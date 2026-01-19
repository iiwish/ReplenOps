import { requirePageAccess } from '@/lib/rbac-server'
import { Suspense } from 'react'
import { OrderDetailClient } from './OrderDetailClient'

export default async function OrderDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  await requirePageAccess('/admin/orders')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">订单详情</h1>
      <Suspense fallback={<div>加载中...</div>}>
        <OrderDetailClientWrapper params={params} />
      </Suspense>
    </div>
  )
}

async function OrderDetailClientWrapper({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  return <OrderDetailClient orderId={id} />
}
