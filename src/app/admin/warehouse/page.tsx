import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function WarehousePage() {
  await requirePageAccess('/admin/warehouse')
  return <PlaceholderPage title="仓库管理" />
}
