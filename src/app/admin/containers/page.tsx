import { requirePageAccess } from '@/lib/rbac-server'
import ContainersListClient from './ContainersListClient'

export default async function ContainersPage() {
  await requirePageAccess('/admin/containers')
  return <ContainersListClient />
}
