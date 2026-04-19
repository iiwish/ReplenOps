'use server'

import { auditLogService } from '@/services/audit-log.service'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'
import type { ListAuditLogsInput } from '@/types/audit-log.types'

export async function listAuditLogs(input: ListAuditLogsInput) {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return {
        success: false,
        error: '未登录',
      }
    }

    const roles = getUserRoles(user)
    const isSuperAdmin = roles.includes('super_admin')

    const operatorId = isSuperAdmin ? input.operatorId : user.id

    const startDate = input.startDate ? new Date(input.startDate) : undefined
    const endDate = input.endDate ? new Date(input.endDate) : undefined

    const result = await auditLogService.list({
      page: input.page,
      pageSize: input.pageSize,
      actions: input.actions,
      operatorId,
      orderId: input.orderId ? Number.parseInt(input.orderId, 10) : undefined,
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

    const roles = getUserRoles(user)
    const isSuperAdmin = roles.includes('super_admin')

    const log = await auditLogService.getById(id)

    if (!isSuperAdmin && log.operatedBy !== user.id) {
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

    const roles = getUserRoles(user)
    const isSuperAdmin = roles.includes('super_admin')

    if (!isSuperAdmin) {
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
      operatorId: input.operatorId,
      orderId: input.orderId ? Number.parseInt(input.orderId, 10) : undefined,
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
