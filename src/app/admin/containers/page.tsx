import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function ContainersPage() {
  await requirePageAccess('/admin/containers')
  return <PlaceholderPage title="包装物管理" />
}
