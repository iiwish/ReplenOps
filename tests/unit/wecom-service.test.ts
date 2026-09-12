import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { hash } from 'bcryptjs'
import { prisma } from '@/lib/prisma'
import { localAuth } from '@/lib/auth'
import { encryptSecret, randomToken, tokenHash } from '@/lib/wecom/security'
import {
  beginWecom,
  bindWecomWithPassword,
  cancelWecomFlow,
  completeWecom,
  getWecomAdminConfig,
  getWecomAuthOrigin,
  hasPendingWecomBinding,
  prebindWecom,
  saveWecomConfig,
  unbindWecom,
} from '@/services/wecom-auth.service'

const corpId = `wecom-test-${process.pid}`
const actor = `${corpId}-operator`
const password = 'test-only-password'
const origin = 'https://ops.example.test'
let userId = ''
const username = `${corpId}-user`

function mockMember(subjectId = 'member') {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (url: URL) =>
      Response.json(
        url.pathname.endsWith('/gettoken')
          ? { access_token: 'test-token', expires_in: 7200 }
          : { errcode: 0, UserId: subjectId }
      )
    )
  )
}

async function pending(subjectId = 'member') {
  mockMember(subjectId)
  const browser = randomToken()
  const flow = await beginWecom('/mobile/home', browser, origin)
  const result = await completeWecom(flow.state, browser, 'test-code', origin)
  if (result.kind !== 'bind') throw new Error('Expected bind flow')
  return { token: result.token, browser }
}

