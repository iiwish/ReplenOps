import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { proxy } from '@/proxy'

const authMocks = vi.hoisted(() => ({
  verifyToken: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

vi.mock('@/lib/auth-edge', () => ({
  verifyToken: authMocks.verifyToken,
  refreshAccessToken: authMocks.refreshAccessToken,
}))

const originalEnv = {
  ADMIN_HOSTS: process.env.ADMIN_HOSTS,
  MOBILE_HOSTS: process.env.MOBILE_HOSTS,
  CANONICAL_ADMIN_HOST: process.env.CANONICAL_ADMIN_HOST,
  CANONICAL_MOBILE_HOST: process.env.CANONICAL_MOBILE_HOST,
  APP_ENV: process.env.APP_ENV,
  COOKIE_DOMAIN: process.env.COOKIE_DOMAIN,
}

function restoreEnv(key: keyof typeof originalEnv) {
  const value = originalEnv[key]
  if (value === undefined) {
    delete process.env[key]
    return
  }

  process.env[key] = value
}

function request(url: string, cookie?: string, headers?: Record<string, string>) {
  return new NextRequest(url, {
    headers: { ...(cookie ? { cookie } : {}), ...headers },
  })
}

function authUser(roles: string[]) {
  return {
    id: 'user-1',
    username: 'store-user',
    name: null,
    email: null,
    phone: null,
    avatar: null,
    isActive: true,
    roles,
  }
}

describe('proxy domain routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.ADMIN_HOSTS = 'admin.example.com,admin.test.example.com'
    process.env.MOBILE_HOSTS = 'mobile.example.com,mobile.test.example.com'
    process.env.CANONICAL_ADMIN_HOST = 'admin.test.example.com'
    process.env.CANONICAL_MOBILE_HOST = 'mobile.test.example.com'
    process.env.APP_ENV = 'preview'
    delete process.env.COOKIE_DOMAIN
    authMocks.verifyToken.mockResolvedValue(authUser(['STORE_ADMIN']))
    authMocks.refreshAccessToken.mockResolvedValue({
      access_token: 'rotated-access-token',
      refresh_token: 'rotated-refresh-token',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read',
    })
  })

  afterEach(() => {
    restoreEnv('ADMIN_HOSTS')
    restoreEnv('MOBILE_HOSTS')
    restoreEnv('CANONICAL_ADMIN_HOST')
    restoreEnv('CANONICAL_MOBILE_HOST')
    restoreEnv('APP_ENV')
    restoreEnv('COOKIE_DOMAIN')
  })

  it('routes configured root hosts to their default platform entry', async () => {
    const adminResponse = await proxy(request('https://admin.test.example.com/'))
    const mobileResponse = await proxy(request('https://mobile.test.example.com/'))

    expect(adminResponse.headers.get('location')).toBe('https://admin.test.example.com/admin')
    expect(mobileResponse.headers.get('location')).toBe('https://mobile.test.example.com/mobile')
  })

  it('redirects cross-platform paths to the canonical platform host', async () => {
    const mobileOnAdmin = await proxy(
      request('https://admin.test.example.com/mobile/orders?redirect=%2Fmobile%2Fhome')
    )
    const adminOnMobile = await proxy(
      request('https://mobile.test.example.com/admin/orders/123?tab=items')
    )

    expect(mobileOnAdmin.headers.get('location')).toBe(
      'https://mobile.test.example.com/mobile/orders?redirect=%2Fmobile%2Fhome'
    )
    expect(adminOnMobile.headers.get('location')).toBe(
      'https://admin.test.example.com/admin/orders/123?tab=items'
    )
  })

  it('keeps localhost on the same host and preserves full login redirect paths', async () => {
    const response = await proxy(request('http://localhost:3001/admin/orders/1?tab=items'))
    const location = response.headers.get('location')

    expect(location).toBe(
      'http://localhost:3001/login?redirect=%2Fadmin%2Forders%2F1%3Ftab%3Ditems'
    )
  })

  it('does not bypass API RBAC after refreshing an expiring access token', async () => {
    const staleSessionCookie = [
      'replenops_access_token=stale-access-token',
      'replenops_refresh_token=valid-refresh-token',
      `replenops_expires_at=${Date.now() - 1000}`,
    ].join('; ')

    const response = await proxy(
      request('https://admin.test.example.com/api/users', staleSessionCookie)
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'You do not have permission to access this resource',
    })
    expect(response.headers.get('set-cookie')).toContain(
      'replenops_refresh_token=rotated-refresh-token'
    )
  })

  it('forwards refreshed cookies to the protected route in the same request', async () => {
    const staleSessionCookie = [
      'replenops_access_token=stale-access-token',
      'replenops_refresh_token=valid-refresh-token',
      `replenops_expires_at=${Date.now() - 1000}`,
    ].join('; ')

    const response = await proxy(
      request('https://mobile.test.example.com/api/ordering-schedule/status', staleSessionCookie)
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      'replenops_access_token=rotated-access-token'
    )
    expect(response.headers.get('x-middleware-request-cookie')).toContain(
      'replenops_refresh_token=rotated-refresh-token'
    )
  })

  it('turns an unauthenticated server action into a client navigation', async () => {
    authMocks.verifyToken.mockResolvedValue(null)

    const response = await proxy(
      request(
        'https://admin.test.example.com/admin/orders/1?tab=items',
        `replenops_access_token=revoked; replenops_expires_at=${Date.now() + 60_000}`,
        { 'next-action': 'action-id' }
      )
    )

    expect(response.status).toBe(200)
    expect(response.headers.get('x-action-redirect')).toBe(
      '/login?redirect=%2Fadmin%2Forders%2F1%3Ftab%3Ditems;replace'
    )
  })

  it('keeps the register API disabled before authentication checks', async () => {
    const response = await proxy(request('https://admin.test.example.com/api/auth/register'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ success: false, error: '注册接口不可用' })
  })

  it.each(['/api/auth/session', '/'])(
    'renews cookies at the request boundary for %s',
    async (path) => {
      const response = await proxy(
        request(
          `http://localhost:3001${path}`,
          `replenops_access_token=old; replenops_refresh_token=refresh; replenops_expires_at=${Date.now() - 1000}`
        )
      )
      expect(authMocks.refreshAccessToken).toHaveBeenCalledWith('refresh')
      expect(response.headers.get('set-cookie')).toContain('rotated-refresh-token')
      expect(response.headers.get('x-middleware-request-cookie')).toContain('rotated-access-token')
    }
  )

  it('recovers a missing access cookie using a valid refresh token', async () => {
    const response = await proxy(
      request('http://localhost:3001/mobile', 'replenops_refresh_token=refresh')
    )
    expect(response.status).toBe(200)
    expect(authMocks.refreshAccessToken).toHaveBeenCalledWith('refresh')
    expect(response.headers.get('set-cookie')).toContain('rotated-access-token')
  })

  it('returns a retryable failure instead of logging out on a refresh outage', async () => {
    authMocks.refreshAccessToken.mockRejectedValue(new Error('database unavailable'))
    const response = await proxy(
      request(
        'http://localhost:3001/api/auth/session',
        `replenops_access_token=old; replenops_refresh_token=refresh; replenops_expires_at=${Date.now() - 1000}`
      )
    )
    expect(response.status).toBe(503)
    expect(response.headers.get('location')).toBeNull()
  })

  it.each(['missing', 'invalid', 'future'])(
    'renews expired access despite %s expiry metadata',
    async (metadata) => {
      authMocks.verifyToken.mockResolvedValueOnce(null)
      const marker =
        metadata === 'missing'
          ? ''
          : `; replenops_expires_at=${metadata === 'future' ? Date.now() + 3_600_000 : 'invalid'}`
      const response = await proxy(
        request(
          'http://localhost:3001/api/auth/session',
          `replenops_access_token=expired; replenops_refresh_token=refresh${marker}`
        )
      )
      expect(response.status).toBe(200)
      expect(authMocks.refreshAccessToken).toHaveBeenCalledWith('refresh')
      expect(response.headers.get('set-cookie')).toContain('rotated-access-token')
    }
  )

  it('returns 503 rather than 401 when verification cannot reach the database', async () => {
    authMocks.verifyToken.mockRejectedValue(new Error('database unavailable'))
    const response = await proxy(
      request('http://localhost:3001/api/auth/session', 'replenops_access_token=access')
    )
    expect(response.status).toBe(503)
  })

  it('allows store_admin to read ordering schedule status for mobile reminders', async () => {
    const sessionCookie = [
      'replenops_access_token=valid-access-token',
      `replenops_expires_at=${Date.now() + 60 * 60 * 1000}`,
    ].join('; ')

    const response = await proxy(
      request('https://admin.test.example.com/api/ordering-schedule/status', sessionCookie)
    )

    expect(response.status).toBe(200)
  })
})
