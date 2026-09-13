import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ permission: vi.fn(), getGoodsStock: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/action-permissions', () => ({ requireActionPermission: mocks.permission }))
vi.mock('@/services/stock-in.service', () => ({
  stockInService: { getGoodsStock: mocks.getGoodsStock },
}))

import { getGoodsStock } from '@/actions/stock-in-actions'

describe('stock-in inventory lookup action', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.permission.mockResolvedValue({ id: 'operator' })
    mocks.getGoodsStock.mockResolvedValue({ '12': 18.125 })
  })

  it('requires stock access and returns only the requested quantities', async () => {
    await expect(getGoodsStock('7', ['12'])).resolves.toEqual({
      success: true,
      data: { '12': 18.125 },
    })
    expect(mocks.permission).toHaveBeenCalledWith('stock:write')
    expect(mocks.getGoodsStock).toHaveBeenCalledWith('7', ['12'])
  })

  it('does not query inventory when access is denied', async () => {
    mocks.permission.mockRejectedValue(new Error('权限不足'))
    expect((await getGoodsStock('7', ['12'])).success).toBe(false)
    expect(mocks.getGoodsStock).not.toHaveBeenCalled()
  })

  it.each(['', '0', '-1', '1.5', '7invalid', '2147483648'])(
    'rejects invalid IDs: %s',
    async (id) => {
      expect((await getGoodsStock(id, ['12'])).success).toBe(false)
      expect((await getGoodsStock('7', [id])).success).toBe(false)
      expect(mocks.getGoodsStock).not.toHaveBeenCalled()
    }
  )

  it('bounds the batch size', async () => {
    expect(
      (
        await getGoodsStock(
          '7',
          Array.from({ length: 201 }, (_, index) => String(index + 1))
        )
      ).success
    ).toBe(false)
    expect(mocks.getGoodsStock).not.toHaveBeenCalled()
  })

  it('does not expose diagnostics or convert query failure into zero stock', async () => {
    mocks.getGoodsStock.mockRejectedValue(new Error('private database diagnostics'))
    await expect(getGoodsStock('7', ['12'])).resolves.toEqual({
      success: false,
      message: '读取现有库存失败，请重试',
    })
  })
})
