import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { NextRequest } from 'next/server'
import { SignJWT } from 'jose'
import { proxy } from '@/proxy'
import { getJwtSecret } from '@/lib/jwt-secret'

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

function request(url: string, cookie?: string) {
  return new NextRequest(url, {
    headers: cookie ? { cookie } : {},
  })
}

async function createToken(roles: string[]) {
  const now = Math.floor(Date.now() / 1000)

  return new SignJWT({
    userId: 'user-1',
    username: 'store-user',
    roles,
    exp: now + 60 * 60,
    iat: now,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .sign(getJwtSecret())
}

describe('proxy domain routing', () => {
  beforeEach(() => {
    process.env.ADMIN_HOSTS = 'admin.example.com,admin.test.example.com'
    process.env.MOBILE_HOSTS = 'mobile.example.com,mobile.test.example.com'
    process.env.CANONICAL_ADMIN_HOST = 'admin.test.example.com'
    process.env.CANONICAL_MOBILE_HOST = 'mobile.test.example.com'
    process.env.APP_ENV = 'preview'
    delete process.env.COOKIE_DOMAIN
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
    const refreshToken = await createToken(['STORE_ADMIN'])
    const staleSessionCookie = [
      'replenops_access_token=stale-access-token',
      `replenops_refresh_token=${refreshToken}`,
      `replenops_expires_at=${Date.now() - 1000}`,
    ].join('; ')

    const response = await proxy(
      request('https://admin.test.example.com/api/users', staleSessionCookie)
    )

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({
      error: 'You do not have permission to access this resource',
    })
  })

  it('keeps the register API disabled before authentication checks', async () => {
    const response = await proxy(request('https://admin.test.example.com/api/auth/register'))

    expect(response.status).toBe(404)
    expect(await response.json()).toEqual({ success: false, error: '注册接口不可用' })
  })

  it('allows store_admin to read ordering schedule status for mobile reminders', async () => {
    const accessToken = await createToken(['STORE_ADMIN'])
    const sessionCookie = [
      `replenops_access_token=${accessToken}`,
      `replenops_expires_at=${Date.now() + 60 * 60 * 1000}`,
    ].join('; ')

    const response = await proxy(
      request('https://admin.test.example.com/api/ordering-schedule/status', sessionCookie)
    )

    expect(response.status).toBe(200)
  })
})
