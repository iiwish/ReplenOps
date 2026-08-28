import { requirePageAccess } from '@/lib/rbac-server'
import { redirect } from 'next/navigation'

export default async function ContainerReturnListPage() {
  await requirePageAccess('/admin/container-return')
  redirect('/admin/containers?view=returns')
}
