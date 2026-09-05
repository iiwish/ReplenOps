import { requirePageAccess } from '@/lib/rbac-server'
import StockOutListClient from './StockOutListClient'
import { canPerformAction } from '@/lib/action-permissions'
import { stockOutService } from '@/services/stock-out.service'
import { stockInService } from '@/services/stock-in.service'

interface SearchParams {
  page?: string
  pageSize?: string
  keyword?: string
  status?: string
  warehouseId?: string
  startDate?: string
  endDate?: string
}

export default async function StockOutPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const { user } = await requirePageAccess('/admin/stock-out')

  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const pageSize = parseInt(params.pageSize || '20', 10)
  const keyword = params.keyword
  const status = params.status
  const warehouseId = params.warehouseId
  const startDate = params.startDate
  const endDate = params.endDate

  const [result, warehouses] = await Promise.all([
    stockOutService.list({
      page,
      keyword,
      status,
      warehouseId,
      startDate,
      endDate,
      pageSize,
    }),
    stockInService.getActiveWarehouses(),
  ])

  return (
    <StockOutListClient
      initialData={result}
      warehouses={warehouses.map((warehouse) => ({
        ...warehouse,
        id: String(warehouse.id),
      }))}
      initialFilters={{ keyword, status, warehouseId, startDate, endDate }}
      canReviewOrders={canPerformAction(user, 'order:review')}
      canWriteStock={canPerformAction(user, 'stock:write')}
    />
  )
}
