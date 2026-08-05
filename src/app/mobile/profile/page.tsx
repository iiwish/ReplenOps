import { requireRoles } from '@/lib/rbac-server'
import { MOBILE_ACCESS_ROLES } from '@/lib/rbac'
import type { UserRole } from '@/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { User, LogOut, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import type { Route } from 'next'

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: '超级管理员',
  warehouse_manager: '仓库管理员',
  store_admin: '门店管理员',
  finance: '财务',
  approver: '审批员',
}

export default async function MobileProfilePage() {
  const { user, role } = await requireRoles(MOBILE_ACCESS_ROLES)
  const displayName = user.displayName || user.name || user.username
  const roleLabel = ROLE_LABELS[role]

  // 获取用户名首字母用于头像
  const getInitials = (name: string) => {
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-4 p-4">
      {/* 用户信息卡片 */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarFallback className="bg-primary text-lg text-primary-foreground">
                {getInitials(displayName)}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="text-lg font-semibold">{displayName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 设置选项 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-1">
          <Link
            href={'/mobile/profile/info' as Route}
            className="flex min-h-[48px] w-full items-center justify-between rounded-lg p-3 transition-colors hover:bg-accent"
          >
            <div className="flex items-center gap-3">
              <User className="h-5 w-5 text-muted-foreground" />
              <span>个人信息</span>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground" />
          </Link>
        </CardContent>
      </Card>

      {/* 退出登录 */}
      <Card>
        <CardContent className="pt-6">
          <Button variant="destructive" className="min-h-[48px] w-full" asChild>
            <Link href="/api/auth/logout">
              <LogOut className="mr-2 h-5 w-5" />
              退出登录
            </Link>
          </Button>
        </CardContent>
      </Card>

      {/* 版本信息 */}
      <div className="py-4 text-center text-xs text-muted-foreground">ReplenOps</div>

      {/* 底部间距 */}
      <div className="h-4" />
    </div>
  )
}
