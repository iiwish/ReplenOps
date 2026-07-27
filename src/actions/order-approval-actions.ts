'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActionPermission } from '@/lib/action-permissions'
import { orderApprovalService } from '@/services/order-approval.service'

// Zod 验证 Schema
const approveOrderSchema = z.object({
  orderId: z.string().min(1, '订单ID不能为空'),
  comment: z.string().optional(),
})

const rejectOrderSchema = z.object({
  orderId: z.string().min(1, '订单ID不能为空'),
  reason: z.string().min(5, '拒绝原因至少5个字符'),
})

const batchApproveSchema = z.object({
  orderIds: z.array(z.string()).min(1, '至少选择一个订单'),
})

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * 获取待审批订单列表
 */
export async function getPendingOrders(params: {
  page?: number
  pageSize?: number
  storeId?: string
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  keyword?: string
}): Promise<ActionResponse> {
  try {
    await requireActionPermission('order:review')

    const result = await orderApprovalService.listPendingOrders(params)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取待审批订单列表失败:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取列表失败',
    }
  }
}

/**
 * 获取订单详情(含库存检查)
 */
export async function getOrderDetailWithStock(orderId: string): Promise<ActionResponse> {
  try {
    await requireActionPermission('order:review')

    const result = await orderApprovalService.getOrderDetailWithStock(orderId)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取订单详情失败:', error)
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取详情失败',
    }
  }
}

/**
 * 审批通过订单
 */
export async function approveOrder(data: {
  orderId: string
  comment?: string
}): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('order:review')

    // Zod 验证
    const validatedData = approveOrderSchema.parse(data)

    // 调用 Service
    const result = await orderApprovalService.approve(
      validatedData.orderId,
      user.id,
      validatedData.comment
    )

    // 刷新页面缓存
    revalidatePath('/admin/order-approval')
    revalidatePath('/admin/orders')
    revalidatePath('/admin/stock-out')

    return {
      success: true,
      message: result.message,
      data: { stockOutId: result.stockOutId },
    }
  } catch (error) {
    console.error('审批订单失败:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '数据验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : '审批失败',
    }
  }
}

/**
 * 拒绝订单
 */
export async function rejectOrder(data: {
  orderId: string
  reason: string
}): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('order:review')

    // Zod 验证
    const validatedData = rejectOrderSchema.parse(data)

    // 调用 Service
    const result = await orderApprovalService.reject(
      validatedData.orderId,
      user.id,
      validatedData.reason
    )

    // 刷新页面缓存
    revalidatePath('/admin/order-approval')
    revalidatePath('/admin/orders')

    return {
      success: true,
      message: result.message,
    }
  } catch (error) {
    console.error('拒绝订单失败:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '数据验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : '拒绝失败',
    }
  }
}

/**
 * 批量审批订单
 */
export async function batchApproveOrders(data: { orderIds: string[] }): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('order:review')

    // Zod 验证
    const validatedData = batchApproveSchema.parse(data)

    // 调用 Service
    const results = await orderApprovalService.batchApprove(validatedData.orderIds, user.id)

    // 统计成功失败数量
    const successCount = results.filter((r) => r.success).length
    const failCount = results.length - successCount

    // 刷新页面缓存
    revalidatePath('/admin/order-approval')
    revalidatePath('/admin/orders')
    revalidatePath('/admin/stock-out')

    return {
      success: true,
      message: `批量审批完成: 成功${successCount}个, 失败${failCount}个`,
      data: results,
    }
  } catch (error) {
    console.error('批量审批失败:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '数据验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : '批量审批失败',
    }
  }
}
