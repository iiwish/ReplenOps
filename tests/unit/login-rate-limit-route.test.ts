import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const loginMocks = vi.hoisted(() => ({
  check: vi.fn(),
  clear: vi.fn(),
  recordFailure: vi.fn(),
  setSession: vi.fn(),
  verifyCredentials: vi.fn(),
}))

vi.mock('@/lib/session', () => ({ setSession: loginMocks.setSession }))
vi.mock('@/lib/auth', () => ({
  localAuth: { verifyCredentials: loginMocks.verifyCredentials },
}))
vi.mock('@/services/auth-rate-limit.service', () => ({
  createLoginRateLimitKey: () => 'hashed-rate-limit-key',
  getLoginClientAddress: () => '203.0.113.7',
  authRateLimitService: {
    check: loginMocks.check,
    clear: loginMocks.clear,
    recordFailure: loginMocks.recordFailure,
  },
}))

function request() {
  return new NextRequest('https://app.example.com/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-forwarded-for': '203.0.113.7',
    },
    body: JSON.stringify({ identifier: 'Admin', password: 'not-the-password' }),
  })
}

describe('login rate limiting', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    loginMocks.check.mockResolvedValue({ allowed: true })
    loginMocks.recordFailure.mockResolvedValue({ allowed: true })
    loginMocks.clear.mockResolvedValue(undefined)
  })

  it('returns 429 without checking credentials when the key is blocked', async () => {
    loginMocks.check.mockResolvedValue({ allowed: false, retryAfterSeconds: 120 })

    const { POST } = await import('@/app/api/auth/login/route')
    const response = await POST(request())

    expect(response.status).toBe(429)
    expect(response.headers.get('Retry-After')).toBe('120')
    expect(loginMocks.verifyCredentials).not.toHaveBeenCalled()
  })

  it('records failed attempts and clears the counter after success', async () => {
    const { POST } = await import('@/app/api/auth/login/route')

    loginMocks.verifyCredentials.mockResolvedValueOnce({ success: false })
    expect((await POST(request())).status).toBe(401)
    expect(loginMocks.recordFailure).toHaveBeenCalledTimes(1)

    loginMocks.verifyCredentials.mockResolvedValueOnce({
      success: true,
      user: {
        id: 'user-1',
        username: 'admin',
        name: null,
        email: null,
        phone: null,
        avatar: null,
        isActive: true,
        roles: ['SUPER_ADMIN'],
      },
      tokens: {
        access_token: 'access',
        refresh_token: 'refresh',
        token_type: 'Bearer',
        expires_in: 3600,
        scope: 'read',
      },
    })
    expect((await POST(request())).status).toBe(200)
    expect(loginMocks.clear).toHaveBeenCalledTimes(1)
  })
})
