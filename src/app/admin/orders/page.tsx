import { requirePageAccess } from '@/lib/rbac-server'
import { Suspense } from 'react'
import { OrderListClient } from './OrderListClient'

export default async function OrdersPage() {
  await requirePageAccess('/admin/orders')

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6">订单列表</h1>
      <Suspense fallback={<div>加载中...</div>}>
        <OrderListClient />
      </Suspense>
    </div>
  )
}
