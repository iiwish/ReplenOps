import { requirePageAccess } from '@/lib/rbac-server'
import { canPerformAction } from '@/lib/action-permissions'
import ContainerTrackingClient from './ContainerTrackingClient'

export default async function ContainerTrackingPage() {
  const { user } = await requirePageAccess('/admin/container-tracking')
  return <ContainerTrackingClient canWriteStock={canPerformAction(user, 'stock:write')} />
}
