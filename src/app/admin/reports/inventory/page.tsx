import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function InventoryReportPage() {
  await requirePageAccess('/admin/reports/inventory')
  return <PlaceholderPage title="库存报表" />
}
