import { requirePageAccess } from '@/lib/rbac-server'
import ContainerTrackingClient from './ContainerTrackingClient'

export default async function ContainerTrackingPage() {
  await requirePageAccess('/admin/container-tracking')
  return <ContainerTrackingClient />
}
