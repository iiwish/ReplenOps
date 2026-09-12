import { beforeEach, describe, expect, it, vi } from 'vitest'

const sessionMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  headers: vi.fn(),
  verifyToken: vi.fn(),
  refreshAccessToken: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: sessionMocks.cookies,
  headers: sessionMocks.headers,
}))

vi.mock('@/lib/auth-edge', () => ({
  verifyToken: sessionMocks.verifyToken,
  refreshAccessToken: sessionMocks.refreshAccessToken,
}))

describe('session header trust boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    sessionMocks.cookies.mockResolvedValue({
      get: (name: string) => {
        if (name === 'replenops_access_token') return { value: 'signed-access-token' }
        if (name === 'replenops_expires_at') return { value: String(Date.now() + 3_600_000) }
        return undefined
      },
    })
    sessionMocks.headers.mockResolvedValue(
      new Headers({
        'x-user-profile': Buffer.from(
          JSON.stringify({
            id: 'attacker',
            username: 'attacker',
            roles: ['SUPER_ADMIN'],
            isActive: true,
          })
        ).toString('base64'),
      })
    )
    sessionMocks.verifyToken.mockResolvedValue({
      id: 'user-1',
      username: 'store-user',
      name: null,
      email: null,
      phone: null,
      avatar: null,
      isActive: true,
      roles: ['STORE_ADMIN'],
    })
  })

  it('ignores a client-supplied x-user-profile value', async () => {
    const { getSession } = await import('@/lib/session')
    const session = await getSession()

    expect(session?.user.id).toBe('user-1')
    expect(session?.user.roles).toEqual(['STORE_ADMIN'])
    expect(sessionMocks.verifyToken).toHaveBeenCalledWith('signed-access-token')
  })

  it('reads an expiring session without rotating tokens or writing cookies', async () => {
    sessionMocks.cookies.mockResolvedValue({
      get: (name: string) => {
        const values: Record<string, string> = {
          replenops_access_token: 'signed-access-token',
          replenops_refresh_token: 'refresh-token',
          replenops_expires_at: String(Date.now() + 60_000),
        }
        return values[name] ? { value: values[name] } : undefined
      },
      set: () => {
        throw new Error('Cookies cannot be modified in a Server Component')
      },
    })
    const { getSession } = await import('@/lib/session')
    expect((await getSession())?.user.id).toBe('user-1')
    expect(sessionMocks.refreshAccessToken).not.toHaveBeenCalled()
  })
})
