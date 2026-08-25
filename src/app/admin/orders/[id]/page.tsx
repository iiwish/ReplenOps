import { requirePageAccess } from '@/lib/rbac-server'
import { Suspense } from 'react'
import { OrderDetailClient } from './OrderDetailClient'
import { canPerformAction } from '@/lib/action-permissions'

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { user } = await requirePageAccess('/admin/orders')
  const canReviewOrders = canPerformAction(user, 'order:review')

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">订单详情</h1>
      <Suspense fallback={<div>加载中...</div>}>
        <OrderDetailClientWrapper params={params} canReviewOrders={canReviewOrders} />
      </Suspense>
    </div>
  )
}

async function OrderDetailClientWrapper({
  params,
  canReviewOrders,
}: {
  params: Promise<{ id: string }>
  canReviewOrders: boolean
}) {
  const { id } = await params
  return <OrderDetailClient orderId={id} canReviewOrders={canReviewOrders} />
}
