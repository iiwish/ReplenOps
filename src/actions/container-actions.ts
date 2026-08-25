'use server'

import { z } from 'zod'
import { requireActionPermission } from '@/lib/action-permissions'
import {
  containerService,
  type BindableGoodsRecord,
  type ContainerRecord,
} from '@/services/container.service'
import { containerTrackingService } from '@/services/container-tracking.service'
import { CONTAINER_CODE_PATTERN } from '@/lib/container-code-policy'

interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

const goodsBindingSchema = z.object({
  goodsId: z.string().min(1, '请选择商品'),
  goodsQuantityPerContainer: z.coerce
    .number()
    .positive('每个包装物的商品数量必须大于0')
    .multipleOf(0.001, '最多保留3位小数'),
})

const createContainerSchema = z.object({
  code: z
    .string()
    .min(1, '包装物编码不能为空')
    .regex(CONTAINER_CODE_PATTERN, '包装物编码格式错误，应为 C + 6位数字（如 C000001）'),
  name: z.string().min(1, '名称不能为空'),
  unit: z.string().min(1, '单位不能为空'),
  deposit: z.coerce.number().min(0, '押金不能为负数'),
  remark: z.preprocess((value) => (value === null ? undefined : value), z.string().optional()),
  goodsBindings: z.array(goodsBindingSchema).default([]),
})

const updateContainerSchema = createContainerSchema.omit({ code: true }).partial().extend({
  isActive: z.boolean().optional(),
})

export async function getNextContainerCode(): Promise<ActionResponse<string>> {
  try {
    await requireActionPermission('master-data:write')
    return { success: true, data: await containerService.getNextCode() }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '生成包装物编码失败',
    }
  }
}

export async function createContainer(
  formData: z.infer<typeof createContainerSchema>
): Promise<ActionResponse> {
  try {
    await requireActionPermission('master-data:write')

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
    await requireActionPermission('master-data:write')

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
    const user = await requireActionPermission('master-data:write')

    await containerService.delete(id, user.id)

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

export async function restoreContainer(id: string): Promise<ActionResponse<ContainerRecord>> {
  try {
    const user = await requireActionPermission('master-data:write')
    const container = await containerService.restore(id, user.id)

    return {
      success: true,
      message: '包装物已恢复，请确认后启用',
      data: container,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '恢复包装物失败',
    }
  }
}

export async function listContainers(): Promise<ActionResponse<ContainerRecord[]>> {
  try {
    await requireActionPermission('stock:read')
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

export async function listBindableGoods(): Promise<ActionResponse<BindableGoodsRecord[]>> {
  try {
    await requireActionPermission('stock:read')
    return { success: true, data: await containerService.listBindableGoods() }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取可关联商品失败',
    }
  }
}

export async function listTracking(
  storeId?: string,
  containerId?: string
): Promise<ActionResponse> {
  try {
    await requireActionPermission('stock:read')
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
