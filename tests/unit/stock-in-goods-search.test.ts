import { beforeEach, describe, expect, it, vi } from 'vitest'

const stockInMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
  inventoryFindMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    goods: { findMany: stockInMocks.findMany },
    inventory: { findMany: stockInMocks.inventoryFindMany },
    $disconnect: vi.fn(),
  },
}))

describe('stock-in goods search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stockInMocks.findMany.mockResolvedValue([])
    stockInMocks.inventoryFindMany.mockResolvedValue([])
  })

  it('supports an empty keyword and stable pagination', async () => {
    const { stockInService } = await import('@/services/stock-in.service')

    await stockInService.searchGoods('', 2, 20)

    expect(stockInMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        skip: 20,
        take: 20,
        orderBy: [{ code: 'asc' }, { id: 'asc' }],
        where: expect.objectContaining({
          isDeleted: false,
          isActive: true,
          OR: [
            { name: { contains: '', mode: 'insensitive' } },
            { code: { contains: '', mode: 'insensitive' } },
          ],
        }),
      })
    )
  })

  it('reads physical stock for only the selected warehouse and requested goods', async () => {
    const { stockInService } = await import('@/services/stock-in.service')
    stockInMocks.inventoryFindMany.mockResolvedValue([
      { goodsId: 12, quantity: '18.125' },
      { goodsId: 13, quantity: '-2.5' },
    ])

    await expect(stockInService.getGoodsStock('7', ['12', '13', '14'])).resolves.toEqual({
      '12': 18.125,
      '13': -2.5,
      '14': 0,
    })
    expect(stockInMocks.inventoryFindMany).toHaveBeenCalledWith({
      where: { warehouseId: 7, goodsId: { in: [12, 13, 14] }, isDeleted: false },
      select: { goodsId: true, quantity: true },
    })
  })

  it('does not query inventory for an empty selection', async () => {
    const { stockInService } = await import('@/services/stock-in.service')
    await expect(stockInService.getGoodsStock('7', [])).resolves.toEqual({})
    expect(stockInMocks.inventoryFindMany).not.toHaveBeenCalled()
  })
})
