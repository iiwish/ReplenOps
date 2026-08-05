import { describe, expect, it } from 'vitest'
import { getRedirectRoute, hasPermission, isPublicRoute } from '@/lib/rbac'

describe('rbac platform access regression', () => {
  it('keeps store_admin limited to mobile routes', () => {
    expect(hasPermission('store_admin', '/mobile')).toBe(true)
    expect(hasPermission('store_admin', '/mobile/orders')).toBe(true)
    expect(hasPermission('store_admin', '/admin')).toBe(false)
    expect(hasPermission('store_admin', '/admin/orders')).toBe(false)
    expect(getRedirectRoute('store_admin', '/admin/orders')).toBe('/mobile')
  })

  it.each(['super_admin', 'warehouse_manager', 'approver'] as const)(
    'keeps %s able to access admin and mobile routes',
    (role) => {
      expect(hasPermission(role, '/admin')).toBe(true)
      expect(hasPermission(role, '/admin/orders')).toBe(true)
      expect(hasPermission(role, '/mobile')).toBe(true)
      expect(hasPermission(role, '/mobile/orders')).toBe(true)
    }
  )

  it('does not expose the register API as a public auth route', () => {
    expect(isPublicRoute('/api/auth/login')).toBe(true)
    expect(isPublicRoute('/api/auth/logout')).toBe(true)
    expect(isPublicRoute('/api/auth/refresh')).toBe(true)
    expect(isPublicRoute('/api/auth/session')).toBe(true)
    expect(isPublicRoute('/api/auth/register')).toBe(false)
  })

  it('limits store_admin API access to mobile and shared endpoints', () => {
    expect(hasPermission('store_admin', '/api/users')).toBe(false)
    expect(hasPermission('store_admin', '/api/reports/inventory/export')).toBe(false)
    expect(hasPermission('store_admin', '/api/dashboard')).toBe(true)
    expect(hasPermission('store_admin', '/api/stores/user')).toBe(true)
    expect(hasPermission('store_admin', '/api/ordering-schedule/status')).toBe(true)
  })

  it('keeps super_admin able to access management APIs', () => {
    expect(hasPermission('super_admin', '/api/users')).toBe(true)
    expect(hasPermission('super_admin', '/api/ordering-schedule')).toBe(true)
    expect(hasPermission('super_admin', '/api/ordering-schedule/status')).toBe(true)
    expect(hasPermission('super_admin', '/api/reports/inventory')).toBe(true)
    expect(hasPermission('super_admin', '/api/reports/inventory/export')).toBe(true)
  })
})
