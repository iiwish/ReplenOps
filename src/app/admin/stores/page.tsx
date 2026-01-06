import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function StoresPage() {
  await requirePageAccess('/admin/stores')
  return <PlaceholderPage title="门店列表" />
}
