import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function AuditLogsPage() {
  await requirePageAccess('/admin/audit-logs')
  return <PlaceholderPage title="审计日志" />
}
