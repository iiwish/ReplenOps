'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'
import { orderRevocationService } from '@/services/order-revocation.service'
import { revalidatePath } from 'next/cache'

const revokeOrderSchema = z.object({
  reason: z.string().min(3, '撤销原因至少 3 个字符').max(500, '撤销原因不能超过 500 字'),
})

export async function revokeOrder(orderId: string, data: { reason: string }) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    const roles = getUserRoles(user)
    if (!roles.includes('super_admin')) {
      return {
        success: false,
        error: '只有超级管理员可以撤销订单',
      }
    }

    const validatedData = revokeOrderSchema.parse(data)

    const headersList = await headers()
    const ip = headersList.get('x-forwarded-for') || headersList.get('x-real-ip') || 'unknown'

    const result = await orderRevocationService.revokeOrder(
      orderId,
      validatedData.reason,
      user.id,
      ip
    )

    revalidatePath('/admin/orders')
    revalidatePath('/admin/orders/[id]')

    return result
  } catch (error) {
    console.error('撤销订单失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '撤销订单失败',
    }
  }
}

export async function getRevokePreview(orderId: string) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    const roles = getUserRoles(user)
    if (!roles.includes('super_admin')) {
      return {
        success: false,
        error: '只有超级管理员可以查看撤销预览',
      }
    }

    const preview = await orderRevocationService.getRevokePreview(orderId)

    return {
      success: true,
      data: preview,
    }
  } catch (error) {
    console.error('获取撤销预览失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取撤销预览失败',
    }
  }
}

export async function canRevokeOrder(orderId: string) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    const roles = getUserRoles(user)
    if (!roles.includes('super_admin')) {
      return {
        success: true,
        canRevoke: false,
      }
    }

    const canRevoke = await orderRevocationService.canRevokeOrder(orderId)

    return {
      success: true,
      canRevoke,
    }
  } catch (error) {
    console.error('检查订单是否可撤销失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '检查失败',
    }
  }
}
