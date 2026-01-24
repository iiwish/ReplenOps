'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { orderService } from '@/services/order.service'
import { getCurrentUser } from '@/lib/session.server'

// Zod 验证 Schema
const orderItemSchema = z.object({
  goodsId: z.string().min(1, '请选择商品'),
  quantity: z.number().positive('数量必须大于0'),
  unitPrice: z.number().min(0, '单价不能为负数'),
})

const createOrderSchema = z.object({
  storeId: z.string().min(1, '请选择门店'),
  items: z
    .array(orderItemSchema)
    .min(1, '至少添加一个商品')
    .refine(
      (items) => {
        const goodsIds = items.map((item) => item.goodsId)
        return new Set(goodsIds).size === goodsIds.length
      },
      { message: '不能添加重复的商品' }
    ),
  remark: z.string().optional(),
})

const approveOrderSchema = z.object({
  id: z.string().min(1, '订单ID不能为空'),
  comment: z.string().optional(),
})

const rejectOrderSchema = z.object({
  id: z.string().min(1, '订单ID不能为空'),
  reason: z.string().min(1, '请填写拒绝原因'),
})

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * 创建订单（移动端购物车提交）
 */
export async function createOrder(data: {
  storeId: string
  items: Array<{ goodsId: string; quantity: number; unitPrice: number }>
  remark?: string
}): Promise<ActionResponse> {
  try {
    // 获取当前用户
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    // Zod 验证
    const validatedData = createOrderSchema.parse(data)

    // 调用 Service 创建
    const order = await orderService.create({
      ...validatedData,
      createdBy: user.id,
    })

    // 刷新相关页面缓存
    revalidatePath('/mobile/orders')
    revalidatePath('/admin/orders')

    return {
      success: true,
      message: '订单创建成功',
      data: { id: order.id, code: order.code } as { id: string; code: string },
    }
  } catch (error) {
    console.error('创建订单失败:', error)

    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '数据验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    return {
      success: false,
      message: error instanceof Error ? error.message : '创建订单失败',
    }
  }
}

/**
 * 获取订单列表
 */
export async function getOrders(params: {
  page?: number
  pageSize?: number
  keyword?: string
  status?: string
  storeId?: string
  startDate?: string
  endDate?: string
}): Promise<ActionResponse> {
  try {
    const result = await orderService.list(params)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取订单列表失败:', error)

    return {
      success: false,
      message: error instanceof Error ? error.message : '获取订单列表失败',
    }
  }
}

/**
 * 获取订单详情
 */
export async function getOrderById(id: string): Promise<ActionResponse> {
  try {
    const order = await orderService.getById(id)

    if (!order) {
      return {
        success: false,
        message: '订单不存在',
      }
    }

    return {
      success: true,
      data: order,
    }
  } catch (error) {
    console.error('获取订单详情失败:', error)

    return {
      success: false,
      message: error instanceof Error ? error.message : '获取订单详情失败',
    }
  }
}

/**
 * 删除订单
 */
export async function deleteOrder(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    await orderService.delete(id, user.id)

    revalidatePath('/mobile/orders')
    revalidatePath('/admin/orders')

    return {
      success: true,
      message: '订单删除成功',
    }
  } catch (error) {
    console.error('删除订单失败:', error)

    return {
      success: false,
      message: error instanceof Error ? error.message : '删除订单失败',
    }
  }
}

/**
 * 审批订单
 */
export async function approveOrder(data: {
  id: string
  comment?: string
}): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    // Zod 验证
    const validatedData = approveOrderSchema.parse(data)

    await orderService.approve(validatedData.id, user.id, validatedData.comment)

    revalidatePath('/mobile/orders')
    revalidatePath('/admin/orders')

    return {
      success: true,
      message: '订单审批成功',
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
      message: error instanceof Error ? error.message : '审批订单失败',
    }
  }
}

/**
 * 拒绝订单
 */
export async function rejectOrder(data: { id: string; reason: string }): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    // Zod 验证
    const validatedData = rejectOrderSchema.parse(data)

    await orderService.reject(validatedData.id, user.id, validatedData.reason)

    revalidatePath('/mobile/orders')
    revalidatePath('/admin/orders')

    return {
      success: true,
      message: '订单已拒绝',
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
      message: error instanceof Error ? error.message : '拒绝订单失败',
    }
  }
}
