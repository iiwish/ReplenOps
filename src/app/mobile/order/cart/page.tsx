import { requireRoles } from '@/lib/rbac-server'
import { MOBILE_ACCESS_ROLES } from '@/lib/rbac'
import { redirect } from 'next/navigation'

export default async function CartConfirmPage() {
  await requireRoles(MOBILE_ACCESS_ROLES)

  redirect('/mobile/order')
}
