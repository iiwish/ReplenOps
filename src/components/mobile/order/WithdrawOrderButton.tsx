'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { revokeOrder } from '@/actions/order-actions'
import { hydrateCartStore, useCartStore } from '@/lib/stores/cart.store'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface WithdrawOrderButtonProps {
  orderId: string
  orderCode: string
  storeId: string
}

export function WithdrawOrderButton({ orderId, orderCode, storeId }: WithdrawOrderButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleRevoke = async () => {
    if (!confirm(`确定撤回订单 ${orderCode} 吗？商品将恢复至购物车。`)) {
      return
    }

    setLoading(true)
    try {
      await hydrateCartStore()
      const result = await revokeOrder(orderId)

      if (!result.success) {
        toast({
          title: '撤回失败',
          description: result.message,
          variant: 'destructive',
        })
        return
      }

      const restoredItems = result.restoredCartItems ?? []
      if (restoredItems.length > 0) {
        useCartStore.getState().restoreItems(restoredItems)
      }
      toast({
        title: '订单已撤回',
        description:
          restoredItems.length > 0
            ? `${restoredItems.length} 种商品已恢复至购物车`
            : '请重新选择商品',
      })

      useStoreSelectionStore.getState().setSelectedStoreId(storeId)
      router.replace('/mobile/order')
    } catch {
      toast({ title: '撤回失败', description: '请检查网络后重试', variant: 'destructive' })
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button variant="destructive" className="w-full" onClick={handleRevoke} disabled={loading}>
      {loading ? '撤回中...' : '撤回订单'}
    </Button>
  )
}
