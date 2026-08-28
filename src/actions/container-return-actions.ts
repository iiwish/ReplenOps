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
  quantity: z.coerce.number().int('归还数量必须是整数').positive('归还数量必须大于0'),
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

const getReturnRequestsSchema = getReturnLogsSchema.extend({
  status: z.enum(['PENDING', 'COMPLETED', 'REJECTED', 'CANCELLED']).optional(),
})

const completeReturnSchema = z.object({
  returnId: z.string().min(1, '归还单ID不能为空'),
  items: z
    .array(
      z.object({
        itemId: z.string().min(1),
        receivedQuantity: z.coerce.number().int('实收数量必须是整数').min(0),
      })
    )
    .min(1, '请填写实收数量'),
  remark: z.string().optional(),
})

const rejectReturnSchema = z.object({
  returnId: z.string().min(1, '归还单ID不能为空'),
  reason: z.string().trim().min(1, '请填写驳回原因'),
})

const storeReturnRequestsSchema = z.object({
  storeId: z.string().min(1, '门店ID不能为空'),
  page: z.coerce.number().min(1).default(1),
  pageSize: z.coerce.number().min(1).max(50).default(20),
})

const cancelReturnSchema = z.object({
  returnId: z.string().min(1, '归还单ID不能为空'),
  storeId: z.string().min(1, '门店ID不能为空'),
})

/**
 * 提交包装物归还申请
 */
export async function submitContainerReturnRequest(
  formData: z.infer<typeof batchReturnSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) {
      throw new Error('请先登录')
    }

    const validatedData = batchReturnSchema.parse(formData)
    await assertCanOperateStore(user, Number.parseInt(validatedData.storeId, 10))

    const request = await containerTrackingService.submitReturnRequest({
      storeId: validatedData.storeId,
      items: validatedData.items,
      remark: validatedData.remark,
      operatorId: user.id,
    })

    revalidatePath('/admin/container-return')
    revalidatePath('/admin/container-tracking')
    revalidatePath('/admin/containers')
    revalidatePath('/mobile/container-return')

    return {
      success: true,
      message: '归还申请已提交，等待仓库验收',
      data: request,
    }
  } catch (error) {
    console.error('提交包装物归还申请失败:', error)
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }
    return {
      success: false,
      message: '提交包装物归还申请失败',
    }
  }
}

export async function getContainerReturnRequests(
  params: z.infer<typeof getReturnRequestsSchema>
): Promise<ActionResponse> {
  try {
    await requireActionPermission('stock:read')
    const validated = getReturnRequestsSchema.parse(params)
    const range = getShanghaiDateRange(validated.dateFrom, validated.dateTo)
    return {
      success: true,
      data: await containerTrackingService.listReturnRequests({
        storeId: validated.storeId,
        containerId: validated.containerId,
        status: validated.status,
        dateFrom: range.start,
        dateToExclusive: range.endExclusive,
        page: validated.page,
        pageSize: validated.pageSize,
      }),
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取归还申请失败',
    }
  }
}

export async function completeContainerReturn(
  formData: z.infer<typeof completeReturnSchema>
): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('stock:write')
    const validated = completeReturnSchema.parse(formData)
    const request = await containerTrackingService.completeReturnRequest(
      validated.returnId,
      validated.items,
      user.id,
      validated.remark
    )
    revalidatePath('/admin/container-return')
    revalidatePath('/admin/container-tracking')
    revalidatePath('/admin/containers')
    revalidatePath('/mobile/container-return')
    return { success: true, message: '归还单验收完成', data: request }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '归还单验收失败',
    }
  }
}

export async function rejectContainerReturn(
  formData: z.infer<typeof rejectReturnSchema>
): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('stock:write')
    const validated = rejectReturnSchema.parse(formData)
    const request = await containerTrackingService.rejectReturnRequest(
      validated.returnId,
      validated.reason,
      user.id
    )
    revalidatePath('/admin/container-return')
    revalidatePath('/admin/container-tracking')
    revalidatePath('/admin/containers')
    revalidatePath('/mobile/container-return')
    return { success: true, message: '归还申请已驳回', data: request }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '驳回归还申请失败',
    }
  }
}

export async function getStoreContainerReturnRequests(
  params: z.infer<typeof storeReturnRequestsSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('请先登录')
    const validated = storeReturnRequestsSchema.parse(params)
    await assertCanOperateStore(user, Number.parseInt(validated.storeId, 10))
    return {
      success: true,
      data: await containerTrackingService.listReturnRequests({
        storeId: validated.storeId,
        status: 'PENDING',
        page: validated.page,
        pageSize: validated.pageSize,
      }),
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '获取待验收归还单失败',
    }
  }
}

export async function cancelContainerReturn(
  formData: z.infer<typeof cancelReturnSchema>
): Promise<ActionResponse> {
  try {
    const user = await getCurrentUser()
    if (!user) throw new Error('请先登录')
    const validated = cancelReturnSchema.parse(formData)
    await assertCanOperateStore(user, Number.parseInt(validated.storeId, 10))
    const request = await containerTrackingService.cancelReturnRequest(
      validated.returnId,
      validated.storeId,
      user.id
    )
    revalidatePath('/admin/container-return')
    revalidatePath('/admin/container-tracking')
    revalidatePath('/admin/containers')
    revalidatePath('/mobile/container-return')
    return { success: true, message: '归还申请已撤回', data: request }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '撤回归还申请失败',
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
