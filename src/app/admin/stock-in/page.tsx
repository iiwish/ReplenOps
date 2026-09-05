import { requirePageAccess } from '@/lib/rbac-server'
import StockInListClient from './StockInListClient'
import { stockInService } from '@/services/stock-in.service'

interface SearchParams {
  page?: string
  keyword?: string
  status?: string
  warehouseId?: string
  startDate?: string
  endDate?: string
}

export default async function StockInPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePageAccess('/admin/stock-in')

  // 获取搜索参数
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const keyword = params.keyword
  const status = params.status
  const warehouseId = params.warehouseId
  const startDate = params.startDate
  const endDate = params.endDate

  const [result, warehouses] = await Promise.all([
    stockInService.list({
      page,
      pageSize: 20,
      keyword,
      status,
      warehouseId,
      startDate,
      endDate,
    }),
    stockInService.getActiveWarehouses(),
  ])

  return (
    <StockInListClient
      initialData={result}
      warehouses={warehouses.map((warehouse) => ({
        ...warehouse,
        id: String(warehouse.id),
      }))}
    />
  )
}
