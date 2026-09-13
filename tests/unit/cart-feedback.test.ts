import { beforeEach, describe, expect, it, vi } from 'vitest'
import { toast } from '@/hooks/use-toast'
import { useCartStore, type CartItem } from '@/lib/stores/cart.store'

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }))

const item: CartItem = {
  goodsId: 'layout-test',
  code: 'LAYOUT',
  name: '测试商品',
  spec: null,
  unit: '袋',
  measureType: 'INT',
  price: 18.5,
  quantity: 1,
  availableQty: 3,
}

describe('compact product add-to-cart feedback', () => {
  beforeEach(() => {
    useCartStore.setState({ items: [] })
    vi.mocked(toast).mockClear()
  })

  it('updates new and existing cart items without a success overlay when requested', () => {
    useCartStore.getState().addItem(item, { notifySuccess: false })
    useCartStore.getState().addItem(item, { notifySuccess: false })
    expect(useCartStore.getState().items[0]?.quantity).toBe(2)
    expect(toast).not.toHaveBeenCalled()
  })

  it('keeps success feedback for callers that do not opt out', () => {
    useCartStore.getState().addItem(item)
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ title: '已添加到购物车' }))
  })

  it('refreshes stock limits without silently reducing or removing selected quantities', () => {
    useCartStore.getState().addItem({ ...item, quantity: 3 }, { notifySuccess: false })
    useCartStore.getState().syncAvailability([{ id: item.goodsId, availableQty: 1 }])
    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: 3, availableQty: 1 })
    useCartStore.getState().syncAvailability([])
    expect(useCartStore.getState().items[0]).toMatchObject({ quantity: 3, availableQty: 0 })
  })

  it('still reports insufficient stock without modifying the cart', () => {
    useCartStore.getState().addItem({ ...item, quantity: 4 }, { notifySuccess: false })
    expect(useCartStore.getState().items).toEqual([])
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
    vi.mocked(toast).mockClear()
    useCartStore.getState().addItem({ ...item, quantity: 3 }, { notifySuccess: false })
    useCartStore.getState().addItem(item, { notifySuccess: false })
    expect(useCartStore.getState().items[0]?.quantity).toBe(3)
    expect(toast).toHaveBeenCalledWith(expect.objectContaining({ variant: 'destructive' }))
  })

  it('allows reducing an overstocked selection after refresh without allowing increases', () => {
    useCartStore.getState().addItem({ ...item, quantity: 3 }, { notifySuccess: false })
    useCartStore.getState().syncAvailability([{ id: item.goodsId, availableQty: 1 }])
    expect(useCartStore.getState().updateQuantity(item.goodsId, 2)).toBe(true)
    expect(useCartStore.getState().items[0]?.quantity).toBe(2)
    expect(useCartStore.getState().updateQuantity(item.goodsId, 3)).toBe(false)
    expect(useCartStore.getState().items[0]?.quantity).toBe(2)
    expect(useCartStore.getState().updateQuantity(item.goodsId, 1)).toBe(true)
    expect(useCartStore.getState().items[0]?.quantity).toBe(1)
  })
})
