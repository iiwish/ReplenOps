import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

vi.mock('@/lib/session', () => ({
  revokeSession: vi.fn(),
}))

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
    const response = await GET(new NextRequest('https://admin.test.example.com/api/auth/logout'))

    expect(response.headers.get('location')).toBe('https://admin.test.example.com/login')
  })

  it('keeps mobile-domain GET logout redirects on the current host', async () => {
    const { GET } = await import('@/app/api/auth/logout/route')
    const response = await GET(new NextRequest('https://mobile.test.example.com/api/auth/logout'))

    expect(response.headers.get('location')).toBe('https://mobile.test.example.com/login')
  })
})
