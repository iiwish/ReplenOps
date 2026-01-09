import { requirePageAccess } from '@/lib/rbac-server'
import StockInDetailClient from './StockInDetailClient'
import { stockInService } from '@/services/stock-in.service'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StockInDetailPage({ params }: PageProps) {
  await requirePageAccess('/admin/stock-in')

  const { id } = await params

  // 获取入库单详情
  try {
    const stockIn = await stockInService.findById(id)
    return <StockInDetailClient data={stockIn} />
  } catch (error) {
    notFound()
  }
}
