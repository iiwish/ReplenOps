import { requirePageAccess } from '@/lib/rbac-server'
import { stockInService } from '@/services/stock-in.service'
import InventoryAdjustmentClient from './InventoryAdjustmentClient'

export const metadata = {
  title: '库存调整',
}

export default async function InventoryAdjustmentPage() {
  // 权限验证
  await requirePageAccess('/admin/inventory/adjustment')

  // 获取仓库列表
  const warehouses = await stockInService.getActiveWarehouses()

  return (
    <InventoryAdjustmentClient
      warehouses={warehouses.map((warehouse) => ({
        id: String(warehouse.id),
        name: warehouse.name,
      }))}
    />
  )
}
