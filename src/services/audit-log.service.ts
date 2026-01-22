import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface ListAuditLogsParams {
  page?: number
  pageSize?: number
  actions?: string[]
  operatorId?: string
  orderId?: string
  startDate?: Date
  endDate?: Date
}

export interface AuditLogListItem {
  id: string
  action: string
  operatedBy: string
  operatorIp?: string
  orderId?: string
  orderCode?: string
  orderStore?: string
  remark?: string
  beforeData?: any
  afterData?: any
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
  operatedBy: string
  operatorIp?: string
  orderId?: string
  orderCode?: string
  orderStore?: string
  remark?: string
  beforeData?: any
  afterData?: any
  createdAt: Date
  operatorName?: string
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
            select: { id: true, code: true, store: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.approvalLog.count({ where }),
    ])

    const items = logs.map((log) => ({
      id: log.id,
      action: log.action,
      operatedBy: log.operatedBy,
      operatorIp: log.operatorIp || undefined,
      orderId: log.orderId,
      orderCode: log.order?.code || undefined,
      orderStore: log.order?.store?.name || undefined,
      remark: log.remark || undefined,
      beforeData: log.beforeData,
      afterData: log.afterData,
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
    const log = await prisma.approvalLog.findUnique({
      where: { id },
      include: {
        order: {
          select: { id: true, code: true, store: true },
        },
      },
    })

    if (!log) {
      throw new Error('审计日志不存在')
    }

    return {
      id: log.id,
      action: log.action,
      operatedBy: log.operatedBy,
      operatorIp: log.operatorIp || undefined,
      orderId: log.orderId,
      orderCode: log.order?.code || undefined,
      orderStore: log.order?.store?.name || undefined,
      remark: log.remark || undefined,
      beforeData: log.beforeData,
      afterData: log.afterData,
      createdAt: log.createdAt,
      operatorName: log.operatedBy,
    }
  }

  async create(data: {
    orderId?: string
    action: string
    operator: string
    operatorIp: string
    remark?: string
    beforeData?: any
    afterData?: any
  }): Promise<void> {
    await prisma.approvalLog.create({
      data: {
        orderId: data.orderId,
        action: data.action,
        operator: data.operator,
        operatorIp: data.operatorIp,
        remark: data.remark,
        beforeData: data.beforeData,
        afterData: data.afterData,
      },
    })
  }

  async exportToExcel(params: ListAuditLogsParams): Promise<Buffer> {
    const result = await this.list(params)

    const headers = ['操作时间', '操作类型', '操作人', 'IP地址', '订单号', '操作说明']

    const rows = result.data.map((log) => [
      new Date(log.createdAt).toLocaleString('zh-CN'),
      log.action,
      log.operatedBy,
      log.operatorIp || '-',
      log.orderCode || '-',
      log.remark || '-',
    ])

    const workbook = {
      Headers: headers,
      Sheets: [
        {
          name: '审计日志',
          data: [headers, ...rows],
        },
      ],
    }

    const XLSX = await import('xlsx')
    return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  }

  async canUserViewAll(userId: string): Promise<boolean> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { roles: true },
    })

    if (!user) {
      return false
    }

    const roles = user.roles || []
    return roles.some((role) => role.name === 'super_admin' && role.isEnabled)
  }
}

export const auditLogService = new AuditLogService()
