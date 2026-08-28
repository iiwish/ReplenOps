'use client'

import { usePathname } from 'next/navigation'
import MobileHeader from './MobileHeader'
import MobileTabBar from './MobileTabBar'
import { cn } from '@/lib/utils'

interface MobileLayoutClientProps {
  children: React.ReactNode
}

export default function MobileLayoutClient({ children }: MobileLayoutClientProps) {
  const pathname = usePathname()

  // 根据路由决定是否显示 Header
  const showHeader = pathname !== '/mobile/home'
  const isOrderPage = pathname === '/mobile/order'

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
    if (pageTitles[pathname]) {
      return pageTitles[pathname]
    }

    // 订单详情页面
    if (pathname.startsWith('/mobile/orders/')) {
      return '订单详情'
    }

    return '页面'
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header - 可选显示 */}
      {showHeader && <MobileHeader title={getPageTitle()} />}

      {/* 下单页由分类和商品列表分别滚动，其他页面保持主内容区滚动。 */}
      <main
        className={cn(
          'min-h-0 flex-1 pb-16',
          isOrderPage ? 'overflow-hidden' : 'mobile-scroll overflow-y-auto'
        )}
      >
        {children}
      </main>

      {/* Tab Bar - 固定底部 */}
      <MobileTabBar />
    </div>
  )
}
