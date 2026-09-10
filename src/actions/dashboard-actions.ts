'use server'

import { dashboardService, type AdminDashboardData } from '@/services/dashboard.service'
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

    const stats = await dashboardService.getTodayStats(storeId, user)

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

    const todoList = await dashboardService.getTodoList(storeId, user)

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

export async function getAdminDashboardData(): Promise<ActionResponse<AdminDashboardData>> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    const data = await dashboardService.getAdminDashboardData(user)

    return {
      success: true,
      data,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取仪表板数据失败',
    }
  }
}
