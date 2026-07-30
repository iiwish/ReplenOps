import { requirePageAccess } from '@/lib/rbac-server'
import { costService } from '@/services/cost.service'
import { stockInService } from '@/services/stock-in.service'
import CostHistoryListClient from './CostHistoryListClient'

export const metadata = {
  title: '成本历史',
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
  }>
}) {
  // 权限验证
  await requirePageAccess('/admin/inventory/cost-history')

  // 解析搜索参数
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const pageSize = parseInt(params.pageSize || '20', 10)

  // 构建查询参数
  const queryParams = {
    page,
    pageSize,
    warehouseId: params.warehouseId,
    goodsId: params.goodsId,
    startDate: params.startDate,
    endDate: params.endDate,
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
        startDate: params.startDate,
        endDate: params.endDate,
      }}
    />
  )
}
