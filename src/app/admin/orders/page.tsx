import { requirePageAccess } from '@/lib/rbac-server'
import { Suspense } from 'react'
import { OrderListClient, type OrderListFilters } from './OrderListClient'
import { canPerformAction } from '@/lib/action-permissions'
import { goodsService, type OrderGoodsOption } from '@/services/goods.service'
import { storeService, type StoreOption } from '@/services/store.service'

interface OrdersSearchParams {
  status?: string | string[]
  startDate?: string
  endDate?: string
  keyword?: string
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
    keyword: firstParam(params.keyword),
  }
  const requestedApproval = firstParam(params.approval)
  const initialApprovalOrderId =
    requestedApproval && /^\d+$/.test(requestedApproval) ? requestedApproval : undefined
  const canCreateOrders = canPerformAction(user, 'order:write')
  const canReviewOrders = canPerformAction(user, 'order:review')
  const canWriteStock = canPerformAction(user, 'stock:write')
  let stores: StoreOption[] = []
  let goods: OrderGoodsOption[] = []

  if (canCreateOrders) {
    const options = await Promise.all([
      storeService.listActiveOptions(),
      goodsService.listActiveOrderOptions(),
    ])
    stores = options[0]
    goods = options[1]
  }

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col">
      <Suspense fallback={<div className="flex h-full min-h-0 flex-col">加载中...</div>}>
        <OrderListClient
          initialFilters={initialFilters}
          initialApprovalOrderId={initialApprovalOrderId}
          canCreateOrders={canCreateOrders}
          canReviewOrders={canReviewOrders}
          canWriteStock={canWriteStock}
          stores={stores}
          goods={goods}
        />
      </Suspense>
    </div>
  )
}
