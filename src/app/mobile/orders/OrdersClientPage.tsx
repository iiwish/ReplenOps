'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ChevronRight, Loader2, Search, X } from 'lucide-react'
import { getOrders } from '@/actions/order-actions'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'

const PAGE_SIZE = 20

const STATUS_FILTERS: Record<string, string[] | undefined> = {
  all: undefined,
  pending: ['PENDING'],
  shipping: ['APPROVED'],
  receipt: ['PROCESSING'],
  completed: ['COMPLETED'],
  rejected: ['REJECTED'],
  cancelled: ['CANCELLED'],
}

const STATUS_TO_TAB: Record<string, string> = {
  PENDING: 'pending',
  APPROVED: 'shipping',
  PROCESSING: 'receipt',
  COMPLETED: 'completed',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
}

const STATUS_MAP: Record<
  string,
  { text: string; variant: 'default' | 'secondary' | 'outline' | 'destructive' }
> = {
  PENDING: { text: '待审批', variant: 'default' },
  APPROVED: { text: '待发货', variant: 'secondary' },
  PROCESSING: { text: '待收货', variant: 'secondary' },
  COMPLETED: { text: '已完成', variant: 'outline' },
  REJECTED: { text: '已拒绝', variant: 'destructive' },
  CANCELLED: { text: '已取消', variant: 'outline' },
}

interface Order {
  id: string
  code: string
  status: string
  totalAmount: number
  orderedAt: Date
}

interface PaginatedOrders {
  data: Order[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  statusCounts: Record<string, number>
}

interface PaginationState {
  page: number
  total: number
  totalPages: number
}

function OrderListSkeleton() {
  return (
    <div className="space-y-2.5 px-3 py-3">
      {[0, 1, 2].map((item) => (
        <div key={item} className="rounded-lg border p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-3 w-28" />
            </div>
            <Skeleton className="h-6 w-14 rounded-full" />
          </div>
          <Skeleton className="mt-4 h-7 w-24" />
        </div>
      ))}
    </div>
  )
}

export default function OrdersClientPage() {
  const searchParams = useSearchParams()
  const { selectedStoreId } = useStoreSelectionStore()
  const [orders, setOrders] = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [appliedKeyword, setAppliedKeyword] = useState('')
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [pagination, setPagination] = useState<PaginationState>({
    page: 0,
    total: 0,
    totalPages: 0,
  })
  const [statusCounts, setStatusCounts] = useState<Record<string, number>>({})
  const requestIdRef = useRef(0)
  const requestedStatus = searchParams.get('status') || ''
  const initialTab = STATUS_TO_TAB[requestedStatus] || 'all'
  const [activeTab, setActiveTab] = useState(initialTab)
  const loadMoreRef = useRef<HTMLDivElement>(null)
  const loadingMoreRef = useRef(false)

  const loadOrders = useCallback(
    async (page: number, append: boolean, keyword: string, statuses?: string[]) => {
      if (!selectedStoreId) return
      if (append && loadingMoreRef.current) return

      const requestId = ++requestIdRef.current
      if (append) {
        loadingMoreRef.current = true
        setLoadingMore(true)
      } else {
        loadingMoreRef.current = false
        setLoading(true)
        setError(null)
      }

      try {
        const result = await getOrders({
          page,
          pageSize: PAGE_SIZE,
          storeId: selectedStoreId,
          keyword: keyword || undefined,
          status: statuses,
        })

        if (requestId !== requestIdRef.current) return

        if (!result.success || !result.data) {
          setError(result.message || '订单加载失败')
          return
        }

        const data = result.data as PaginatedOrders
        setOrders((currentOrders) => {
          if (!append) return data.data

          const existingIds = new Set(currentOrders.map((order) => order.id))
          return [...currentOrders, ...data.data.filter((order) => !existingIds.has(order.id))]
        })
        setPagination({ page: data.page, total: data.total, totalPages: data.totalPages })
        setStatusCounts(data.statusCounts ?? {})
        setError(null)
      } catch (loadError) {
        if (requestId !== requestIdRef.current) return
        console.error('加载订单失败:', loadError)
        setError('订单加载失败，请稍后重试')
      } finally {
        if (requestId === requestIdRef.current) {
          setLoading(false)
          setLoadingMore(false)
          loadingMoreRef.current = false
        }
      }
    },
    [selectedStoreId]
  )

  useEffect(() => {
    if (selectedStoreId) {
      setOrders([])
      setPagination({ page: 0, total: 0, totalPages: 0 })
      setStatusCounts({})
      void loadOrders(1, false, '', STATUS_FILTERS[initialTab])
    }
  }, [initialTab, loadOrders, selectedStoreId])

  const pendingCount = statusCounts.PENDING || 0
  const shippingCount = statusCounts.APPROVED || 0
  const receiptCount = statusCounts.PROCESSING || 0
  const completedCount = statusCounts.COMPLETED || 0
  const rejectedCount = statusCounts.REJECTED || 0
  const cancelledCount = statusCounts.CANCELLED || 0
  const totalOrderCount = Object.values(statusCounts).reduce((total, count) => total + count, 0)
  const hasMore = pagination.page < pagination.totalPages
  const activeStatuses = STATUS_FILTERS[activeTab]

  useEffect(() => {
    const loadMoreTarget = loadMoreRef.current
    if (!loadMoreTarget || loading || !hasMore || loadingMore) return

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          void loadOrders(pagination.page + 1, true, appliedKeyword, activeStatuses)
        }
      },
      { rootMargin: '320px 0px' }
    )

