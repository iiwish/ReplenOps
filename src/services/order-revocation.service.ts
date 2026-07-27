import { prisma } from '@/lib/prisma'

/**
 * 订单撤销服务
 * 负责处理已完成订单的撤销操作，包括库存回滚、包装物归还和审计日志记录
 */
export class OrderRevocationService {
  /**
   * 撤销订单（核心业务逻辑）
   *
   * 流程：
   * 1. 验证订单状态（必须是COMPLETED）
   * 2. 使用数据库事务保证原子性
   * 3. 回滚订单和出库单状态为CANCELLED
   * 4. 恢复库存数量（根据出库单明细）
   * 5. 自动归还包装物
   * 6. 记录审计日志
   * 7. 记录库存变动日志
   *
   * @param orderId 订单ID
   * @param reason 撤销原因
   * @param operatorId 操作人ID
   * @param operatorIp 操作人IP
   * @returns 撤销结果
   */
  async revokeOrder(
    orderId: string,
    reason: string,
    operatorId: string,
    operatorIp: string
  ): Promise<{ success: boolean; message: string }> {
    const orderIdInt = Number.parseInt(orderId, 10)

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findFirst({
        where: { id: orderIdInt, isDeleted: false },
        include: {
          store: {
            select: { id: true, name: true },
          },
        },
      })

      if (!order) {
        throw new Error('订单不存在')
      }

      if (order.status !== 'COMPLETED') {
        throw new Error('只能撤销已完成的订单')
      }

      const stockOut = await tx.stockOut.findFirst({
        where: { orderId: orderIdInt, isDeleted: false },
        include: {
          items: true,
        },
      })

      if (!stockOut) {
        throw new Error('订单关联的出库单不存在')
      }

      if (stockOut.status !== 'COMPLETED') {
        throw new Error('出库单未完成，无法撤销')
      }

      await tx.order.update({
        where: { id: orderIdInt },
        data: {
          status: 'CANCELLED',
          revokedBy: operatorId,
          revokedAt: new Date(),
          revokeReason: reason,
        },
      })

      await tx.stockOut.update({
        where: { id: stockOut.id },
        data: {
          status: 'CANCELLED',
          revokedBy: operatorId,
          revokedAt: new Date(),
          revokeReason: reason,
        },
      })

      for (const item of stockOut.items) {
        const inventory = await tx.inventory.findUnique({
          where: {
            warehouseId_goodsId: {
              warehouseId: stockOut.warehouseId,
              goodsId: item.goodsId,
            },
          },
        })

        if (!inventory) {
          throw new Error(`商品ID ${item.goodsId} 的库存记录不存在`)
        }

        const restoreQty = item.quantity.toNumber()

        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: { increment: restoreQty },
            availableQuantity: { increment: restoreQty },
          },
        })

        await tx.inventoryLog.create({
          data: {
            inventoryId: inventory.id,
            changeType: 'RETURN',
            quantity: restoreQty,
            beforeQty: inventory.quantity.toNumber(),
            afterQty: inventory.quantity.toNumber() + restoreQty,
            referenceType: 'order_revoke',
            referenceId: String(orderIdInt),
            remark: `订单撤销回滚-订单号：${order.code}`,
            operatedBy: operatorId,
          },
        })
      }

      const containerLogs = await tx.containerLog.findMany({
        where: {
          orderId: orderIdInt,
          opType: 'BORROW',
        },
      })

      for (const log of containerLogs) {
        const tracking = await tx.containerTracking.findUnique({
          where: { id: log.containerTrackingId },
        })

        if (tracking) {
          const returnQty = log.quantity.toNumber()
          const beforeBorrowed = tracking.currentBorrowed.toNumber()

          if (beforeBorrowed < returnQty) {
            throw new Error(`包装物 ${log.containerTrackingId} 在外数量不足，无法撤销订单自动归还`)
          }

          const updated = await tx.containerTracking.updateMany({
            where: {
              id: log.containerTrackingId,
              currentBorrowed: { gte: returnQty },
            },
            data: {
              totalReturned: { increment: returnQty },
              currentBorrowed: { decrement: returnQty },
              lastReturnAt: new Date(),
            },
          })

          if (updated.count !== 1) {
            throw new Error('包装物在外数量已变化，请刷新后重试')
          }

          await tx.containerLog.create({
            data: {
              containerTrackingId: log.containerTrackingId,
              orderId: orderIdInt,
              opType: 'RETURN',
              quantity: returnQty,
              beforeBorrowed,
              afterBorrowed: beforeBorrowed - returnQty,
              remark: '系统自动归还-订单撤销',
              operatedBy: operatorId,
              operatedAt: new Date(),
            },
          })
        }
      }

      await tx.approvalLog.create({
        data: {
          orderId: orderIdInt,
          entityType: 'ORDER',
          entityId: String(orderIdInt),
          action: 'revoke',
          reason,
          beforeJson: { status: order.status },
          afterJson: { status: 'CANCELLED', reason },
          operatedBy: operatorId,
          operatorIp,
        },
      })

      return {
        success: true,
        message: `订单 ${order.code} 撤销成功`,
      }
    })
  }

  /**
   * 获取订单撤销预览信息
   * 用于撤销前显示将要回滚的库存和包装物数量
   *
   * @param orderId 订单ID
   * @returns 撤销预览信息
   */
  async getRevokePreview(orderId: string): Promise<{
    order: {
      code: string
      status: string
    }
    items: Array<{
      goodsId: string
      goodsName: string
      quantity: number
    }>
    containers: Array<{
      containerId: string
      containerName: string
      quantity: number
    }>
    canRevoke: boolean
    message?: string
  }> {
    const orderIdInt = Number.parseInt(orderId, 10)

    const order = await prisma.order.findFirst({
      where: { id: orderIdInt, isDeleted: false },
    })

    if (!order) {
      return {
        order: { code: '', status: '' },
        items: [],
        containers: [],
        canRevoke: false,
        message: '订单不存在',
      }
    }

    if (order.status !== 'COMPLETED') {
      return {
        order: {
          code: order.code,
          status: order.status,
        },
        items: [],
        containers: [],
        canRevoke: false,
        message: '只能撤销已完成的订单',
      }
    }

    const stockOut = await prisma.stockOut.findFirst({
      where: { orderId: orderIdInt, isDeleted: false },
      include: {
        items: true,
      },
    })

    const goodsIds = stockOut?.items.map((item) => item.goodsId) || []
    const goodsMap = new Map(
      (
        await prisma.goods.findMany({
          where: { id: { in: goodsIds } },
          select: { id: true, name: true },
        })
      ).map((g) => [g.id, g.name])
    )

    const items =
      stockOut?.items.map((item) => ({
        goodsId: String(item.goodsId),
        goodsName: goodsMap.get(item.goodsId) || '未知商品',
        quantity: item.quantity.toNumber(),
      })) || []

    const containerLogs = await prisma.containerLog.findMany({
      where: {
        orderId: orderIdInt,
        opType: 'BORROW',
      },
      include: {
        tracking: {
          include: {
            container: {
              select: { id: true, name: true },
            },
          },
        },
      },
    })

    const containers = containerLogs.map((log) => ({
      containerId: String(log.tracking!.container.id),
      containerName: log.tracking!.container.name,
      quantity: log.quantity.toNumber(),
    }))

    return {
      order: {
        code: order.code,
        status: order.status,
      },
      items,
      containers,
      canRevoke: true,
    }
  }

  /**
   * 检查订单是否可以撤销
   *
   * @param orderId 订单ID
   * @returns 是否可以撤销
   */
  async canRevokeOrder(orderId: string): Promise<boolean> {
    const orderIdInt = Number.parseInt(orderId, 10)

    const order = await prisma.order.findFirst({
      where: { id: orderIdInt, isDeleted: false },
      select: { status: true },
    })

    if (!order) {
      return false
    }

    return order.status === 'COMPLETED'
  }
}

export const orderRevocationService = new OrderRevocationService()
