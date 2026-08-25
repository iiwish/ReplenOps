'use server'

import { z } from 'zod'
import { containerTrackingService } from '@/services/container-tracking.service'
import { requireActionPermission } from '@/lib/action-permissions'

interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

const listTrackingSchema = z.object({
  storeId: z.string().optional(),
  containerId: z.string().optional(),
  hasUnreturned: z.boolean().optional(),
})

export async function listTracking(
  params: z.infer<typeof listTrackingSchema> = {}
): Promise<ActionResponse> {
  try {
    await requireActionPermission('stock:read')
    const validatedParams = listTrackingSchema.parse(params)

    const result = await containerTrackingService.list(validatedParams)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取包装物台账失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取包装物台账失败',
    }
  }
}

export async function getTrackingLogs(trackingId: string): Promise<ActionResponse> {
  try {
    await requireActionPermission('stock:read')
    const logs = await containerTrackingService.getLogs(trackingId)

    return {
      success: true,
      data: logs,
    }
  } catch (error) {
    console.error('获取包装物日志失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取包装物日志失败',
    }
  }
}
