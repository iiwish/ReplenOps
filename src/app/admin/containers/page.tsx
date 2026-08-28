import { requirePageAccess } from '@/lib/rbac-server'
import { canPerformAction } from '@/lib/action-permissions'
import ContainerWorkspaceClient, { type ContainerWorkspaceView } from './ContainerWorkspaceClient'

const workspaceViews: ContainerWorkspaceView[] = ['outstanding', 'returns', 'all', 'settings']

export default async function ContainersPage({
  searchParams,
}: {
  searchParams: Promise<{ view?: string }>
}) {
  const { user } = await requirePageAccess('/admin/containers')
  const params = await searchParams
  const canManageContainers = canPerformAction(user, 'master-data:write')
  const requestedView = workspaceViews.includes(params.view as ContainerWorkspaceView)
    ? (params.view as ContainerWorkspaceView)
    : 'outstanding'
  const initialView =
    requestedView === 'settings' && !canManageContainers ? 'outstanding' : requestedView

  return (
    <ContainerWorkspaceClient
      initialView={initialView}
      canWriteStock={canPerformAction(user, 'stock:write')}
      canManageContainers={canManageContainers}
    />
  )
}
