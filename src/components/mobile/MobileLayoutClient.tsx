'use client'

import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useOptimistic, useRef, useTransition } from 'react'
import MobileHeader from './MobileHeader'
import MobileTabBar from './MobileTabBar'
import MobilePageLoading from './MobilePageLoading'
import { cn } from '@/lib/utils'

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
        className={cn(
          'min-h-0 flex-1 pb-[var(--mobile-tab-bar-height)]',
          isOrderPage ? 'overflow-hidden' : 'mobile-scroll overflow-y-auto'
        )}
      >
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
