'use client'

import { useCallback, useEffect, useState } from 'react'
import { CalendarDays, CheckCircle2, Clock, LogOut, RefreshCw, ShoppingBag } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { StatCard } from '@/components/mobile/dashboard/StatCard'
import { TodoList } from '@/components/mobile/dashboard/TodoList'
import { QuickActions } from '@/components/mobile/dashboard/QuickActions'
import { StoreSelector } from '@/components/mobile/dashboard/StoreSelector'
import { OrderingReminder } from '@/components/mobile/dashboard/OrderingReminder'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'
import { logoutAndRedirect } from '@/lib/auth-client'
import { getUserStores } from '@/actions/store-actions'
import type { StoreInfo } from '@/lib/stores/store-selection.store'
import Link from 'next/link'

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

interface DashboardData {
  stats: {
    orderCount: number
    pendingCount: number
    monthlyOrderCount: number
    monthlyCompletedCount: number
  }
  todos: Array<{
    key: string
    todo: import('@/services/dashboard.service').TodoItem
  }>
}

type DashboardTodoItem = DashboardData['todos'][number]['todo']

interface DashboardApiResponse {
  stats: DashboardData['stats']
  todoList: DashboardTodoItem[]
}

export default function HomePage() {
  const [refreshing, setRefreshing] = useState(false)
  const [user, setUser] = useState<UserInfo | null>(null)
  const [data, setData] = useState<DashboardData>({
    stats: {
      orderCount: 0,
      pendingCount: 0,
      monthlyOrderCount: 0,
      monthlyCompletedCount: 0,
    },
    todos: [],
  })

  const { selectedStoreId, availableStores, setAvailableStores, initializeStore } =
    useStoreSelectionStore()

  const initializeUserStores = useCallback(async () => {
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
  }, [initializeStore, setAvailableStores])

  const loadDashboardData = useCallback(async (storeId?: string) => {
    try {
      const response = await fetch(`/api/dashboard?${storeId ? `storeId=${storeId}` : ''}`)
      const result = await response.json()

      if (result.success && result.data) {
        const dashboardData = result.data as DashboardApiResponse
        setData({
          stats: dashboardData.stats,
          todos: dashboardData.todoList
            .filter((item) => item.type !== 'inventory')
            .map((item) => ({
              key: item.type,
              todo: item,
            })),
        })
      }
    } catch (error) {
      console.error('加载数据失败:', error)
    }
  }, [])

  const loadData = useCallback(async () => {
    await initializeUserStores()
    await loadDashboardData(selectedStoreId || undefined)
  }, [initializeUserStores, loadDashboardData, selectedStoreId])

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      void loadData()
    }, 0)

    return () => window.clearTimeout(timeoutId)
  }, [loadData])

  useEffect(() => {
    if (selectedStoreId) {
      const timeoutId = window.setTimeout(() => {
        void loadDashboardData(selectedStoreId)
      }, 0)

      return () => window.clearTimeout(timeoutId)
    }

    return undefined
  }, [loadDashboardData, selectedStoreId])

  const handleRefresh = async () => {
    setRefreshing(true)
    await loadDashboardData(selectedStoreId || undefined)
    setRefreshing(false)
  }

  const handleLogout = async () => {
    try {
      await logoutAndRedirect()
    } catch (error) {
      console.error('登出失败:', error)
    }
  }

  return (
    <div className="min-h-full bg-[#f6f7f9] pb-6">
      <header className="border-b border-gray-100 bg-white px-4 pb-4 pt-5">
        <div className="mx-auto flex max-w-xl items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-xs font-medium text-blue-600">工作台</div>
            <div className="mt-1 truncate text-xl font-semibold leading-7 text-gray-950">
              你好，{user?.name || '用户'}
            </div>
            {availableStores.length > 0 && (
              <div className="mt-2.5">
                <StoreSelector />
              </div>
            )}
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              onClick={handleRefresh}
              disabled={refreshing}
              aria-label="刷新首页数据"
              title="刷新"
            >
              <RefreshCw className={`h-[18px] w-[18px] ${refreshing ? 'animate-spin' : ''}`} />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-10 w-10 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              onClick={handleLogout}
              aria-label="退出登录"
              title="退出登录"
            >
              <LogOut className="h-[18px] w-[18px]" />
            </Button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-xl px-4 pb-2 pt-3">
        <OrderingReminder variant="home" />
      </div>

      <div className="mx-auto max-w-xl space-y-5 px-4">
        <section aria-labelledby="mobile-overview-heading">
          <h2 id="mobile-overview-heading" className="mb-2.5 text-base font-semibold text-gray-950">
            数据概览
          </h2>
          <div className="grid auto-rows-fr grid-cols-2 gap-2.5">
            <Link
              href="/mobile/orders"
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <StatCard
                icon={ShoppingBag}
                title="今日订单"
                value={data.stats.orderCount}
                color="blue"
                compact
              />
            </Link>
            <Link
              href="/mobile/orders"
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <StatCard
                icon={Clock}
                title="待处理订单"
                value={data.stats.pendingCount}
                color="orange"
                compact
              />
            </Link>
            <Link
              href="/mobile/orders"
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <StatCard
                icon={CalendarDays}
                title="本月订单"
                value={data.stats.monthlyOrderCount}
                color="blue"
                compact
              />
            </Link>
            <Link
              href="/mobile/orders?status=COMPLETED"
              className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
            >
              <StatCard
                icon={CheckCircle2}
                title="本月已完成"
                value={data.stats.monthlyCompletedCount}
                color="green"
                compact
              />
            </Link>
          </div>
        </section>

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
