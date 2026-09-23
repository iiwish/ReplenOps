import { beforeEach, describe, expect, it } from 'vitest'
import { useCartStore, type CartItem } from '@/lib/stores/cart.store'

const item: CartItem = {
  goodsId: '1',
  code: 'G-1',
  name: '商品',
  spec: null,
  unit: '件',
  measureType: 'INT',
  price: 8,
  quantity: 3,
  availableQty: 2,
}

describe('cancelled order cart recovery', () => {
  beforeEach(() => useCartStore.getState().clear())

  it('restores the requested quantity even when current stock is lower', () => {
    useCartStore.getState().restoreItems([item])
    expect(useCartStore.getState().items).toEqual([item])
  })

  it('does not double quantities when the same order is restored again', () => {
    useCartStore.getState().restoreItems([item])
    useCartStore.getState().restoreItems([item])
    expect(useCartStore.getState().items).toHaveLength(1)
    expect(useCartStore.getState().items[0]?.quantity).toBe(3)
  })

  it('preserves a larger quantity already chosen in the cart', () => {
    useCartStore.getState().restoreItems([{ ...item, quantity: 5 }])
    useCartStore.getState().restoreItems([item])
    expect(useCartStore.getState().items[0]?.quantity).toBe(5)
  })
})
