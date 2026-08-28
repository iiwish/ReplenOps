import { requirePageAccess } from '@/lib/rbac-server'
import { redirect } from 'next/navigation'

export default async function ContainerTrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ hasUnreturned?: string }>
}) {
  await requirePageAccess('/admin/container-tracking')
  const params = await searchParams
  redirect(
    params.hasUnreturned === 'true'
      ? '/admin/containers?view=outstanding'
      : '/admin/containers?view=all'
  )
}
