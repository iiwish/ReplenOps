import { beforeEach, describe, expect, it, vi } from 'vitest'

const authMocks = vi.hoisted(() => ({
  verifyRefreshToken: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  localAuth: {
    verifyAccessToken: vi.fn(),
    verifyRefreshToken: authMocks.verifyRefreshToken,
  },
}))

describe('refresh request deduplication', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns the same rotation result for concurrent uses of one refresh token', async () => {
    const tokens = {
      access_token: 'next-access',
      refresh_token: 'next-refresh',
      token_type: 'Bearer',
      expires_in: 3600,
      scope: 'read',
    }
    authMocks.verifyRefreshToken.mockResolvedValue(tokens)
    const { refreshAccessToken } = await import('@/lib/auth-edge')

    const [first, second] = await Promise.all([
      refreshAccessToken('same-refresh-token'),
      refreshAccessToken('same-refresh-token'),
    ])

    expect(first).toBe(tokens)
    expect(second).toBe(tokens)
    expect(authMocks.verifyRefreshToken).toHaveBeenCalledTimes(1)
  })
})
