'use client'

import type { Route } from 'next'
import Link from 'next/link'
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

export default function MobileTabBar({
  pathname,
  onNavigate,
}: {
  pathname: string
  onNavigate: (path: string) => void
}) {
  const isActive = (tab: TabItem) => {
    return tab.matchPaths.some((path) => pathname === path || pathname.startsWith(`${path}/`))
  }

  return (
    <nav
      aria-label="底部导航"
      className="safe-area-bottom fixed bottom-0 left-0 right-0 z-50 border-t bg-background"
    >
      <div className="flex h-16 items-center justify-around">
        {tabs.map((tab) => {
          const Icon = tab.icon
          const active = isActive(tab)

          return (
            <Link
              key={tab.href}
              href={tab.href as Route}
              aria-current={active ? 'page' : undefined}
              onNavigate={(event) => {
                event.preventDefault()
                onNavigate(tab.href)
              }}
              className={cn(
                'flex flex-1 flex-col items-center justify-center',
                'min-h-[44px] min-w-[44px]', // 触控区域最小尺寸
                'transition-colors',
                active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <Icon className="mb-1 h-6 w-6" />
              <span className="text-xs">{tab.label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
