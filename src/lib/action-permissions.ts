import type { AuthUser } from '@/lib/auth'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'
import type { UserRole } from '@/types'

export type ActionPermission =
  | 'goods:write'
  | 'master-data:write'
  | 'stock:read'
  | 'stock:write'
  | 'inventory:adjust'
  | 'order:review'
  | 'store:manage'
  | 'system:manage'

const ACTION_PERMISSION_ROLES: Record<ActionPermission, readonly UserRole[]> = {
  'goods:write': ['super_admin', 'warehouse_manager'],
  'master-data:write': ['super_admin', 'warehouse_manager'],
  'stock:read': ['super_admin', 'warehouse_manager', 'finance', 'approver'],
  'stock:write': ['super_admin', 'warehouse_manager'],
  'inventory:adjust': ['super_admin', 'warehouse_manager'],
  'order:review': ['super_admin', 'warehouse_manager', 'approver'],
  'store:manage': ['super_admin'],
  'system:manage': ['super_admin'],
}

export function canPerformAction(user: AuthUser | null, permission: ActionPermission): boolean {
  const allowedRoles = ACTION_PERMISSION_ROLES[permission]
  return getUserRoles(user).some((role) => allowedRoles.includes(role))
}

export async function requireActionPermission(permission: ActionPermission): Promise<AuthUser> {
  const user = await getCurrentUser()

  if (!user) {
    throw new Error('用户未登录')
  }

  if (!canPerformAction(user, permission)) {
    throw new Error('权限不足')
  }

  return user
}
