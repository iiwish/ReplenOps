import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function OrdersPage() {
  await requirePageAccess('/admin/orders')
  return <PlaceholderPage title="订单列表" />
}
