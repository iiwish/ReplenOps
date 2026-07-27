'use server'

import { prisma } from '@/lib/prisma'
import { dashboardService } from '@/services/dashboard.service'
import { getCurrentUser } from '@/lib/session.server'

interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

export async function getTodayStats(storeId?: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    const stats = await dashboardService.getTodayStats(storeId)

    return {
      success: true,
      data: stats,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取统计数据失败',
    }
  }
}

export async function getTodoList(storeId?: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    const todoList = await dashboardService.getTodoList(storeId)

    return {
      success: true,
      data: todoList,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取待办事项失败',
    }
  }
}

export async function getOrderTrend(days: number = 7, storeId?: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    const trend = await dashboardService.getOrderTrend(days, storeId)

    return {
      success: true,
      data: trend,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取订单趋势失败',
    }
  }
}

export async function getAdminDashboardData(): Promise<
  ActionResponse<{
    todayStats: {
      orderCount: number
      pendingCount: number
      lowStockCount: number
      containerToReturnCount: number
    }
    orderTrend: Array<{
      date: string
      count: number
    }>
    totalOrders: number
    totalCompletedOrders: number
    totalGoods: number
    totalStores: number
  }>
> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    const [todayStats, orderTrend, totalOrders, totalCompletedOrders, totalGoods, totalStores] =
      await Promise.all([
        dashboardService.getTodayStats(),
        dashboardService.getOrderTrend(14),
        prisma.order.count({
          where: {
            isDeleted: false,
          },
        }),
        prisma.order.count({
          where: {
            status: 'COMPLETED',
            isDeleted: false,
          },
        }),
        prisma.goods.count({
          where: {
            isActive: true,
            isDeleted: false,
          },
        }),
        prisma.store.count({
          where: {
            isActive: true,
            isDeleted: false,
          },
        }),
      ])

    return {
      success: true,
      data: {
        todayStats: {
          orderCount: todayStats.orderCount,
          pendingCount: todayStats.pendingCount,
          lowStockCount: todayStats.lowStockCount,
          containerToReturnCount: todayStats.containerToReturnCount,
        },
        orderTrend,
        totalOrders,
        totalCompletedOrders,
        totalGoods,
        totalStores,
      },
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取仪表板数据失败',
    }
  }
}
