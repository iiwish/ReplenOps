import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '../helpers/deferred'
import { Prisma } from '@prisma/client'

const mocks = vi.hoisted(() => ({
  stockInCount: vi.fn(),
  stockInFindMany: vi.fn(),
  stockOutCount: vi.fn(),
  stockOutFindMany: vi.fn(),
  findUsers: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stockIn: { count: mocks.stockInCount, findMany: mocks.stockInFindMany },
    stockOut: { count: mocks.stockOutCount, findMany: mocks.stockOutFindMany },
    user: { findMany: mocks.findUsers },
    $disconnect: vi.fn(),
  },
}))

import { stockInService } from '@/services/stock-in.service'
import { stockOutService } from '@/services/stock-out.service'

describe('stock list query scheduling', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.findUsers.mockResolvedValue([])
  })

  for (const [name, service, count, findMany] of [
    ['stock-in', stockInService, mocks.stockInCount, mocks.stockInFindMany],
    ['stock-out', stockOutService, mocks.stockOutCount, mocks.stockOutFindMany],
  ] as const) {
    it(`${name} starts the page query without waiting for the count`, async () => {
      const total = deferred<number>()
      count.mockReturnValue(total.promise)
      findMany.mockResolvedValue([])

      const result = service.list({ page: 2, pageSize: 20, status: 'PENDING', warehouseId: '7' })
      try {
        expect(findMany).toHaveBeenCalledWith(
          expect.objectContaining({
            where: { isDeleted: false, status: 'PENDING', warehouseId: 7 },
            skip: 20,
            take: 20,
          })
        )
      } finally {
        total.resolve(25)
        await result
      }
      expect(await result).toEqual({ data: [], total: 25, page: 2, pageSize: 20, totalPages: 2 })
    })

    it(`${name} propagates query failures rather than returning an empty success`, async () => {
      count.mockResolvedValue(1)
      findMany.mockRejectedValue(new Error('database unavailable'))
      await expect(service.list()).rejects.toThrow('database unavailable')
    })
  }

  it('does not load packaging detail for the stock-out list', async () => {
    mocks.stockOutCount.mockResolvedValue(0)
    mocks.stockOutFindMany.mockResolvedValue([])
    await stockOutService.list()
    const query = mocks.stockOutFindMany.mock.calls[0]?.[0]
    expect(query.include).not.toHaveProperty('containerItems')
  })

  it('preserves stock-out snapshots, decimal totals, and display names', async () => {
    mocks.stockOutCount.mockResolvedValue(1)
    mocks.findUsers.mockResolvedValue([
      { id: 'operator', username: 'warehouse-user', name: '仓库操作员' },
    ])
    mocks.stockOutFindMany.mockResolvedValue([
      {
        id: 1,
        code: 'SO-TEST',
        orderId: 2,
        warehouseId: 3,
        status: 'COMPLETED',
        order: {
          code: 'ORDER-TEST',
          isDeleted: true,
          storeNameSnapshot: '门店快照',
          store: { name: '现用门店名' },
        },
        warehouse: { name: '测试仓库' },
        createdBy: 'operator',
        items: [
          { quantity: new Prisma.Decimal(2), salePrice: new Prisma.Decimal(10) },
          { quantity: new Prisma.Decimal(3), salePrice: new Prisma.Decimal('1.25') },
        ],
        totalCost: new Prisma.Decimal(12),
        remark: null,
        completedAt: null,
        createdAt: new Date('2026-09-05T00:00:00Z'),
        updatedAt: new Date('2026-09-05T00:00:00Z'),
      },
    ])
    const result = await stockOutService.list()
    expect(result).toMatchObject({
      total: 1,
      totalPages: 1,
      data: [
        {
          id: '1',
          orderId: '2',
          warehouseId: '3',
          orderIsDeleted: true,
          storeName: '门店快照',
          totalQuantity: 5,
          issueAmount: 23.75,
          totalCost: 12,
          createdByName: '仓库操作员',
        },
      ],
    })
  })
})
