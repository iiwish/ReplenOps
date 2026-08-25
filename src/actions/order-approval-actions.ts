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

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
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
    revalidatePath('/admin/orders')
    revalidatePath('/admin/stock-out')
    revalidatePath('/mobile/orders')

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
    revalidatePath('/admin/orders')
    revalidatePath('/mobile/orders')

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
