import { requirePageAccess } from '@/lib/rbac-server'
import { inventoryLogService } from '@/services/inventory-log.service'
import { stockInService } from '@/services/stock-in.service'
import InventoryLogListClient from './InventoryLogListClient'

export const metadata = {
  title: '库存变动日志',
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
    operatorId?: string
  }>
}) {
  // 权限验证
  await requirePageAccess('/admin/inventory/logs')

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
    changeTypes: params.changeTypes ? params.changeTypes.split(',') : undefined,
    startDate: params.startDate ? new Date(params.startDate) : undefined,
    endDate: params.endDate ? new Date(params.endDate) : undefined,
    operatorId: params.operatorId,
  }

  // 获取库存日志列表
  const logsResult = await inventoryLogService.list(queryParams)

  // 获取筛选数据
  const warehouses = await stockInService.getActiveWarehouses()

  // 当前操作人筛选暂未接入用户列表查询
  const operators: Array<{ id: string; username: string }> = []

  return (
    <InventoryLogListClient
      initialData={logsResult}
      warehouses={warehouses.map((warehouse) => ({
        id: String(warehouse.id),
        name: warehouse.name,
      }))}
      operators={operators}
    />
  )
}
