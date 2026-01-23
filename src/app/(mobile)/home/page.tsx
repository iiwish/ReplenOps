'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/mobile/dashboard/StatCard'
import { TodoList } from '@/components/mobile/dashboard/TodoList'
import { QuickActions } from '@/components/mobile/dashboard/QuickActions'
import { ShoppingBag, DollarSign, Clock, AlertTriangle, LogOut } from 'lucide-react'
import { getCurrentUser, clearSession } from '@/lib/session'
import { useRouter } from 'next/navigation'

interface DashboardData {
  stats: {
    orderCount: number
    totalAmount: number
    pendingCount: number
    lowStockCount: number
  }
  todos: Array<{
    key: string
    todo: import('@/services/dashboard.service').TodoItem
  }>
}

export default function HomePage() {
  const router = useRouter()
  const [refreshing, setRefreshing] = useState(false)
  const [user, setUser] = useState<any>(null)
  const [data, setData] = useState<DashboardData>({
    stats: {
      orderCount: 0,
      totalAmount: 0,
      pendingCount: 0,
      lowStockCount: 0,
    },
    todos: [],
  })

  const loadData = async () => {
    try {
      const [currentUser] = await Promise.all([getCurrentUser()])

      if (currentUser) {
        setUser(currentUser)
      }

      setData({
        stats: {
          orderCount: 3,
          totalAmount: 1250,
          pendingCount: 1,
          lowStockCount: 2,
        },
        todos: [
          {
            key: 'order',
            todo: {
              id: 'pending-orders',
              type: 'order',
              title: '待收货订单',
              description: '有订单待收货处理',
              count: 2,
              link: '/mobile/orders',
            },
          },
          {
            key: 'container',
            todo: {
              id: 'containers-return',
              type: 'container',
              title: '包装物待归还',
              description: '有包装物需归还',
              count: 5,
              link: '/mobile/containers',
            },
          },
          {
            key: 'inventory',
            todo: {
              id: 'low-stock',
              type: 'inventory',
              title: '库存预警',
              description: '部分商品库存不足',
              count: 3,
              link: '/mobile/inventory',
            },
          },
        ],
      })
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadData()
    setRefreshing(false)
  }

  const handleLogout = async () => {
    await clearSession()
    router.push('/login')
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('zh-CN', {
      style: 'currency',
      currency: 'CNY',
    }).format(amount)
  }

  return (
    <div className="min-h-screen bg-gray-50 pb-6">
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-4 py-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm opacity-80">你好,</div>
            <div className="text-xl font-bold">{user?.name || '用户'}</div>
            {user?.properties?.storeName && (
              <div className="mt-1 text-sm opacity-80">🏪 {user.properties.storeName}</div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleRefresh}
              disabled={refreshing}
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white hover:bg-white/20"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-4 pt-6">
        <div className="grid grid-cols-2 gap-4">
          <StatCard
            icon={ShoppingBag}
            title="今日订单"
            value={data.stats.orderCount}
            color="blue"
          />
          <StatCard
            icon={DollarSign}
            title="今日销售额"
            value={formatCurrency(data.stats.totalAmount)}
            color="green"
          />
        </div>

        {data.stats.pendingCount > 0 && (
          <StatCard
            icon={Clock}
            title="待审批订单"
            value={data.stats.pendingCount}
            subtitle="需尽快处理"
            color="orange"
          />
        )}

        {data.stats.lowStockCount > 0 && (
          <StatCard
            icon={AlertTriangle}
            title="库存预警"
            value={data.stats.lowStockCount}
            subtitle="部分商品库存不足"
            color="red"
          />
        )}

        <TodoList items={data.todos} />

        <QuickActions />
      </div>

      {refreshing && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <RefreshCw className="h-8 w-8 animate-spin text-white" />
        </div>
      )}
    </div>
  )
}
