'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActionPermission } from '@/lib/action-permissions'
import { goodsCategoryService } from '@/services/goods-category.service'

// Zod 验证 Schema
const goodsCategorySchema = z.object({
  code: z
    .string()
    .min(1, '分类编码不能为空')
    .regex(/^GC\d{4}$/, '分类编码格式错误，应为 GC + 4位数字（如 GC0001）'),
  name: z.string().min(2, '分类名称至少2个字符').max(30, '分类名称最多30个字符'),
  sortOrder: z.number().int().min(0, '排序序号不能为负数').default(0),
})

const updateGoodsCategorySchema = z.object({
  name: z.string().min(2, '分类名称至少2个字符').max(30, '分类名称最多30个字符'),
  sortOrder: z.number().int().min(0, '排序序号不能为负数').default(0),
})

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * 创建商品分类
 */
export async function createGoodsCategory(formData: FormData): Promise<ActionResponse> {
  try {
    await requireActionPermission('master-data:write')
    // 从 FormData 提取数据
    const rawData = {
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
    }

    // Zod 验证
    const validatedData = goodsCategorySchema.parse(rawData)

    // 调用 Service 创建
    const category = await goodsCategoryService.create(validatedData)

    // 重新验证缓存
    revalidatePath('/admin/goods-category')

    return {
      success: true,
      message: '商品分类创建成功',
      data: category,
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
 * 更新商品分类
 */
export async function updateGoodsCategory(id: string, formData: FormData): Promise<ActionResponse> {
  try {
    await requireActionPermission('master-data:write')
    // 从 FormData 提取数据
    const rawData = {
      name: formData.get('name') as string,
      sortOrder: parseInt(formData.get('sortOrder') as string) || 0,
    }

    // Zod 验证
    const validatedData = updateGoodsCategorySchema.parse(rawData)

    // 调用 Service 更新
    const category = await goodsCategoryService.update(id, validatedData)

    // 重新验证缓存
    revalidatePath('/admin/goods-category')

    return {
      success: true,
      message: '商品分类更新成功',
      data: category,
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
 * 删除商品分类（软删除）
 */
export async function deleteGoodsCategory(id: string): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('master-data:write')
    await goodsCategoryService.delete(id, user.id)

    // 重新验证缓存
    revalidatePath('/admin/goods-category')

    return {
      success: true,
      message: '商品分类删除成功',
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

export async function restoreGoodsCategory(id: string): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('master-data:write')
    const category = await goodsCategoryService.restore(id, user.id)

    revalidatePath('/admin/goods-category')

    return {
      success: true,
      message: '商品分类已恢复，请确认后启用',
      data: category,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '恢复失败，请重试',
    }
  }
}

/**
 * 切换商品分类状态（启用/禁用）
 */
export async function toggleGoodsCategoryStatus(id: string): Promise<ActionResponse> {
  try {
    await requireActionPermission('master-data:write')
    const category = await goodsCategoryService.toggleStatus(id)

    // 重新验证缓存
    revalidatePath('/admin/goods-category')

    return {
      success: true,
      message: `商品分类已${category.isActive ? '启用' : '禁用'}`,
      data: category,
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
 * 更新排序
 */
export async function updateGoodsCategorySortOrder(
  orders: { id: string; sortOrder: number }[]
): Promise<ActionResponse> {
  try {
    await requireActionPermission('master-data:write')
    await goodsCategoryService.updateSortOrder(orders)

    // 重新验证缓存
    revalidatePath('/admin/goods-category')

    return {
      success: true,
      message: '排序更新成功',
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
      message: '更新失败，请重试',
    }
  }
}
