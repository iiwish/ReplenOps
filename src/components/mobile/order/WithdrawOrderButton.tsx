'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { revokeOrder } from '@/actions/order-actions'
import { useCartStore, type CartItem } from '@/lib/stores/cart.store'
import { toast } from '@/hooks/use-toast'
import { useRouter } from 'next/navigation'

interface WithdrawOrderButtonProps {
  orderId: string
  orderCode: string
  /** 传递给 useCartStore.addItem 的商品列表（来自订单详情接口） */
  orderItems: Array<{
    goodsId: string
    goodsCode: string
    goodsName: string
    goodsUnit: string
    measureType: string
    quantity: number
    unitPrice: number
  }>
}

export function WithdrawOrderButton({
  orderId,
  orderCode,
  orderItems,
}: WithdrawOrderButtonProps) {
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const addItem = useCartStore((s) => s.addItem)

  const handleRevoke = async () => {
    if (!confirm(`确定撤回订单 ${orderCode} 吗？商品将恢复至购物车。`)) {
      return
    }

    setLoading(true)
    try {
      const result = await revokeOrder(orderId)

      if (!result.success) {
        toast({
          title: '撤回失败',
          description: result.message,
          variant: 'destructive',
        })
        return
      }

      // 恢复购物车商品
      if (result.restoredCartItems && result.restoredCartItems.length > 0) {
        for (const item of result.restoredCartItems) {
          const cartItem: CartItem = {
            goodsId: String(item.goodsId),
            code: item.code,
            name: item.name,
            spec: item.spec,
            unit: item.unit,
            measureType: item.measureType as 'INT' | 'DECIMAL',
            price: item.price,
            quantity: item.quantity,
            availableQty: item.availableQty,
            imageUrl: item.imageUrl,
          }
          addItem(cartItem)
        }
      } else {
        // 降级：使用订单详情中的items（不做库存校验）
        for (const item of orderItems) {
          const cartItem: CartItem = {
            goodsId: item.goodsId,
            code: item.goodsCode,
            name: item.goodsName,
            spec: null,
            unit: item.goodsUnit,
            measureType: item.measureType as 'INT' | 'DECIMAL',
            price: item.unitPrice,
            quantity: item.quantity,
            availableQty: 999999, // 不校验库存
            imageUrl: null,
          }
          addItem(cartItem)
        }
      }

      const restoredCount = result.restoredCartItems?.length ?? orderItems.length
      toast({
        title: '订单已撤回',
        description: `${restoredCount} 件商品已恢复至购物车`,
      })

      router.push('/mobile/order/cart')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      variant="destructive"
      className="w-full"
      onClick={handleRevoke}
      disabled={loading}
    >
      {loading ? '撤回中...' : '撤回订单'}
    </Button>
  )
}
