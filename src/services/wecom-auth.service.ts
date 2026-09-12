import { Prisma } from '@prisma/client'
import { compare } from 'bcryptjs'
import { z } from 'zod'
import { prisma } from '@/lib/prisma'
import { localAuth } from '@/lib/auth'
import {
  authOrigin,
  decryptSecret,
  encryptSecret,
  randomToken,
  safeReturnPath,
  tokenHash,
  validToken,
  WecomError,
} from '@/lib/wecom/security'
import { buildAuthorizationUrl, checkCredentials, exchangeCode } from '@/lib/wecom/provider'

const TTL = 5 * 60 * 1000
const configSchema = z.object({
  publicOrigin: z.string().trim().min(1, '请填写公开登录地址').max(2048),
  corpId: z
    .string()
    .trim()
    .regex(/^[\w-]{1,128}$/, '企业 ID 格式无效'),
  agentId: z
    .string()
    .trim()
    .regex(/^\d{1,20}$/, 'AgentId 必须为数字'),
  secret: z.string().trim().max(512).default(''),
  enabled: z.boolean(),
  autoLogin: z.boolean(),
  revision: z.number().int().nonnegative(),
})
const bindingSchema = z.object({
  username: z.string().trim().min(1).max(50),
  subjectId: z
    .string()
    .trim()
    .regex(/^[a-zA-Z0-9_@.\-]{1,128}$/, '成员 UserID 格式无效'),
})

async function lockedConfig(tx: Prisma.TransactionClient, enabled = true) {
  await tx.$queryRaw`SELECT "id" FROM "wecom_auth_config" WHERE "id" = 1 FOR UPDATE`
  const config = await tx.wecomAuthConfig.findUnique({ where: { id: 1 } })
  if (!config || (enabled && !config.enabled)) throw new WecomError('企业微信登录未启用')
  return config
}

async function activeUser(tx: Prisma.TransactionClient, userId: string) {
  await tx.$queryRaw`SELECT "id" FROM "users" WHERE "id" = ${userId} FOR UPDATE`
  const user = await tx.user.findUnique({ where: { id: userId }, include: { roles: true } })
  if (!user || !user.isActive || user.isDeleted || !user.roles.length)
    throw new WecomError('账号不可用，请联系管理员')
  return user
}

async function issueSession(tx: Prisma.TransactionClient, userId: string) {
  const user = await activeUser(tx, userId)
  return localAuth.generateTokens(
    {
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
      roles: user.roles.map((role) => role.role),
    },
    user.sessionVersion,
    tx
  )
}

async function audit(
  tx: Prisma.TransactionClient,
  actor: string,
  action: string,
  entityId: string,
  afterJson?: Prisma.InputJsonValue
) {
  await tx.approvalLog.create({
    data: { entityType: 'IDENTITY_AUTH', entityId, action, operatedBy: actor, afterJson },
  })
}

async function insertBinding(
  tx: Prisma.TransactionClient,
  corpId: string,
  subjectId: string,
  userId: string,
  actor: string
) {
  await activeUser(tx, userId)
  const conflict = await tx.externalIdentity.findFirst({
    where: { provider: 'wecom', organizationId: corpId, OR: [{ subjectId }, { userId }] },
  })
  if (conflict)
    throw new WecomError('该企业微信身份或系统账号已有关联，请联系管理员，不能覆盖现有绑定')
  const binding = await tx.externalIdentity.create({
    data: { provider: 'wecom', organizationId: corpId, subjectId, userId, createdBy: actor },
  })
  await audit(tx, actor, 'wecom_bind', binding.id, { userId, organizationId: corpId, subjectId })
  return binding
}

