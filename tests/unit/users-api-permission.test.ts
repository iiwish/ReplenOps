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

  it.each(['store_admin', 'warehouse_manager', 'finance', 'approver'] as const)(
    'denies %s at the handler layer',
    async (role) => {
      usersApiMocks.getUserRoles.mockReturnValue([role])

      const { GET } = await import('@/app/api/users/route')
      const response = await GET(new NextRequest('https://erp.test/api/users'))

      expect(response.status).toBe(403)
      expect(await response.json()).toEqual({ success: false, error: '权限不足' })
      expect(usersApiMocks.findAll).not.toHaveBeenCalled()
    }
  )

  it('allows admin roles at the handler layer', async () => {
    usersApiMocks.getUserRoles.mockReturnValue(['super_admin'])
    usersApiMocks.findAll.mockResolvedValue({ users: [], total: 0 })

    const { GET } = await import('@/app/api/users/route')
    const response = await GET(new NextRequest('https://erp.test/api/users'))

    expect(response.status).toBe(200)
    expect(await response.json()).toEqual({ success: true, users: [], total: 0 })
  })

  it('denies non-super-admin updates before invoking the service', async () => {
    usersApiMocks.getUserRoles.mockReturnValue(['warehouse_manager'])

    const { PATCH } = await import('@/app/api/users/route')
    const response = await PATCH(
      new NextRequest('https://erp.test/api/users?userId=user-2', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: false }),
      })
    )

    expect(response.status).toBe(403)
    expect(usersApiMocks.update).not.toHaveBeenCalled()
  })

  it('denies non-super-admin deletes before invoking the service', async () => {
    usersApiMocks.getUserRoles.mockReturnValue(['approver'])

    const { DELETE } = await import('@/app/api/users/route')
    const response = await DELETE(
      new NextRequest('https://erp.test/api/users?userId=user-2', { method: 'DELETE' })
    )

    expect(response.status).toBe(403)
    expect(usersApiMocks.deleteById).not.toHaveBeenCalled()
  })
})
