import { requirePageAccess } from '@/lib/rbac-server'
import { canPerformAction } from '@/lib/action-permissions'
import ContainerTrackingClient from './ContainerTrackingClient'

export default async function ContainerTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ hasUnreturned?: string }>
}) {
  const { user } = await requirePageAccess('/admin/container-tracking')
  const params = await searchParams
  return (
    <ContainerTrackingClient
      canWriteStock={canPerformAction(user, 'stock:write')}
      initialHasUnreturned={params.hasUnreturned === 'true'}
    />
  )
}
