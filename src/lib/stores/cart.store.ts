import { create } from 'zustand'
import { persist } from 'zustand/middleware'
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

const normalizeQuantity = (quantity: number) => (quantity > 0 ? Math.max(1, quantity) : quantity)

const isCartItem = (value: unknown): value is CartItem => {
  if (typeof value !== 'object' || value === null) return false

  const item = value as Record<string, unknown>

  return (
    typeof item.goodsId === 'string' &&
    typeof item.code === 'string' &&
    typeof item.name === 'string' &&
    (typeof item.spec === 'string' || item.spec === null) &&
    typeof item.unit === 'string' &&
    (item.measureType === 'INT' || item.measureType === 'DECIMAL') &&
    typeof item.price === 'number' &&
    typeof item.quantity === 'number' &&
    typeof item.availableQty === 'number' &&
    (typeof item.imageUrl === 'string' || item.imageUrl === null || item.imageUrl === undefined)
  )
}

const mergePersistedCart = (persistedState: unknown, currentState: CartStore): CartStore => {
  if (typeof persistedState !== 'object' || persistedState === null) {
    return currentState
  }

  const persisted = persistedState as Record<string, unknown>
  const persistedItems = Array.isArray(persisted.items)
    ? persisted.items.filter(isCartItem)
    : undefined

  if (!persistedItems) {
    return currentState
  }

  return {
    ...currentState,
    items: persistedItems.map((item) => ({ ...item, quantity: normalizeQuantity(item.quantity) })),
  }
}

interface CartStore {
  items: CartItem[]
  hasHydrated: boolean
  addItem: (item: CartItem) => void
  removeItem: (goodsId: string) => void
  updateQuantity: (goodsId: string, quantity: number) => boolean
  clear: () => void
  getTotalAmount: () => number
  getTotalQuantity: () => number
  setHasHydrated: (hasHydrated: boolean) => void
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],
      hasHydrated: false,

      setHasHydrated: (hasHydrated) => {
        set({ hasHydrated })
      },

      addItem: (item) => {
        const items = get().items
        const existing = items.find((i) => i.goodsId === item.goodsId)
        const normalizedItem = { ...item, quantity: normalizeQuantity(item.quantity) }

        if (existing) {
          // 检查库存
          const newQty = existing.quantity + normalizedItem.quantity
          if (newQty > normalizedItem.availableQty) {
            toast({
              title: '库存不足',
              description: `当前可用库存：${normalizedItem.availableQty} ${normalizedItem.unit}`,
              variant: 'destructive',
            })
            return
          }

          set({
            items: items.map((i) =>
              i.goodsId === item.goodsId
                ? { ...i, quantity: newQty, availableQty: normalizedItem.availableQty }
                : i
            ),
          })

          toast({
            title: '已添加到购物车',
            description: `${normalizedItem.name} x ${normalizedItem.quantity}`,
          })
        } else {
          // 检查库存
          if (normalizedItem.quantity > normalizedItem.availableQty) {
            toast({
              title: '库存不足',
              description: `当前可用库存：${normalizedItem.availableQty} ${normalizedItem.unit}`,
              variant: 'destructive',
            })
            return
          }

          set({ items: [...items, normalizedItem] })

          toast({
            title: '已添加到购物车',
            description: `${normalizedItem.name} x ${normalizedItem.quantity}`,
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

        const normalizedQuantity = normalizeQuantity(quantity)

        // 检查库存
        if (normalizedQuantity > item.availableQty) {
          toast({
            title: '库存不足',
            description: `当前可用库存：${item.availableQty} ${item.unit}`,
            variant: 'destructive',
          })
          return false
        }

        if (normalizedQuantity <= 0) {
          get().removeItem(goodsId)
          return true
        }

        set({
          items: items.map((i) =>
            i.goodsId === goodsId ? { ...i, quantity: normalizedQuantity } : i
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
    }),
    {
      name: 'erp-cart-storage',
      merge: mergePersistedCart,
      skipHydration: true,
      onRehydrateStorage: () => (state, error) => {
        if (error) {
          console.error('购物车状态恢复失败:', error)
        }

        state?.setHasHydrated(true)
      },
    }
  )
)

/**
 * Persisted cart state must be restored after the first client render so the
 * server and browser render the same initial markup during hydration.
 */
export const hydrateCartStore = async () => {
  if (useCartStore.persist.hasHydrated()) return

  await useCartStore.persist.rehydrate()
}
