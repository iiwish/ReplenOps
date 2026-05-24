'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { stockOutService } from '@/services/stock-out.service'
import { getCurrentUser } from '@/lib/session'

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

// 取消出库单验证Schema
const cancelStockOutSchema = z.object({
  reason: z.string().min(1, '请填写取消原因').max(500, '取消原因不能超过500字'),
})

/**
 * 获取出库单列表
 */
export async function getStockOuts(params: {
  page?: number
  keyword?: string
  status?: string
  warehouseId?: string
  startDate?: string
  endDate?: string
}): Promise<ActionResponse> {
  try {
    const result = await stockOutService.list({
      page: params.page,
      keyword: params.keyword,
      status: params.status,
      warehouseId: params.warehouseId,
      startDate: params.startDate,
      endDate: params.endDate,
      pageSize: 20,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '获取出库单列表失败，请重试',
    }
  }
}

/**
 * 获取出库单详情
 */
export async function getStockOutById(id: string): Promise<ActionResponse> {
  try {
    const stockOut = await stockOutService.findById(id)

    if (!stockOut) {
      return {
        success: false,
        message: '出库单不存在',
      }
    }

    return {
      success: true,
      data: stockOut,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '获取出库单详情失败，请重试',
    }
  }
}

/**
 * 确认出库
 */
export async function completeStockOut(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    const stockOut = await stockOutService.complete(id, user.id)

    revalidatePath('/admin/stock-out')
    revalidatePath(`/admin/stock-out/${id}`)
    revalidatePath('/admin/inventory')
    revalidatePath('/admin/orders')

    return {
      success: true,
      message: '出库成功',
      data: stockOut,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '出库失败，请重试',
    }
  }
}

/**
 * 取消出库单
 */
export async function cancelStockOut(
  id: string,
  data: { reason: string }
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    const validatedData = cancelStockOutSchema.parse(data)

    const stockOut = await stockOutService.cancel(id, validatedData.reason, user.id)

    revalidatePath('/admin/stock-out')
    revalidatePath(`/admin/stock-out/${id}`)
    revalidatePath('/admin/inventory')
    revalidatePath('/admin/orders')

    return {
      success: true,
      message: '出库单已取消',
      data: stockOut,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '表单验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '取消失败，请重试',
    }
  }
}

/**
 * 获取所有启用的仓库（用于筛选）
 */
export async function getActiveWarehouses(): Promise<ActionResponse> {
  try {
    const stockInService = await import('@/services/stock-in.service')
    const warehouses = await stockInService.stockInService.getActiveWarehouses()

    return {
      success: true,
      data: warehouses,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '获取仓库列表失败，请重试',
    }
  }
}
