import { beforeEach, describe, expect, it, vi } from 'vitest'

const stockOutMocks = vi.hoisted(() => ({
  findFirst: vi.fn(),
  findUsers: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    stockOut: { findFirst: stockOutMocks.findFirst },
    user: { findMany: stockOutMocks.findUsers },
    $disconnect: vi.fn(),
  },
}))

const decimal = (value: number) => ({ toNumber: () => value })

describe('stock-out printable detail', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it.each([
    ['耗材', '耗材'],
    [null, '已调整分类'],
  ])('resolves category snapshot %s as %s', async (categorySnapshot, expectedCategory) => {
    const now = new Date('2026-08-02T10:00:00.000Z')
    stockOutMocks.findUsers.mockResolvedValue([
      { id: 'store-user', username: 'store-code', name: '门店张三' },
      { id: 'approver', username: 'approver-code', name: '审批李四' },
      { id: 'warehouse-user', username: 'warehouse-code', name: '仓库王五' },
    ])
    stockOutMocks.findFirst.mockResolvedValue({
      id: 8,
      code: 'SO202608020001',
      orderId: 6,
      warehouseId: 1,
      status: 'COMPLETED',
      totalCost: decimal(10),
      remark: '复核后交接',
      createdBy: 'warehouse-user',
      completedAt: now,
      revokedBy: null,
      revokedAt: null,
      revokeReason: null,
      createdAt: now,
      updatedAt: now,
      warehouse: { name: '主仓' },
      order: {
        code: 'OR202608020001',
        isDeleted: false,
        createdBy: 'store-user',
        orderedAt: now,
        approvedBy: 'approver',
        approvedAt: now,
        remark: '上午送达',
        storeNameSnapshot: '一号门店',
        store: { id: 2, name: '已改名门店' },
      },
      items: [
        {
          id: 10,
          goodsId: 3,
          goodsCodeSnapshot: 'GLE00143',
          goodsNameSnapshot: '冰袋',
          goodsSpecSnapshot: '80袋/箱',
          goodsUnitSnapshot: '箱',
          measureTypeSnapshot: 'INT',
          categoryIdSnapshot: 4,
          categoryNameSnapshot: categorySnapshot,
          quantity: decimal(2),
          salePrice: decimal(8),
          snapshotCost: decimal(5),
          goods: {
            code: 'G000003',
            name: '新名称',
            spec: null,
            unit: '箱',
            measureType: 'INT',
            categoryId: 4,
            category: { name: '已调整分类' },
          },
        },
      ],
      containerItems: [],
    })

    const { stockOutService } = await import('@/services/stock-out.service')
    const result = await stockOutService.findById('8')

    expect(stockOutMocks.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 8, isDeleted: false },
        include: expect.objectContaining({
          items: expect.objectContaining({ where: { isDeleted: false } }),
        }),
      })
    )
    expect(result).toMatchObject({
      orderCode: 'OR202608020001',
      orderCreatedBy: 'store-user',
      orderCreatedByName: '门店张三',
      approvedBy: 'approver',
      approvedByName: '审批李四',
      createdByName: '仓库王五',
      orderRemark: '上午送达',
      storeName: '一号门店',
      items: [
        {
          goodsCode: 'GLE00143',
          goodsName: '冰袋',
          categoryName: expectedCategory,
          goodsSpec: '80袋/箱',
          quantity: 2,
          lineAmount: 16,
        },
      ],
      containers: [],
    })
  })
})
