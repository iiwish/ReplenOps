import { beforeEach, describe, expect, it, vi } from 'vitest'

const authorizationMocks = vi.hoisted(() => ({
  requireActionPermission: vi.fn(),
  updateGoods: vi.fn(),
  updateStockIn: vi.fn(),
  approveOrder: vi.fn(),
  createOrder: vi.fn(),
  listOrderGoods: vi.fn(),
  assertCanOperateStore: vi.fn(),
  updateSystemConfig: vi.fn(),
}))

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

vi.mock('@/lib/action-permissions', () => ({
  requireActionPermission: authorizationMocks.requireActionPermission,
}))

vi.mock('@/services/goods.service', () => ({
  goodsService: {
    update: authorizationMocks.updateGoods,
    listActiveOrderOptions: authorizationMocks.listOrderGoods,
  },
}))

vi.mock('@/lib/store-access', () => ({
  assertCanOperateStore: authorizationMocks.assertCanOperateStore,
}))

vi.mock('@/services/stock-in.service', () => ({
  stockInService: { update: authorizationMocks.updateStockIn },
}))

vi.mock('@/services/order-approval.service', () => ({
  orderApprovalService: { approve: authorizationMocks.approveOrder },
}))

vi.mock('@/services/order.service', () => ({
  orderService: { create: authorizationMocks.createOrder },
}))

vi.mock('@/services/system-config.service', () => ({
  systemConfigService: { update: authorizationMocks.updateSystemConfig },
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

  it('blocks administrator order creation before validation or service access', async () => {
    const { createAdminOrder } = await import('@/actions/order-actions')
    const result = await createAdminOrder({ storeId: '1', items: [] })

    expect(result).toEqual({ success: false, message: '权限不足' })
    expect(authorizationMocks.requireActionPermission).toHaveBeenCalledWith('order:write')
    expect(authorizationMocks.createOrder).not.toHaveBeenCalled()
  })

  it('blocks system branding writes before validation or service access', async () => {
    const { updateSystemBrand } = await import('@/actions/system-config-actions')
    const result = await updateSystemBrand({ name: '', logoPath: '' })

    expect(result).toEqual({ success: false, error: '权限不足' })
    expect(authorizationMocks.requireActionPermission).toHaveBeenCalledWith('system:manage')
    expect(authorizationMocks.updateSystemConfig).not.toHaveBeenCalled()
  })

  it('uses the current partner price when an administrator creates an order', async () => {
    authorizationMocks.requireActionPermission.mockResolvedValue({ id: 'admin-1' })
    authorizationMocks.assertCanOperateStore.mockResolvedValue(undefined)
    authorizationMocks.listOrderGoods.mockResolvedValue([
      {
        id: '7',
        name: '测试商品',
        code: 'G-7',
        spec: null,
        unit: '件',
        measureType: 'INT',
        partnerPrice: 12.5,
        availableQty: 10,
        categoryName: '测试分类',
      },
    ])
    authorizationMocks.createOrder.mockResolvedValue({ id: 123, code: 'OR-TEST-1' })

    const { createAdminOrder } = await import('@/actions/order-actions')
    const result = await createAdminOrder({
      storeId: '2',
      items: [{ goodsId: '7', quantity: 2 }],
    })

    expect(result).toEqual({
      success: true,
      message: '订单创建成功，已进入待审批流程',
      data: { id: '123', code: 'OR-TEST-1' },
    })
    expect(authorizationMocks.createOrder).toHaveBeenCalledWith(
      {
        storeId: '2',
        items: [{ goodsId: '7', quantity: 2, unitPrice: 12.5 }],
        createdBy: 'admin-1',
      },
      { enforceOrderingSchedule: false }
    )
  })
})
