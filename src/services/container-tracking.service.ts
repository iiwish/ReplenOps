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
}

export const containerTrackingService = new ContainerTrackingService()
