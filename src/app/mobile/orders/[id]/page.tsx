import { requireRoles } from '@/lib/rbac-server'
import { MOBILE_ACCESS_ROLES } from '@/lib/rbac'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import { getOrderById } from '@/actions/order-actions'
import { notFound } from 'next/navigation'
import { WithdrawOrderButton } from '@/components/mobile/order/WithdrawOrderButton'
import { ConfirmReceiptButton } from '@/components/mobile/order/ConfirmReceiptButton'
import { formatGoodsQuantity } from '@/lib/quantity'

interface OrderDetailPageProps {
  params: Promise<{
    id: string
  }>
}

// 状态映射
const STATUS_MAP: Record<
  string,
  { text: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PENDING: { text: '待审批', variant: 'default' },
  APPROVED: { text: '待出库', variant: 'secondary' },
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
    createdByName: string
    approvedBy: string | null
    approvedByName: string | null
    approvedAt: Date | null
    completedAt: Date | null
    revokedBy: string | null
    revokedByName: string | null
    revokedAt: Date | null
    revokeReason: string | null
    orderedAt: Date
    createdAt: Date
    updatedAt: Date
    stockOut: {
      id: string
      code: string
      status: string
      completedAt: Date | null
    } | null
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
  const totalQuantity = order.items.reduce((sum, item) => sum + item.quantity, 0)
  const totalMeasureType = order.items.every((item) => item.measureType === 'INT')
    ? 'INT'
    : 'DECIMAL'
  const hasAction = ['PENDING', 'REJECTED', 'PROCESSING'].includes(order.status)

  return (
    <div className={hasAction ? 'pb-20' : undefined}>
      <div className="mx-auto max-w-2xl space-y-3 p-3">
        {/* 订单状态卡片 */}
        <Card>
          <CardHeader className="px-3 pb-2 pt-3">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0 flex-1">
                <CardTitle
                  className="truncate text-[13px] leading-5 tracking-normal"
                  title={order.code}
                >
                  {order.code}
                </CardTitle>
                <CardDescription className="mt-0.5 text-xs">
                  {new Date(order.orderedAt).toLocaleString('zh-CN')}
                </CardDescription>
              </div>
              <Badge variant={statusInfo.variant} className="shrink-0 whitespace-nowrap">
                {statusInfo.text}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="px-3 pb-3">
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">门店</span>
                <span>{order.storeName}</span>
              </div>
              {order.approvedBy && order.approvedAt && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">审批人</span>
                    <span>{order.approvedByName}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">审批时间</span>
                    <span>{new Date(order.approvedAt).toLocaleString('zh-CN')}</span>
                  </div>
                </>
              )}
              {order.stockOut &&
                (order.stockOut.status === 'COMPLETED' || order.stockOut.completedAt) && (
                  <>
                    <Separator />
                    <div className="flex justify-between gap-3">
                      <span className="shrink-0 text-muted-foreground">出库单号</span>
                      <span className="break-all text-right text-xs leading-5">
                        {order.stockOut.code}
                      </span>
                    </div>
                    {order.stockOut.completedAt && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">发货时间</span>
                        <span>{new Date(order.stockOut.completedAt).toLocaleString('zh-CN')}</span>
                      </div>
                    )}
                  </>
                )}
              {order.revokedBy && order.revokedAt && (
                <>
                  <Separator />
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">拒绝人</span>
                    <span>{order.revokedByName}</span>
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
          <CardHeader className="px-3 pb-1 pt-3">
            <CardTitle className="text-sm tracking-normal">商品清单</CardTitle>
          </CardHeader>
          <CardContent className="divide-y px-3 pb-1">
            {order.items.map((item) => (
              <div key={item.id} className="space-y-1 py-2.5">
                <div className="flex items-center justify-between gap-2 text-sm">
                  <div className="min-w-0 truncate font-medium" title={item.goodsName}>
                    {item.goodsName}
                  </div>
                  <div className="shrink-0 font-medium">¥{item.totalPrice.toFixed(2)}</div>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <div className="min-w-0 truncate" title={item.goodsCode}>
                    编号: {item.goodsCode}
                  </div>
                  <div className="shrink-0 whitespace-nowrap">
                    ¥{item.unitPrice.toFixed(2)} ×{' '}
                    {formatGoodsQuantity(item.quantity, item.measureType)} {item.goodsUnit}
                  </div>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {/* 金额汇总 */}
        <Card>
          <CardContent className="space-y-2 p-3">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">商品种类</span>
              <span>{order.items.length} 种</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">商品总数</span>
              <span>{formatGoodsQuantity(totalQuantity, totalMeasureType)}</span>
            </div>
            <Separator />
            <div className="flex justify-between text-base font-bold">
              <span>合计</span>
              <span className="text-primary">¥{order.totalAmount.toFixed(2)}</span>
            </div>
          </CardContent>
        </Card>

        {/* 备注 */}
        {order.remark && (
          <Card>
            <CardHeader className="px-3 pb-2 pt-3">
              <CardTitle className="text-sm tracking-normal">备注</CardTitle>
            </CardHeader>
            <CardContent className="px-3 pb-3">
              <p className="text-sm text-muted-foreground">{order.remark}</p>
            </CardContent>
          </Card>
        )}

        {order.status === 'APPROVED' && (
          <div className="border-y bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            订单已审批，正在等待仓库确认发货。仓库发货后才能确认收货。
          </div>
        )}

        {order.status === 'PROCESSING' && (
          <div className="fixed bottom-[var(--mobile-tab-bar-height)] left-0 right-0 z-30 border-t bg-background px-3 py-3">
            <ConfirmReceiptButton orderId={order.id} orderCode={order.code} />
          </div>
        )}

        {/* 撤回按钮（PENDING / REJECTED 状态显示） */}
        {(order.status === 'PENDING' || order.status === 'REJECTED') && (
          <div className="fixed bottom-[var(--mobile-tab-bar-height)] left-0 right-0 z-30 border-t bg-background px-3 py-3">
            <WithdrawOrderButton
              orderId={order.id}
              orderCode={order.code}
              storeId={order.storeId}
              orderItems={order.items}
            />
          </div>
        )}
      </div>
    </div>
  )
}
