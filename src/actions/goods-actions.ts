'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActionPermission } from '@/lib/action-permissions'
import { goodsService } from '@/services/goods.service'

// Zod 验证 Schema
const goodsSchema = z
  .object({
    code: z
      .string()
      .min(1, '商品编码不能为空')
      .regex(/^G\d{6}$/, '商品编码格式错误，应为 G + 6位数字（如 G000001）'),
    name: z.string().min(2, '商品名称至少2个字符').max(50, '商品名称最多50个字符'),
    categoryId: z.string().min(1, '请选择商品分类'),
    spec: z.string().optional(),
    unit: z.string().min(1, '单位不能为空').max(10, '单位最多10个字符'),
    measureType: z.enum(['INT', 'DECIMAL'], {
      message: '请选择计量类型',
    }),
    costPrice: z.coerce.number().min(0, '成本价不能为负数'),
    partnerPrice: z.coerce.number().min(0, '领用价不能为负数'),
    defaultInPrice: z.coerce.number().min(0, '默认入库价不能为负数'),
    containerId: z.string().optional(),
    containerRatio: z.coerce
      .number()
      .int('包装物配比必须是整数')
      .min(0, '包装物配比不能为负数')
      .optional(),
    imageUrl: z.string().url('图片URL格式错误').optional().nullable().or(z.literal('')),
    description: z.string().optional().nullable(),
  })
  .refine((data) => !data.containerId || (data.containerRatio && data.containerRatio > 0), {
    message: '绑定包装物时配比必须大于0',
    path: ['containerRatio'],
  })

const updateGoodsSchema = z
  .object({
    name: z.string().min(2, '商品名称至少2个字符').max(50, '商品名称最多50个字符'),
    categoryId: z.string().min(1, '请选择商品分类'),
    spec: z.string().optional(),
    unit: z.string().min(1, '单位不能为空').max(10, '单位最多10个字符'),
    measureType: z.enum(['INT', 'DECIMAL'], {
      message: '请选择计量类型',
    }),
    costPrice: z.coerce.number().min(0, '成本价不能为负数'),
    partnerPrice: z.coerce.number().min(0, '领用价不能为负数'),
    defaultInPrice: z.coerce.number().min(0, '默认入库价不能为负数'),
    containerId: z.string().optional(),
    containerRatio: z.coerce
      .number()
      .int('包装物配比必须是整数')
      .min(0, '包装物配比不能为负数')
      .optional(),
    imageUrl: z.string().url('图片URL格式错误').optional().nullable().or(z.literal('')),
    description: z.string().optional().nullable(),
  })
  .refine((data) => !data.containerId || (data.containerRatio && data.containerRatio > 0), {
    message: '绑定包装物时配比必须大于0',
    path: ['containerRatio'],
  })

// 通用响应接口
interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  errors?: Record<string, string[]>
}

/**
 * 创建商品
 */
export async function createGoods(formData: FormData): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('goods:write')
    // 从 FormData 提取数据
    const rawData = {
      code: formData.get('code') as string,
      name: formData.get('name') as string,
      categoryId: formData.get('categoryId') as string,
      spec: (formData.get('spec') as string) || undefined,
      unit: formData.get('unit') as string,
      measureType: formData.get('measureType') as 'INT' | 'DECIMAL',
      costPrice: formData.get('costPrice'),
      partnerPrice: formData.get('partnerPrice'),
      defaultInPrice: formData.get('defaultInPrice'),
      containerId: (formData.get('containerId') as string) || undefined,
      containerRatio: formData.get('containerRatio') || 0,
      imageUrl: (formData.get('imageUrl') as string) || undefined,
      description: (formData.get('description') as string) || undefined,
    }

    // Zod 验证
    const validatedData = goodsSchema.parse(rawData)

    // 调用 Service 创建 (过滤掉null值)
    const goods = await goodsService.create(
      {
        ...validatedData,
        imageUrl: validatedData.imageUrl || undefined,
        description: validatedData.description || undefined,
      },
      user.id
    )

    // 重新验证缓存
    revalidatePath('/admin/goods')

    return {
      success: true,
      message: '商品创建成功',
      data: goods,
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
 * 更新商品
 */
export async function updateGoods(id: string, formData: FormData): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('goods:write')
    // 从 FormData 提取数据
    const rawData = {
      name: formData.get('name') as string,
      categoryId: formData.get('categoryId') as string,
      spec: (formData.get('spec') as string) || undefined,
      unit: formData.get('unit') as string,
      measureType: formData.get('measureType') as 'INT' | 'DECIMAL',
      costPrice: formData.get('costPrice'),
      partnerPrice: formData.get('partnerPrice'),
      defaultInPrice: formData.get('defaultInPrice'),
      containerId: (formData.get('containerId') as string) || undefined,
      containerRatio: formData.get('containerRatio') || 0,
      imageUrl: (formData.get('imageUrl') as string) || undefined,
      description: (formData.get('description') as string) || undefined,
    }

    // Zod 验证
    const validatedData = updateGoodsSchema.parse(rawData)

    // 调用 Service 更新 (过滤掉null值)
    const goods = await goodsService.update(
      id,
      {
        ...validatedData,
        imageUrl: validatedData.imageUrl || undefined,
        description: validatedData.description || undefined,
      },
      user.id
    )

    // 重新验证缓存
    revalidatePath('/admin/goods')

    return {
      success: true,
      message: '商品更新成功',
      data: goods,
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
 * 删除商品（软删除）
 */
export async function deleteGoods(id: string): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('goods:write')
    await goodsService.delete(id, user.id)

    // 重新验证缓存
    revalidatePath('/admin/goods')

    return {
      success: true,
      message: '商品删除成功',
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

export async function restoreGoods(id: string): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('goods:write')
    const goods = await goodsService.restore(id, user.id)

    revalidatePath('/admin/goods')

    return {
      success: true,
      message: '商品已恢复，请确认后启用',
      data: goods,
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : '恢复失败，请重试',
    }
  }
}

/**
 * 切换商品状态（启用/禁用）
 */
export async function toggleGoodsStatus(id: string): Promise<ActionResponse> {
  try {
    const user = await requireActionPermission('goods:write')
    const goods = await goodsService.toggleStatus(id, user.id)

    // 重新验证缓存
    revalidatePath('/admin/goods')

    return {
      success: true,
      message: `商品已${goods.isActive ? '启用' : '禁用'}`,
      data: goods,
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
