import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'

const READ_ALL_STORE_ROLES = new Set([
  'SUPER_ADMIN',
  'WAREHOUSE_MANAGER',
  'APPROVER',
  'FINANCE',
  'super_admin',
  'warehouse_manager',
  'approver',
  'finance',
])

const OPERATE_ALL_STORE_ROLES = new Set([
  'SUPER_ADMIN',
  'WAREHOUSE_MANAGER',
  'APPROVER',
  'super_admin',
  'warehouse_manager',
  'approver',
])

export function canReadAllStores(user: AuthUser): boolean {
  return user.roles.some((role) => READ_ALL_STORE_ROLES.has(role))
}

export function canOperateAllStores(user: AuthUser): boolean {
  return user.roles.some((role) => OPERATE_ALL_STORE_ROLES.has(role))
}

export async function getAccessibleStoreIds(user: AuthUser): Promise<number[]> {
  const storeAdmins = await prisma.storeAdmin.findMany({
    where: { userId: user.id },
    select: { storeId: true },
  })

  return storeAdmins.map((storeAdmin) => storeAdmin.storeId)
}

export async function assertCanReadStore(user: AuthUser, storeId: number): Promise<void> {
  if (canReadAllStores(user)) {
    return
  }

  const storeAdmin = await prisma.storeAdmin.findUnique({
    where: {
      userId_storeId: {
        userId: user.id,
        storeId,
      },
    },
  })

  if (!storeAdmin) {
    throw new Error('无权访问该门店数据')
  }
}

export async function assertCanOperateStore(user: AuthUser, storeId: number): Promise<void> {
  if (canOperateAllStores(user)) {
    return
  }

  const storeAdmin = await prisma.storeAdmin.findUnique({
    where: {
      userId_storeId: {
        userId: user.id,
        storeId,
      },
    },
  })

  if (!storeAdmin) {
    throw new Error('无权操作该门店订单')
  }
}
