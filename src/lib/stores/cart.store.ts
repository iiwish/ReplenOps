import { create } from 'zustand'
import { toast } from '@/hooks/use-toast'

export interface CartItem {
  goodsId: string
  code: string
  name: string
  spec: string | null
  unit: string
  measureType: 'INT' | 'DECIMAL'
  price: number
  quantity: number
  availableQty: number // 可用库存
  imageUrl?: string | null
}

interface CartStore {
  items: CartItem[]
  addItem: (item: CartItem) => void
  removeItem: (goodsId: string) => void
  updateQuantity: (goodsId: string, quantity: number) => boolean
  clear: () => void
  getTotalAmount: () => number
  getTotalQuantity: () => number
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],

  addItem: (item) => {
    const items = get().items
    const existing = items.find((i) => i.goodsId === item.goodsId)

    if (existing) {
      // 检查库存
      const newQty = existing.quantity + item.quantity
      if (newQty > item.availableQty) {
        toast({
          title: '库存不足',
          description: `当前可用库存：${item.availableQty} ${item.unit}`,
          variant: 'destructive',
        })
        return
      }

      set({
        items: items.map((i) =>
          i.goodsId === item.goodsId
            ? { ...i, quantity: newQty, availableQty: item.availableQty }
            : i
        ),
      })

      toast({
        title: '已添加到购物车',
        description: `${item.name} x ${item.quantity}`,
      })
    } else {
      // 检查库存
      if (item.quantity > item.availableQty) {
        toast({
          title: '库存不足',
          description: `当前可用库存：${item.availableQty} ${item.unit}`,
          variant: 'destructive',
        })
        return
      }

      set({ items: [...items, item] })

      toast({
        title: '已添加到购物车',
        description: `${item.name} x ${item.quantity}`,
      })
    }
  },

  removeItem: (goodsId) => {
    set({ items: get().items.filter((i) => i.goodsId !== goodsId) })
  },

  updateQuantity: (goodsId, quantity) => {
    const items = get().items
    const item = items.find((i) => i.goodsId === goodsId)

    if (!item) return false

    // 检查库存
    if (quantity > item.availableQty) {
      toast({
        title: '库存不足',
        description: `当前可用库存：${item.availableQty} ${item.unit}`,
        variant: 'destructive',
      })
      return false
    }

    if (quantity <= 0) {
      get().removeItem(goodsId)
      return true
    }

    set({
      items: items.map((i) =>
        i.goodsId === goodsId ? { ...i, quantity } : i
      ),
    })

    return true
  },

  clear: () => {
    set({ items: [] })
  },

  getTotalAmount: () => {
    return get().items.reduce((sum, item) => sum + item.price * item.quantity, 0)
  },

  getTotalQuantity: () => {
    return get().items.reduce((sum, item) => sum + item.quantity, 0)
  },
}))
