import { requirePageAccess } from '@/lib/rbac-server'
import StockOutDetailClient from '@/app/admin/stock-out/[id]/StockOutDetailClient'
import { stockOutService } from '@/services/stock-out.service'

export default async function StockOutDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageAccess('/admin/stock-out')

  const { id } = await params
  const stockOut = await stockOutService.findById(id)

  if (!stockOut) {
    return (
      <div className="p-8">
        <h1 className="mb-4 text-2xl font-bold">出库单不存在</h1>
        <p>该出库单可能已被删除或不存在。</p>
      </div>
    )
  }

  return <StockOutDetailClient stockOut={stockOut} />
}