export async function getWecomAdminConfig() {
  const config = await prisma.wecomAuthConfig.findUnique({ where: { id: 1 } })
  let origin = ''
  let readinessError = ''
  try {
    origin = authOrigin(config?.publicOrigin)
  } catch {
    /* The administrator can fill or correct the address in the form. */
  }
  try {
    if (config?.encryptedSecret) decryptSecret(config.encryptedSecret)
    else encryptSecret('readiness-check')
  } catch (error) {
    readinessError = error instanceof WecomError ? error.message : '部署配置不可用'
  }
  return {
    corpId: config?.corpId ?? '',
    agentId: config?.agentId ?? '',
    enabled: config?.enabled ?? false,
    autoLogin: config?.autoLogin ?? false,
    revision: config?.revision ?? 0,
    hasSecret: Boolean(config?.encryptedSecret),
    publicOrigin: config?.publicOrigin || process.env.WECOM_AUTH_ORIGIN || '',
    allowLocalHttp: process.env.NODE_ENV !== 'production',
    callbackUrl: origin ? `${origin}/api/auth/wecom/callback` : '',
    readinessError,
  }
}

export async function getWecomLoginOptions() {
  try {
    if (!process.env.DATABASE_URL) return { enabled: false, autoLogin: false }
    const config = await prisma.wecomAuthConfig.findUnique({ where: { id: 1 } })
    authOrigin(config?.publicOrigin)
    return {
      enabled: Boolean(config?.enabled),
      autoLogin: Boolean(config?.enabled && config.autoLogin),
    }
  } catch {
    return { enabled: false, autoLogin: false }
  }
}

export async function getWecomAuthOrigin() {
  const config = await prisma.wecomAuthConfig.findUnique({
    where: { id: 1 },
    select: { publicOrigin: true },
  })
  return authOrigin(config?.publicOrigin)
}

function requireConfiguredOrigin(publicOrigin: string, requestOrigin: string) {
  const origin = authOrigin(publicOrigin)
  if (origin !== requestOrigin) throw new WecomError('公开登录地址已变更，请重新进行企业微信登录')
  return origin
}

export async function saveWecomConfig(input: unknown, actor: string) {
  const data = configSchema.parse(input)
  const publicOrigin = authOrigin(data.publicOrigin)
  return prisma.$transaction(async (tx) => {
    await tx.wecomAuthConfig.upsert({ where: { id: 1 }, create: { id: 1 }, update: {} })
    const config = await lockedConfig(tx, false)
    if (config.revision !== data.revision) throw new WecomError('配置已被更新，请刷新后重试')
    if ((config.corpId !== data.corpId || config.agentId !== data.agentId) && !data.secret)
      throw new WecomError('更换企业或应用时必须填写对应 Secret')
    const encryptedSecret = data.secret ? encryptSecret(data.secret) : config.encryptedSecret
    if (!encryptedSecret) throw new WecomError('请填写应用 Secret')
    if (data.enabled) decryptSecret(encryptedSecret)
    await tx.wecomAuthConfig.update({
      where: { id: 1 },
      data: {
        corpId: data.corpId,
        publicOrigin,
        agentId: data.agentId,
        enabled: data.enabled,
        autoLogin: data.autoLogin,
        encryptedSecret,
        revision: { increment: 1 },
      },
    })
    await tx.wecomAuthChallenge.deleteMany({})
    await audit(tx, actor, 'wecom_config', 'wecom', {
      corpId: data.corpId,
      publicOrigin,
      agentId: data.agentId,
      enabled: data.enabled,
      autoLogin: data.autoLogin,
      secretChanged: Boolean(data.secret),
    })
  })
}

export async function testWecomConfig() {
  const config = await prisma.wecomAuthConfig.findUnique({ where: { id: 1 } })
  if (!config) throw new WecomError('请先保存企业微信配置')
  authOrigin(config.publicOrigin)
  await checkCredentials({ corpId: config.corpId, secret: decryptSecret(config.encryptedSecret) })
}

