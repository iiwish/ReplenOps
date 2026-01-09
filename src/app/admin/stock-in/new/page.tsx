import { requirePageAccess } from '@/lib/rbac-server'
import StockInFormClient from '../StockInFormClient'
import { stockInService } from '@/services/stock-in.service'

export default async function NewStockInPage() {
  await requirePageAccess('/admin/stock-in')

  // 获取仓库列表
  const warehouses = await stockInService.getActiveWarehouses()

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>新建入库单</h2>
      <StockInFormClient mode="create" warehouses={warehouses} />
    </div>
  )
}
