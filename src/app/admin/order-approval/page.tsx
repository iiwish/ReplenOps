import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function OrderApprovalPage() {
  await requirePageAccess('/admin/order-approval')
  return <PlaceholderPage title="订单审批" />
}
