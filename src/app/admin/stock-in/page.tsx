import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function StockInPage() {
  await requirePageAccess('/admin/stock-in')
  return <PlaceholderPage title="入库管理" />
}
