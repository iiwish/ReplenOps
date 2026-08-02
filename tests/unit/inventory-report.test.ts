import { beforeEach, describe, expect, it, vi } from 'vitest'

const reportMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    inventory: { findMany: reportMocks.findMany },
    $disconnect: vi.fn(),
  },
}))

describe('inventory report', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('includes zero-stock warnings and calculates shortage details', async () => {
    reportMocks.findMany.mockResolvedValue([
      {
        id: 1,
        quantity: 0,
        availableQuantity: 0,
        avgCost: 12.3,
        totalCost: 0,
        goods: {
          code: 'GLE00143',
          name: '冰袋',
          spec: '80袋/箱',
          unit: '箱',
          minStock: 10,
          category: { name: '耗材' },
        },
        warehouse: { name: '主仓' },
      },
      {
        id: 2,
        quantity: 9,
        availableQuantity: 7,
        avgCost: 5,
        totalCost: 45,
        goods: {
          code: 'G000002',
          name: '手套',
          spec: null,
          unit: '盒',
          minStock: 8,
          category: { name: '耗材' },
        },
        warehouse: { name: '主仓' },
      },
    ])

    const { reportService } = await import('@/services/report.service')
    const result = await reportService.getInventoryReport()

    expect(reportMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ isDeleted: false }) })
    )
    expect(result.summary.lowStockCount).toBe(2)
    expect(result.lowStockItems.map((item) => item.shortageQuantity)).toEqual([10, 1])
    expect(result.lowStockItems[0]).toMatchObject({
      goodsCode: 'GLE00143',
      goodsSpec: '80袋/箱',
      goodsUnit: '箱',
      minStock: 10,
    })
  })
})
