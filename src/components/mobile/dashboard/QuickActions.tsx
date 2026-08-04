'use client'

import Link from 'next/link'
import type { Route } from 'next'
import type { LucideIcon } from 'lucide-react'
import { ShoppingBag, ClipboardList } from 'lucide-react'

interface QuickAction {
  label: string
  href: string
  icon: LucideIcon
  iconClassName: string
  iconBackgroundClassName: string
}

const quickActions: QuickAction[] = [
  {
    label: '下单',
    href: '/mobile/order',
    icon: ShoppingBag,
    iconClassName: 'text-blue-600',
    iconBackgroundClassName: 'bg-blue-50 ring-blue-100',
  },
  {
    label: '我的订单',
    href: '/mobile/orders',
    icon: ClipboardList,
    iconClassName: 'text-orange-600',
    iconBackgroundClassName: 'bg-orange-50 ring-orange-100',
  },
]

export function QuickActions() {
  return (
    <section aria-labelledby="mobile-quick-actions-heading">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 id="mobile-quick-actions-heading" className="text-base font-semibold text-gray-950">
          快速入口
        </h2>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {quickActions.map((action) => {
          const Icon = action.icon

          return (
            <Link
              key={action.label}
              href={action.href as Route}
              className="flex min-h-[82px] min-w-0 flex-col items-center justify-center gap-2 rounded-lg border border-gray-200/80 bg-white px-1.5 py-2.5 text-gray-700 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 active:bg-gray-50"
            >
              <span
                className={`flex h-9 w-9 items-center justify-center rounded-lg ring-1 ${action.iconBackgroundClassName}`}
              >
                <Icon className={`h-5 w-5 ${action.iconClassName}`} />
              </span>
              <span className="w-full whitespace-nowrap text-center text-xs font-medium leading-4">
                {action.label}
              </span>
            </Link>
          )
        })}
      </div>
    </section>
  )
}
