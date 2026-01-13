'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { stockInService } from '@/services/stock-in.service'
import { getCurrentUser } from '@/lib/session'

// Zod 验证 Schema
const stockInItemSchema = z.object({
  goodsId: z.string().min(1, '请选择商品'),
  quantity: z.number().positive('数量必须大于0'),
  price: z.number().min(0, '价格不能为负数'),
})

const stockInSchema = z.object({
  warehouseId: z.string().min(1, '请选择仓库'),
  items: z
    .array(stockInItemSchema)
    .min(1, '至少添加一个商品')
    .refine(
      (items) => {
        const goodsIds = items.map((item) => item.goodsId)
        return new Set(goodsIds).size === goodsIds.length
      },
      { message: '不能添加重复的商品' }
    ),
  remark: z.string().optional(),
  submitForApproval: z.boolean().optional(),
})

const updateStockInSchema = z.object({
  warehouseId: z.string().min(1, '请选择仓库').optional(),
  items: z
    .array(stockInItemSchema)
    .min(1, '至少添加一个商品')
    .refine(
      (items) => {
        const goodsIds = items.map((item) => item.goodsId)
        return new Set(goodsIds).size === goodsIds.length
      },
      { message: '不能添加重复的商品' }
    )
    .optional(),
  remark: z.string().optional(),
})

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * 创建入库单
 */
export async function createStockIn(data: {
  warehouseId: string
  items: Array<{ goodsId: string; quantity: number; price: number }>
  remark?: string
  submitForApproval?: boolean
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
    const validatedData = stockInSchema.parse(data)

    // 调用 Service 创建
    const stockIn = await stockInService.create({
      ...validatedData,
      createdBy: user.id,
    })

    // 重新验证缓存
    revalidatePath('/admin/stock-in')

    return {
      success: true,
      message: '入库单创建成功',
      data: stockIn,
    }
  } catch (error) {
    // 处理 Zod 验证错误
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '表单验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    // 处理业务逻辑错误
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '创建失败，请重试',
    }
  }
}

/**
 * 更新入库单
 */
export async function updateStockIn(
  id: string,
  data: {
    warehouseId?: string
    items?: Array<{ goodsId: string; quantity: number; price: number }>
    remark?: string
  }
): Promise<ActionResponse> {
  try {
    // Zod 验证
    const validatedData = updateStockInSchema.parse(data)

    // 调用 Service 更新
    const stockIn = await stockInService.update(id, validatedData)

    // 重新验证缓存
    revalidatePath('/admin/stock-in')
    revalidatePath(`/admin/stock-in/${id}`)

    return {
      success: true,
      message: '入库单更新成功',
      data: stockIn,
    }
  } catch (error) {
    // 处理 Zod 验证错误
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '表单验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    // 处理业务逻辑错误
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '更新失败，请重试',
    }
  }
}

/**
 * 提交审批
 */
export async function submitStockIn(id: string): Promise<ActionResponse> {
  try {
    const stockIn = await stockInService.submit(id)

    // 重新验证缓存
    revalidatePath('/admin/stock-in')
    revalidatePath(`/admin/stock-in/${id}`)

    return {
      success: true,
      message: '提交审批成功',
      data: stockIn,
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
      message: '提交审批失败，请重试',
    }
  }
}

/**
 * 审批通过
 */
export async function approveStockIn(id: string): Promise<ActionResponse> {
  try {
    // 获取当前用户
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    const stockIn = await stockInService.approve(id, user.id)

    // 重新验证缓存
    revalidatePath('/admin/stock-in')
    revalidatePath(`/admin/stock-in/${id}`)

    return {
      success: true,
      message: '审批通过',
      data: stockIn,
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
      message: '审批失败，请重试',
    }
  }
}

/**
 * 审批拒绝
 */
export async function rejectStockIn(
  id: string,
  reason: string
): Promise<ActionResponse> {
  try {
    if (!reason || reason.trim() === '') {
      return {
        success: false,
        message: '请填写拒绝原因',
      }
    }

    const stockIn = await stockInService.reject(id, reason)

    // 重新验证缓存
    revalidatePath('/admin/stock-in')
    revalidatePath(`/admin/stock-in/${id}`)

    return {
      success: true,
      message: '审批已拒绝',
      data: stockIn,
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
      message: '操作失败，请重试',
    }
  }
}

/**
 * 确认入库
 */
export async function completeStockIn(id: string): Promise<ActionResponse> {
  try {
    const stockIn = await stockInService.complete(id)

    // 重新验证缓存
    revalidatePath('/admin/stock-in')
    revalidatePath(`/admin/stock-in/${id}`)
    revalidatePath('/admin/inventory') // 刷新库存页面

    return {
      success: true,
      message: '入库成功',
      data: stockIn,
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
      message: '入库失败，请重试',
    }
  }
}

/**
 * 取消入库单
 */
export async function cancelStockIn(
  id: string,
  reason: string
): Promise<ActionResponse> {
  try {
    if (!reason || reason.trim() === '') {
      return {
        success: false,
        message: '请填写取消原因',
      }
    }

    const stockIn = await stockInService.cancel(id, reason)

    // 重新验证缓存
    revalidatePath('/admin/stock-in')
    revalidatePath(`/admin/stock-in/${id}`)

    return {
      success: true,
      message: '入库单已取消',
      data: stockIn,
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
      message: '取消失败，请重试',
    }
  }
}

/**
 * 删除入库单（软删除）
 */
export async function deleteStockIn(id: string): Promise<ActionResponse> {
  try {
    await stockInService.delete(id)

    // 重新验证缓存
    revalidatePath('/admin/stock-in')

    return {
      success: true,
      message: '入库单删除成功',
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
      message: '删除失败，请重试',
    }
  }
}

/**
 * 搜索商品（用于商品选择器）
 */
export async function searchGoods(keyword: string = ''): Promise<ActionResponse> {
  try {
    const goods = await stockInService.searchGoods(keyword)

    return {
      success: true,
      data: goods,
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
      message: '搜索商品失败，请重试',
    }
  }
}

/**
 * 获取所有启用的仓库
 */
export async function getActiveWarehouses(): Promise<ActionResponse> {
  try {
    const warehouses = await stockInService.getActiveWarehouses()

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
