import { requireRoles } from '@/lib/rbac-server'
import InventoryScanClient from './InventoryScanClient'

export default async function InventoryScanPage() {
  await requireRoles(['store_admin', 'warehouse_manager', 'super_admin'])

  return <InventoryScanClient />
}
