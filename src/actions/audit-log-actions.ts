'use server'

import { headers } from 'next/headers'
import { z } from 'zod'
import { auditLogService } from '@/services/audit-log.service'
import { revalidatePath } from 'next/cache'

export const listAuditLogsSchema = z.object({
  page: z.number().int().positive().default(1),
  pageSize: z.number().int().positive().max(100).default(20),
  actions: z.array(z.string()).optional(),
  operatorId: z.string().optional(),
  orderId: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
})

export type ListAuditLogsInput = z.infer<typeof listAuditLogsSchema>

export async function listAuditLogs(input: ListAuditLogsInput) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    const canViewAll = await auditLogService.canUserViewAll(user.id)

    if (!canViewAll) {
      if (input.actions || input.operatorId || input.orderId) {
        return {
          success: false,
          error: '无权查看他人的操作日志',
        }
      }
    }

    const startDate = input.startDate ? new Date(input.startDate) : undefined
    const endDate = input.endDate ? new Date(input.endDate) : undefined

    const result = await auditLogService.list({
      page: input.page,
      pageSize: input.pageSize,
      actions: input.actions,
      operatorId: canViewAll ? undefined : input.operatorId || user.id,
      orderId: input.orderId,
      startDate,
      endDate,
    })

    return {
      success: true,
      data: result,
    }
  } catch (error) {
    console.error('查询审计日志失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '查询审计日志失败',
    }
  }
}

export async function getAuditLogDetail(id: string) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    const canViewAll = await auditLogService.canUserViewAll(user.id)

    const log = await auditLogService.getById(id)

    if (!canViewAll && log.operatedBy !== user.id) {
      return {
        success: false,
        error: '无权查看他人的操作日志',
      }
    }

    return {
      success: true,
      data: log,
    }
  } catch (error) {
    console.error('获取审计日志详情失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取审计日志详情失败',
    }
  }
}

export async function exportAuditLogs(input: ListAuditLogsInput) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    const canViewAll = await auditLogService.canUserViewAll(user.id)

    if (!canViewAll) {
      return {
        success: false,
        error: '无权导出审计日志',
      }
    }

    const startDate = input.startDate ? new Date(input.startDate) : undefined
    const endDate = input.endDate ? new Date(input.endDate) : undefined

    const buffer = await auditLogService.exportToExcel({
      page: input.page,
      pageSize: input.pageSize,
      actions: input.actions,
      operatorId: canViewAll ? undefined : input.operatorId || user.id,
      orderId: input.orderId,
      startDate,
      endDate,
    })

    const filename = `审计日志_${new Date().toISOString().slice(0, 10)}.xlsx`

    return {
      success: true,
      data: {
        buffer,
        filename,
      },
    }
  } catch (error) {
    console.error('导出审计日志失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '导出审计日志失败',
    }
  }
}