describe('WeCom transactional identity service', () => {
  beforeAll(async () => {
    const existing = await prisma.wecomAuthConfig.findUnique({ where: { id: 1 } })
    if (existing)
      throw new Error('WeCom integration tests require an unconfigured local test database')
    userId = (
      await prisma.user.create({
        data: {
          username,
          password: await hash(password, 10),
          roles: { create: { role: 'STORE_ADMIN' } },
        },
      })
    ).id
  })
  beforeEach(async () => {
    vi.stubEnv('WECOM_SECRET_KEY', 'ab'.repeat(32))
    vi.stubEnv('WECOM_AUTH_ORIGIN', '')
    await prisma.externalIdentity.deleteMany({ where: { organizationId: corpId } })
    await prisma.wecomAuthChallenge.deleteMany({})
    await prisma.authSession.deleteMany({ where: { userId } })
    await prisma.user.update({ where: { id: userId }, data: { isActive: true, isDeleted: false } })
    const data = {
      corpId,
      agentId: '123',
      publicOrigin: origin,
      encryptedSecret: encryptSecret('test-secret'),
      enabled: true,
      autoLogin: true,
      revision: 1,
    }
    await prisma.wecomAuthConfig.upsert({ where: { id: 1 }, create: data, update: data })
  })
  afterEach(() => {
    vi.restoreAllMocks()
    vi.unstubAllEnvs()
    vi.unstubAllGlobals()
  })
  afterAll(async () => {
    if (!userId) return
    await prisma.approvalLog.deleteMany({ where: { operatedBy: { in: [actor, userId] } } })
    await prisma.wecomAuthChallenge.deleteMany({})
    await prisma.wecomAuthConfig.deleteMany({ where: { corpId } })
    await prisma.userRole.deleteMany({ where: { userId } })
    await prisma.user.delete({ where: { id: userId } })
  })

  it('binds only after password verification, creates a normal revocable local session, and prevents reuse', async () => {
    const flow = await pending()
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
    await expect(
      bindWecomWithPassword(flow.token, flow.browser, username, 'wrong', origin)
    ).rejects.toThrow('用户名或密码错误')
    expect(await prisma.externalIdentity.count({ where: { userId } })).toBe(0)
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
    const result = await bindWecomWithPassword(flow.token, flow.browser, username, password, origin)
    expect((await localAuth.verifyAccessToken(result.tokens.access_token))?.id).toBe(userId)
    expect(result.returnPath).toBe('/mobile/home')
    await expect(
      bindWecomWithPassword(flow.token, flow.browser, username, password, origin)
    ).rejects.toThrow('授权已失效')
    const identity = await prisma.externalIdentity.findFirstOrThrow({ where: { userId } })
    await unbindWecom(identity.id, actor)
    expect(await localAuth.verifyAccessToken(result.tokens.access_token)).toBeNull()
  })

  it('allows prebinding and rejects account/identity conflicts without overwriting', async () => {
    await prebindWecom({ username, subjectId: 'member' }, actor)
    await expect(prebindWecom({ username, subjectId: 'other' }, actor)).rejects.toThrow('已有关联')
    mockMember()
    const browser = randomToken()
    const flow = await beginWecom('/', browser, origin)
    const result = await completeWecom(flow.state, browser, 'code', origin)
    expect(result.kind).toBe('login')
    expect(await prisma.externalIdentity.count({ where: { userId } })).toBe(1)
  })

  it('serializes two simultaneous submissions into exactly one binding and session', async () => {
    const flow = await pending()
    const outcomes = await Promise.allSettled(
      Array.from({ length: 2 }, () =>
        bindWecomWithPassword(flow.token, flow.browser, username, password, origin)
      )
    )
    expect(outcomes.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(await prisma.externalIdentity.count({ where: { userId } })).toBe(1)
    expect(await prisma.authSession.count({ where: { userId } })).toBe(1)
  })

  it('rejects the wrong browser, expired credentials, disabled and deleted local accounts', async () => {
    const flow = await pending()
    await expect(
      bindWecomWithPassword(flow.token, randomToken(), username, password, origin)
    ).rejects.toThrow('授权已失效')
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } })
    await expect(
      bindWecomWithPassword(flow.token, flow.browser, username, password, origin)
    ).rejects.toThrow()
    await prisma.user.update({
      where: { id: userId },
      data: { isActive: false, isDeleted: true, deletedAt: new Date() },
    })
    await expect(
      bindWecomWithPassword(flow.token, flow.browser, username, password, origin)
    ).rejects.toThrow()
    await prisma.wecomAuthChallenge.update({
      where: { id: tokenHash(flow.token) },
      data: { expiresAt: new Date(0) },
    })
    expect(await hasPendingWecomBinding(flow.token, flow.browser)).toBe(false)
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
  })

  it('prevents callback replay before contacting the provider', async () => {
    mockMember()
    const browser = randomToken()
    const flow = await beginWecom('/', browser, origin)
    await completeWecom(flow.state, browser, 'code', origin)
    vi.mocked(fetch).mockClear()
    await expect(completeWecom(flow.state, browser, 'code', origin)).rejects.toThrow('授权已失效')
    expect(fetch).not.toHaveBeenCalled()
  })

  it('invalidates pending bindings on configuration changes and never returns secrets', async () => {
    const flow = await pending()
    await saveWecomConfig(
      {
        corpId,
        publicOrigin: origin,
        agentId: '123',
        enabled: false,
        autoLogin: false,
        revision: 1,
      },
      actor
    )
    await expect(
      bindWecomWithPassword(flow.token, flow.browser, username, password, origin)
    ).rejects.toThrow()
    const config = await getWecomAdminConfig()
    expect(config.enabled).toBe(false)
    expect(config.hasSecret).toBe(true)
    expect(config).not.toHaveProperty('encryptedSecret')
    expect(config).not.toHaveProperty('secret')
    await expect(
      saveWecomConfig(
        {
          corpId,
          publicOrigin: origin,
          agentId: '123',
          enabled: false,
          autoLogin: false,
          revision: 1,
        },
        actor
      )
    ).rejects.toThrow('配置已被更新')
    const logs = await prisma.approvalLog.findMany({ where: { operatedBy: actor } })
    expect(JSON.stringify(logs)).not.toContain('test-secret')
  })

  it.each(['cancel', 'origin-change'])(
    'honors %s while the provider response is in flight',
    async (reason) => {
      let release: (value: Response) => void = () => {
        throw new Error('Request not started')
      }
      let entered: () => void = () => {}
      const waiting = new Promise<void>((resolve) => {
        entered = resolve
      })
      vi.stubGlobal(
        'fetch',
        vi.fn(async (url: URL) => {
          if (url.pathname.endsWith('/gettoken'))
            return Response.json({ access_token: 'test-token', expires_in: 7200 })
          entered()
          return new Promise<Response>((resolve) => {
            release = resolve
          })
        })
      )
      const browser = randomToken()
      const flow = await beginWecom('/', browser, origin)
      const completion = completeWecom(flow.state, browser, 'code', origin)
      const rejected = expect(completion).rejects.toThrow(
        reason === 'cancel' ? '授权已失效' : '配置已变更'
      )
      await waiting
      if (reason === 'cancel') await cancelWecomFlow(flow.state, browser)
      else
        await saveWecomConfig(
          {
            corpId,
            publicOrigin: 'https://changed.example.test',
            agentId: '123',
            enabled: true,
            autoLogin: true,
            revision: 1,
          },
          actor
        )
      release(Response.json({ UserId: 'member' }))
      await rejected
      expect(await prisma.wecomAuthChallenge.count()).toBe(0)
      expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
    }
  )

  it('persists an admin origin without environment setup and invalidates pending OAuth and binding', async () => {
    const flow = await pending()
    const browser = randomToken()
    const oauth = await beginWecom('/', browser, origin)
    const publicOrigin = 'https://changed.example.test'
    await saveWecomConfig(
      {
        corpId,
        publicOrigin: `${publicOrigin}/`,
        agentId: '123',
        enabled: true,
        autoLogin: true,
        revision: 1,
      },
      actor
    )
    expect(await getWecomAuthOrigin()).toBe(publicOrigin)
    const config = await getWecomAdminConfig()
    expect(config.publicOrigin).toBe(publicOrigin)
    expect(config.callbackUrl).toBe(`${publicOrigin}/api/auth/wecom/callback`)
    expect(config.revision).toBe(2)
    expect(await hasPendingWecomBinding(flow.token, flow.browser)).toBe(false)
    await expect(completeWecom(oauth.state, browser, 'code', publicOrigin)).rejects.toThrow(
      '授权已失效'
    )
    await expect(beginWecom('/', browser, origin)).rejects.toThrow('公开登录地址已变更')
    const next = await beginWecom('/', browser, publicOrigin)
    expect(new URL(next.url).searchParams.get('redirect_uri')).toBe(config.callbackUrl)
    const audit = await prisma.approvalLog.findFirstOrThrow({
      where: { operatedBy: actor, action: 'wecom_config' },
      orderBy: { createdAt: 'desc' },
    })
    expect(audit.afterJson).toMatchObject({ publicOrigin })
  })

  it('uses the environment only for an empty database address, and stores it when saved', async () => {
    await prisma.wecomAuthConfig.update({ where: { id: 1 }, data: { publicOrigin: '' } })
    vi.stubEnv('WECOM_AUTH_ORIGIN', origin)
    const config = await getWecomAdminConfig()
    expect(config.publicOrigin).toBe(origin)
    expect(await getWecomAuthOrigin()).toBe(origin)
    await saveWecomConfig({ ...config, secret: '' }, actor)
    vi.stubEnv('WECOM_AUTH_ORIGIN', 'https://other.example.test')
    expect(await getWecomAuthOrigin()).toBe(origin)
  })

  it('rejects invalid admin addresses without altering the config', async () => {
    await expect(
      saveWecomConfig(
        {
          corpId,
          publicOrigin: 'https://ops.example.test/path',
          agentId: '123',
          enabled: true,
          autoLogin: true,
          revision: 1,
        },
        actor
      )
    ).rejects.toThrow()
    expect((await getWecomAdminConfig()).revision).toBe(1)
    expect(await getWecomAuthOrigin()).toBe(origin)
  })

  it('rechecks the request origin inside the password-binding transaction', async () => {
    const flow = await pending()
    await expect(
      bindWecomWithPassword(
        flow.token,
        flow.browser,
        username,
        password,
        'https://stale.example.test'
      )
    ).rejects.toThrow('公开登录地址已变更')
    expect(await hasPendingWecomBinding(flow.token, flow.browser)).toBe(true)
    expect(await prisma.externalIdentity.count({ where: { userId } })).toBe(0)
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
  })

  it('does not log in a disabled prebound user', async () => {
    await prebindWecom({ username, subjectId: 'member' }, actor)
    await prisma.user.update({ where: { id: userId }, data: { isActive: false } })
    mockMember()
    const browser = randomToken()
    const flow = await beginWecom('/', browser, origin)
    await expect(completeWecom(flow.state, browser, 'code', origin)).rejects.toThrow('账号不可用')
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
  })

  it('rolls back the mapping, audit and challenge consumption if session issuance fails', async () => {
    const flow = await pending()
    vi.spyOn(localAuth, 'generateTokens').mockRejectedValueOnce(
      new Error('Synthetic session failure')
    )
    await expect(
      bindWecomWithPassword(flow.token, flow.browser, username, password, origin)
    ).rejects.toThrow('Synthetic session failure')
    expect(await prisma.externalIdentity.count({ where: { userId } })).toBe(0)
    expect(await hasPendingWecomBinding(flow.token, flow.browser)).toBe(true)
    expect(await prisma.authSession.count({ where: { userId } })).toBe(0)
  })
})
