'use server'

import { z } from 'zod'
import { getCurrentUser } from '@/lib/session.server'
import { containerService, type ContainerRecord } from '@/services/container.service'
import { containerTrackingService } from '@/services/container-tracking.service'

interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

const createContainerSchema = z.object({
  code: z.string().min(1, '编号不能为空'),
  name: z.string().min(1, '名称不能为空'),
  unit: z.string().min(1, '单位不能为空'),
  deposit: z.coerce.number().min(0, '押金不能为负数'),
  remark: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
})

const updateContainerSchema = createContainerSchema.partial().extend({
  isActive: z.boolean().optional(),
})

export async function createContainer(
  formData: z.infer<typeof createContainerSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    const validatedData = createContainerSchema.parse(formData)

    const container = await containerService.create(validatedData)

    return {
      success: true,
      data: container,
    }
  } catch (error) {
    console.error('创建包装物失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '创建包装物失败',
    }
  }
}

export async function updateContainer(
  id: string,
  formData: z.infer<typeof updateContainerSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    const validatedData = updateContainerSchema.parse(formData)

    const container = await containerService.update(id, validatedData)

    return {
      success: true,
      data: container,
    }
  } catch (error) {
    console.error('更新包装物失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '更新包装物失败',
    }
  }
}

export async function deleteContainer(id: string): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    await containerService.delete(id)

    return {
      success: true,
    }
  } catch (error) {
    console.error('删除包装物失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '删除包装物失败',
    }
  }
}

export async function listContainers(): Promise<ActionResponse<ContainerRecord[]>> {
  try {
    const containers = await containerService.list()

    return {
      success: true,
      data: containers,
    }
  } catch (error) {
    console.error('获取包装物列表失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取包装物列表失败',
    }
  }
}

export async function listTracking(
  storeId?: string,
  containerId?: string
): Promise<ActionResponse> {
  try {
    const result = await containerTrackingService.list({
      storeId,
      containerId,
    })

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
  trackingId: string,
  quantity: number
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      return {
        success: false,
        message: '请先登录',
      }
    }

    await containerTrackingService.returnContainers(trackingId, quantity, user.id)

    return {
      success: true,
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
