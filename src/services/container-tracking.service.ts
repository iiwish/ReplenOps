import { ContainerOpType, ContainerReturnStatus, Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { documentNumberService } from './document-number.service'
import {
  getUserDisplayNameMap,
  resolveUserDisplayName,
  type UserDisplayNameMap,
} from './user-display.service'

export interface ListTrackingParams {
  storeId?: string
  containerId?: string
  hasUnreturned?: boolean
}

export interface TrackingListItem {
  id: string
  storeId: string
  storeName: string
  containerId: string
  containerName: string
  containerCode: string
  containerUnit: string
  totalBorrowed: number
  totalReturned: number
  currentBorrowed: number
  pendingReturnQuantity: number
  depositTotal: number
  lastBorrowAt: Date | null
  lastReturnAt: Date | null
}

export interface ContainerLogItem {
  id: string
  containerTrackingId: string
  orderId: string | null
  orderCode: string | null
  opType: ContainerOpType
  quantity: number
  beforeBorrowed: number
  afterBorrowed: number
  remark: string | null
  operatedBy: string
  operatorName: string
  operatedAt: Date
}

export interface ContainerReturnRequestItem {
  id: string
  containerId: string
  containerCode: string
  containerName: string
  containerUnit: string
  requestedQuantity: number
  receivedQuantity: number | null
}

export interface ContainerReturnRequestRecord {
  id: string
  code: string
  storeId: string
  storeName: string
  status: ContainerReturnStatus
  remark: string | null
  submittedBy: string
  submittedByName: string
  submittedAt: Date
  reviewedBy: string | null
  reviewedByName: string | null
  reviewedAt: Date | null
  reviewReason: string | null
  items: ContainerReturnRequestItem[]
}

interface ReturnRequestInput {
  storeId: string
  items: Array<{ containerId: string; quantity: number }>
  remark?: string
  operatorId: string
}

interface ReceivedReturnItemInput {
  itemId: string
  receivedQuantity: number
}

class ContainerTrackingService {
  async list(params?: ListTrackingParams): Promise<TrackingListItem[]> {
    const where: Prisma.ContainerTrackingWhereInput = { isDeleted: false }

    if (params?.storeId) where.storeId = Number.parseInt(params.storeId, 10)
    if (params?.containerId) where.containerId = Number.parseInt(params.containerId, 10)
    if (params?.hasUnreturned) where.currentBorrowed = { gt: 0 }

    const trackings = await prisma.containerTracking.findMany({
      where,
      include: {
        store: { select: { id: true, name: true } },
        container: {
          select: { id: true, name: true, code: true, unit: true, deposit: true },
        },
      },
      orderBy: [{ storeId: 'asc' }, { containerId: 'asc' }],
    })

    return trackings.map((tracking) => ({
      id: String(tracking.id),
      storeId: String(tracking.storeId),
      storeName: tracking.store.name,
      containerId: String(tracking.containerId),
      containerName: tracking.container.name,
      containerCode: tracking.container.code,
      containerUnit: tracking.container.unit,
      totalBorrowed: tracking.totalBorrowed,
      totalReturned: tracking.totalReturned,
      currentBorrowed: tracking.currentBorrowed,
      pendingReturnQuantity: tracking.pendingReturnQuantity,
      depositTotal: tracking.currentBorrowed * Number(tracking.container.deposit),
      lastBorrowAt: tracking.lastBorrowAt,
      lastReturnAt: tracking.lastReturnAt,
    }))
  }

  async getLogs(trackingId: string): Promise<ContainerLogItem[]> {
    const logs = await prisma.containerLog.findMany({
      where: { containerTrackingId: Number.parseInt(trackingId, 10) },
      include: { order: { select: { id: true, code: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const userNames = await getUserDisplayNameMap(logs.map((log) => log.operatedBy))

    return logs.map((log) => ({
      id: String(log.id),
      containerTrackingId: String(log.containerTrackingId),
      orderId: log.orderId !== null ? String(log.orderId) : null,
      orderCode: log.order?.code ?? null,
      opType: log.opType,
      quantity: log.quantity,
      beforeBorrowed: log.beforeBorrowed,
      afterBorrowed: log.afterBorrowed,
      remark: log.remark,
      operatedBy: log.operatedBy,
      operatorName: resolveUserDisplayName(log.operatedBy, userNames) ?? log.operatedBy,
      operatedAt: log.operatedAt,
    }))
  }

  async borrowContainers(
    stockOutId: string,
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    if (tx) {
      await this.borrowContainersInTransaction(stockOutId, userId, tx)
      return
    }
    await prisma.$transaction((client) =>
      this.borrowContainersInTransaction(stockOutId, userId, client)
    )
  }

  private async borrowContainersInTransaction(
    stockOutId: string,
    userId: string,
    tx: Prisma.TransactionClient
  ): Promise<void> {
    const stockOut = await tx.stockOut.findFirst({
      where: { id: Number.parseInt(stockOutId, 10), isDeleted: false },
      include: { containerItems: true, order: { select: { storeId: true } } },
    })

    if (!stockOut) throw new Error('出库单不存在')

    for (const item of stockOut.containerItems) {
      if (item.shippedQuantity <= 0) continue

      const tracking = await tx.containerTracking.upsert({
        where: {
          storeId_containerId: {
            storeId: stockOut.order.storeId,
            containerId: item.containerId,
          },
        },
        create: {
          storeId: stockOut.order.storeId,
          containerId: item.containerId,
          totalBorrowed: item.shippedQuantity,
          currentBorrowed: item.shippedQuantity,
          lastBorrowAt: new Date(),
        },
        update: {
          totalBorrowed: { increment: item.shippedQuantity },
          currentBorrowed: { increment: item.shippedQuantity },
          lastBorrowAt: new Date(),
          isDeleted: false,
        },
      })
      const beforeBorrowed = tracking.currentBorrowed - item.shippedQuantity

      await tx.containerLog.create({
        data: {
          containerId: item.containerId,
          containerTrackingId: tracking.id,
          orderId: stockOut.orderId,
          opType: 'BORROW',
          quantity: item.shippedQuantity,
          beforeBorrowed,
          afterBorrowed: tracking.currentBorrowed,
          remark: `出库单：${stockOut.code}`,
          operatedBy: userId,
          operatedAt: new Date(),
        },
      })
    }
  }

  async submitReturnRequest(data: ReturnRequestInput) {
    const storeId = Number.parseInt(data.storeId, 10)
    if (!Number.isInteger(storeId) || data.items.length === 0) {
      throw new Error('请选择要归还的包装物')
    }

    const items = data.items.map((item) => ({
      containerId: Number.parseInt(item.containerId, 10),
      quantity: item.quantity,
    }))
    if (
      items.some(
        (item) =>
          !Number.isInteger(item.containerId) ||
          !Number.isInteger(item.quantity) ||
          item.quantity <= 0
      )
    ) {
      throw new Error('包装物归还数量必须是正整数')
    }
    if (new Set(items.map((item) => item.containerId)).size !== items.length) {
      throw new Error('同一归还申请中不能重复选择包装物')
    }

    return prisma.$transaction(async (tx) => {
      const store = await tx.store.findFirst({
        where: { id: storeId, isDeleted: false, isActive: true },
        select: { id: true },
      })
      if (!store) throw new Error('门店不存在或已停用')

      const code = await documentNumberService.next('CONTAINER_RETURN', tx)
      const reservedItems: Array<{
        containerId: number
        containerTrackingId: number
        requestedQuantity: number
      }> = []

      for (const item of items) {
        const tracking = await tx.containerTracking.findUnique({
          where: { storeId_containerId: { storeId, containerId: item.containerId } },
          include: { container: { select: { name: true, isActive: true, isDeleted: true } } },
        })
        if (!tracking || tracking.isDeleted || tracking.container.isDeleted) {
          throw new Error('门店无此包装物的借出记录')
        }

        const rows = await tx.$queryRaw<Array<{ id: number }>>(Prisma.sql`
          UPDATE "container_tracking"
          SET
            "pending_return_quantity" = "pending_return_quantity" + ${item.quantity},
            "updated_at" = CURRENT_TIMESTAMP
          WHERE
            "id" = ${tracking.id}
            AND NOT "is_deleted"
            AND "current_borrowed" - "pending_return_quantity" >= ${item.quantity}
          RETURNING "id"
        `)
        if (rows.length !== 1) {
          const available = tracking.currentBorrowed - tracking.pendingReturnQuantity
          throw new Error(`${tracking.container.name} 可申请归还数量不足，当前可申请 ${available}`)
        }

        reservedItems.push({
          containerId: item.containerId,
          containerTrackingId: tracking.id,
          requestedQuantity: item.quantity,
        })
      }

      return tx.containerReturn.create({
        data: {
          code,
          storeId,
          remark: data.remark,
          submittedBy: data.operatorId,
          items: { create: reservedItems },
        },
        include: { items: true },
      })
    })
  }

  async completeReturnRequest(
    returnId: string,
    receivedItems: ReceivedReturnItemInput[],
    reviewerId: string,
    remark?: string
  ): Promise<ContainerReturnRequestRecord> {
    const numericReturnId = Number.parseInt(returnId, 10)
    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "container_returns" WHERE "id" = ${numericReturnId} FOR UPDATE
      `)
      const request = await tx.containerReturn.findUnique({
        where: { id: numericReturnId },
        include: {
          store: { select: { name: true } },
          items: { include: { container: true, tracking: true } },
        },
      })
      if (!request) throw new Error('归还申请不存在')
      if (request.status !== 'PENDING') throw new Error('该归还申请已处理')

      const receivedMap = new Map<number, number>()
      for (const item of receivedItems) {
        const itemId = Number.parseInt(item.itemId, 10)
        if (
          !Number.isInteger(itemId) ||
          !Number.isInteger(item.receivedQuantity) ||
          item.receivedQuantity < 0 ||
          receivedMap.has(itemId)
        ) {
          throw new Error('实收数量不合法')
        }
        receivedMap.set(itemId, item.receivedQuantity)
      }
      if (receivedMap.size !== request.items.length) {
        throw new Error('请填写全部包装物的实收数量')
      }

      for (const item of request.items) {
        const receivedQuantity = receivedMap.get(item.id)
        if (receivedQuantity === undefined || receivedQuantity > item.requestedQuantity) {
          throw new Error(`${item.container.name} 实收数量不能超过申请数量`)
        }

        await tx.$queryRaw(Prisma.sql`
          SELECT "id" FROM "container_tracking" WHERE "id" = ${item.containerTrackingId} FOR UPDATE
        `)
        const tracking = await tx.containerTracking.findUniqueOrThrow({
          where: { id: item.containerTrackingId },
        })
        if (
          tracking.pendingReturnQuantity < item.requestedQuantity ||
          tracking.currentBorrowed < receivedQuantity
        ) {
          throw new Error(`${item.container.name} 台账数量异常，请刷新后重试`)
        }

        await tx.containerTracking.update({
          where: { id: tracking.id },
          data: {
            pendingReturnQuantity: { decrement: item.requestedQuantity },
            totalReturned: { increment: receivedQuantity },
            currentBorrowed: { decrement: receivedQuantity },
            ...(receivedQuantity > 0 ? { lastReturnAt: new Date() } : {}),
          },
        })
        await tx.containerReturnItem.update({
          where: { id: item.id },
          data: { receivedQuantity },
        })

        if (receivedQuantity > 0) {
          await tx.containerLog.create({
            data: {
              containerId: item.containerId,
              containerTrackingId: tracking.id,
              containerReturnId: request.id,
              opType: 'RETURN',
              quantity: receivedQuantity,
              beforeBorrowed: tracking.currentBorrowed,
              afterBorrowed: tracking.currentBorrowed - receivedQuantity,
              remark: remark || `归还单：${request.code}`,
              operatedBy: reviewerId,
              operatedAt: new Date(),
            },
          })
        }
      }

      await tx.containerReturn.update({
        where: { id: request.id },
        data: {
          status: 'COMPLETED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewReason: remark,
        },
      })
      return this.findReturnRequest(request.id, tx)
    })
  }

  async rejectReturnRequest(
    returnId: string,
    reason: string,
    reviewerId: string
  ): Promise<ContainerReturnRequestRecord> {
    const numericReturnId = Number.parseInt(returnId, 10)
    if (!reason.trim()) throw new Error('请填写驳回原因')

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "container_returns" WHERE "id" = ${numericReturnId} FOR UPDATE
      `)
      const request = await tx.containerReturn.findUnique({
        where: { id: numericReturnId },
        include: { items: true },
      })
      if (!request) throw new Error('归还申请不存在')
      if (request.status !== 'PENDING') throw new Error('该归还申请已处理')

      for (const item of request.items) {
        const changed = await tx.containerTracking.updateMany({
          where: {
            id: item.containerTrackingId,
            pendingReturnQuantity: { gte: item.requestedQuantity },
          },
          data: { pendingReturnQuantity: { decrement: item.requestedQuantity } },
        })
        if (changed.count !== 1) throw new Error('包装物待归还数量异常，请刷新后重试')
      }

      await tx.containerReturn.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          reviewedBy: reviewerId,
          reviewedAt: new Date(),
          reviewReason: reason.trim(),
        },
      })
      return this.findReturnRequest(request.id, tx)
    })
  }

  async cancelReturnRequest(
    returnId: string,
    storeId: string,
    operatorId: string
  ): Promise<ContainerReturnRequestRecord> {
    const numericReturnId = Number.parseInt(returnId, 10)
    const numericStoreId = Number.parseInt(storeId, 10)

    return prisma.$transaction(async (tx) => {
      await tx.$queryRaw(Prisma.sql`
        SELECT "id" FROM "container_returns" WHERE "id" = ${numericReturnId} FOR UPDATE
      `)
      const request = await tx.containerReturn.findUnique({
        where: { id: numericReturnId },
        include: { items: true },
      })
      if (!request || request.storeId !== numericStoreId) throw new Error('归还申请不存在')
      if (request.status !== 'PENDING') throw new Error('该归还申请已处理')

      for (const item of request.items) {
        const changed = await tx.containerTracking.updateMany({
          where: {
            id: item.containerTrackingId,
            pendingReturnQuantity: { gte: item.requestedQuantity },
          },
          data: { pendingReturnQuantity: { decrement: item.requestedQuantity } },
        })
        if (changed.count !== 1) throw new Error('包装物待归还数量异常，请刷新后重试')
      }

      await tx.containerReturn.update({
        where: { id: request.id },
        data: {
          status: 'CANCELLED',
          reviewedBy: operatorId,
          reviewedAt: new Date(),
          reviewReason: '门店撤回',
        },
      })
      return this.findReturnRequest(request.id, tx)
    })
  }

  async listReturnRequests(params: {
    storeId?: string
    containerId?: string
    status?: ContainerReturnStatus
    dateFrom?: Date
    dateToExclusive?: Date
    page?: number
    pageSize?: number
  }): Promise<{ data: ContainerReturnRequestRecord[]; total: number }> {
    const { page = 1, pageSize = 20 } = params
    const where: Prisma.ContainerReturnWhereInput = {}
    if (params.storeId) where.storeId = Number.parseInt(params.storeId, 10)
    if (params.status) where.status = params.status
    if (params.containerId) {
      where.items = { some: { containerId: Number.parseInt(params.containerId, 10) } }
    }
    if (params.dateFrom || params.dateToExclusive) {
      where.submittedAt = {
        ...(params.dateFrom ? { gte: params.dateFrom } : {}),
        ...(params.dateToExclusive ? { lt: params.dateToExclusive } : {}),
      }
    }

    const [requests, total] = await Promise.all([
      prisma.containerReturn.findMany({
        where,
        include: {
          store: { select: { name: true } },
          items: { include: { container: true } },
        },
        orderBy: { submittedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.containerReturn.count({ where }),
    ])

    const userNames = await getUserDisplayNameMap(
      requests.flatMap((request) => [request.submittedBy, request.reviewedBy])
    )

    return {
      data: requests.map((request) => this.toReturnRequest(request, userNames)),
      total,
    }
  }

  private async findReturnRequest(
    id: number,
    tx: Prisma.TransactionClient
  ): Promise<ContainerReturnRequestRecord> {
    const request = await tx.containerReturn.findUniqueOrThrow({
      where: { id },
      include: {
        store: { select: { name: true } },
        items: { include: { container: true } },
      },
    })
    const userNames = await getUserDisplayNameMap([request.submittedBy, request.reviewedBy])
    return this.toReturnRequest(request, userNames)
  }

  private toReturnRequest(
    request: {
      id: number
      code: string
      storeId: number
      store: { name: string }
      status: ContainerReturnStatus
      remark: string | null
      submittedBy: string
      submittedAt: Date
      reviewedBy: string | null
      reviewedAt: Date | null
      reviewReason: string | null
      items: Array<{
        id: number
        containerId: number
        requestedQuantity: number
        receivedQuantity: number | null
        container: { code: string; name: string; unit: string }
      }>
    },
    userNames: UserDisplayNameMap
  ): ContainerReturnRequestRecord {
    return {
      id: String(request.id),
      code: request.code,
      storeId: String(request.storeId),
      storeName: request.store.name,
      status: request.status,
      remark: request.remark,
      submittedBy: request.submittedBy,
      submittedByName:
        resolveUserDisplayName(request.submittedBy, userNames) ?? request.submittedBy,
      submittedAt: request.submittedAt,
      reviewedBy: request.reviewedBy,
      reviewedByName: resolveUserDisplayName(request.reviewedBy, userNames),
      reviewedAt: request.reviewedAt,
      reviewReason: request.reviewReason,
      items: request.items.map((item) => ({
        id: String(item.id),
        containerId: String(item.containerId),
        containerCode: item.container.code,
        containerName: item.container.name,
        containerUnit: item.container.unit,
        requestedQuantity: item.requestedQuantity,
        receivedQuantity: item.receivedQuantity,
      })),
    }
  }

  async getReturnLogs(params: {
    storeId?: string
    containerId?: string
    dateFrom?: Date
    dateToExclusive?: Date
    page?: number
    pageSize?: number
  }): Promise<{ data: ContainerLogItem[]; total: number }> {
    const { page = 1, pageSize = 20, ...filters } = params
    const where: Prisma.ContainerLogWhereInput = { opType: 'RETURN' }

    if (filters.storeId || filters.containerId) {
      where.tracking = {}
      if (filters.storeId) where.tracking.storeId = Number.parseInt(filters.storeId, 10)
      if (filters.containerId) where.tracking.containerId = Number.parseInt(filters.containerId, 10)
    }
    if (filters.dateFrom || filters.dateToExclusive) {
      where.operatedAt = {
        ...(filters.dateFrom ? { gte: filters.dateFrom } : {}),
        ...(filters.dateToExclusive ? { lt: filters.dateToExclusive } : {}),
      }
    }

    const [logs, total] = await Promise.all([
      prisma.containerLog.findMany({
        where,
        include: {
          order: { select: { id: true, code: true } },
          tracking: {
            include: {
              store: { select: { name: true } },
              container: { select: { name: true } },
            },
          },
        },
        orderBy: { operatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.containerLog.count({ where }),
    ])
    const userNames = await getUserDisplayNameMap(logs.map((log) => log.operatedBy))

    return {
      data: logs.map((log) => ({
        id: String(log.id),
        containerTrackingId: String(log.containerTrackingId),
        orderId: log.orderId !== null ? String(log.orderId) : null,
        orderCode: log.order?.code ?? null,
        opType: log.opType,
        quantity: log.quantity,
        beforeBorrowed: log.beforeBorrowed,
        afterBorrowed: log.afterBorrowed,
        remark: log.remark,
        operatedBy: log.operatedBy,
        operatorName: resolveUserDisplayName(log.operatedBy, userNames) ?? log.operatedBy,
        operatedAt: log.operatedAt,
        storeName: log.tracking.store.name,
        containerName: log.tracking.container.name,
      })),
      total,
    }
  }

  async getReturnableContainers(storeId: string): Promise<
    Array<{
      trackingId: string
      containerId: string
      containerName: string
      containerUnit: string
      currentBorrowed: number
      pendingReturnQuantity: number
      availableReturnQuantity: number
      deposit: number
    }>
  > {
    const trackings = await prisma.containerTracking.findMany({
      where: {
        storeId: Number.parseInt(storeId, 10),
        currentBorrowed: { gt: 0 },
        isDeleted: false,
      },
      include: { container: { select: { id: true, name: true, unit: true, deposit: true } } },
      orderBy: { lastBorrowAt: 'desc' },
    })

    return trackings.map((tracking) => ({
      trackingId: String(tracking.id),
      containerId: String(tracking.container.id),
      containerName: tracking.container.name,
      containerUnit: tracking.container.unit,
      currentBorrowed: tracking.currentBorrowed,
      pendingReturnQuantity: tracking.pendingReturnQuantity,
      availableReturnQuantity: tracking.currentBorrowed - tracking.pendingReturnQuantity,
      deposit: Number(tracking.container.deposit),
    }))
  }

  async getSummary(params?: { storeId?: string; containerId?: string }): Promise<{
    totalContainers: number
    totalBorrowed: number
    totalDeposit: number
    avgReturnRate: number
  }> {
    const where: Prisma.ContainerTrackingWhereInput = { isDeleted: false }
    if (params?.storeId) where.storeId = Number.parseInt(params.storeId, 10)
    if (params?.containerId) where.containerId = Number.parseInt(params.containerId, 10)

    const trackings = await prisma.containerTracking.findMany({
      where,
      include: { container: { select: { deposit: true } } },
    })
    let totalBorrowed = 0
    let totalDeposit = 0
    let totalReturnRate = 0
    for (const tracking of trackings) {
      totalBorrowed += tracking.currentBorrowed
      totalDeposit += tracking.currentBorrowed * Number(tracking.container.deposit)
      if (tracking.totalBorrowed > 0) {
        totalReturnRate += (tracking.totalReturned / tracking.totalBorrowed) * 100
      }
    }

    return {
      totalContainers: trackings.length,
      totalBorrowed,
      totalDeposit,
      avgReturnRate: trackings.length > 0 ? totalReturnRate / trackings.length : 0,
    }
  }

  async listTracking(params: {
    storeId?: string
    containerId?: string
    hasUnreturned?: boolean
    orderBy?: 'currentBorrowed' | 'returnRate' | 'lastBorrowAt'
    page?: number
    pageSize?: number
  }): Promise<{
    data: Array<{
      id: string
      storeId: string
      storeName: string
      containerId: string
      containerName: string
      containerCode: string
      containerUnit: string
      containerDeposit: number
      totalBorrowed: number
      totalReturned: number
      currentBorrowed: number
      pendingReturnQuantity: number
      returnRate: number
      depositAmount: number
      lastBorrowAt: Date | null
      lastReturnAt: Date | null
      daysUnreturned: number
      warningLevel: 'none' | 'info' | 'warning' | 'danger'
    }>
    total: number
  }> {
    const where: Prisma.ContainerTrackingWhereInput = { isDeleted: false }
    if (params.storeId) where.storeId = Number.parseInt(params.storeId, 10)
    if (params.containerId) where.containerId = Number.parseInt(params.containerId, 10)
    if (params.hasUnreturned) where.currentBorrowed = { gt: 0 }

    const orderBy = {
      currentBorrowed: 'desc',
      returnRate: 'asc',
      lastBorrowAt: 'desc',
    }[params.orderBy || 'lastBorrowAt'] as Prisma.ContainerTrackingOrderByWithRelationInput

    const [trackings, total] = await Promise.all([
      prisma.containerTracking.findMany({
        where,
        include: {
          store: { select: { id: true, name: true } },
          container: { select: { name: true, code: true, unit: true, deposit: true } },
        },
        orderBy,
        skip: params.page && params.pageSize ? (params.page - 1) * params.pageSize : undefined,
        take: params.pageSize,
      }),
      prisma.containerTracking.count({ where }),
    ])

    const data = trackings.map((tracking) => {
      const returnRate =
        tracking.totalBorrowed > 0 ? (tracking.totalReturned / tracking.totalBorrowed) * 100 : 0
      const daysUnreturned = tracking.lastBorrowAt
        ? Math.floor((Date.now() - tracking.lastBorrowAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      return {
        id: String(tracking.id),
        storeId: String(tracking.storeId),
        storeName: tracking.store.name,
        containerId: String(tracking.containerId),
        containerName: tracking.container.name,
        containerCode: tracking.container.code,
        containerUnit: tracking.container.unit,
        containerDeposit: Number(tracking.container.deposit),
        totalBorrowed: tracking.totalBorrowed,
        totalReturned: tracking.totalReturned,
        currentBorrowed: tracking.currentBorrowed,
        pendingReturnQuantity: tracking.pendingReturnQuantity,
        returnRate,
        depositAmount: tracking.currentBorrowed * Number(tracking.container.deposit),
        lastBorrowAt: tracking.lastBorrowAt,
        lastReturnAt: tracking.lastReturnAt,
        daysUnreturned,
        warningLevel: this.getWarningLevel(tracking.currentBorrowed, returnRate, daysUnreturned),
      }
    })

    return { data, total }
  }

  private getWarningLevel(
    currentBorrowed: number,
    returnRate: number,
    daysUnreturned: number
  ): 'none' | 'info' | 'warning' | 'danger' {
    if (currentBorrowed === 0) return 'none'
    if (daysUnreturned > 60 || returnRate < 40) return 'danger'
    if (daysUnreturned > 30 || returnRate < 60) return 'warning'
    if (returnRate < 80) return 'info'
    return 'none'
  }

  async getAbnormalTrackings(days = 30): Promise<
    Array<{
      id: string
      storeId: string
      storeName: string
      containerId: string
      containerName: string
      currentBorrowed: number
      depositAmount: number
      daysUnreturned: number
    }>
  > {
    const trackings = await prisma.containerTracking.findMany({
      where: { currentBorrowed: { gt: 0 }, isDeleted: false },
      include: {
        store: { select: { name: true } },
        container: { select: { name: true, deposit: true } },
      },
    })

    return trackings
      .filter((tracking) => {
        if (!tracking.lastBorrowAt) return false
        return (
          Math.floor((Date.now() - tracking.lastBorrowAt.getTime()) / (1000 * 60 * 60 * 24)) >= days
        )
      })
      .map((tracking) => ({
        id: String(tracking.id),
        storeId: String(tracking.storeId),
        storeName: tracking.store.name,
        containerId: String(tracking.containerId),
        containerName: tracking.container.name,
        currentBorrowed: tracking.currentBorrowed,
        depositAmount: tracking.currentBorrowed * Number(tracking.container.deposit),
        daysUnreturned: Math.floor(
          (Date.now() - (tracking.lastBorrowAt?.getTime() ?? Date.now())) / (1000 * 60 * 60 * 24)
        ),
      }))
  }
}

export const containerTrackingService = new ContainerTrackingService()
