import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function StockOutPage() {
  await requirePageAccess('/admin/stock-out')
  return <PlaceholderPage title="出库管理" />
}
