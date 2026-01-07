import { requireRoles } from '@/lib/rbac-server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { ChevronRight } from 'lucide-react'

export default async function MobileOrdersPage() {
  // 验证用户权限，仅允许 store_admin 访问
  await requireRoles(['store_admin'])

  // 示例订单数据
  const orders = [
    {
      id: 'ORD-2024-001',
      status: 'pending',
      statusText: '待审批',
      amount: 1580.00,
      items: 5,
      date: '2024-01-15',
    },
    {
      id: 'ORD-2024-002',
      status: 'approved',
      statusText: '已审批',
      amount: 2340.00,
      items: 8,
      date: '2024-01-14',
    },
    {
      id: 'ORD-2024-003',
      status: 'completed',
      statusText: '已完成',
      amount: 890.00,
      items: 3,
      date: '2024-01-13',
    },
  ]

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
        return 'default' as const
      case 'approved':
        return 'secondary' as const
      case 'completed':
        return 'outline' as const
      default:
        return 'default' as const
    }
  }

  return (
    <div className="p-4">
      <Tabs defaultValue="all" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="all">全部</TabsTrigger>
          <TabsTrigger value="pending">待审批</TabsTrigger>
          <TabsTrigger value="approved">已审批</TabsTrigger>
          <TabsTrigger value="completed">已完成</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-3 mt-4">
          {orders.map((order) => (
            <Link key={order.id} href={`/mobile/orders/${order.id}`}>
              <Card className="touch-feedback active:scale-[0.98] transition-transform">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{order.id}</CardTitle>
                      <CardDescription className="mt-1">
                        {order.date}
                      </CardDescription>
                    </div>
                    <Badge variant={getStatusVariant(order.status)}>
                      {order.statusText}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-sm text-muted-foreground">
                        {order.items} 件商品
                      </div>
                      <div className="text-lg font-bold text-primary mt-1">
                        ¥{order.amount.toFixed(2)}
                      </div>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </TabsContent>

        <TabsContent value="pending" className="space-y-3 mt-4">
          {orders
            .filter((o) => o.status === 'pending')
            .map((order) => (
              <Link key={order.id} href={`/mobile/orders/${order.id}`}>
                <Card className="touch-feedback">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div>
                        <CardTitle className="text-base">{order.id}</CardTitle>
                        <CardDescription className="mt-1">
                          {order.date}
                        </CardDescription>
                      </div>
                      <Badge variant={getStatusVariant(order.status)}>
                        {order.statusText}
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm text-muted-foreground">
                          {order.items} 件商品
                        </div>
                        <div className="text-lg font-bold text-primary mt-1">
                          ¥{order.amount.toFixed(2)}
                        </div>
                      </div>
                      <ChevronRight className="w-5 h-5 text-muted-foreground" />
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
        </TabsContent>

        <TabsContent value="approved" className="space-y-3 mt-4">
          <div className="text-center text-muted-foreground py-8">
            暂无已审批订单
          </div>
        </TabsContent>

        <TabsContent value="completed" className="space-y-3 mt-4">
          <div className="text-center text-muted-foreground py-8">
            暂无已完成订单
          </div>
        </TabsContent>
      </Tabs>

      {/* 底部间距 */}
      <div className="h-4" />
    </div>
  )
}
