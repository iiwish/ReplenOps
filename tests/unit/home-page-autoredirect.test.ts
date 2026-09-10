import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { headers } from 'next/headers'
import { getCurrentUser } from '@/lib/session'
import HomePage, { AutoRedirect } from '@/app/page'

vi.mock('next/headers', () => ({ headers: vi.fn() }))
vi.mock('@/lib/session', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/session')>()),
  getCurrentUser: vi.fn(),
}))

function setDevice(userAgent: string) {
  vi.mocked(headers).mockResolvedValue(
    new Headers({
      host: 'entry.example.com',
      'x-forwarded-proto': 'https',
      'user-agent': userAgent,
    })
  )
}

function setRoles(roles: string[]) {
  vi.mocked(getCurrentUser).mockResolvedValue({
    id: 'home-user',
    username: 'home-user',
    name: 'Home User',
    email: null,
    phone: null,
    avatar: null,
    isActive: true,
    roles,
  })
}

describe('home page auto redirect', () => {
  beforeEach(() => {
    vi.stubEnv('APP_ENV', 'production')
    vi.stubEnv('CANONICAL_ADMIN_HOST', 'admin.example.com')
    vi.stubEnv('CANONICAL_MOBILE_HOST', 'mobile.example.com')
    setDevice('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)')
    setRoles(['SUPER_ADMIN'])
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('uses the canonical platform URL instead of a relative platform path', () => {
    const markup = renderToStaticMarkup(
      createElement(AutoRedirect, {
        targetUrl: 'https://mobile.test.example.com/mobile',
      })
    )

    expect(markup).toContain('window.location.href = "https://mobile.test.example.com/mobile"')
    expect(markup).not.toContain("window.location.href = '/mobile'")
  })

  it.each([
    ['desktop', 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 'admin'],
    ['iPhone', 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'mobile'],
    ['Android', 'Mozilla/5.0 (Linux; Android 15)', 'mobile'],
    ['missing user agent', '', 'admin'],
  ])('redirects a production %s request before rendering the selector', async (_, ua, platform) => {
    setDevice(ua)
    await expect(HomePage()).rejects.toMatchObject({
      digest: `NEXT_REDIRECT;replace;https://${platform}.example.com/${platform};307;`,
    })
  })

  it.each(['local', 'preview'])('keeps the selector and timer in %s', async (env) => {
    vi.stubEnv('APP_ENV', env)
    const markup = renderToStaticMarkup(await HomePage())
    expect(markup).toContain('管理端 (PC)')
    expect(markup).toContain('移动端')
    expect(markup).toContain('setTimeout')
    expect(markup).toContain('https://admin.example.com/admin')
  })

  it('uses a relative destination when canonical hosts are not configured', async () => {
    vi.stubEnv('CANONICAL_ADMIN_HOST', '')
    await expect(HomePage()).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/admin;307;',
    })
  })

  it('redirects anonymous visitors to login before choosing a platform', async () => {
    vi.mocked(getCurrentUser).mockResolvedValue(null)
    await expect(HomePage()).rejects.toMatchObject({
      digest: 'NEXT_REDIRECT;replace;/login;307;',
    })
  })

  it.each([
    ['FINANCE', 'iPhone', 'admin'],
    ['STORE_ADMIN', 'Macintosh', 'mobile'],
  ])('keeps the %s permission ahead of the device preference', async (role, ua, platform) => {
    setRoles([role])
    setDevice(ua)
    await expect(HomePage()).rejects.toMatchObject({
      digest: `NEXT_REDIRECT;replace;/${platform};307;`,
    })
  })
})
