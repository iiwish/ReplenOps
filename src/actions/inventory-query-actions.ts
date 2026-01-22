'use server'

import { z } from 'zod'
import { inventoryQueryService } from '@/services/inventory-query.service'

export interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

const querySchema = z.object({
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
  warehouseIds: z.array(z.string()).optional(),
  categoryId: z.string().optional(),
  goodsId: z.string().optional(),
  keyword: z.string().optional(),
  stockStatus: z.enum(['all', 'has_stock', 'zero_stock', 'low_stock']).optional(),
})

const queryByCodeSchema = z.object({
  code: z.string().min(1, '商品编码不能为空'),
})

export async function getInventoryList(params: unknown): Promise<ActionResponse> {
  try {
    const validated = querySchema.parse(params)
    const result = await inventoryQueryService.query(validated)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '表单验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : '查询失败',
    }
  }
}

export async function queryByGoodsCode(params: unknown): Promise<ActionResponse> {
  try {
    const validated = queryByCodeSchema.parse(params)
    const result = await inventoryQueryService.queryByGoodsCode(validated.code)
    return {
      success: true,
      data: result,
    }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '表单验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }
    return {
      success: false,
      message: error instanceof Error ? error.message : '查询失败',
    }
  }
}
