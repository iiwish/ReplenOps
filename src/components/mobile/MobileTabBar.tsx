'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Home, FileText, Package, User } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TabItem {
  label: string
  icon: React.ComponentType<{ className?: string }>
  href: string
  matchPaths: string[] // 匹配的路径前缀
}

const tabs: TabItem[] = [
  {
    label: '首页',
    icon: Home,
    href: '/mobile/home',
    matchPaths: ['/mobile/home'],
  },
  {
    label: '下单',
    icon: FileText,
    href: '/mobile/order',
    matchPaths: ['/mobile/order'],
  },
  {
    label: '订单',
    icon: Package,
    href: '/mobile/orders',
    matchPaths: ['/mobile/orders'],
  },
  {
    label: '我的',
    icon: User,
    href: '/mobile/profile',
    matchPaths: ['/mobile/profile'],
  },
]

export default function MobileTabBar() {
  const pathname = usePathname()

  const isActive = (tab: TabItem) => {
    return tab.matchPaths.some((path) => pathname.startsWith(path))
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 bg-background border-t">
      <div className="flex items-center justify-around h-16 safe-area-bottom">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab)

          return (
            <Link
              key={tab.href}
              href={tab.href as any}
              className={cn(
                'flex flex-col items-center justify-center flex-1',
                'min-w-[44px] min-h-[44px]', // 触控区域最小尺寸
                'transition-colors',
                active
                  ? 'text-primary'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="w-6 h-6 mb-1" />
              <span className="text-xs">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