export async function listWecomBindings(query = '', page = 1) {
  const where: Prisma.ExternalIdentityWhereInput = {
    provider: 'wecom',
    ...(query
      ? { OR: [{ subjectId: { contains: query } }, { user: { username: { contains: query } } }] }
      : {}),
  }
  const [items, total] = await prisma.$transaction([
    prisma.externalIdentity.findMany({
      where,
      select: {
        id: true,
        organizationId: true,
        subjectId: true,
        createdAt: true,
        user: { select: { id: true, username: true, name: true, isActive: true, isDeleted: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
      take: 20,
      skip: (page - 1) * 20,
    }),
    prisma.externalIdentity.count({ where }),
  ])
  return { items, total }
}

export async function prebindWecom(input: unknown, actor: string) {
  const data = bindingSchema.parse(input)
  return prisma.$transaction(async (tx) => {
    const config = await lockedConfig(tx, false)
    if (!config.corpId) throw new WecomError('请先配置企业 ID')
    const user = await tx.user.findUnique({ where: { username: data.username } })
    if (!user) throw new WecomError('系统用户名不存在')
    await insertBinding(tx, config.corpId, data.subjectId, user.id, actor)
    // Invalidate pending assertions to prevent a concurrent self-binding from changing this grant.
    await tx.wecomAuthConfig.update({ where: { id: 1 }, data: { revision: { increment: 1 } } })
    await tx.wecomAuthChallenge.deleteMany({})
  })
}

export async function unbindWecom(id: string, actor: string) {
  return prisma.$transaction(async (tx) => {
    await lockedConfig(tx, false)
    const binding = await tx.externalIdentity.findUnique({ where: { id } })
    if (!binding || binding.provider !== 'wecom') throw new WecomError('绑定记录不存在')
    await tx.user.update({
      where: { id: binding.userId },
      data: { sessionVersion: { increment: 1 } },
    })
    await tx.authSession.deleteMany({ where: { userId: binding.userId } })
    await tx.externalIdentity.delete({ where: { id } })
    await tx.wecomAuthConfig.update({ where: { id: 1 }, data: { revision: { increment: 1 } } })
    await tx.wecomAuthChallenge.deleteMany({})
    await audit(tx, actor, 'wecom_unbind', id, {
      userId: binding.userId,
      organizationId: binding.organizationId,
      subjectId: binding.subjectId,
    })
  })
}

export async function beginWecom(
  returnPath: string,
  browser: string,
  requestOrigin: string,
  previousFlow?: string
) {
  const state = randomToken()
  const url = await prisma.$transaction(async (tx) => {
    const config = await lockedConfig(tx)
    const origin = requireConfiguredOrigin(config.publicOrigin, requestOrigin)
    decryptSecret(config.encryptedSecret)
    await tx.wecomAuthChallenge.deleteMany({
      where: {
        OR: [
          { expiresAt: { lte: new Date() } },
          ...(previousFlow
            ? [{ id: tokenHash(previousFlow), browserHash: tokenHash(browser) }]
            : []),
        ],
      },
    })
    await tx.wecomAuthChallenge.create({
      data: {
        id: tokenHash(state),
        browserHash: tokenHash(browser),
        stage: 'oauth',
        revision: config.revision,
        returnPath: safeReturnPath(returnPath),
        expiresAt: new Date(Date.now() + TTL),
      },
    })
    return buildAuthorizationUrl(config, `${origin}/api/auth/wecom/callback`, state)
  })
  return { state, url }
}

async function consumeChallenge(
  tx: Prisma.TransactionClient,
  token: string,
  browser: string,
  stage: 'oauth' | 'exchange' | 'bind',
  revision: number
) {
  if (!validToken(token) || !validToken(browser))
    throw new WecomError('授权已失效，请重新进行企业微信登录')
  const challenge = await tx.wecomAuthChallenge.findUnique({ where: { id: tokenHash(token) } })
  if (
    !challenge ||
    challenge.browserHash !== tokenHash(browser) ||
    challenge.stage !== stage ||
    challenge.revision !== revision ||
    challenge.expiresAt <= new Date()
  )
    throw new WecomError('授权已失效，请重新进行企业微信登录')
  await tx.wecomAuthChallenge.delete({ where: { id: challenge.id } })
  return challenge
}

export async function completeWecom(
  state: string,
  browser: string,
  code: string,
  requestOrigin: string
) {
  const assertion = await prisma.$transaction(async (tx) => {
    const config = await lockedConfig(tx)
    requireConfiguredOrigin(config.publicOrigin, requestOrigin)
    const challenge = await consumeChallenge(tx, state, browser, 'oauth', config.revision)
    // Keep a cancellable marker while waiting for the upstream identity response.
    await tx.wecomAuthChallenge.create({ data: { ...challenge, stage: 'exchange' } })
    return { config, challenge }
  })
  const subjectId = await exchangeCode(
    { corpId: assertion.config.corpId, secret: decryptSecret(assertion.config.encryptedSecret) },
    code
  )
  return prisma.$transaction(async (tx) => {
    const config = await lockedConfig(tx)
    if (config.revision !== assertion.config.revision)
      throw new WecomError('配置已变更，请重新登录')
    requireConfiguredOrigin(config.publicOrigin, requestOrigin)
    await consumeChallenge(tx, state, browser, 'exchange', config.revision)
    const binding = await tx.externalIdentity.findUnique({
      where: {
        provider_organizationId_subjectId: {
          provider: 'wecom',
          organizationId: config.corpId,
          subjectId,
        },
      },
    })
    if (binding) {
      const tokens = await issueSession(tx, binding.userId)
      return { kind: 'login' as const, tokens, returnPath: assertion.challenge.returnPath }
    }
    const token = randomToken()
    await tx.wecomAuthChallenge.create({
      data: {
        id: tokenHash(token),
        browserHash: tokenHash(browser),
        revision: config.revision,
        stage: 'bind',
        subjectId,
        returnPath: assertion.challenge.returnPath,
        expiresAt: new Date(Date.now() + TTL),
      },
    })
    return { kind: 'bind' as const, token }
  })
}

export async function hasPendingWecomBinding(token: string, browser: string) {
  if (!validToken(token) || !validToken(browser)) return false
  const config = await prisma.wecomAuthConfig.findUnique({ where: { id: 1 } })
  if (!config?.enabled) return false
  return Boolean(
    await prisma.wecomAuthChallenge.findFirst({
      where: {
        id: tokenHash(token),
        browserHash: tokenHash(browser),
        stage: 'bind',
        revision: config.revision,
        expiresAt: { gt: new Date() },
      },
    })
  )
}

export async function bindWecomWithPassword(
  token: string,
  browser: string,
  identifier: string,
  password: string,
  requestOrigin: string
) {
  // Verify the password without issuing a session. Recheck the exact hash and account under lock.
  if (!(await hasPendingWecomBinding(token, browser)))
    throw new WecomError('授权已失效，请重新进行企业微信登录')
  const candidate = await prisma.user.findFirst({
    where: {
      OR: [{ username: identifier }, { phone: identifier }],
      isActive: true,
      isDeleted: false,
    },
  })
  if (!candidate || !(await compare(password, candidate.password)))
    throw new WecomError('用户名或密码错误')
  return prisma.$transaction(async (tx) => {
    const config = await lockedConfig(tx)
    const challenge = await consumeChallenge(tx, token, browser, 'bind', config.revision)
    requireConfiguredOrigin(config.publicOrigin, requestOrigin)
    const user = await activeUser(tx, candidate.id)
    if (user.password !== candidate.password || user.sessionVersion !== candidate.sessionVersion)
      throw new WecomError('账号已变更，请重新验证')
    if (!challenge.subjectId) throw new WecomError('授权已失效，请重新登录')
    await insertBinding(tx, config.corpId, challenge.subjectId, user.id, user.id)
    const tokens = await issueSession(tx, user.id)
    return { tokens, returnPath: challenge.returnPath }
  })
}

export async function cancelWecomFlow(token: string, browser: string) {
  if (!validToken(token) || !validToken(browser)) return
  await prisma.wecomAuthChallenge.deleteMany({
    where: { id: tokenHash(token), browserHash: tokenHash(browser) },
  })
}
