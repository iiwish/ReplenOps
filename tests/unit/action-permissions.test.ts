import { describe, expect, it } from 'vitest'

import type { AuthUser } from '@/lib/auth'
import { canPerformAction, type ActionPermission } from '@/lib/action-permissions'

function userWithRole(role: string): AuthUser {
  return {
    id: `user-${role}`,
    username: role,
    name: role,
    email: null,
    phone: null,
    avatar: null,
    isActive: true,
    roles: [role],
  }
}

describe('action permissions', () => {
  it.each<ActionPermission>([
    'goods:write',
    'master-data:write',
    'stock:read',
    'stock:write',
    'inventory:adjust',
    'order:review',
    'store:manage',
    'system:manage',
  ])('allows super administrators to perform %s', (permission) => {
    expect(canPerformAction(userWithRole('SUPER_ADMIN'), permission)).toBe(true)
  })

  it('limits warehouse managers to inventory and operational master data', () => {
    const user = userWithRole('WAREHOUSE_MANAGER')

    expect(canPerformAction(user, 'goods:write')).toBe(true)
    expect(canPerformAction(user, 'master-data:write')).toBe(true)
    expect(canPerformAction(user, 'stock:write')).toBe(true)
    expect(canPerformAction(user, 'inventory:adjust')).toBe(true)
    expect(canPerformAction(user, 'order:review')).toBe(true)
    expect(canPerformAction(user, 'store:manage')).toBe(false)
    expect(canPerformAction(user, 'system:manage')).toBe(false)
  })

  it('keeps approvers on order review and read-only stock access', () => {
    const user = userWithRole('APPROVER')

    expect(canPerformAction(user, 'order:review')).toBe(true)
    expect(canPerformAction(user, 'stock:read')).toBe(true)
    expect(canPerformAction(user, 'stock:write')).toBe(false)
    expect(canPerformAction(user, 'goods:write')).toBe(false)
  })

  it('keeps finance and store users away from inventory mutations', () => {
    const finance = userWithRole('FINANCE')
    const store = userWithRole('STORE_ADMIN')

    expect(canPerformAction(finance, 'stock:read')).toBe(true)
    expect(canPerformAction(finance, 'stock:write')).toBe(false)
    expect(canPerformAction(finance, 'order:review')).toBe(false)
    expect(canPerformAction(store, 'stock:read')).toBe(false)
    expect(canPerformAction(store, 'order:review')).toBe(false)
  })

  it('denies unauthenticated users', () => {
    expect(canPerformAction(null, 'stock:read')).toBe(false)
  })
})
