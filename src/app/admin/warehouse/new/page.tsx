import { requirePageAccess } from '@/lib/rbac-server'
import WarehouseFormClient from '../WarehouseFormClient'

export default async function NewWarehousePage() {
  await requirePageAccess('/admin/warehouse')

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>新增仓库</h2>
      <WarehouseFormClient mode="create" />
    </div>
  )
}
