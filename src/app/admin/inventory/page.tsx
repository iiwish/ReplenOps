import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function InventoryPage() {
  await requirePageAccess('/admin/inventory')
  return <PlaceholderPage title="库存查询" />
}
