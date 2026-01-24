'use server'

import { z } from 'zod'
import { profitReportService } from '@/services/profit-report.service'
import { getCurrentUser } from '@/lib/session.server'

interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

const profitReportParamsSchema = z
  .object({
    startDate: z.string().optional(),
    endDate: z.string().optional(),
    storeId: z.string().optional(),
    goodsId: z.string().optional(),
    categoryId: z.string().optional(),
  })
  .optional()

const paginationSchema = z.object({
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(100).default(20),
})

const trendParamsSchema = z.object({
  groupBy: z.enum(['day', 'week', 'month']).default('day'),
})

export async function getProfitOverview(
  params?: z.infer<typeof profitReportParamsSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    const validatedParams = profitReportParamsSchema.parse(params)

    const result = await profitReportService.getOverview(validatedParams || {})

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取利润概览失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取利润概览失败',
    }
  }
}

export async function getProfitByStore(
  params?: z.infer<typeof profitReportParamsSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    const validatedParams = profitReportParamsSchema.parse(params)

    const result = await profitReportService.getByStore(validatedParams || {})

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('按门店统计失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '按门店统计失败',
    }
  }
}

export async function getProfitByGoods(
  params?: z.infer<typeof profitReportParamsSchema>,
  pagination?: z.infer<typeof paginationSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    const validatedParams = profitReportParamsSchema.parse(params) ?? {}
    const validatedPagination = paginationSchema.parse(pagination ?? {})

    const result = await profitReportService.getByGoods(
      validatedParams,
      validatedPagination.page,
      validatedPagination.pageSize
    )

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('按商品统计失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '按商品统计失败',
    }
  }
}

export async function getProfitByCategory(
  params?: z.infer<typeof profitReportParamsSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    const validatedParams = profitReportParamsSchema.parse(params) ?? {}

    const result = await profitReportService.getByCategory(validatedParams)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('按分类统计失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '按分类统计失败',
    }
  }
}

export async function getProfitTrend(
  params?: z.infer<typeof profitReportParamsSchema>,
  trendParams?: z.infer<typeof trendParamsSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    const validatedParams = profitReportParamsSchema.parse(params) ?? {}
    const validatedTrendParams = trendParamsSchema.parse(trendParams ?? {})

    const result = await profitReportService.getTrend(validatedParams, validatedTrendParams.groupBy)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取利润趋势失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取利润趋势失败',
    }
  }
}
