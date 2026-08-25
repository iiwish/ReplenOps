import { requirePageAccess } from '@/lib/rbac-server'
import AuditLogListClient from './AuditLogListClient'
import { auditLogService } from '@/services/audit-log.service'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'

export default async function AuditLogsPage() {
  await requirePageAccess('/admin/audit-logs')

  const user = await getCurrentUser()
  const roles = user ? getUserRoles(user) : []
  const isSuperAdmin = roles.includes('super_admin')

  const [result, operators] = await Promise.all([
    auditLogService.list({
      page: 1,
      pageSize: 20,
    }),
    isSuperAdmin
      ? auditLogService.getOperators()
      : Promise.resolve(user ? [{ id: user.id, name: user.name || user.username }] : []),
  ])

  return (
    <AuditLogListClient initialData={result} isSuperAdmin={isSuperAdmin} operators={operators} />
  )
}
