import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/session', () => ({
  revokeSession: vi.fn(),
}))

vi.mock('@/lib/wecom/http', () => ({ cancelCurrentWecomFlow: vi.fn() }))

const originalNextPublicAppUrl = process.env.NEXT_PUBLIC_APP_URL

describe('logout domain routing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.NEXT_PUBLIC_APP_URL = 'https://admin.test.example.com'
  })

  afterEach(() => {
    if (originalNextPublicAppUrl === undefined) {
      delete process.env.NEXT_PUBLIC_APP_URL
      return
    }

    process.env.NEXT_PUBLIC_APP_URL = originalNextPublicAppUrl
  })

  it('keeps admin-domain GET logout redirects on the current host', async () => {
    const { GET } = await import('@/app/api/auth/logout/route')
    const response = await GET()

    expect(response.headers.get('location')).toBe('/login')
  })

  it('keeps mobile-domain GET logout redirects on the current host', async () => {
    const { GET } = await import('@/app/api/auth/logout/route')
    const response = await GET()

    expect(response.headers.get('location')).toBe('/login')
  })
})
