'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { confirmOrderReceipt } from '@/actions/order-actions'
import { toast } from '@/hooks/use-toast'

interface ConfirmReceiptButtonProps {
  orderId: string
  orderCode: string
}

export function ConfirmReceiptButton({
  orderId,
  orderCode,
}: ConfirmReceiptButtonProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  const handleConfirm = async () => {
    if (!confirm(`确认已收到订单 ${orderCode} 的商品吗？确认后订单将变为已完成。`)) {
      return
    }

    setLoading(true)
    try {
      const result = await confirmOrderReceipt(orderId)

      if (!result.success) {
        toast({
          title: '确认收货失败',
          description: result.message,
          variant: 'destructive',
        })
        return
      }

      toast({
        title: '确认收货成功',
        description: `订单 ${orderCode} 已完成`,
      })
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <Button
      className="w-full"
      onClick={handleConfirm}
      disabled={loading}
    >
      {loading ? '确认中...' : '确认收货'}
    </Button>
  )
}
