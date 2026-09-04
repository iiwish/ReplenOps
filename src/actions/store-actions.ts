'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { requireActionPermission } from '@/lib/action-permissions'
import { storeService } from '@/services/store.service'
import { userService } from '@/services/user.service'
import { getLoginClientAddress } from '@/services/auth-rate-limit.service'

// Zod 验证 Schema
const storeSchema = z.object({
  code: z
    .string()
    .min(1, '门店编码不能为空')
    .regex(/^ST\d{4}$/, '门店编码格式错误，应为 ST + 4位数字（如 ST0001）'),
  name: z.string().min(2, '门店名称至少2个字符').max(50, '门店名称最多50个字符'),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z
    .string()
    .optional()
    .refine((val) => !val || /^1[3-9]\d{9}$/.test(val), '请输入正确的手机号码'),
})

const updateStoreSchema = z.object({
  name: z.string().min(2, '门店名称至少2个字符').max(50, '门店名称最多50个字符'),
  address: z.string().optional(),
  contactName: z.string().optional(),
  contactPhone: z
    .string()
    .optional()
    .refine((val) => !val || /^1[3-9]\d{9}$/.test(val), '请输入正确的手机号码'),
})

const addAdminSchema = z.object({
  userId: z.string().min(1, '用户ID不能为空'),
})

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * 创建门店
 */
export async function createStore(formData: FormData): Promise<ActionResponse> {
  try {
    await requireActionPermission('store:manage')
    // 从 FormData 提取数据
    const rawData = {
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      address: (formData.get('address') as string) || '',
      contactName: (formData.get('contactName') as string) || '',
      contactPhone: (formData.get('contactPhone') as string) || '',
    }

    // Zod 验证
    const validatedData = storeSchema.parse(rawData)

    // 调用 Service 创建
    const store = await storeService.create(validatedData)

    // 重新验证缓存
    revalidatePath('/admin/stores')

    return {
      success: true,
      message: '门店创建成功',
      data: store,
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
 * 更新门店
 */
export async function updateStore(id: string, formData: FormData): Promise<ActionResponse> {
  try {
    await requireActionPermission('store:manage')
    // 从 FormData 提取数据
    const rawData = {
      name: formData.get('name') as string,
      address: (formData.get('address') as string) || '',
      contactName: (formData.get('contactName') as string) || '',
      contactPhone: (formData.get('contactPhone') as string) || '',
    }

    // Zod 验证
    const validatedData = updateStoreSchema.parse(rawData)

    // 调用 Service 更新
    const store = await storeService.update(id, validatedData)

    // 重新验证缓存
    revalidatePath('/admin/stores')

    return {
      success: true,
      message: '门店更新成功',
      data: store,
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
 * 删除门店（软删除）
 */
export async function deleteStore(id: string): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('store:manage')
    await storeService.delete(id, user.id)

    // 重新验证缓存
    revalidatePath('/admin/stores')

    return {
      success: true,
      message: '门店删除成功',
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

export async function restoreStore(id: string): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('store:manage')
    const store = await storeService.restore(id, user.id)

    revalidatePath('/admin/stores')

    return {
      success: true,
      message: '门店已恢复，请重新分配管理员并确认后启用',
      data: store,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '恢复失败，请重试',
    }
  }
}

/**
 * 切换门店状态（启用/禁用）
 */
export async function toggleStoreStatus(id: string): Promise<ActionResponse> {
  try {
    await requireActionPermission('store:manage')
    const store = await storeService.toggleStatus(id)

    // 重新验证缓存
    revalidatePath('/admin/stores')

    return {
      success: true,
      message: `门店已${store.isActive ? '启用' : '禁用'}`,
      data: store,
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

/**
 * 添加门店管理员
 */
export async function addStoreAdmin(storeId: string, formData: FormData): Promise<ActionResponse> {
  try {
    const currentUser = await requireActionPermission('store:manage')
    // 从 FormData 提取数据
    const rawData = {
      userId: formData.get('userId') as string,
    }

    // Zod 验证
    const validatedData = addAdminSchema.parse(rawData)

    // 调用 Service 添加管理员
    const admin = await storeService.addAdmin(
      storeId,
      validatedData.userId,
      currentUser.id,
      getLoginClientAddress(await headers())
    )

    const user = await userService.findById(validatedData.userId)

    const adminWithUser = {
      ...admin,
      user: user
        ? {
            code: user.code,
            displayName: user.displayName || user.name || '',
            email: user.email || '',
            avatar: user.avatar || undefined,
          }
        : undefined,
    }

    // 重新验证缓存
    revalidatePath('/admin/stores')
    revalidatePath(`/admin/stores/${storeId}/admins`)

    return {
      success: true,
      message: '管理员添加成功',
      data: adminWithUser,
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
      message: '添加失败，请重试',
    }
  }
}

/**
 * 移除门店管理员
 */
export async function removeStoreAdmin(storeId: string, userId: string): Promise<ActionResponse> {
  try {
    const currentUser = await requireActionPermission('store:manage')
    await storeService.removeAdmin(
      storeId,
      userId,
      currentUser.id,
      getLoginClientAddress(await headers())
    )

    // 重新验证缓存
    revalidatePath('/admin/stores')
    revalidatePath(`/admin/stores/${storeId}/admins`)

    return {
      success: true,
      message: '管理员移除成功',
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
      message: '移除失败，请重试',
    }
  }
}

/**
 * 检查门店编码是否可用
 */
export async function checkStoreCode(
  code: string,
  excludeId?: string
): Promise<ActionResponse<{ available: boolean }>> {
  try {
    await requireActionPermission('store:manage')
    const available = await storeService.isCodeAvailable(code, excludeId)

    return {
      success: true,
      data: { available },
    }
  } catch {
    return {
      success: false,
      message: '检查失败，请重试',
    }
  }
}

/**
 * 获取当前用户可访问的所有门店
 */
export async function getUserStores(): Promise<ActionResponse> {
  try {
    // 先获取当前用户
    const { getCurrentUser } = await import('@/lib/session')
    const user = await getCurrentUser()

    if (!user) {
      return {
        success: false,
        message: '用户未登录',
      }
    }

    // 传递user给service
    const stores = await storeService.getUserStores(user)

    return {
      success: true,
      data: stores,
    }
  } catch (error) {
    console.error('获取用户门店失败:', error)

    return {
      success: false,
      message: error instanceof Error ? error.message : '获取用户门店失败',
    }
  }
}
