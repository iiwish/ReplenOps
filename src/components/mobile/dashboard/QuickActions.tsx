'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { ShoppingBag, Package, ClipboardList, Search } from 'lucide-react'

interface QuickAction {
  label: string
  href: string
  icon: React.ReactNode
  color: string
}

const quickActions: QuickAction[] = [
  {
    label: '下单',
    href: '/mobile/order',
    icon: <ShoppingBag className="h-5 w-5" />,
    color: 'bg-blue-50 text-blue-600',
  },
  {
    label: '查库存',
    href: '/mobile/inventory',
    icon: <Package className="h-5 w-5" />,
    color: 'bg-green-50 text-green-600',
  },
  {
    label: '我的订单',
    href: '/mobile/orders',
    icon: <ClipboardList className="h-5 w-5" />,
    color: 'bg-orange-50 text-orange-600',
  },
  {
    label: '扫码',
    href: '/mobile/scan',
    icon: <Search className="h-5 w-5" />,
    color: 'bg-purple-50 text-purple-600',
  },
]

export function QuickActions() {
  return (
    <Card className="p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-semibold text-gray-800">快速入口</h3>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {quickActions.map((action, index) => (
          <Link key={index} href={action.href as any}>
            <Button
              variant="outline"
              className={`flex h-24 flex-col items-center justify-center gap-2 ${action.color}`}
            >
              {action.icon}
              <span className="text-sm font-medium">{action.label}</span>
            </Button>
          </Link>
        ))}
      </div>
    </Card>
  )
}
