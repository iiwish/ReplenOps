import { requireRoles } from '@/lib/rbac-server'
import { MOBILE_ACCESS_ROLES } from '@/lib/rbac'
import OrdersClientPage from './OrdersClientPage'

export default async function MobileOrdersPage() {
  await requireRoles(MOBILE_ACCESS_ROLES)

  return <OrdersClientPage />
}
