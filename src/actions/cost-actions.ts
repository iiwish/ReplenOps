'use server'

import { costService } from '@/services/cost.service'
import { getCurrentUser } from '@/lib/session'
import { z } from 'zod'

// 成本历史列表查询参数 Schema
const listCostHistorySchema = z.object({
  page: z.number().min(1).optional(),
  pageSize: z.number().min(1).max(100).optional(),
  warehouseId: z.string().optional(),
  goodsId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

/**
 * 获取成本历史列表
 */
export async function getCostHistory(params: {
  page?: number
  pageSize?: number
  warehouseId?: string
  goodsId?: string
  startDate?: string
  endDate?: string
}) {
  try {
    // 验证用户权限
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    // 验证参数
    const validatedParams = listCostHistorySchema.parse(params)

    // 调用服务
    const result = await costService.listHistory(validatedParams)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取成本历史失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取成本历史失败',
    }
  }
}

// 成本趋势查询参数 Schema
const getCostTrendSchema = z.object({
  warehouseId: z.string().min(1, '仓库ID不能为空'),
  goodsId: z.string().min(1, '商品ID不能为空'),
  days: z.number().min(1).max(365).optional(),
})

/**
 * 获取成本趋势数据
 */
export async function getCostTrend(params: {
  warehouseId: string
  goodsId: string
  days?: number
}) {
  try {
    // 验证用户权限
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    // 验证参数
    const validatedParams = getCostTrendSchema.parse(params)

    // 调用服务
    const result = await costService.getTrend(
      validatedParams.warehouseId,
      validatedParams.goodsId,
      validatedParams.days || 30
    )

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取成本趋势失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取成本趋势失败',
    }
  }
}

// 最新成本查询参数 Schema
const getLatestCostSchema = z.object({
  warehouseId: z.string().min(1, '仓库ID不能为空'),
  goodsId: z.string().min(1, '商品ID不能为空'),
})

/**
 * 获取最新成本
 */
export async function getLatestCost(params: {
  warehouseId: string
  goodsId: string
}) {
  try {
    // 验证用户权限
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    // 验证参数
    const validatedParams = getLatestCostSchema.parse(params)

    // 调用服务
    const result = await costService.getLatestCost(
      validatedParams.warehouseId,
      validatedParams.goodsId
    )

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取最新成本失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取最新成本失败',
    }
  }
}
