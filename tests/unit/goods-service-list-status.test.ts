import { beforeEach, describe, expect, it, vi } from 'vitest'

const goodsMocks = vi.hoisted(() => ({
  count: vi.fn(),
  findMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    goods: {
      count: goodsMocks.count,
      findMany: goodsMocks.findMany,
    },
  },
}))

describe('goods list status filtering', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    goodsMocks.count.mockResolvedValue(0)
    goodsMocks.findMany.mockResolvedValue([])
  })

  it.each([
    ['active', true],
    ['inactive', false],
  ] as const)('adds the %s status to the database query', async (status, isActive) => {
    const { goodsService } = await import('@/services/goods.service')

    await goodsService.list({ status })

    expect(goodsMocks.count).toHaveBeenCalledWith({
      where: { isDeleted: false, isActive },
    })
    expect(goodsMocks.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isDeleted: false, isActive },
      })
    )
  })

  it('does not constrain status for the all filter', async () => {
    const { goodsService } = await import('@/services/goods.service')

    await goodsService.list({ status: 'all' })

    expect(goodsMocks.count).toHaveBeenCalledWith({ where: { isDeleted: false } })
  })
})
