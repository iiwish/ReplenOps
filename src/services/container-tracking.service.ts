import { prisma } from '@/lib/prisma'
import { Prisma, ContainerOpType } from '@prisma/client'

export interface ListTrackingParams {
  storeId?: string
  containerId?: string
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
  operatedAt: Date
}

class ContainerTrackingService {
  async list(params?: ListTrackingParams): Promise<TrackingListItem[]> {
    const where: Prisma.ContainerTrackingWhereInput = {}

    if (params?.storeId) {
      where.storeId = Number.parseInt(params.storeId, 10)
    }

    if (params?.containerId) {
      where.containerId = Number.parseInt(params.containerId, 10)
    }

    const trackings = await prisma.containerTracking.findMany({
      where,
      include: {
        store: {
          select: { id: true, name: true },
        },
        container: {
          select: { id: true, name: true, code: true, unit: true, deposit: true },
        },
      },
      orderBy: [{ storeId: 'asc' }, { containerId: 'asc' }],
    })

    return trackings.map((t) => ({
      id: String(t.id),
      storeId: String(t.storeId),
      storeName: t.store.name,
      containerId: String(t.containerId),
      containerName: t.container.name,
      containerCode: t.container.code,
      containerUnit: t.container.unit,
      totalBorrowed: t.totalBorrowed.toNumber(),
      totalReturned: t.totalReturned.toNumber(),
      currentBorrowed: t.currentBorrowed.toNumber(),
      depositTotal: t.currentBorrowed.toNumber() * t.container.deposit.toNumber(),
      lastBorrowAt: t.lastBorrowAt,
      lastReturnAt: t.lastReturnAt,
    }))
  }

