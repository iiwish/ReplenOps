import { requireRoles } from '@/lib/rbac-server'
import { MOBILE_ACCESS_ROLES } from '@/lib/rbac'
import type { UserRole } from '@/types'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import ChangePasswordForm from './ChangePasswordForm'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '超级管理员',
  warehouse_manager: '仓库管理员',
  store_admin: '门店管理员',
  finance: '财务',
  approver: '审批员',
}

export default async function MobileProfileInfoPage() {
  const { user, role } = await requireRoles(MOBILE_ACCESS_ROLES)
  const displayName = user.displayName || user.name || user.username
  const roleLabel = ROLE_LABELS[role]
  const initials = displayName.substring(0, 2).toUpperCase()

  const details = [
    { label: '用户名', value: user.username },
    { label: '邮箱', value: user.email || '未设置' },
    { label: '手机号', value: user.phone || '未设置' },
  ]

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                {initials}
              </AvatarFallback>
            </Avatar>
            <div>
              <h2 className="text-lg font-semibold">{displayName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">账号信息</CardTitle>
        </CardHeader>
        <CardContent className="space-y-0">
          {details.map((detail, index) => (
            <div
              key={detail.label}
              className={`flex items-center justify-between gap-4 py-3 text-sm ${
                index > 0 ? 'border-t' : ''
              }`}
            >
              <span className="text-muted-foreground">{detail.label}</span>
              <span className="max-w-[65%] truncate text-right font-medium">{detail.value}</span>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">账户安全</CardTitle>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>
    </div>
  )
}
