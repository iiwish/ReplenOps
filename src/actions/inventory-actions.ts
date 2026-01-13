'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { inventoryService } from '@/services/inventory.service'
import { inventoryLogService } from '@/services/inventory-log.service'
import { getCurrentUser } from '@/lib/session'

// Zod 验证 Schema
const adjustStockSchema = z.object({
  warehouseId: z.string().min(1, '请选择仓库'),
  goodsId: z.string().min(1, '请选择商品'),
  newQuantity: z.number().min(0, '数量不能为负数'),
  reason: z.string().min(1, '请填写调整原因'),
})

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * 手动库存调整
 */
export async function adjustStock(data: {
  warehouseId: string
  goodsId: string
  newQuantity: number
  reason: string
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
    const validatedData = adjustStockSchema.parse(data)

    // 调用 Service 进行调整
    const result = await inventoryService.adjustStock({
      ...validatedData,
      operatorId: user.id,
    })

    // 重新验证缓存
    revalidatePath('/admin/inventory/logs')
    revalidatePath('/admin/inventory')
    revalidatePath('/admin/inventory/adjustment')

    return {
      success: true,
      message: `库存调整成功，变动数量：${result.changeQty > 0 ? '+' : ''}${result.changeQty}`,
      data: result,
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
    return {
      success: false,
      message: error instanceof Error ? error.message : '库存调整失败',
    }
  }
}

/**
 * 获取库存日志列表（用于客户端筛选后刷新）
 */
export async function getInventoryLogs(params: {
  page?: number
  pageSize?: number
  warehouseId?: string
  goodsId?: string
  changeTypes?: string[]
  startDate?: string
  endDate?: string
  operatorId?: string
}): Promise<ActionResponse> {
  try {
    // 转换日期字符串为 Date 对象
    const parsedParams = {
      ...params,
      startDate: params.startDate ? new Date(params.startDate) : undefined,
      endDate: params.endDate ? new Date(params.endDate) : undefined,
    }

    const result = await inventoryLogService.list(parsedParams)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取库存日志失败',
    }
  }
}

/**
 * 获取当前库存信息（用于调整页面）
 */
export async function getInventoryInfo(
  warehouseId: string,
  goodsId: string
): Promise<ActionResponse> {
  try {
    const inventory = await inventoryService.findByWarehouseAndGoods(
      warehouseId,
      goodsId
    )

    if (!inventory) {
      return {
        success: false,
        message: '未找到库存记录',
      }
    }

    return {
      success: true,
      data: inventory,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取库存信息失败',
    }
  }
}
