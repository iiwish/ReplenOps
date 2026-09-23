'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { getCancelledOrderCartRecovery } from '@/actions/order-actions'
import type { CancelledOrderCartRecovery } from '@/services/order.service'
import { hydrateCartStore, useCartStore } from '@/lib/stores/cart.store'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'
import { toast } from '@/hooks/use-toast'

export const cartRecoveryKey = (orderId: string) => `replenops-cart-recovered-${orderId}`

export function RestoreCancelledOrderButton({
  orderId,
  storeId,
}: {
  orderId: string
  storeId: string
}) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const restore = async () => {
    setLoading(true)
    try {
      await hydrateCartStore()
      const selectedStoreId = useStoreSelectionStore.getState().selectedStoreId
      const cart = useCartStore.getState()
      const clearOtherStoreCart = selectedStoreId !== storeId && cart.items.length > 0
      if (clearOtherStoreCart) {
        if (!window.confirm('切换门店需要清空当前购物车，是否继续？')) return
      }

      const result = await getCancelledOrderCartRecovery(orderId)
      if (!result.success || !result.data) {
        throw new Error(result.message || '获取订单商品失败')
      }

      const recovery = result.data as CancelledOrderCartRecovery
      if (recovery.items.length === 0) {
        toast({
          title: '没有可恢复的商品',
          description: '原商品均已停用，请重新选择商品',
          variant: 'destructive',
        })
        return
      }

      if (clearOtherStoreCart) cart.clear()
      useCartStore.getState().restoreItems(recovery.items)
      useStoreSelectionStore.getState().setSelectedStoreId(storeId)
      window.localStorage.setItem(cartRecoveryKey(orderId), '1')

      const notices = [
        recovery.unavailableGoods.length > 0
          ? `${recovery.unavailableGoods.length} 种停用商品未加入`
          : null,
        recovery.stockChanged ? '部分商品库存不足，请调整数量' : null,
        recovery.priceChanged ? '商品价格已更新' : null,
      ].filter(Boolean)
      toast({
        title: '商品已加入购物车',
        description: notices.length > 0 ? notices.join('；') : '请核对价格和数量后重新下单',
      })
      router.push('/mobile/order')
    } catch (error) {
      toast({
        title: '恢复购物车失败',
        description: error instanceof Error ? error.message : '请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button className="w-full" onClick={() => void restore()} disabled={loading}>
      {loading ? '恢复中...' : '将原商品加入购物车'}
    </Button>
  )
}
