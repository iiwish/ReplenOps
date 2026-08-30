'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import * as Dialog from '@radix-ui/react-dialog'
import { CheckCircle2, Clock3, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { CategorySidebar } from '@/components/mobile/order/CategorySidebar'
import { GoodsGrid, type GoodsGridHandle } from '@/components/mobile/order/GoodsGrid'
import { CartFloating } from '@/components/mobile/order/CartFloating'
import { CartDrawer } from '@/components/mobile/order/CartDrawer'
import {
  OrderingReminder,
  type OrderingStatus,
} from '@/components/mobile/dashboard/OrderingReminder'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'
import { hydrateCartStore, useCartStore } from '@/lib/stores/cart.store'
import { createOrder, getActiveOrderForStore } from '@/actions/order-actions'
import { toast } from '@/hooks/use-toast'

interface Goods {
  id: string
  code: string
  name: string
  spec: string | null
  unit: string
  measureType: 'INT' | 'DECIMAL'
  partnerPrice: number
  imageUrl: string | null
  availableQty: number
  categoryId: string
}

interface Category {
  id: string
  name: string
  code: string
  goods: Goods[]
}

interface MobileOrderClientProps {
  categories: Category[]
}

interface CreatedOrder {
  id?: string
  code?: string
}

interface ActiveOrder {
  id: string
  code: string
  status: string
}

export default function MobileOrderClient({ categories }: MobileOrderClientProps) {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState<string | null>(
    categories.length > 0 ? categories[0]?.id || null : null
  )
  const [cartOpen, setCartOpen] = useState(false)
  const [checkoutDialogOpen, setCheckoutDialogOpen] = useState(false)
  const [createdOrder, setCreatedOrder] = useState<CreatedOrder | null>(null)
  const [activeOrder, setActiveOrder] = useState<ActiveOrder | null>(null)
  const [checkingActiveOrder, setCheckingActiveOrder] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [orderingStatus, setOrderingStatus] = useState<OrderingStatus | null>()
  const [searchTerm, setSearchTerm] = useState('')
  const goodsGridRef = useRef<GoodsGridHandle>(null)
  const isSubmittingRef = useRef(false)

  const { selectedStoreId } = useStoreSelectionStore()
  const { items, hasHydrated, clear, getTotalAmount, getTotalQuantity } = useCartStore()
  const visibleItems = hasHydrated ? items : []
  const totalAmount = hasHydrated ? getTotalAmount() : 0
  const totalQuantity = hasHydrated ? getTotalQuantity() : 0

  useEffect(() => {
    void hydrateCartStore()
  }, [])

  useEffect(() => {
    let cancelled = false

    if (!selectedStoreId) {
      setActiveOrder(null)
      setCheckingActiveOrder(false)
      return
    }

    setCheckingActiveOrder(true)
    void getActiveOrderForStore(selectedStoreId).then((result) => {
      if (cancelled) return

      setActiveOrder(result.success ? ((result.data as ActiveOrder | null) ?? null) : null)
      setCheckingActiveOrder(false)
    })

    return () => {
      cancelled = true
    }
  }, [selectedStoreId])

  const filteredCategories = useMemo(() => {
    const keyword = searchTerm.trim().toLocaleLowerCase()

    if (!keyword) {
      return categories
    }

    return categories
      .map((category) => ({
        ...category,
        goods: category.goods.filter((goods) =>
          [goods.name, goods.code, goods.spec]
            .filter((value): value is string => value !== null)
            .some((value) => value.toLocaleLowerCase().includes(keyword))
        ),
      }))
      .filter((category) => category.goods.length > 0)
  }, [categories, searchTerm])

  useEffect(() => {
    if (filteredCategories.some((category) => category.id === activeCategory)) {
      return
    }

    setActiveCategory(filteredCategories[0]?.id || null)
  }, [activeCategory, filteredCategories])

  const handleCategoryVisible = useCallback((categoryId: string) => {
    setActiveCategory(categoryId)
  }, [])

  const handleCategoryClick = useCallback((categoryId: string) => {
    setActiveCategory(categoryId)
    goodsGridRef.current?.scrollToCategory(categoryId)
  }, [])

  const handleOrderingStatusChange = useCallback((status: OrderingStatus | null) => {
    setOrderingStatus(status)
  }, [])

  const checkoutDisabled = orderingStatus?.isOpen !== true
  const checkoutLabel =
    orderingStatus === undefined
      ? '检查中'
      : orderingStatus === null
        ? '暂不可用'
        : checkoutDisabled
          ? '暂停报货'
          : '结算'

  const requestCheckout = () => {
    if (!selectedStoreId) {
      toast({
        title: '请先选择门店',
        description: '请在首页选择要下单的门店',
        variant: 'destructive',
      })
      return
    }

    if (!orderingStatus?.isOpen) {
      const nextOrderingTime = orderingStatus?.nextOrderingTime
      toast({
        title: orderingStatus ? '当前暂停报货' : '暂时无法确认报货时间',
        description: nextOrderingTime
          ? `购物车已保留，请在${nextOrderingTime.dayName} ${nextOrderingTime.startTime}后结算`
          : '购物车已保留，请稍后再试',
        variant: 'destructive',
      })
      return
    }

    if (visibleItems.length === 0) {
      toast({
        title: '购物车为空',
        description: '请先添加商品到购物车',
        variant: 'destructive',
      })
      return
    }

    // 检查所有商品库存是否充足（防超卖）
    const insufficientStock = visibleItems.find((item) => item.quantity > item.availableQty)

    if (insufficientStock) {
      toast({
        title: '库存不足',
        description: `${insufficientStock.name} 库存不足，当前可用: ${insufficientStock.availableQty} ${insufficientStock.unit}`,
        variant: 'destructive',
      })
      return
    }

    setCartOpen(false)
    setCreatedOrder(null)
    setCheckoutDialogOpen(true)
  }

  const submitCheckout = async () => {
    if (
      isSubmittingRef.current ||
      !selectedStoreId ||
      visibleItems.length === 0 ||
      !orderingStatus?.isOpen
    ) {
      return
    }

    isSubmittingRef.current = true
    setIsSubmitting(true)

    try {
      const result = await createOrder({
        storeId: selectedStoreId,
        items: visibleItems.map((item) => ({
          goodsId: item.goodsId,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        remark: undefined,
      })

      if (result.success) {
        clear()
        const orderData = result.data as { id: string; code: string } | undefined
        setCreatedOrder(orderData ?? {})
        toast({
          title: '订单提交成功',
          description: `订单号: ${orderData?.code}，等待审批`,
        })
      } else {
        toast({
          title: '订单提交失败',
          description: result.message || '请稍后重试',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('提交订单失败:', error)
      toast({
        title: '订单提交失败',
        description: error instanceof Error ? error.message : '网络错误，请稍后重试',
        variant: 'destructive',
      })
    } finally {
      isSubmittingRef.current = false
      setIsSubmitting(false)
    }
  }

  const closeCheckoutDialog = () => {
    setCheckoutDialogOpen(false)
    if (createdOrder?.id && createdOrder.code) {
      setActiveOrder({ id: createdOrder.id, code: createdOrder.code, status: 'PENDING' })
    }
    setCreatedOrder(null)
  }

  const handleCheckoutDialogOpenChange = (open: boolean) => {
    if (isSubmittingRef.current) {
      return
    }

    if (!open) {
      closeCheckoutDialog()
      return
    }

    setCheckoutDialogOpen(true)
  }

  const viewCreatedOrder = () => {
    closeCheckoutDialog()

    if (createdOrder?.id) {
      router.push(`/mobile/orders/${createdOrder.id}`)
      return
    }

    router.push('/mobile/orders')
  }

  if (checkingActiveOrder) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="mr-2 h-5 w-5 animate-spin" />
        正在检查门店订单...
      </div>
    )
  }

  if (activeOrder) {
    const statusText =
      activeOrder.status === 'PENDING'
        ? '待审批'
        : activeOrder.status === 'APPROVED'
          ? '待出库'
          : '待收货'

    return (
      <div className="flex h-full min-h-0 flex-col overflow-hidden">
        <OrderingReminder variant="compact" />
        <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
          <Clock3 className="h-10 w-10 text-primary" aria-hidden="true" />
          <h2 className="mt-4 text-lg font-semibold">当前门店已有待处理订单</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {activeOrder.code} · {statusText}
          </p>
          <p className="mt-1 max-w-sm text-sm text-muted-foreground">
            每个门店同时只能处理一个订单。确认收货后即可提交下一张订单。
          </p>
          <Button className="mt-5" onClick={() => router.push(`/mobile/orders/${activeOrder.id}`)}>
            查看当前订单
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full min-h-0 flex-col overflow-hidden">
      <OrderingReminder variant="compact" onStatusChange={handleOrderingStatusChange} />
      <div className="flex min-h-0 flex-1 overflow-hidden">
        {/* 左侧分类 */}
        <CategorySidebar
          categories={filteredCategories}
          activeCategory={activeCategory}
          onCategoryClick={handleCategoryClick}
        />

        {/* 右侧商品列表 */}
        <div className="relative flex min-w-0 flex-1 flex-col">
          <GoodsGrid
            ref={goodsGridRef}
            categories={filteredCategories}
            onCategoryVisible={handleCategoryVisible}
            searchTerm={searchTerm}
            onSearchTermChange={setSearchTerm}
          />

          {/* 悬浮购物车 */}
          <CartFloating
            onClick={() => setCartOpen(true)}
            onCheckout={requestCheckout}
            isSubmitting={isSubmitting}
            checkoutDisabled={checkoutDisabled}
            checkoutLabel={checkoutLabel}
          />
        </div>
      </div>

      {/* 购物车抽屉 */}
      <CartDrawer
        open={cartOpen}
        onOpenChange={setCartOpen}
        onCheckout={requestCheckout}
        isSubmitting={isSubmitting}
        checkoutDisabled={checkoutDisabled}
        checkoutLabel={checkoutDisabled ? checkoutLabel : '去结算'}
      />

      <Dialog.Root open={checkoutDialogOpen} onOpenChange={handleCheckoutDialogOpenChange}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-[60] bg-black/45" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-[60] w-[calc(100%-2rem)] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border bg-background p-5 shadow-xl focus:outline-none">
            {createdOrder ? (
              <>
                <div className="flex items-start gap-3">
                  <CheckCircle2
                    className="mt-0.5 h-5 w-5 shrink-0 text-primary"
                    aria-hidden="true"
                  />
                  <div>
                    <Dialog.Title className="text-base font-semibold">订单已创建</Dialog.Title>
                    <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                      订单已提交，等待审批。
                    </Dialog.Description>
                  </div>
                </div>
                <dl className="mt-4 space-y-2 border-y py-3 text-sm">
                  <div className="flex items-center justify-between gap-4">
                    <dt className="text-muted-foreground">订单编号</dt>
                    <dd className="font-medium">{createdOrder.code || '已生成'}</dd>
                  </div>
                </dl>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={closeCheckoutDialog}>
                    关闭
                  </Button>
                  <Button onClick={viewCreatedOrder}>查看订单</Button>
                </div>
              </>
            ) : (
              <>
                <Dialog.Title className="text-base font-semibold">确认提交订单</Dialog.Title>
                <Dialog.Description className="mt-1 text-sm text-muted-foreground">
                  确认后将生成订单并进入审批流程。
                </Dialog.Description>
                <dl className="mt-4 space-y-2 border-y py-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">商品数量</dt>
                    <dd className="font-medium">{totalQuantity} 件</dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-muted-foreground">订单金额</dt>
                    <dd className="text-base font-semibold text-primary">
                      ¥{totalAmount.toFixed(2)}
                    </dd>
                  </div>
                </dl>
                <div className="mt-5 flex justify-end gap-2">
                  <Button variant="outline" onClick={closeCheckoutDialog} disabled={isSubmitting}>
                    取消
                  </Button>
                  <Button
                    onClick={submitCheckout}
                    disabled={isSubmitting || !orderingStatus?.isOpen}
                  >
                    {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {isSubmitting ? '提交中...' : '确认结算'}
                  </Button>
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </div>
  )
}
