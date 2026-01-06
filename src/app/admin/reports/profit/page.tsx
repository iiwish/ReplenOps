import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function ProfitReportPage() {
  await requirePageAccess('/admin/reports/profit')
  return <PlaceholderPage title="利润分析" />
}
