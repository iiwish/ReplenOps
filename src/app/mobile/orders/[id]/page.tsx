import { requireRoles } from '@/lib/rbac-server'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'

interface OrderDetailPageProps {
  params: {
    id: string
  }
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  // 验证用户权限，仅允许 store_admin 访问
  await requireRoles(['store_admin'])

  // 示例订单详情数据
  const order = {
    id: params.id,
    status: 'pending',
    statusText: '待审批',
    date: '2024-01-15 10:30',
    store: '门店A',
    items: [
      {
        id: 1,
        name: '商品A',
        price: 99.00,
        quantity: 10,
        unit: '件',
      },
      {
        id: 2,
        name: '商品B',
        price: 149.00,
        quantity: 5,
        unit: '件',
      },
    ],
    subtotal: 1735.00,
    tax: 0,
    total: 1735.00,
    notes: '请尽快发货',
  }

  return (
    <div className="p-4 space-y-4">
      {/* 订单状态卡片 */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{order.id}</CardTitle>
              <CardDescription className="mt-1">
                {order.date}
              </CardDescription>
            </div>
            <Badge>
              {order.statusText}
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">门店</span>
              <span>{order.store}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 商品列表 */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">商品清单</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {order.items.map((item) => (
            <div key={item.id} className="flex justify-between items-start">
              <div className="flex-1">
                <div className="font-medium">{item.name}</div>
                <div className="text-sm text-muted-foreground mt-1">
                  ¥{item.price.toFixed(2)} × {item.quantity} {item.unit}
                </div>
              </div>
              <div className="font-medium">
                ¥{(item.price * item.quantity).toFixed(2)}
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* 金额汇总 */}
      <Card>
        <CardContent className="pt-6 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">小计</span>
            <span>¥{order.subtotal.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">税费</span>
            <span>¥{order.tax.toFixed(2)}</span>
          </div>
          <Separator />
          <div className="flex justify-between text-lg font-bold">
            <span>合计</span>
            <span className="text-primary">¥{order.total.toFixed(2)}</span>
          </div>
        </CardContent>
      </Card>

      {/* 备注 */}
      {order.notes && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">备注</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">{order.notes}</p>
          </CardContent>
        </Card>
      )}

      {/* 操作按钮 */}
      <div className="flex gap-3 pt-2">
        <Button variant="outline" className="flex-1 min-h-[48px]">
          取消订单
        </Button>
        <Button className="flex-1 min-h-[48px]">
          确认订单
        </Button>
      </div>

      {/* 底部间距 */}
      <div className="h-4" />
    </div>
  )
}
