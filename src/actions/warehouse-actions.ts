'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActionPermission } from '@/lib/action-permissions'
import { warehouseService } from '@/services/warehouse.service'

// Zod 验证 Schema
const warehouseSchema = z.object({
  code: z
    .string()
    .min(1, '仓库编码不能为空')
    .regex(/^WH\d{4}$/, '仓库编码格式错误，应为 WH + 4位数字（如 WH0001）'),
  name: z.string().min(1, '仓库名称不能为空'),
  address: z.string().optional(),
  contactName: z.string().min(1, '联系人不能为空'),
  contactPhone: z
    .string()
    .min(1, '联系电话不能为空')
    .regex(/^1[3-9]\d{9}$/, '请输入正确的手机号码'),
})

const updateWarehouseSchema = z.object({
  name: z.string().min(1, '仓库名称不能为空'),
  address: z.string().optional(),
  contactName: z.string().min(1, '联系人不能为空'),
  contactPhone: z
    .string()
    .min(1, '联系电话不能为空')
    .regex(/^1[3-9]\d{9}$/, '请输入正确的手机号码'),
})

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * 创建仓库
 */
export async function createWarehouse(formData: FormData): Promise<ActionResponse> {
  try {
    await requireActionPermission('master-data:write')
    // 从 FormData 提取数据
    const rawData = {
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      address: (formData.get('address') as string) || '',
      contactName: formData.get('contactName') as string,
      contactPhone: formData.get('contactPhone') as string,
    }

    // Zod 验证
    const validatedData = warehouseSchema.parse(rawData)

    // 调用 Service 创建
    const warehouse = await warehouseService.create(validatedData)

    // 重新验证缓存
    revalidatePath('/admin/warehouse')

    return {
      success: true,
      message: '仓库创建成功',
      data: warehouse,
    }
  } catch (error) {
    // 处理 Zod 验证错误
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '表单验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    // 处理业务逻辑错误
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '创建失败，请重试',
    }
  }
}

/**
 * 更新仓库
 */
export async function updateWarehouse(id: number, formData: FormData): Promise<ActionResponse> {
  try {
    await requireActionPermission('master-data:write')
    // 从 FormData 提取数据
    const rawData = {
      name: formData.get('name') as string,
      address: (formData.get('address') as string) || '',
      contactName: formData.get('contactName') as string,
      contactPhone: formData.get('contactPhone') as string,
    }

    // Zod 验证
    const validatedData = updateWarehouseSchema.parse(rawData)

    // 调用 Service 更新
    const warehouse = await warehouseService.update(id, validatedData)

    // 重新验证缓存
    revalidatePath('/admin/warehouse')

    return {
      success: true,
      message: '仓库更新成功',
      data: warehouse,
    }
  } catch (error) {
    // 处理 Zod 验证错误
    if (error instanceof z.ZodError) {
      return {
        success: false,
        message: '表单验证失败',
        errors: error.flatten().fieldErrors as Record<string, string[]>,
      }
    }

    // 处理业务逻辑错误
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '更新失败，请重试',
    }
  }
}

/**
 * 删除仓库（软删除）
 */
export async function deleteWarehouse(id: number): Promise<ActionResponse> {
  try {
    await requireActionPermission('master-data:write')
    await warehouseService.delete(id)

    // 重新验证缓存
    revalidatePath('/admin/warehouse')

    return {
      success: true,
      message: '仓库删除成功',
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '删除失败，请重试',
    }
  }
}

/**
 * 切换仓库状态（启用/禁用）
 */
export async function toggleWarehouseStatus(id: number): Promise<ActionResponse> {
  try {
    await requireActionPermission('master-data:write')
    const warehouse = await warehouseService.toggleStatus(id)

    // 重新验证缓存
    revalidatePath('/admin/warehouse')

    return {
      success: true,
      message: `仓库已${warehouse.isActive ? '启用' : '禁用'}`,
      data: warehouse,
    }
  } catch (error) {
    if (error instanceof Error) {
      return {
        success: false,
        message: error.message,
      }
    }

    return {
      success: false,
      message: '操作失败，请重试',
    }
  }
}
