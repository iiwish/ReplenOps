import { beforeEach, describe, expect, it, vi } from 'vitest'
import { Prisma } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'

const mocks = vi.hoisted(() => ({ inventory: vi.fn() }))
vi.mock('@/lib/prisma', () => ({
  prisma: {
    inventory: { findMany: mocks.inventory },
    inventoryLog: { findMany: vi.fn().mockResolvedValue([]) },
    order: { count: vi.fn().mockResolvedValue(0) },
    stockIn: { count: vi.fn().mockResolvedValue(0) },
    stockOut: { count: vi.fn().mockResolvedValue(0) },
    containerReturn: { count: vi.fn().mockResolvedValue(0) },
    $disconnect: vi.fn(),
  },
}))

import { DashboardService } from '@/services/dashboard.service'

const user: AuthUser = {
  id: 'dashboard-test',
  username: 'dashboard-test',
  name: null,
  email: null,
  phone: null,
  avatar: null,
  isActive: true,
  roles: ['SUPER_ADMIN'],
}

function inventory(id: number, available: number, minimum: number) {
  return {
    id,
    quantity: new Prisma.Decimal(Math.max(available, 0)),
    availableQuantity: new Prisma.Decimal(available),
    lockedQuantity: new Prisma.Decimal(0),
    avgCost: new Prisma.Decimal(2),
    goods: {
      code: String(id),
      name: String(id),
      spec: null,
      unit: '件',
      minStock: new Prisma.Decimal(minimum),
    },
    warehouse: { name: 'test' },
  }
}

describe('dashboard inventory counts', () => {
  let service: DashboardService
  beforeEach(() => {
    vi.clearAllMocks()
    service = new DashboardService()
    vi.spyOn(service, 'getTodayStats').mockResolvedValue({
      orderCount: 0,
      pendingCount: 0,
      lowStockCount: 0,
      containerToReturnCount: 0,
      monthlyOrderCount: 0,
      monthlyPendingCount: 0,
      monthlyCompletedCount: 0,
    })
  })

  it('rejects store-only users before reading global inventory', async () => {
    await expect(
      service.getAdminDashboardData({ ...user, roles: ['STORE_ADMIN'] })
    ).rejects.toThrow('权限不足')
    expect(mocks.inventory).not.toHaveBeenCalled()
    expect(service.getTodayStats).not.toHaveBeenCalled()
  })

  it('counts zero available stock independently of the minimum-stock threshold', async () => {
    mocks.inventory.mockResolvedValue([
      inventory(1, 0, 0),
      inventory(2, 0, 10),
      inventory(3, 3, 5),
      inventory(4, 5, 5),
      inventory(5, -1, 0),
    ])
    const { inventory: result } = await service.getAdminDashboardData(user)
    expect(result.zeroStockCount).toBe(3)
    expect(result.lowStockCount).toBe(3)
    expect(result.lowStockItems.map((item) => item.id)).toEqual(['2', '3', '5'])
  })

  it('returns zero counts for an empty inventory', async () => {
    mocks.inventory.mockResolvedValue([])
    const { inventory: result } = await service.getAdminDashboardData(user)
    expect(result.zeroStockCount).toBe(0)
    expect(result.lowStockCount).toBe(0)
    expect(result.lowStockItems).toEqual([])
  })
})
