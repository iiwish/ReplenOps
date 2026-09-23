'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, PackageX } from 'lucide-react'
import { getCancelledOrdersForCartRecovery } from '@/actions/order-actions'
import { cartRecoveryKey } from './RestoreCancelledOrderButton'

interface RecoveryOrder {
  id: string
  code: string
}

export function CancelledOrderRecoveryNotice({ storeId }: { storeId: string | null }) {
  const [notice, setNotice] = useState<{ storeId: string; order: RecoveryOrder } | null>(null)

  useEffect(() => {
    let cancelled = false
    if (!storeId) return

    void getCancelledOrdersForCartRecovery(storeId)
      .then((result) => {
        if (cancelled) return
        const orders = result.success ? (result.data as RecoveryOrder[]) : []
        const order = orders.find(
          (candidate) => window.localStorage.getItem(cartRecoveryKey(candidate.id)) !== '1'
        )
        setNotice(order ? { storeId, order } : null)
      })
      .catch(() => {
        if (!cancelled) setNotice(null)
      })

    return () => {
      cancelled = true
    }
  }, [storeId])

  if (!notice || notice.storeId !== storeId) return null
  const { order } = notice

  return (
    <section className="border-y border-amber-200 bg-amber-50 px-4 py-3" aria-label="已取消订单">
      <div className="mx-auto flex max-w-xl items-start gap-3">
        <PackageX className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <p className="break-all text-sm font-semibold text-gray-950">订单 {order.code} 已取消</p>
          <p className="mt-1 text-xs text-gray-600">
            原商品可以重新加入购物车，提交前请核对库存和价格。
          </p>
          <Link
            href={`/mobile/orders/${order.id}`}
            className="mt-2 inline-flex items-center gap-1 text-sm font-medium text-amber-800 underline-offset-2 hover:underline"
          >
            查看并恢复商品 <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  )
}
