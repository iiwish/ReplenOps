'use client'

import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { RefreshCw } from 'lucide-react'
import { type TouchEvent, useEffect, useOptimistic, useRef, useState, useTransition } from 'react'
import MobileHeader from './MobileHeader'
import MobileTabBar from './MobileTabBar'
import MobilePageLoading from './MobilePageLoading'
import { cn } from '@/lib/utils'

const PULL_REFRESH_THRESHOLD = 64
const PULL_REFRESH_MAX_DISTANCE = 96

function getScrollableParent(target: EventTarget | null, root: HTMLElement): HTMLElement {
  let element = target instanceof HTMLElement ? target : null

  while (element && element !== root) {
    const style = window.getComputedStyle(element)
    if (/(auto|scroll)/.test(style.overflowY) && element.scrollHeight > element.clientHeight) {
      return element
    }
    element = element.parentElement
  }

  return root
}

interface MobileLayoutClientProps {
  children: React.ReactNode
}

export default function MobileLayoutClient({ children }: MobileLayoutClientProps) {
  const pathname = usePathname()
  const router = useRouter()
  const [targetPathname, setTargetPathname] = useOptimistic(pathname)
  const [isPending, startTransition] = useTransition()
  const isNavigating = isPending && targetPathname !== pathname
  const contentRef = useRef<HTMLElement>(null)
  const pullStartYRef = useRef<number | null>(null)
  const pullScrollTargetRef = useRef<HTMLElement | null>(null)
  const pullDistanceRef = useRef(0)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPullRefreshing, setIsPullRefreshing] = useState(false)

  useEffect(() => {
    contentRef.current?.scrollTo({ top: 0 })
  }, [targetPathname])

  const navigate = (path: string) => {
    if (isNavigating && path === targetPathname) return
    // Link's onNavigate runs after capture-phase unsaved-change checks.
    startTransition(() => {
      setTargetPathname(path)
      router.push(path as Route)
    })
  }

  const resetPullState = () => {
    pullStartYRef.current = null
    pullScrollTargetRef.current = null
    pullDistanceRef.current = 0
    setPullDistance(0)
  }

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    if (isPullRefreshing || event.touches.length !== 1 || !contentRef.current) return

    const scrollTarget = getScrollableParent(event.target, contentRef.current)
    if (scrollTarget.scrollTop > 0) return

    pullStartYRef.current = event.touches[0]?.clientY ?? null
    pullScrollTargetRef.current = scrollTarget
  }

  const handleTouchMove = (event: TouchEvent<HTMLElement>) => {
    const startY = pullStartYRef.current
    const scrollTarget = pullScrollTargetRef.current
    const currentY = event.touches[0]?.clientY

    if (startY === null || !scrollTarget || currentY === undefined || isPullRefreshing) return
    if (scrollTarget.scrollTop > 0) {
      resetPullState()
      return
    }

    const distance = currentY - startY
    if (distance <= 0) {
      setPullDistance(0)
      pullDistanceRef.current = 0
      return
    }

    if (event.cancelable) event.preventDefault()
    const nextDistance = Math.min(PULL_REFRESH_MAX_DISTANCE, Math.round(distance * 0.5))
    pullDistanceRef.current = nextDistance
    setPullDistance(nextDistance)
  }

  const handleTouchEnd = () => {
    const shouldRefresh = pullDistanceRef.current >= PULL_REFRESH_THRESHOLD
    resetPullState()

    if (!shouldRefresh || isPullRefreshing) return

    setIsPullRefreshing(true)
    window.setTimeout(() => window.location.reload(), 120)
  }

  // 根据路由决定是否显示 Header
  const showHeader = targetPathname !== '/mobile/home'
  const isOrderPage = targetPathname === '/mobile/order'

  // 页面标题映射
  const pageTitles: Record<string, string> = {
    '/mobile/home': '首页',
    '/mobile/order': '下单',
    '/mobile/orders': '订单',
    '/mobile/profile': '我的',
    '/mobile/profile/info': '个人信息',
    '/mobile/container-return': '包装物归还',
    '/mobile/container-tracking': '包装物台账',
  }

  // 获取当前页面标题
  const getPageTitle = () => {
    // 精确匹配
    if (pageTitles[targetPathname]) {
      return pageTitles[targetPathname]
    }

    // 订单详情页面
    if (targetPathname.startsWith('/mobile/orders/')) {
      return '订单详情'
    }

    return '页面'
  }

  return (
    <div className="mobile-shell flex h-dvh flex-col bg-background">
      {/* Header - 可选显示 */}
      {showHeader && <MobileHeader title={getPageTitle()} />}

      {/* 下单页由分类和商品列表分别滚动，其他页面保持主内容区滚动。 */}
      <main
        ref={contentRef}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onTouchCancel={resetPullState}
        className={cn(
          'min-h-0 flex-1 pb-[var(--mobile-tab-bar-height)]',
          isOrderPage ? 'overflow-hidden' : 'mobile-scroll overflow-y-auto'
        )}
      >
        <div
          aria-live="polite"
          className="flex shrink-0 items-center justify-center gap-2 overflow-hidden text-xs text-muted-foreground transition-[height] duration-150"
          style={{ height: isPullRefreshing ? 44 : pullDistance }}
        >
          {(isPullRefreshing || pullDistance > 0) && (
            <>
              <RefreshCw
                className={cn('h-4 w-4', isPullRefreshing && 'animate-spin')}
                aria-hidden="true"
              />
              <span>
                {isPullRefreshing
                  ? '正在刷新'
                  : pullDistance >= PULL_REFRESH_THRESHOLD
                    ? '松开刷新'
                    : '下拉刷新'}
              </span>
            </>
          )}
        </div>
        {isNavigating && <MobilePageLoading />}
        {/* Preserve page state until the destination commits. */}
        <div
          hidden={isNavigating}
          className={pathname === '/mobile/order' ? 'h-full min-h-0' : undefined}
        >
          {children}
        </div>
      </main>

      {/* Tab Bar - 固定底部 */}
      <MobileTabBar pathname={targetPathname} onNavigate={navigate} />
    </div>
  )
}
