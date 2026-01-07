import { requireRoles } from '@/lib/rbac-server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { FileText, Package, TrendingUp } from 'lucide-react'
import Link from 'next/link'

export default async function MobileHomePage() {
  // 验证用户权限，仅允许 store_admin 访问
  const { user } = await requireRoles(['store_admin'])

  return (
    <div className="p-4 space-y-4">
      {/* 欢迎信息 */}
      <Card>
        <CardHeader>
          <CardTitle>欢迎回来</CardTitle>
          <CardDescription>
            {user.displayName || user.name}
          </CardDescription>
        </CardHeader>
      </Card>

      {/* 数据概览 */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>今日订单</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">12</div>
            <div className="flex items-center text-xs text-muted-foreground mt-1">
              <TrendingUp className="w-3 h-3 mr-1" />
              <span>+2 较昨日</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardDescription>待审批</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">3</div>
            <div className="text-xs text-muted-foreground mt-1">
              需处理
            </div>
          </CardContent>
        </Card>
      </div>

      {/* 快速入口 */}
      <Card>
        <CardHeader>
          <CardTitle>快速操作</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <Link
            href="/mobile/order"
            className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-accent transition-colors min-h-[100px]"
          >
            <FileText className="w-8 h-8 mb-2 text-primary" />
            <span className="text-sm font-medium">下单</span>
          </Link>

          <Link
            href="/mobile/orders"
            className="flex flex-col items-center justify-center p-6 border rounded-lg hover:bg-accent transition-colors min-h-[100px]"
          >
            <Package className="w-8 h-8 mb-2 text-primary" />
            <span className="text-sm font-medium">查看订单</span>
          </Link>
        </CardContent>
      </Card>

      {/* 底部间距 */}
      <div className="h-4" />
    </div>
  )
}
