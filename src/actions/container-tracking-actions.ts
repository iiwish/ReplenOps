'use server'

import { z } from 'zod'
import { containerTrackingService } from '@/services/container-tracking.service'
import { getCurrentUser } from '@/lib/session'

interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

const listTrackingSchema = z.object({
  storeId: z.string().optional(),
  containerId: z.string().optional(),
})

const returnContainerSchema = z.object({
  trackingId: z.string().min(1, '台账ID不能为空'),
  quantity: z.coerce.number().min(1, '归还数量必须大于0'),
})

export async function listTracking(
  params?: z.infer<typeof listTrackingSchema>
): Promise<ActionResponse> {
  try {
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

export async function returnContainer(
  formData: z.infer<typeof returnContainerSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    const validatedData = returnContainerSchema.parse(formData)

    await containerTrackingService.returnContainers(
      validatedData.trackingId,
      validatedData.quantity,
      user.id
    )

    return {
      success: true,
      message: '包装物归还成功',
    }
  } catch (error) {
    console.error('包装物归还失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '包装物归还失败',
    }
  }
}
