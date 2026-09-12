import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { randomToken, BROWSER_COOKIE, FLOW_COOKIE } from '@/lib/wecom/security'

const mocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  currentUser: vi.fn(),
  setSession: vi.fn(),
  complete: vi.fn(),
  bind: vi.fn(),
  check: vi.fn(),
  record: vi.fn(),
  clear: vi.fn(),
  cancel: vi.fn(),
  permission: vi.fn(),
  save: vi.fn(),
  prebind: vi.fn(),
  unbind: vi.fn(),
  list: vi.fn(),
  test: vi.fn(),
}))
vi.mock('next/headers', () => ({ cookies: mocks.cookies }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/session', () => ({
  getCurrentUser: mocks.currentUser,
  setSession: mocks.setSession,
}))
vi.mock('@/lib/action-permissions', () => ({ requireActionPermission: mocks.permission }))
vi.mock('@/services/wecom-auth.service', () => ({
  getWecomAuthOrigin: async () => 'https://ops.example.test',
  completeWecom: mocks.complete,
  bindWecomWithPassword: mocks.bind,
  cancelWecomFlow: mocks.cancel,
  saveWecomConfig: mocks.save,
  prebindWecom: mocks.prebind,
  unbindWecom: mocks.unbind,
  listWecomBindings: mocks.list,
  testWecomConfig: mocks.test,
}))
vi.mock('@/services/auth-rate-limit.service', () => ({
  authRateLimitService: { check: mocks.check, recordFailure: mocks.record, clear: mocks.clear },
  createLoginRateLimitKey: (value: string) => value,
  getLoginClientAddress: () => 'test-address',
}))

const origin = 'https://ops.example.test'
let flow = ''
let browser = ''
const setter = vi.fn()
beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('WECOM_AUTH_ORIGIN', origin)
  flow = randomToken()
  browser = randomToken()
  mocks.cookies.mockResolvedValue({
    get: (name: string) => ({
      value: name === FLOW_COOKIE ? flow : name === BROWSER_COOKIE ? browser : '',
    }),
    set: setter,
  })
  mocks.currentUser.mockResolvedValue(null)
  mocks.check.mockResolvedValue({ allowed: true })
  mocks.record.mockResolvedValue({ allowed: true })
  mocks.permission.mockResolvedValue({ id: 'admin' })
})
afterEach(() => vi.unstubAllEnvs())

describe('WeCom HTTP and permission boundaries', () => {
  it('uses the preserved Host behind a proxy and ignores untrusted forwarded hosts', async () => {
    const { requestOrigin, localRedirect } = await import('@/lib/wecom/http')
    const request = new NextRequest('https://127.0.0.1:3202/api/auth/wecom/callback', {
      headers: { host: 'ops.example.test', 'x-forwarded-host': 'attacker.example' },
    })
    expect(requestOrigin(request)).toBe(origin)
    expect(localRedirect('/login?local=1').headers.get('location')).toBe('/login?local=1')
    expect(() => localRedirect('//attacker.example')).toThrow()
  })

  it('never exchanges a code when OAuth state does not match the browser cookie', async () => {
    const { GET } = await import('@/app/api/auth/wecom/callback/route')
    const response = await GET(
      new NextRequest(`${origin}/api/auth/wecom/callback?state=${randomToken()}&code=code`)
    )
    expect(response.headers.get('location')).toContain('/login?wecomError=1&local=1')
    expect(mocks.complete).not.toHaveBeenCalled()
    expect(response.headers.get('referrer-policy')).toBe('no-referrer')
    expect(response.headers.get('cache-control')).toBe('no-store')
  })

  it('passes a verified callback to the binding page without leaking the binding token', async () => {
    const { GET } = await import('@/app/api/auth/wecom/callback/route')
    const token = randomToken()
    mocks.complete.mockResolvedValue({ kind: 'bind', token })
    const response = await GET(
      new NextRequest(`${origin}/api/auth/wecom/callback?state=${flow}&code=code`)
    )
    expect(mocks.complete).toHaveBeenCalledWith(flow, browser, 'code', origin)
    expect(response.headers.get('location')).toBe('/login/wecom-bind')
    expect(setter).toHaveBeenCalledWith(
      FLOW_COOKIE,
      token,
      expect.objectContaining({ httpOnly: true, sameSite: 'lax', maxAge: 300 })
    )
    expect(mocks.setSession).not.toHaveBeenCalled()
  })

  it('rejects cross-origin binding and exhausted limits before verifying passwords', async () => {
    const { POST } = await import('@/app/api/auth/wecom/bind/route')
    const request = (source: string) =>
      new NextRequest(`${origin}/api/auth/wecom/bind`, {
        method: 'POST',
        headers: { origin: source },
        body: JSON.stringify({ identifier: 'test-user', password: 'password' }),
      })
    expect((await POST(request('https://evil.test'))).status).toBe(403)
    mocks.check.mockResolvedValue({ allowed: false, retryAfterSeconds: 90 })
    const limited = await POST(request(origin))
    expect(limited.status).toBe(429)
    expect(limited.headers.get('retry-after')).toBe('90')
    expect(mocks.bind).not.toHaveBeenCalled()
  })

  it('sets local session cookies only after successful binding, never returns tokens', async () => {
    const { POST } = await import('@/app/api/auth/wecom/bind/route')
    mocks.bind.mockResolvedValue({
      tokens: { access_token: 'access', refresh_token: 'refresh', expires_in: 3600 },
      returnPath: '/mobile/home',
    })
    const result = await POST(
      new NextRequest(`${origin}/api/auth/wecom/bind`, {
        method: 'POST',
        headers: { origin },
        body: JSON.stringify({ identifier: 'user', password: 'password' }),
      })
    )
    expect(await result.json()).toEqual({ success: true, redirect: '/mobile/home' })
    expect(mocks.setSession).toHaveBeenCalledWith('access', 'refresh', 3600)
  })

  it('guards every administrator action independently of navigation and proxy', async () => {
    const actions = await import('@/actions/wecom-actions')
    mocks.permission.mockRejectedValue(new Error('Not authorized'))
    for (const call of [
      () => actions.saveWecomSettings({}),
      () => actions.createWecomBinding({}),
      () => actions.removeWecomBinding('id'),
      () => actions.checkWecomConnection(),
    ]) {
      expect((await call()).success).toBe(false)
    }
    await expect(actions.searchWecomBindings('', 1)).rejects.toThrow()
    for (const operation of [mocks.save, mocks.prebind, mocks.unbind, mocks.list, mocks.test])
      expect(operation).not.toHaveBeenCalled()
  })
})
