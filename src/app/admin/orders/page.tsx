import { requirePageAccess } from '@/lib/rbac-server'
import { Suspense } from 'react'
import { OrderListClient, type OrderListFilters } from './OrderListClient'
import { canPerformAction } from '@/lib/action-permissions'

interface OrdersSearchParams {
  status?: string | string[]
  startDate?: string
  endDate?: string
  approval?: string | string[]
}

const ORDER_STATUS_FILTERS = new Set([
  'PENDING',
  'APPROVED',
  'REJECTED',
  'PROCESSING',
  'COMPLETED',
  'CANCELLED',
  'PENDING,APPROVED,PROCESSING',
])

function firstParam(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<OrdersSearchParams>
}) {
  const { user } = await requirePageAccess('/admin/orders')
  const params = await searchParams
  const requestedStatus = Array.isArray(params.status) ? params.status.join(',') : params.status
  const initialFilters: OrderListFilters = {
    status:
      requestedStatus && ORDER_STATUS_FILTERS.has(requestedStatus) ? requestedStatus : undefined,
    startDate: firstParam(params.startDate),
    endDate: firstParam(params.endDate),
  }
  const requestedApproval = firstParam(params.approval)
  const initialApprovalOrderId =
    requestedApproval && /^\d+$/.test(requestedApproval) ? requestedApproval : undefined
  const canReviewOrders = canPerformAction(user, 'order:review')

  return (
    <div className="p-6">
      <h1 className="mb-6 text-2xl font-bold">订单列表</h1>
      <Suspense fallback={<div>加载中...</div>}>
        <OrderListClient
          initialFilters={initialFilters}
          initialApprovalOrderId={initialApprovalOrderId}
          canReviewOrders={canReviewOrders}
        />
      </Suspense>
    </div>
  )
}
