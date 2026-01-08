import { requirePageAccess } from '@/lib/rbac-server'
import StoreFormClient from '../StoreFormClient'

export default async function NewStorePage() {
  await requirePageAccess('/admin/stores')

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>新增门店</h2>
      <StoreFormClient mode="create" />
    </div>
  )
}