    observer.observe(loadMoreTarget)
    return () => observer.disconnect()
  }, [activeStatuses, appliedKeyword, hasMore, loadOrders, loading, loadingMore, pagination.page])

  const submitSearch = () => {
    const nextKeyword = searchTerm.trim()
    setAppliedKeyword(nextKeyword)
    void loadOrders(1, false, nextKeyword, activeStatuses)
  }

  const clearSearch = () => {
    setSearchTerm('')
    setAppliedKeyword('')
    void loadOrders(1, false, '', activeStatuses)
  }

  const handleTabChange = (nextTab: string) => {
    setActiveTab(nextTab)
    setOrders([])
    setPagination({ page: 0, total: 0, totalPages: 0 })
    setStatusCounts({})
    void loadOrders(1, false, appliedKeyword, STATUS_FILTERS[nextTab])
  }

  useEffect(() => {
    if (searchOpen) searchInputRef.current?.focus()
  }, [searchOpen])

  const renderOrderCard = (order: Order) => {
    const statusInfo = STATUS_MAP[order.status] || {
      text: order.status,
      variant: 'default' as const,
    }

    return (
      <Link key={order.id} href={`/mobile/orders/${order.id}`} className="block">
        <Card className="overflow-hidden border-border/80 shadow-none transition-colors hover:border-primary/40 active:bg-muted/30">
          <CardHeader className="px-4 py-3 pb-2">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <CardTitle className="truncate text-[15px] font-semibold tracking-normal">
                  {order.code}
                </CardTitle>
                <CardDescription className="mt-1 text-xs">
                  {new Date(order.orderedAt).toLocaleString('zh-CN', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </CardDescription>
              </div>
              <Badge variant={statusInfo.variant} className="shrink-0">
                {statusInfo.text}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="flex items-center justify-between border-t bg-muted/30 px-4 py-2.5">
            <span className="text-xs text-muted-foreground">订单金额</span>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold text-primary">
                ¥{order.totalAmount.toFixed(2)}
              </span>
              <ChevronRight className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            </div>
          </CardContent>
        </Card>
      </Link>
    )
  }

  const renderEmptyState = (message: string) => (
    <div className="rounded-lg border border-dashed px-4 py-12 text-center text-sm text-muted-foreground">
      {message}
    </div>
  )

  if (!selectedStoreId) {
    return <div className="p-4 text-center text-sm text-muted-foreground">请先在首页选择门店</div>
  }

  if (loading) {
    return <OrderListSkeleton />
  }

  if (error && orders.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 px-4 py-16 text-center">
        <p className="text-sm text-muted-foreground">{error}</p>
        <Button
          variant="outline"
          onClick={() => void loadOrders(1, false, appliedKeyword, activeStatuses)}
        >
          重新加载
        </Button>
      </div>
    )
  }

  const allOrders = orders
  const pendingOrders = orders.filter((order) => order.status === 'PENDING')
  const shippingOrders = orders.filter((order) => order.status === 'APPROVED')
  const receiptOrders = orders.filter((order) => order.status === 'PROCESSING')
  const completedOrders = orders.filter((order) => order.status === 'COMPLETED')
  const rejectedOrders = orders.filter((order) => order.status === 'REJECTED')
  const cancelledOrders = orders.filter((order) => order.status === 'CANCELLED')

  return (
    <div className="space-y-3 px-3 py-3">
      <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
        <div className="sticky top-0 z-20 -mx-3 border-b border-border/70 bg-background/95 px-3 pb-2 pt-2 shadow-sm backdrop-blur supports-[backdrop-filter]:bg-background/80">
          <div className="flex min-w-0 items-center gap-2">
            <TabsList className="min-w-0 flex-1 justify-start gap-1 overflow-x-auto rounded-none bg-transparent p-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <TabsTrigger
                value="all"
                className="h-9 shrink-0 rounded-full border border-transparent px-3 text-sm text-muted-foreground data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                全部 <span className="ml-1 text-xs tabular-nums opacity-75">{totalOrderCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="pending"
                className="h-9 shrink-0 rounded-full border border-transparent px-3 text-sm text-muted-foreground data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                待审批 <span className="ml-1 text-xs tabular-nums opacity-75">{pendingCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="shipping"
                className="h-9 shrink-0 rounded-full border border-transparent px-3 text-sm text-muted-foreground data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                待发货 <span className="ml-1 text-xs tabular-nums opacity-75">{shippingCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="receipt"
                className="h-9 shrink-0 rounded-full border border-transparent px-3 text-sm text-muted-foreground data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                待收货 <span className="ml-1 text-xs tabular-nums opacity-75">{receiptCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="completed"
                className="h-9 shrink-0 rounded-full border border-transparent px-3 text-sm text-muted-foreground data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                已完成{' '}
                <span className="ml-1 text-xs tabular-nums opacity-75">{completedCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="rejected"
                className="h-9 shrink-0 rounded-full border border-transparent px-3 text-sm text-muted-foreground data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                已拒绝 <span className="ml-1 text-xs tabular-nums opacity-75">{rejectedCount}</span>
              </TabsTrigger>
              <TabsTrigger
                value="cancelled"
                className="h-9 shrink-0 rounded-full border border-transparent px-3 text-sm text-muted-foreground data-[state=active]:border-primary/20 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none"
              >
                已取消{' '}
                <span className="ml-1 text-xs tabular-nums opacity-75">{cancelledCount}</span>
              </TabsTrigger>
            </TabsList>
            <Button
              type="button"
              variant={appliedKeyword ? 'default' : searchOpen ? 'secondary' : 'outline'}
              size="icon"
              className="h-9 w-9 shrink-0"
              onClick={() => setSearchOpen((open) => !open)}
              aria-label="搜索订单"
              title="搜索订单"
            >
              <Search className="h-4 w-4" />
            </Button>
          </div>
          {searchOpen && (
            <div className="mt-1.5 flex h-10 items-center gap-2 rounded-lg border border-border/80 bg-muted/30 px-3">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <input
                ref={searchInputRef}
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') submitSearch()
                }}
                placeholder="搜索订单号或备注"
                aria-label="搜索订单号或备注"
                className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground/80"
              />
              {searchTerm && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 shrink-0"
                  onClick={clearSearch}
                  aria-label="清除订单搜索"
                  title="清除订单搜索"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
              <Button
                type="button"
                size="icon"
                className="h-8 w-8 shrink-0"
                onClick={submitSearch}
                aria-label="提交订单搜索"
                title="提交订单搜索"
              >
                <Search className="h-4 w-4" />
              </Button>
            </div>
          )}
        </div>

        <TabsContent value="all" className="mt-3 space-y-2.5">
          {allOrders.length > 0 ? allOrders.map(renderOrderCard) : renderEmptyState('暂无订单')}
        </TabsContent>
        <TabsContent value="pending" className="mt-3 space-y-2.5">
          {pendingOrders.length > 0
            ? pendingOrders.map(renderOrderCard)
            : renderEmptyState('暂无待审批订单')}
        </TabsContent>
        <TabsContent value="shipping" className="mt-3 space-y-2.5">
          {shippingOrders.length > 0
            ? shippingOrders.map(renderOrderCard)
            : renderEmptyState('暂无待发货订单')}
        </TabsContent>
        <TabsContent value="receipt" className="mt-3 space-y-2.5">
          {receiptOrders.length > 0
            ? receiptOrders.map(renderOrderCard)
            : renderEmptyState('暂无待收货订单')}
        </TabsContent>
        <TabsContent value="completed" className="mt-3 space-y-2.5">
          {completedOrders.length > 0
            ? completedOrders.map(renderOrderCard)
            : renderEmptyState('暂无已完成订单')}
        </TabsContent>
        <TabsContent value="rejected" className="mt-3 space-y-2.5">
          {rejectedOrders.length > 0
            ? rejectedOrders.map(renderOrderCard)
            : renderEmptyState('暂无已拒绝订单')}
        </TabsContent>
        <TabsContent value="cancelled" className="mt-3 space-y-2.5">
          {cancelledOrders.length > 0
            ? cancelledOrders.map(renderOrderCard)
            : renderEmptyState('暂无已取消订单')}
        </TabsContent>
      </Tabs>

      {error && orders.length > 0 && (
        <p className="text-center text-xs text-destructive">{error}</p>
      )}

      <div
        ref={loadMoreRef}
        className="flex min-h-12 items-center justify-center py-2 text-xs text-muted-foreground"
      >
        {loadingMore && (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            正在加载更多订单...
          </>
        )}
        {!loadingMore && hasMore && '继续下滑加载更多'}
        {!hasMore && orders.length > 0 && `已加载全部 ${pagination.total} 条订单`}
      </div>
    </div>
  )
}
