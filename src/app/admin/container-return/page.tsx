import { ContainerReturnList } from '@/components/admin/containers/ContainerReturnList'
import { requirePageAccess } from '@/lib/rbac-server'
import { canPerformAction } from '@/lib/action-permissions'

export default async function ContainerReturnListPage() {
  const { user } = await requirePageAccess('/admin/container-return')

  return (
    <div style={{ padding: '24px' }}>
      <h1>包装物归还记录</h1>
      <ContainerReturnList canWriteStock={canPerformAction(user, 'stock:write')} />
    </div>
  )
}
