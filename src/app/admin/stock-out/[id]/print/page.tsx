import { requirePageAccess } from '@/lib/rbac-server'
import { stockOutService } from '@/services/stock-out.service'
import StockOutPrintContent from '@/components/admin/stock-out/StockOutPrintContent'

export default async function StockOutPrintPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess('/admin/stock-out')
  const { id } = await params
  const stockOut = await stockOutService.findById(id)

  if (!stockOut) {
    return <div className="p-8 text-center">出库单不存在或已删除</div>
  }

  return <StockOutPrintContent stockOut={stockOut} />
}
