import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function StoreAdminsPage() {
  await requirePageAccess('/admin/store-admins')
  return <PlaceholderPage title="门店管理员" />
}
