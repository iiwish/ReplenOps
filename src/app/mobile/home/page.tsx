'use client'

import { useEffect, useState } from 'react'
import { RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/mobile/dashboard/StatCard'
import { TodoList } from '@/components/mobile/dashboard/TodoList'
import { QuickActions } from '@/components/mobile/dashboard/QuickActions'
import { StoreSelector } from '@/components/mobile/dashboard/StoreSelector'
import { ShoppingBag, DollarSign, Clock, AlertTriangle, LogOut } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'
import { getUserStores } from '@/actions/store-actions'
import type { StoreInfo } from '@/lib/stores/store-selection.store'

interface UserInfo {
  id: string
  name: string | null
  displayName?: string
  email?: string | null
  phone?: string | null
  avatar?: string | null
  roles?: string[]
}

async function getCurrentUserClient(): Promise<UserInfo | null> {
  try {
    const response = await fetch('/api/auth/session', {
      cache: 'no-store',
    })

    if (!response.ok) {
      return null
    }

    const data = await response.json()
    return data.user || null
  } catch (error) {
    console.error('获取用户信息失败:', error)
    return null
  }
}

async function logoutClient(): Promise<void> {
  try {
    await fetch('/api/auth/logout', {
      method: 'POST',
    })
  } catch (error) {
    console.error('登出失败:', error)
  }
}

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

  const { selectedStoreId, availableStores, setAvailableStores, initializeStore } =
    useStoreSelectionStore()

  const initializeUserStores = async () => {
    try {
      const currentUser = await getCurrentUserClient()

      if (!currentUser) {
        return
      }

      setUser(currentUser)

      const result = await getUserStores()

      if (!result.success || !result.data) {
        console.error('获取用户门店失败:', result.message)
        return
      }

      const userStores = result.data as StoreInfo[]

      setAvailableStores(userStores)

      if (userStores.length > 0) {
        initializeStore(userStores)
      }
    } catch (error) {
      console.error('初始化用户门店失败:', error)
    }
  }

  const loadDashboardData = async (storeId?: string) => {
    try {
      const response = await fetch(`/api/dashboard?${storeId ? `storeId=${storeId}` : ''}`)
      const result = await response.json()

      if (result.success && result.data) {
        setData({
          stats: result.data.stats,
          todos: result.data.todoList.map((item: any, index: number) => ({
            key: ['order', 'container', 'inventory'][index],
            todo: item,
          })),
        })
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }

  const loadData = async () => {
    await initializeUserStores()
    await loadDashboardData(selectedStoreId || undefined)
  }

  useEffect(() => {
    loadData()
  }, [])

  useEffect(() => {
    if (selectedStoreId) {
      loadDashboardData(selectedStoreId)
    }
  }, [selectedStoreId])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData(selectedStoreId || undefined)
    setRefreshing(false)
  }

  const handleLogout = async () => {
    await logoutClient()
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
          <div className="flex-1">
            <div className="text-sm opacity-80">你好,</div>
            <div className="text-xl font-bold">{user?.name || '用户'}</div>
            {availableStores.length > 0 && (
              <div className="mt-2">
                <StoreSelector />
              </div>
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
