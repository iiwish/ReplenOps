import { requirePageAccess } from '@/lib/rbac-server'
import AuditLogListClient from './AuditLogListClient'
import { auditLogService } from '@/services/audit-log.service'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'

export default async function AuditLogsPage() {
  await requirePageAccess('/admin/audit-logs')

  const user = await getCurrentUser()
  const roles = user ? getUserRoles(user) : []
  const isSuperAdmin = roles.includes('super_admin')

  const result = await auditLogService.list({
    page: 1,
    pageSize: 20,
  })

  return <AuditLogListClient initialData={result} isSuperAdmin={isSuperAdmin} />
}
