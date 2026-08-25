import { beforeEach, describe, expect, it, vi } from 'vitest'

const prismaMocks = vi.hoisted(() => ({
  inventory: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}))

vi.mock('@/lib/prisma', () => ({ prisma: prismaMocks }))

import { inventoryQueryService } from '@/services/inventory-query.service'

describe('inventory low-stock query', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns only positive stock whose available quantity is below the warning value', async () => {
    prismaMocks.inventory.findMany.mockResolvedValue([
      {
        id: 1,
        warehouseId: 1,
        goodsId: 1,
        quantity: 20,
        lockedQuantity: 15,
        availableQuantity: 5,
        avgCost: 2,
        updatedAt: new Date('2026-08-09T00:00:00.000Z'),
        warehouse: { name: '主仓' },
        goods: { code: 'G001', name: '预警商品', spec: null, unit: '件', minStock: 10 },
      },
      {
        id: 2,
        warehouseId: 1,
        goodsId: 2,
        quantity: 20,
        lockedQuantity: 0,
        availableQuantity: 20,
        avgCost: 3,
        updatedAt: new Date('2026-08-09T00:00:00.000Z'),
        warehouse: { name: '主仓' },
        goods: { code: 'G002', name: '正常商品', spec: null, unit: '件', minStock: 10 },
      },
    ])

    const result = await inventoryQueryService.query({
      page: 1,
      pageSize: 20,
      stockStatus: 'low_stock',
    })

    expect(result.total).toBe(1)
    expect(result.data).toHaveLength(1)
    expect(result.data[0]).toMatchObject({ goodsCode: 'G001', isLowStock: true })
    expect(prismaMocks.inventory.count).not.toHaveBeenCalled()
  })
})
