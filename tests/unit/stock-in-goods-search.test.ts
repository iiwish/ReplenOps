import { beforeEach, describe, expect, it, vi } from 'vitest'

const stockInMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    goods: { findMany: stockInMocks.findMany },
    $disconnect: vi.fn(),
  },
}))

describe('stock-in goods search', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stockInMocks.findMany.mockResolvedValue([])
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
})
