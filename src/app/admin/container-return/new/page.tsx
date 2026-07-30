import { ContainerReturnForm } from '@/components/admin/containers/ContainerReturnForm'
import { requirePageAccess } from '@/lib/rbac-server'

export default async function NewContainerReturnPage() {
  await requirePageAccess('/admin/container-return/new')

  return (
    <div style={{ padding: '24px' }}>
      <h1>包装物归还登记</h1>
      <ContainerReturnForm />
    </div>
  )
}
