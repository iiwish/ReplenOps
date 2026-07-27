import { prisma } from '@/lib/prisma'
import type { Prisma } from '@prisma/client'

export interface ListAuditLogsParams {
  page?: number
  pageSize?: number
  actions?: string[]
  operatorId?: string
  orderId?: number
  startDate?: Date
  endDate?: Date
}

export interface AuditLogListItem {
  id: string
  action: string
  reason?: string
  operatedBy: string
  operatorIp?: string
  orderId?: string
  orderCode?: string
  orderStore?: string
  entityType: string
  entityId?: string
  createdAt: Date
}

export interface PaginatedAuditLogResult {
  data: AuditLogListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export interface AuditLogDetail {
  id: string
  action: string
  reason?: string
  operatedBy: string
  operatorIp?: string
  orderId?: string
  orderCode?: string
  orderStore?: string
  entityType: string
  entityId?: string
  beforeJson?: Prisma.JsonValue
  afterJson?: Prisma.JsonValue
  createdAt: Date
}

export class AuditLogService {
  async list(params: ListAuditLogsParams): Promise<PaginatedAuditLogResult> {
    const {
      page = 1,
      pageSize = 20,
      actions = [],
      operatorId,
      orderId,
      startDate,
      endDate,
    } = params

    const where: Prisma.ApprovalLogWhereInput = {}

    if (actions && actions.length > 0) {
      where.action = { in: actions }
    }

    if (operatorId) {
      where.operatedBy = operatorId
    }

    if (orderId) {
      where.orderId = orderId
    }

    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = startDate
      }
      if (endDate) {
        where.createdAt.lte = endDate
      }
    }

    const [logs, total] = await Promise.all([
      prisma.approvalLog.findMany({
        where,
        include: {
          order: {
            select: {
              id: true,
              code: true,
              store: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.approvalLog.count({ where }),
    ])

    const items: AuditLogListItem[] = logs.map((log) => ({
      id: String(log.id),
      action: log.action,
      reason: log.reason || undefined,
      operatedBy: log.operatedBy,
      operatorIp: log.operatorIp || undefined,
      orderId: log.orderId !== null ? String(log.orderId) : undefined,
      orderCode: log.order?.code || undefined,
      orderStore: log.order?.store?.name || undefined,
      entityType: log.entityType,
      entityId: log.entityId || undefined,
      createdAt: log.createdAt,
    }))

    return {
      data: items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  async getById(id: string): Promise<AuditLogDetail> {
    const numericId = Number.parseInt(id, 10)

    if (Number.isNaN(numericId)) {
      throw new Error('审计日志ID无效')
    }

    const log = await prisma.approvalLog.findUnique({
      where: { id: numericId },
      include: {
        order: {
          select: {
            id: true,
            code: true,
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    })

    if (!log) {
      throw new Error('审计日志不存在')
    }

    return {
      id: String(log.id),
      action: log.action,
      reason: log.reason || undefined,
      operatedBy: log.operatedBy,
      operatorIp: log.operatorIp || undefined,
      orderId: log.orderId !== null ? String(log.orderId) : undefined,
      orderCode: log.order?.code || undefined,
      orderStore: log.order?.store?.name || undefined,
      entityType: log.entityType,
      entityId: log.entityId || undefined,
      beforeJson: log.beforeJson ?? undefined,
      afterJson: log.afterJson ?? undefined,
      createdAt: log.createdAt,
    }
  }

  async create(data: {
    orderId?: number
    entityType?: string
    entityId?: string
    action: string
    operatedBy: string
    operatorIp?: string
    reason?: string
    beforeJson?: Prisma.InputJsonValue
    afterJson?: Prisma.InputJsonValue
  }): Promise<void> {
    await prisma.approvalLog.create({
      data: {
        orderId: data.orderId,
        entityType: data.entityType ?? 'ORDER',
        entityId: data.entityId ?? (data.orderId === undefined ? undefined : String(data.orderId)),
        action: data.action,
        operatedBy: data.operatedBy,
        operatorIp: data.operatorIp,
        reason: data.reason,
        beforeJson: data.beforeJson,
        afterJson: data.afterJson,
      },
    })
  }

  async exportToExcel(params: ListAuditLogsParams): Promise<Buffer> {
    const result = await this.list(params)

    const headers = ['操作时间', '操作类型', '操作人', 'IP地址', '业务对象', '操作说明']

    const rows = result.data.map((log) => [
      new Date(log.createdAt).toLocaleString('zh-CN'),
      log.action,
      log.operatedBy,
      log.operatorIp || '-',
      log.orderCode || `${log.entityType} #${log.entityId || '-'}`,
      log.reason || '-',
    ])

    const XLSX = await import('xlsx')
    const workbook = XLSX.utils.book_new()
    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...rows])
    XLSX.utils.book_append_sheet(workbook, worksheet, '审计日志')

    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  }
}

export const auditLogService = new AuditLogService()
