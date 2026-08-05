import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import type { AuthUser, TokenResponse } from '@/lib/auth'

const authRouteMocks = vi.hoisted(() => ({
  cookies: vi.fn(),
  refreshAccessToken: vi.fn(),
  setSession: vi.fn(),
  verifyCredentials: vi.fn(),
}))

vi.mock('next/headers', () => ({
  cookies: authRouteMocks.cookies,
}))

vi.mock('@/lib/session', () => ({
  setSession: authRouteMocks.setSession,
}))

vi.mock('@/lib/auth-edge', () => ({
  refreshAccessToken: authRouteMocks.refreshAccessToken,
}))

vi.mock('@/lib/auth', () => ({
  localAuth: {
    verifyCredentials: authRouteMocks.verifyCredentials,
  },
}))

const mockUser: AuthUser = {
  id: 'user-1',
  username: 'admin',
  name: '管理员',
  email: 'admin@example.com',
  phone: null,
  avatar: null,
  isActive: true,
  roles: ['SUPER_ADMIN'],
}

const mockTokens: TokenResponse = {
  access_token: 'test-access-token',
  refresh_token: 'test-refresh-token',
  token_type: 'Bearer',
  expires_in: 3600,
  scope: 'read',
}

function jsonPostRequest(url: string, body: unknown) {
  return new NextRequest(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
}

describe('auth route token response hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authRouteMocks.setSession.mockResolvedValue(undefined)
  })

  it('sets login cookies without returning the access token in JSON', async () => {
    authRouteMocks.verifyCredentials.mockResolvedValue({
      success: true,
      user: mockUser,
      tokens: mockTokens,
    })

    const { POST } = await import('@/app/api/auth/login/route')
    const response = await POST(
      jsonPostRequest('https://app.example.com/api/auth/login', {
        identifier: 'admin',
        password: 'test-password-not-for-production',
      })
    )
    const body: unknown = await response.json()

    expect(authRouteMocks.setSession).toHaveBeenCalledWith(
      mockTokens.access_token,
      mockTokens.refresh_token,
      mockTokens.expires_in
    )
    expect(body).toEqual({
      success: true,
      user: {
        id: mockUser.id,
        username: mockUser.username,
        name: mockUser.name,
        email: mockUser.email,
        phone: mockUser.phone,
        avatar: mockUser.avatar,
        roles: mockUser.roles,
      },
    })
    expect(JSON.stringify(body)).not.toContain(mockTokens.access_token)
    expect(JSON.stringify(body)).not.toContain('access_token')
  })

  it('sets refreshed cookies without returning the access token in JSON', async () => {
    authRouteMocks.cookies.mockResolvedValue({
      get: (name: string) =>
        name === 'replenops_refresh_token' ? { name, value: 'test-refresh-token' } : undefined,
    })
    authRouteMocks.refreshAccessToken.mockResolvedValue({
      access_token: 'new-test-access-token',
      refresh_token: 'test-refresh-token',
      expires_in: 3600,
      scope: 'read',
    })

    const { POST } = await import('@/app/api/auth/refresh/route')
    const response = await POST()
    const body: unknown = await response.json()

    expect(authRouteMocks.setSession).toHaveBeenCalledWith(
      'new-test-access-token',
      'test-refresh-token',
      3600
    )
    expect(body).toEqual({
      success: true,
      expires_in: 3600,
      scope: 'read',
    })
    expect(JSON.stringify(body)).not.toContain('new-test-access-token')
    expect(JSON.stringify(body)).not.toContain('access_token')
  })

  it('keeps public registration disabled', async () => {
    const { POST } = await import('@/app/api/auth/register/route')
    const response = await POST()
    const body: unknown = await response.json()

    expect(response.status).toBe(404)
    expect(body).toEqual({ success: false, error: '注册接口不可用' })
  })
})
