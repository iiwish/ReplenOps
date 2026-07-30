'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { containerTrackingService } from '@/services/container-tracking.service'
import { requireActionPermission } from '@/lib/action-permissions'
import { getShanghaiDateRange } from '@/lib/shanghai-time'
import { getCurrentUser } from '@/lib/session.server'
import { assertCanOperateStore } from '@/lib/store-access'

interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

const returnItemSchema = z.object({
  containerId: z.string().min(1, '包装物ID不能为空'),
  quantity: z.coerce.number().positive('归还数量必须大于0'),
})

const batchReturnSchema = z.object({
  storeId: z.string().min(1, '请选择门店'),
  items: z.array(returnItemSchema).min(1, '至少归还一种包装物'),
  remark: z.string().optional(),
})

const getReturnLogsSchema = z.object({
  storeId: z.string().optional(),
  containerId: z.string().optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  page: z.coerce.number().min(1).optional().default(1),
  pageSize: z.coerce.number().min(1).optional().default(20),
})

const getReturnableContainersSchema = z.object({
  storeId: z.string().min(1, '门店ID不能为空'),
})

/**
 * 批量归还包装物
 */
export async function batchReturnContainers(
  formData: z.infer<typeof batchReturnSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('请先登录')
    }

    const validatedData = batchReturnSchema.parse(formData)
    await assertCanOperateStore(user, Number.parseInt(validatedData.storeId, 10))

    const results = await containerTrackingService.batchReturnContainers({
      storeId: validatedData.storeId,
      items: validatedData.items,
      remark: validatedData.remark,
      operatorId: user.id,
    })

    revalidatePath('/admin/container-return')
    revalidatePath('/admin/container-tracking')

    return {
      success: true,
      message: '包装物归还成功',
      data: results,
    }
  } catch (error) {
    console.error('批量归还包装物失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '批量归还包装物失败',
    }
  }
}

/**
 * 获取归还记录列表
 */
export async function getReturnLogs(
  params: z.infer<typeof getReturnLogsSchema>
): Promise<ActionResponse> {
  try {
    await requireActionPermission('stock:read')
    const validatedParams = getReturnLogsSchema.parse(params)
    const range = getShanghaiDateRange(validatedParams.dateFrom, validatedParams.dateTo)

    const result = await containerTrackingService.getReturnLogs({
      storeId: validatedParams.storeId,
      containerId: validatedParams.containerId,
      dateFrom: range.start,
      dateToExclusive: range.endExclusive,
      page: validatedParams.page,
      pageSize: validatedParams.pageSize,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取归还记录失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取归还记录失败',
    }
  }
}

/**
 * 获取可归还的包装物列表
 */
export async function getReturnableContainers(
  params: z.infer<typeof getReturnableContainersSchema>
): Promise<ActionResponse> {
  try {
    const validatedParams = getReturnableContainersSchema.parse(params)
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('请先登录')
    }
    await assertCanOperateStore(user, Number.parseInt(validatedParams.storeId, 10))

    const result = await containerTrackingService.getReturnableContainers(validatedParams.storeId)

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('获取可归还包装物失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '获取可归还包装物失败',
    }
  }
}
