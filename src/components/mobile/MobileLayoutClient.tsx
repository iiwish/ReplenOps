'use client'

import { usePathname } from 'next/navigation'
import MobileHeader from './MobileHeader'
import MobileTabBar from './MobileTabBar'

interface MobileLayoutClientProps {
  children: React.ReactNode
}

export default function MobileLayoutClient({
  children,
}: MobileLayoutClientProps) {
  const pathname = usePathname()

  // 根据路由决定是否显示 Header
  const showHeader = pathname !== '/mobile/home'

  // 页面标题映射
  const pageTitles: Record<string, string> = {
    '/mobile/home': '首页',
    '/mobile/order': '下单',
    '/mobile/orders': '订单',
    '/mobile/profile': '我的',
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
    <div className="flex flex-col h-screen bg-background">
      {/* Header - 可选显示 */}
      {showHeader && <MobileHeader title={getPageTitle()} />}

      {/* Content Area - 可滚动 */}
      <main className="flex-1 overflow-y-auto mobile-scroll pb-16">
        {children}
      </main>

      {/* Tab Bar - 固定底部 */}
      <MobileTabBar />
    </div>
  )
}
