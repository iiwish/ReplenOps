import { requireRoles } from '@/lib/rbac-server'
import { MOBILE_ACCESS_ROLES } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Separator } from '@/components/ui/separator'
import { getOrderById } from '@/actions/order-actions'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { WithdrawOrderButton } from '@/components/mobile/order/WithdrawOrderButton'
import { ConfirmReceiptButton } from '@/components/mobile/order/ConfirmReceiptButton'

interface OrderDetailPageProps {
  params: Promise<{
    id: string
  }>
}

// 状态映射
const STATUS_MAP: Record<string, { text: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }> = {
  PENDING: { text: '待审批', variant: 'default' },
  APPROVED: { text: '待收货', variant: 'secondary' },
  PROCESSING: { text: '待收货', variant: 'secondary' },
  COMPLETED: { text: '已完成', variant: 'outline' },
  REJECTED: { text: '已拒绝', variant: 'destructive' },
  CANCELLED: { text: '已取消', variant: 'outline' },
}

export default async function OrderDetailPage({ params }: OrderDetailPageProps) {
  await requireRoles(MOBILE_ACCESS_ROLES)

  const { id } = await params

  // 获取真实订单数据
  const result = await getOrderById(id)

  if (!result.success || !result.data) {
    notFound()
  }

  const order = result.data as {
    id: string
    code: string
    storeId: string
    storeName: string
    status: string
    totalAmount: number
    remark: string | null
    createdBy: string
    approvedBy: string | null
    approvedAt: Date | null
    completedAt: Date | null
    revokedBy: string | null
    revokedAt: Date | null
    revokeReason: string | null
    createdAt: Date
    updatedAt: Date
    items: Array<{
      id: string
      goodsId: string
      goodsCode: string
      goodsName: string
      goodsUnit: string
      measureType: string
      quantity: number
      unitPrice: number
      totalPrice: number
    }>
  }

  const statusInfo = STATUS_MAP[order.status] || { text: order.status, variant: 'default' as const }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
        <Link href="/mobile/orders">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <h1 className="text-lg font-semibold">订单详情</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* 订单状态卡片 */}
        <Card>
          <CardHeader>
            <div className="flex items-start justify-between">
              <div>
                <CardTitle>{order.code}</CardTitle>
                <CardDescription className="mt-1">
                  {new Date(order.createdAt).toLocaleString('zh-CN')}
                </CardDescription>
              </div>
              <Badge variant={statusInfo.variant}>
                {statusInfo.text}
              </Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">门店</span>
                <span>{order.storeName}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">订单号</span>
                <span className="font-mono text-xs">{order.code}</span>
              </div>
              {order.approvedBy && order.approvedAt && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">审批人</span>
                    <span>{order.approvedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">审批时间</span>
                    <span>{new Date(order.approvedAt).toLocaleString('zh-CN')}</span>
                  </div>
                </>
              )}
              {order.revokedBy && order.revokedAt && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">拒绝人</span>
                    <span>{order.revokedBy}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">拒绝时间</span>
                    <span>{new Date(order.revokedAt).toLocaleString('zh-CN')}</span>
                  </div>
                  {order.revokeReason && (
                    <div className="flex flex-col gap-1">
                      <span className="text-muted-foreground">拒绝原因</span>
                      <span className="text-destructive">{order.revokeReason}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 商品列表 */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">商品清单</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {order.items.map((item, index) => (
              <div key={item.id}>
                {index > 0 && <Separator className="my-3" />}
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="font-medium">{item.goodsName}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      编号: {item.goodsCode}
                    </div>
                    <div className="text-sm text-muted-foreground mt-1">
                      ¥{item.unitPrice.toFixed(2)} × {item.quantity} {item.goodsUnit}
                    </div>
                  </div>
                  <div className="font-medium">
                    ¥{item.totalPrice.toFixed(2)}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 金额汇总 */}
        <Card>
          <CardContent className="pt-6 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">商品种类</span>
              <span>{order.items.length} 种</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">商品总数</span>
              <span>
                {order.items.reduce((sum, item) => sum + item.quantity, 0).toFixed(3)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between text-lg font-bold">
              <span>合计</span>
              <span className="text-primary">¥{order.totalAmount.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 备注 */}
        {order.remark && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">备注</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">{order.remark}</p>
            </CardContent>
          </Card>
        )}

        {/* 底部间距 */}
        <div className="h-4" />

        {(order.status === 'APPROVED' || order.status === 'PROCESSING') && (
          <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t">
            <ConfirmReceiptButton
              orderId={order.id}
              orderCode={order.code}
            />
          </div>
        )}

        {/* 撤回按钮（PENDING / REJECTED 状态显示） */}
        {(order.status === 'PENDING' || order.status === 'REJECTED') && (
          <div className="sticky bottom-0 left-0 right-0 p-4 bg-background border-t">
            <WithdrawOrderButton
              orderId={order.id}
              orderCode={order.code}
              orderItems={order.items}
            />
          </div>
        )}
      </div>
    </div>
  )
}
