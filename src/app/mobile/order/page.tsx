import { requireRoles } from '@/lib/rbac-server'
import { MOBILE_ACCESS_ROLES } from '@/lib/rbac'
import { getOrderingCatalog } from '@/services/ordering-catalog.service'
import MobileOrderClient from './MobileOrderClient'

export default async function MobileOrderPage() {
  await requireRoles(MOBILE_ACCESS_ROLES)
  return <MobileOrderClient categories={await getOrderingCatalog()} />
}
