import { beforeEach, describe, expect, it, vi } from 'vitest'

const authorizationMocks = vi.hoisted(() => ({
  requireActionPermission: vi.fn(),
  updateGoods: vi.fn(),
  updateStockIn: vi.fn(),
  approveOrder: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/action-permissions', () => ({
  requireActionPermission: authorizationMocks.requireActionPermission,
}))

vi.mock('@/services/goods.service', () => ({
  goodsService: { update: authorizationMocks.updateGoods },
}))

vi.mock('@/services/stock-in.service', () => ({
  stockInService: { update: authorizationMocks.updateStockIn },
}))

vi.mock('@/services/order-approval.service', () => ({
  orderApprovalService: { approve: authorizationMocks.approveOrder },
}))

describe('server action authorization boundaries', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    authorizationMocks.requireActionPermission.mockRejectedValue(new Error('权限不足'))
  })

  it('blocks goods writes before validation or service access', async () => {
    const { updateGoods } = await import('@/actions/goods-actions')
    const result = await updateGoods('1', new FormData())

    expect(result).toEqual({ success: false, message: '权限不足' })
    expect(authorizationMocks.requireActionPermission).toHaveBeenCalledWith('goods:write')
    expect(authorizationMocks.updateGoods).not.toHaveBeenCalled()
  })

  it('blocks stock-in edits before service access', async () => {
    const { updateStockIn } = await import('@/actions/stock-in-actions')
    const result = await updateStockIn('1', {})

    expect(result).toEqual({ success: false, message: '权限不足' })
    expect(authorizationMocks.requireActionPermission).toHaveBeenCalledWith('stock:write')
    expect(authorizationMocks.updateStockIn).not.toHaveBeenCalled()
  })

  it('blocks order approval before service access', async () => {
    const { approveOrder } = await import('@/actions/order-approval-actions')
    const result = await approveOrder({ orderId: '1' })

    expect(result).toEqual({ success: false, message: '权限不足' })
    expect(authorizationMocks.requireActionPermission).toHaveBeenCalledWith('order:review')
    expect(authorizationMocks.approveOrder).not.toHaveBeenCalled()
  })
})
