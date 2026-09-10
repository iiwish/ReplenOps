import { requirePageAccess } from '@/lib/rbac-server'
import { costService } from '@/services/cost.service'
import { stockInService } from '@/services/stock-in.service'
import { getShanghaiYesterdayMonthDateRange } from '@/lib/shanghai-time'
import CostHistoryListClient from './CostHistoryListClient'

export const metadata = {
  title: '成本变动记录',
}

export default async function CostHistoryPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    warehouseId?: string
    goodsId?: string
    startDate?: string
    endDate?: string
    dateRange?: string
  }>
}) {
  // 权限验证
  await requirePageAccess('/admin/inventory/cost-history')

  // 解析搜索参数
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const pageSize = parseInt(params.pageSize || '20', 10)
  const defaultDateRange = getShanghaiYesterdayMonthDateRange()
  const useDefaultDateRange = params.dateRange !== 'all'
  const startDate =
    params.startDate ||
    (useDefaultDateRange && !params.endDate ? defaultDateRange.startDate : undefined)
  const endDate =
    params.endDate ||
    (useDefaultDateRange && !params.startDate ? defaultDateRange.endDate : undefined)

  // 构建查询参数
  const queryParams = {
    page,
    pageSize,
    warehouseId: params.warehouseId,
    goodsId: params.goodsId,
    startDate,
    endDate,
  }

  // 获取成本历史列表
  const costHistoryResult = await costService.listHistory(queryParams)

  // 获取筛选数据
  const warehouses = await stockInService.getActiveWarehouses()

  return (
    <CostHistoryListClient
      initialData={costHistoryResult}
      warehouses={warehouses.map((warehouse) => ({
        id: String(warehouse.id),
        name: warehouse.name,
      }))}
      initialFilters={{
        warehouseId: params.warehouseId,
        goodsId: params.goodsId,
        startDate,
        endDate,
      }}
    />
  )
}
