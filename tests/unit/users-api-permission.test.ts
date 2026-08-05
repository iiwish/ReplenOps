import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const usersApiMocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getUserRoles: vi.fn(),
  findAll: vi.fn(),
  update: vi.fn(),
  deleteById: vi.fn(),
}))

vi.mock('@/lib/session', () => ({
  requireAuth: usersApiMocks.requireAuth,
  getUserRoles: usersApiMocks.getUserRoles,
}))

vi.mock('@/services/user.service', () => ({
  userService: {
    findAll: usersApiMocks.findAll,
    update: usersApiMocks.update,
    deleteById: usersApiMocks.deleteById,
  },
}))

const mockUser = {
  id: 'user-1',
  username: 'store-user',
  name: '门店用户',
  email: null,
  phone: null,
  avatar: null,
  isActive: true,
  roles: ['STORE_ADMIN'],
}

describe('users API permission hardening', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    usersApiMocks.requireAuth.mockResolvedValue(mockUser)
  })

  it('denies store_admin at the handler layer', async () => {
    usersApiMocks.getUserRoles.mockReturnValue(['store_admin'])

    const { GET } = await import('@/app/api/users/route')
    const response = await GET(new NextRequest('https://erp.test/api/users'))

    expect(response.status).toBe(403)
    expect(await response.json()).toEqual({ success: false, error: '权限不足' })
    expect(usersApiMocks.findAll).not.toHaveBeenCalled()
  })

  it('allows admin roles at the handler layer', async () => {
    usersApiMocks.getUserRoles.mockReturnValue(['super_admin'])
    usersApiMocks.findAll.mockResolvedValue({ users: [], total: 0 })

    const { GET } = await import('@/app/api/users/route')
    const response = await GET(new NextRequest('https://erp.test/api/users'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, users: [], total: 0 })
  })
})
