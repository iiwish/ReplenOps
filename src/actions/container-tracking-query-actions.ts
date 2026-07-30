'use server'

import { z } from 'zod'
import { containerTrackingService } from '@/services/container-tracking.service'
import { requireActionPermission } from '@/lib/action-permissions'
import { getCurrentUser } from '@/lib/session.server'
import { assertCanReadStore, canReadAllStores } from '@/lib/store-access'

interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

const getSummarySchema = z.object({
  storeId: z.string().optional(),
  containerId: z.string().optional(),
})

const listTrackingSchema = z.object({
  storeId: z.string().optional(),
  containerId: z.string().optional(),
  hasUnreturned: z.boolean().optional(),
  orderBy: z.enum(['currentBorrowed', 'returnRate', 'lastBorrowAt']).optional(),
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce.number().min(1).optional().default(20),
})

const getAbnormalTrackingSchema = z.object({
  days: z.coerce.number().min(1).optional().default(30),
})

/**
 * 获取台账汇总统计
 */
export async function getTrackingSummary(
  params: z.infer<typeof getSummarySchema>
): Promise<ActionResponse> {
  try {
    await requireActionPermission('stock:read')
    const validatedParams = getSummarySchema.parse(params)

    const result = await containerTrackingService.getSummary(validatedParams)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取台账汇总失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取台账汇总失败',
    }
  }
}

/**
 * 获取台账列表
 */
export async function listTracking(
  params: z.infer<typeof listTrackingSchema>
): Promise<ActionResponse> {
  try {
    const validatedParams = listTrackingSchema.parse(params)
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('请先登录')
    }
    if (validatedParams.storeId) {
      await assertCanReadStore(user, Number.parseInt(validatedParams.storeId, 10))
    } else if (!canReadAllStores(user)) {
      throw new Error('请选择有权访问的门店')
    }

    const result = await containerTrackingService.listTracking(validatedParams)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取台账列表失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取台账列表失败',
    }
  }
}

/**
 * 获取异常台账
 */
export async function getAbnormalTrackings(
  params: z.infer<typeof getAbnormalTrackingSchema>
): Promise<ActionResponse> {
  try {
    await requireActionPermission('stock:read')
    const validatedParams = getAbnormalTrackingSchema.parse(params)

    const result = await containerTrackingService.getAbnormalTrackings(validatedParams.days)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取异常台账失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取异常台账失败',
    }
  }
}
