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
      where.storeId = params.storeId
    }

    if (params?.containerId) {
      where.containerId = params.containerId
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
      id: t.id,
      storeId: t.storeId,
      storeName: t.store.name,
      containerId: t.containerId,
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
    const logs = await prisma.containerLog.findMany({
      where: { containerTrackingId: trackingId },
      include: {
        order: {
          select: { id: true, code: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    return logs.map((log) => ({
      id: log.id,
      containerTrackingId: log.containerTrackingId,
      orderId: log.orderId,
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

    const stockOut = await prismaClient.stockOut.findUnique({
      where: { id: stockOutId, isDeleted: false },
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

    const containerMap = new Map<string, number>()

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
      const tracking = await tx.containerTracking.findUnique({
        where: { id: trackingId },
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
        where: { id: trackingId },
        data: {
          totalReturned: { increment: quantity },
          currentBorrowed: { decrement: quantity },
          lastReturnAt: new Date(),
        },
      })

      await tx.containerLog.create({
        data: {
          containerTrackingId: trackingId,
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
        const tracking = await tx.containerTracking.findUnique({
          where: {
            storeId_containerId: {
              storeId: data.storeId,
              containerId: item.containerId,
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
    dateTo?: Date
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
        where.tracking.storeId = filters.storeId
      }
      if (filters.containerId) {
        where.tracking.containerId = filters.containerId
      }
    }

    if (filters.dateFrom || filters.dateTo) {
      where.operatedAt = {}
      if (filters.dateFrom) {
        where.operatedAt.gte = filters.dateFrom
      }
      if (filters.dateTo) {
        where.operatedAt.lte = filters.dateTo
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
        id: log.id,
        containerTrackingId: log.containerTrackingId,
        orderId: log.orderId,
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
        storeId,
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
      trackingId: t.id,
      containerId: t.container.id,
      containerName: t.container.name,
      currentBorrowed: t.currentBorrowed.toNumber(),
      deposit: t.container.deposit.toNumber(),
    }))
  }
}

export const containerTrackingService = new ContainerTrackingService()
