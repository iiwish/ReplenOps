'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight } from 'lucide-react'
import { getOrders } from '@/actions/order-actions'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'

// 状态映射
const STATUS_MAP: Record<
  string,
  { text: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PENDING: { text: '待审批', variant: 'default' },
  APPROVED: { text: '待收货', variant: 'secondary' },
  PROCESSING: { text: '待收货', variant: 'secondary' },
  COMPLETED: { text: '已完成', variant: 'outline' },
  REJECTED: { text: '已拒绝', variant: 'destructive' },
  CANCELLED: { text: '已取消', variant: 'outline' },
}

interface Order {
  id: string
  code: string
  storeId: string
  storeName: string
  status: string
  totalAmount: number
  remark: string | null
  createdBy: string
  orderedAt: Date
}

export default function OrdersClientPage() {
  const searchParams = useSearchParams()
  const { selectedStoreId } = useStoreSelectionStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const initialTab = ['APPROVED', 'PROCESSING'].includes(searchParams.get('status') || '')
    ? 'receipt'
    : 'all'
  const [activeTab, setActiveTab] = useState(initialTab)

  useEffect(() => {
    if (selectedStoreId) {
      loadOrders()
    }
  }, [selectedStoreId])

  const loadOrders = async () => {
    if (!selectedStoreId) return

    setLoading(true)
    try {
      const result = await getOrders({
        pageSize: 50,
        storeId: selectedStoreId,
      })

      if (result.success && result.data) {
        const data = result.data as { data: Order[] }
        setOrders(data.data)
      }
    } catch (error) {
      console.error('加载订单失败:', error)
    } finally {
      setLoading(false)
    }
  }

  // 按状态筛选订单
  const allOrders = orders
  const pendingOrders = orders.filter((o) => o.status === 'PENDING')
  const receiptOrders = orders.filter((o) => o.status === 'APPROVED' || o.status === 'PROCESSING')
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED')
  const rejectedOrders = orders.filter((o) => o.status === 'REJECTED')
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED')

  // 渲染订单卡片
  const renderOrderCard = (order: Order) => {
    const statusInfo = STATUS_MAP[order.status] || {
      text: order.status,
      variant: 'default' as const,
    }

    return (
      <Link key={order.id} href={`/mobile/orders/${order.id}`}>
        <Card className="touch-feedback transition-transform active:scale-[0.98]">
          <CardHeader className="pb-3">
            <div className="flex items-start justify-between">
              <div>
                <CardTitle className="text-base">{order.code}</CardTitle>
                <CardDescription className="mt-1">
                  {new Date(order.orderedAt).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </CardDescription>
              </div>
              <Badge variant={statusInfo.variant}>{statusInfo.text}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm text-muted-foreground">{order.storeName}</div>
                <div className="mt-1 text-lg font-bold text-primary">
                  ¥{order.totalAmount.toFixed(2)}
                </div>
              </div>
              <ChevronRight className="h-5 w-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  if (!selectedStoreId) {
    return (
      <div className="p-4">
        <div className="py-8 text-center text-muted-foreground">请先在首页选择门店</div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="p-4">
        <div className="py-8 text-center text-muted-foreground">加载中...</div>
      </div>
    )
  }

  return (
    <div className="p-4">
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all">
            全部
            {allOrders.length > 0 && <span className="ml-1 text-xs">({allOrders.length})</span>}
          </TabsTrigger>
          <TabsTrigger value="pending">
            待审批
            {pendingOrders.length > 0 && (
              <span className="ml-1 text-xs">({pendingOrders.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="receipt">
            待收货
            {receiptOrders.length > 0 && (
              <span className="ml-1 text-xs">({receiptOrders.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed">
            已完成
            {completedOrders.length > 0 && (
              <span className="ml-1 text-xs">({completedOrders.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="rejected">
            已拒绝
            {rejectedOrders.length > 0 && (
              <span className="ml-1 text-xs">({rejectedOrders.length})</span>
            )}
          </TabsTrigger>
          <TabsTrigger value="cancelled">
            已取消
            {cancelledOrders.length > 0 && (
              <span className="ml-1 text-xs">({cancelledOrders.length})</span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="mt-4 space-y-3">
          {allOrders.length > 0 ? (
            allOrders.map(renderOrderCard)
          ) : (
            <div className="py-8 text-center text-muted-foreground">暂无订单</div>
          )}
        </TabsContent>

        <TabsContent value="pending" className="mt-4 space-y-3">
          {pendingOrders.length > 0 ? (
            pendingOrders.map(renderOrderCard)
          ) : (
            <div className="py-8 text-center text-muted-foreground">暂无待审批订单</div>
          )}
        </TabsContent>

        <TabsContent value="receipt" className="mt-4 space-y-3">
          {receiptOrders.length > 0 ? (
            receiptOrders.map(renderOrderCard)
          ) : (
            <div className="py-8 text-center text-muted-foreground">暂无待收货订单</div>
          )}
        </TabsContent>

        <TabsContent value="completed" className="mt-4 space-y-3">
          {completedOrders.length > 0 ? (
            completedOrders.map(renderOrderCard)
          ) : (
            <div className="py-8 text-center text-muted-foreground">暂无已完成订单</div>
          )}
        </TabsContent>

        <TabsContent value="rejected" className="mt-4 space-y-3">
          {rejectedOrders.length > 0 ? (
            rejectedOrders.map(renderOrderCard)
          ) : (
            <div className="py-8 text-center text-muted-foreground">暂无已拒绝订单</div>
          )}
        </TabsContent>

        <TabsContent value="cancelled" className="mt-4 space-y-3">
          {cancelledOrders.length > 0 ? (
            cancelledOrders.map(renderOrderCard)
          ) : (
            <div className="py-8 text-center text-muted-foreground">暂无已取消订单</div>
          )}
        </TabsContent>
      </Tabs>

      {/* 底部间距 */}
      <div className="h-4" />
    </div>
  )
}