  async getLogs(trackingId: string): Promise<ContainerLogItem[]> {
    const trackingIdNumber = Number.parseInt(trackingId, 10)

    const logs = await prisma.containerLog.findMany({
      where: { containerTrackingId: trackingIdNumber },
      include: {
        order: {
          select: { id: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return logs.map((log) => ({
      id: String(log.id),
      containerTrackingId: String(log.containerTrackingId),
      orderId: log.orderId !== null ? String(log.orderId) : null,
      orderCode: log.order?.code || null,
      opType: log.opType,
      quantity: log.quantity.toNumber(),
      beforeBorrowed: log.beforeBorrowed.toNumber(),
      afterBorrowed: log.afterBorrowed.toNumber(),
      remark: log.remark,
      operatedBy: log.operatedBy,
      operatedAt: log.operatedAt,
    }))
  }

  async borrowContainers(
    stockOutId: string,
    userId: string,
    tx?: Prisma.TransactionClient
  ): Promise<void> {
    const prismaClient = tx || prisma
    const stockOutIdNumber = Number.parseInt(stockOutId, 10)

    const stockOut = await prismaClient.stockOut.findUnique({
      where: { id: stockOutIdNumber, isDeleted: false },
      include: {
        items: true,
        order: true,
      },
    })

    if (!stockOut) {
      throw new Error('出库单不存在')
    }

    if (!stockOut.order) {
      throw new Error('订单信息缺失')
    }

    const storeId = stockOut.order.storeId || ''
    if (!storeId) {
      throw new Error('订单缺少门店信息')
    }

    const goodsIds = stockOut.items.map((item) => item.goodsId)

    const goods = await prismaClient.goods.findMany({
      where: { id: { in: goodsIds } },
      select: { id: true, containerId: true, containerRatio: true },
    })

    const goodsMap = new Map(goods.map((g) => [g.id, g]))

    const containerMap = new Map<number, number>()

    for (const item of stockOut.items) {
      const goodsInfo = goodsMap.get(item.goodsId)
      if (!goodsInfo) continue

      const { containerId, containerRatio } = goodsInfo

      if (containerId && containerRatio && containerRatio > 0) {
        const itemQty = item.quantity.toNumber()
        const neededQty = Math.ceil(itemQty / containerRatio)
        const current = containerMap.get(containerId) || 0
        containerMap.set(containerId, current + neededQty)
      }
    }

    for (const [containerId, quantity] of containerMap) {
      const tracking = await prismaClient.containerTracking.upsert({
        where: {
          storeId_containerId: {
            storeId,
            containerId,
          },
        },
        create: {
          storeId,
          containerId,
          totalBorrowed: quantity,
          totalReturned: 0,
          currentBorrowed: quantity,
          lastBorrowAt: new Date(),
        },
        update: {
          totalBorrowed: { increment: quantity },
          currentBorrowed: { increment: quantity },
          lastBorrowAt: new Date(),
        },
      })

      const beforeBorrowed = tracking.currentBorrowed.toNumber() - quantity

      await prismaClient.containerLog.create({
        data: {
          containerTrackingId: tracking.id,
          orderId: stockOut.orderId,
          opType: 'BORROW',
          quantity,
          beforeBorrowed,
          afterBorrowed: tracking.currentBorrowed.toNumber(),
          remark: `出库单：${stockOut.code}`,
          operatedBy: userId,
          operatedAt: new Date(),
        },
      })
    }
  }

  async returnContainers(trackingId: string, quantity: number, userId: string): Promise<void> {
    return await prisma.$transaction(async (tx) => {
      const trackingIdNumber = Number.parseInt(trackingId, 10)
      const tracking = await tx.containerTracking.findUnique({
        where: { id: trackingIdNumber },
        include: {
          container: {
            select: { id: true, name: true },
          },
        },
      })

      if (!tracking) {
        throw new Error('台账记录不存在')
      }

      if (quantity > tracking.currentBorrowed.toNumber()) {
        throw new Error('归还数量超过当前在外数量')
      }

      const beforeBorrowed = tracking.currentBorrowed.toNumber()

      await tx.containerTracking.update({
        where: { id: trackingIdNumber },
        data: {
          totalReturned: { increment: quantity },
          currentBorrowed: { decrement: quantity },
          lastReturnAt: new Date(),
        },
      })

      await tx.containerLog.create({
        data: {
          containerTrackingId: trackingIdNumber,
          opType: 'RETURN',
          quantity,
          beforeBorrowed,
          afterBorrowed: beforeBorrowed - quantity,
          remark: '包装物归还',
          operatedBy: userId,
          operatedAt: new Date(),
        },
      })
    })
  }

  async batchReturnContainers(data: {
    storeId: string
    items: Array<{
      containerId: string
      quantity: number
    }>
    remark?: string
    operatorId: string
  }): Promise<
    Array<{
      containerId: string
      containerName: string
      quantity: number
      remainingBorrowed: number
    }>
  > {
    return await prisma.$transaction(async (tx) => {
      const results = []

      for (const item of data.items) {
        const storeId = Number.parseInt(data.storeId, 10)
        const containerId = Number.parseInt(item.containerId, 10)
        const tracking = await tx.containerTracking.findUnique({
          where: {
            storeId_containerId: {
              storeId,
              containerId,
            },
          },
          include: {
            container: {
              select: { id: true, name: true },
            },
          },
        })

        if (!tracking) {
          throw new Error(`门店无此包装物的借出记录: ${item.containerId}`)
        }

        if (item.quantity > tracking.currentBorrowed.toNumber()) {
          throw new Error(
            `${tracking.container.name} 归还数量(${item.quantity}) 超过在外数量(${tracking.currentBorrowed.toNumber()})`
          )
        }

        if (tracking.currentBorrowed.toNumber() === 0) {
          throw new Error(`${tracking.container.name} 当前在外数量为0，无需归还`)
        }

        const beforeBorrowed = tracking.currentBorrowed.toNumber()
        const afterBorrowed = beforeBorrowed - item.quantity

        await tx.containerTracking.update({
          where: { id: tracking.id },
          data: {
            totalReturned: { increment: item.quantity },
            currentBorrowed: { decrement: item.quantity },
            lastReturnAt: new Date(),
          },
        })

        await tx.containerLog.create({
          data: {
            containerTrackingId: tracking.id,
            opType: 'RETURN',
            quantity: item.quantity,
            beforeBorrowed,
            afterBorrowed,
            remark: data.remark || '门店归还',
            operatedBy: data.operatorId,
            operatedAt: new Date(),
          },
        })

        results.push({
          containerId: item.containerId,
          containerName: tracking.container.name,
          quantity: item.quantity,
          remainingBorrowed: afterBorrowed,
        })
      }

      return results
    })
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

    const where: Prisma.ContainerLogWhereInput = {
      opType: 'RETURN',
    }

    if (filters.storeId || filters.containerId) {
      where.tracking = {}
      if (filters.storeId) {
        where.tracking.storeId = Number.parseInt(filters.storeId, 10)
      }
      if (filters.containerId) {
        where.tracking.containerId = Number.parseInt(filters.containerId, 10)
      }
    }

    if (filters.dateFrom || filters.dateToExclusive) {
      where.operatedAt = {}
      if (filters.dateFrom) {
        where.operatedAt.gte = filters.dateFrom
      }
      if (filters.dateToExclusive) {
        where.operatedAt.lt = filters.dateToExclusive
      }
    }

    const [logs, total] = await Promise.all([
      prisma.containerLog.findMany({
        where,
        include: {
          order: {
            select: { id: true, code: true },
          },
          tracking: {
            include: {
              store: {
                select: { id: true, name: true },
              },
              container: {
                select: { id: true, name: true },
              },
            },
          },
        },
        orderBy: { operatedAt: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      }),
      prisma.containerLog.count({ where }),
    ])

    return {
      data: logs.map((log) => ({
        id: String(log.id),
        containerTrackingId: String(log.containerTrackingId),
        orderId: log.orderId !== null ? String(log.orderId) : null,
        orderCode: log.order?.code || null,
        opType: log.opType,
        quantity: log.quantity.toNumber(),
        beforeBorrowed: log.beforeBorrowed.toNumber(),
        afterBorrowed: log.afterBorrowed.toNumber(),
        remark: log.remark,
        operatedBy: log.operatedBy,
        operatedAt: log.operatedAt,
        storeName: log.tracking?.store?.name || '',
        containerName: log.tracking?.container?.name || '',
      })),
      total,
    }
  }

  async getReturnableContainers(storeId: string): Promise<
    Array<{
      trackingId: string
      containerId: string
      containerName: string
      currentBorrowed: number
      deposit: number
    }>
  > {
    const trackings = await prisma.containerTracking.findMany({
      where: {
        storeId: Number.parseInt(storeId, 10),
        currentBorrowed: { gt: 0 },
      },
      include: {
        container: {
          select: {
            id: true,
            name: true,
            deposit: true,
          },
        },
      },
      orderBy: { lastBorrowAt: 'desc' },
    })

    return trackings.map((t) => ({
      trackingId: String(t.id),
      containerId: String(t.container.id),
      containerName: t.container.name,
      currentBorrowed: t.currentBorrowed.toNumber(),
      deposit: t.container.deposit.toNumber(),
    }))
  }

  async getSummary(params?: { storeId?: string; containerId?: string }): Promise<{
    totalContainers: number
    totalBorrowed: number
    totalDeposit: number
    avgReturnRate: number
  }> {
    const where: Prisma.ContainerTrackingWhereInput = {}
    if (params?.storeId) {
      where.storeId = Number.parseInt(params.storeId, 10)
    }
    if (params?.containerId) {
      where.containerId = Number.parseInt(params.containerId, 10)
    }

    const trackings = await prisma.containerTracking.findMany({
      where,
      include: {
        container: {
          select: {
            id: true,
            name: true,
            deposit: true,
          },
        },
      },
    })

    let totalBorrowed = 0
    let totalDeposit = 0
    let totalReturnRate = 0

    trackings.forEach((t) => {
      const borrowed = t.currentBorrowed.toNumber()
      const deposit = t.container.deposit.toNumber()

      totalBorrowed += borrowed
      totalDeposit += borrowed * deposit

      if (t.totalBorrowed.toNumber() > 0) {
        totalReturnRate += (t.totalReturned.toNumber() / t.totalBorrowed.toNumber()) * 100
      }
    })

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
      returnRate: number
      depositAmount: number
      lastBorrowAt: Date | null
      lastReturnAt: Date | null
      daysUnreturned: number
      warningLevel: 'none' | 'info' | 'warning' | 'danger'
    }>
    total: number
  }> {
    const where: Prisma.ContainerTrackingWhereInput = {}
    if (params.storeId) {
      where.storeId = Number.parseInt(params.storeId, 10)
    }
    if (params.containerId) {
      where.containerId = Number.parseInt(params.containerId, 10)
    }
    if (params.hasUnreturned) {
      where.currentBorrowed = { gt: 0 }
    }

    const orderBy = {
      currentBorrowed: 'desc',
      returnRate: 'asc',
      lastBorrowAt: 'desc',
    }[params.orderBy || 'lastBorrowAt'] as Prisma.ContainerTrackingOrderByWithRelationInput

    const [trackings, total] = await Promise.all([
      prisma.containerTracking.findMany({
        where,
        include: {
          store: {
            select: { id: true, name: true },
          },
          container: {
            select: {
              id: true,
              name: true,
              code: true,
              unit: true,
              deposit: true,
            },
          },
        },
        orderBy,
        skip: params.page && params.pageSize ? (params.page - 1) * params.pageSize : undefined,
        take: params.pageSize,
      }),
      prisma.containerTracking.count({ where }),
    ])

    const data = trackings.map((t) => {
      const returnRate =
        t.totalBorrowed.toNumber() > 0
          ? (t.totalReturned.toNumber() / t.totalBorrowed.toNumber()) * 100
          : 0

      const depositAmount = t.currentBorrowed.toNumber() * t.container.deposit.toNumber()

      const daysUnreturned = t.lastBorrowAt
        ? Math.floor((Date.now() - t.lastBorrowAt.getTime()) / (1000 * 60 * 60 * 24))
        : 0

      const warningLevel = this.getWarningLevel(
        t.currentBorrowed.toNumber(),
        returnRate,
        daysUnreturned
      )

      return {
        id: String(t.id),
        storeId: String(t.storeId),
        storeName: t.store.name,
        containerId: String(t.containerId),
        containerName: t.container.name,
        containerCode: t.container.code,
        containerUnit: t.container.unit,
        containerDeposit: t.container.deposit.toNumber(),
        totalBorrowed: t.totalBorrowed.toNumber(),
        totalReturned: t.totalReturned.toNumber(),
        currentBorrowed: t.currentBorrowed.toNumber(),
        returnRate,
        depositAmount,
        lastBorrowAt: t.lastBorrowAt,
        lastReturnAt: t.lastReturnAt,
        daysUnreturned,
        warningLevel,
      }
    })

    return { data, total }
  }

  private getWarningLevel(
    currentBorrowed: number,
    returnRate: number,
    daysUnreturned: number
  ): 'none' | 'info' | 'warning' | 'danger' {
    if (currentBorrowed === 0) {
      return 'none'
    }
    if (daysUnreturned > 60 || returnRate < 40) {
      return 'danger'
    }
    if (daysUnreturned > 30 || returnRate < 60) {
      return 'warning'
    }
    if (returnRate < 80) {
      return 'info'
    }
    return 'none'
  }

  async getAbnormalTrackings(days: number = 30): Promise<
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
      where: {
        currentBorrowed: { gt: 0 },
      },
      include: {
        store: {
          select: { id: true, name: true },
        },
        container: {
          select: { id: true, name: true, deposit: true },
        },
      },
    })

    return trackings
      .filter((t) => {
        if (!t.lastBorrowAt) return false
        const daysUnreturned = Math.floor(
          (Date.now() - t.lastBorrowAt.getTime()) / (1000 * 60 * 60 * 24)
        )
        return daysUnreturned >= days
      })
      .map((t) => ({
        id: String(t.id),
        storeId: String(t.storeId),
        storeName: t.store.name,
        containerId: String(t.containerId),
        containerName: t.container.name,
        currentBorrowed: t.currentBorrowed.toNumber(),
        depositAmount: t.currentBorrowed.toNumber() * t.container.deposit.toNumber(),
        daysUnreturned: Math.floor(
          (Date.now() - (t.lastBorrowAt?.getTime() || Date.now())) / (1000 * 60 * 60 * 24)
        ),
      }))
  }
}

export const containerTrackingService = new ContainerTrackingService()
