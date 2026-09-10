import { requirePageAccess } from '@/lib/rbac-server'
import { inventoryLogService } from '@/services/inventory-log.service'
import { stockInService } from '@/services/stock-in.service'
import InventoryLogListClient from './InventoryLogListClient'
import { getShanghaiDateRange, getShanghaiYesterdayMonthDateRange } from '@/lib/shanghai-time'
import { canPerformAction } from '@/lib/action-permissions'

export const metadata = {
  title: '库存流水',
}

export default async function InventoryLogsPage({
  searchParams,
}: {
  searchParams: Promise<{
    page?: string
    pageSize?: string
    warehouseId?: string
    goodsId?: string
    changeTypes?: string
    startDate?: string
    endDate?: string
    dateRange?: string
    operatorId?: string
    adjustment?: string
  }>
}) {
  // 权限验证
  const { user } = await requirePageAccess('/admin/inventory/logs')

  // 解析搜索参数
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const pageSize = parseInt(params.pageSize || '20', 10)
  const defaultDateRange = getShanghaiYesterdayMonthDateRange()
  const useDefaultDateRange = params.dateRange !== 'all'
  const startDate =
    params.startDate || (useDefaultDateRange && !params.endDate ? defaultDateRange.startDate : undefined)
  const endDate =
    params.endDate || (useDefaultDateRange && !params.startDate ? defaultDateRange.endDate : undefined)

  // 构建查询参数
  const dateRange = getShanghaiDateRange(startDate, endDate)
  const queryParams = {
    page,
    pageSize,
    warehouseId: params.warehouseId,
    goodsId: params.goodsId,
    changeTypes: params.changeTypes ? params.changeTypes.split(',') : undefined,
    startDate: dateRange.start,
    endDateExclusive: dateRange.endExclusive,
    operatorId: params.operatorId,
  }

  const [logsResult, warehouses, operators] = await Promise.all([
    inventoryLogService.list(queryParams),
    stockInService.getActiveWarehouses(),
    inventoryLogService.getOperators(),
  ])

  return (
    <InventoryLogListClient
      initialData={logsResult}
      warehouses={warehouses.map((warehouse) => ({
        id: String(warehouse.id),
        name: warehouse.name,
      }))}
      operators={operators}
      initialFilters={{
        warehouseId: params.warehouseId,
        goodsId: params.goodsId,
        changeTypes: params.changeTypes ? params.changeTypes.split(',') : [],
        startDate,
        endDate,
        operatorId: params.operatorId,
      }}
      canAdjustInventory={canPerformAction(user, 'inventory:adjust')}
      initialAdjustmentOpen={params.adjustment === '1'}
    />
  )
}
