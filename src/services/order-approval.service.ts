import { prisma } from '@/lib/prisma'
import { StockOutService } from './stock-out.service'
import { Prisma } from '@prisma/client'
import { resolveGoodsSnapshot } from '@/lib/goods-snapshot'
import { getShanghaiDateRange } from '@/lib/shanghai-time'
import {
  assertOrderInventoryLocked,
  lockOrderInventory,
  releaseOrderInventory,
} from './inventory-lock.service'

const stockOutService = new StockOutService()

// 列表参数
export interface ListPendingOrdersParams {
  page?: number
  pageSize?: number
  storeId?: string
  startDate?: string
  endDate?: string
  minAmount?: number
  maxAmount?: number
  keyword?: string
}

// 审批结果
export interface ApprovalResult {
  success: boolean
  message: string
  stockOutId?: string
}

export class OrderApprovalService {
  /**
   * 获取待审批订单列表
   */
  async listPendingOrders(params: ListPendingOrdersParams) {
    const {
      page = 1,
      pageSize = 20,
      storeId,
      startDate,
      endDate,
      minAmount,
      maxAmount,
      keyword,
    } = params

    const where: Prisma.OrderWhereInput = {
      status: 'PENDING', // 只显示待审批的
      isDeleted: false,
    }

    // 门店筛选
    if (storeId) {
      where.storeId = Number.parseInt(storeId, 10)
    }

    // 日期范围筛选
    if (startDate || endDate) {
      const range = getShanghaiDateRange(startDate, endDate)
      where.orderedAt = {
        ...(range.start ? { gte: range.start } : {}),
        ...(range.endExclusive ? { lt: range.endExclusive } : {}),
      }
    }

    // 金额范围筛选
    if (minAmount !== undefined || maxAmount !== undefined) {
      where.totalAmount = {}
      if (minAmount !== undefined) {
        where.totalAmount.gte = minAmount
      }
      if (maxAmount !== undefined) {
        where.totalAmount.lte = maxAmount
      }
    }

    // 关键词搜索
    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: 'insensitive' } },
        { remark: { contains: keyword, mode: 'insensitive' } },
      ]
    }

    // 查询总数
    const total = await prisma.order.count({ where })

    // 查询列表
    const data = await prisma.order.findMany({
      where,
      include: {
        store: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            goodsId: true,
          },
        },
      },
      orderBy: {
        orderedAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    return {
      data: data.map((order) => ({
        id: order.id,
        code: order.code,
        storeId: order.storeId,
        storeName: order.storeNameSnapshot ?? order.store.name,
        status: order.status,
        totalAmount: Number(order.totalAmount),
        itemCount: order.items.length, // 商品种类数
        remark: order.remark,
        createdBy: order.createdBy,
        orderedAt: order.orderedAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 获取订单详情(含库存检查)
   */
  async getOrderDetailWithStock(orderId: string) {
    const orderIdInt = Number.parseInt(orderId, 10)

    const order = await prisma.order.findUnique({
      where: { id: orderIdInt },
      include: {
        store: {
          select: {
            name: true,
          },
        },
        items: {
          include: {
            goods: {
              select: {
                code: true,
                name: true,
                unit: true,
                measureType: true,
                spec: true,
                categoryId: true,
                category: { select: { name: true } },
              },
            },
          },
        },
      },
    })

    if (!order) {
      throw new Error('订单不存在')
    }

    // 批量查询库存
    const goodsIds = order.items.map((item) => item.goodsId)
    const inventories = await prisma.inventory.findMany({
      where: {
        goodsId: { in: goodsIds },
        isDeleted: false,
        ...(order.lockedWarehouseId !== null
          ? { warehouseId: order.lockedWarehouseId }
          : {
              warehouse: {
                isActive: true,
                isDeleted: false,
              },
            }),
      },
      select: {
        warehouseId: true,
        goodsId: true,
        availableQuantity: true,
        lockedQuantity: true,
        warehouse: {
          select: {
            name: true,
          },
        },
      },
    })

    const selectedWarehouseId =
      order.lockedWarehouseId ??
      Array.from(new Set(inventories.map((inventory) => inventory.warehouseId))).find(
        (warehouseId) =>
          order.items.every((item) => {
            const inventory = inventories.find(
              (candidate) =>
                candidate.warehouseId === warehouseId && candidate.goodsId === item.goodsId
            )
            return inventory?.availableQuantity.gte(item.quantity) ?? false
          })
      )
    const selectedWarehouse = inventories.find(
      (inventory) => inventory.warehouseId === selectedWarehouseId
    )

    // 计算每个商品的库存状态
    const itemsWithStock = order.items.map((item) => {
      const inv = inventories.find(
        (inventory) =>
          inventory.warehouseId === selectedWarehouseId && inventory.goodsId === item.goodsId
      )
      const required = Number(item.quantity)
      const inventoryReserved = order.lockedWarehouseId !== null
      const hasRequiredStock = inventoryReserved
        ? (inv?.lockedQuantity.gte(item.quantity) ?? false)
        : (inv?.availableQuantity.gte(item.quantity) ?? false)
      const available = inv
        ? inv.availableQuantity.toNumber() + (hasRequiredStock && inventoryReserved ? required : 0)
        : 0
      const snapshot = resolveGoodsSnapshot(item, item.goods)

      let stockStatus: 'sufficient' | 'tight' | 'insufficient' = 'insufficient'
      if (hasRequiredStock) {
        stockStatus = available >= required * 1.5 ? 'sufficient' : 'tight'
      }

      return {
        id: item.id,
        goodsId: item.goodsId,
        goodsCode: snapshot.goodsCodeSnapshot,
        goodsName: snapshot.goodsNameSnapshot,
        goodsSpec: snapshot.goodsSpecSnapshot || '',
        goodsUnit: snapshot.goodsUnitSnapshot,
        measureType: snapshot.measureTypeSnapshot,
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        totalPrice: Number(item.totalPrice),
        availableStock: available,
        stockStatus,
        inventoryReserved,
      }
    })

    // 检查是否所有商品库存充足
    const canApprove = itemsWithStock.every((item) => item.stockStatus !== 'insufficient')

    return {
      id: order.id,
      code: order.code,
      storeId: order.storeId,
      storeName: order.storeNameSnapshot ?? order.store.name,
      warehouseId: selectedWarehouseId ? String(selectedWarehouseId) : null,
      warehouseName: selectedWarehouse?.warehouse.name ?? null,
      status: order.status,
      totalAmount: Number(order.totalAmount),
      remark: order.remark,
      createdBy: order.createdBy,
      orderedAt: order.orderedAt,
      items: itemsWithStock,
      canApprove,
    }
  }

  /**
   * 审批通过(核心逻辑)
   */
  async approve(orderId: string, userId: string, comment?: string): Promise<ApprovalResult> {
    const orderIdInt = Number.parseInt(orderId, 10)

    return await prisma.$transaction(async (tx) => {
      // 1. 查询订单并原子抢占待审批状态
      const order = await tx.order.findUnique({
        where: { id: orderIdInt },
        include: {
          items: true,
        },
      })

      if (!order) {
        throw new Error('订单不存在')
      }

      if (order.status !== 'PENDING') {
        throw new Error('订单状态不是待审批,无法审批')
      }

      if (order.isDeleted) {
        throw new Error('订单已删除')
      }

      const claimed = await tx.order.updateMany({
        where: {
          id: orderIdInt,
          status: 'PENDING',
          isDeleted: false,
        },
        data: { status: 'PROCESSING' },
      })

      if (claimed.count !== 1) {
        throw new Error('订单状态已变化，请刷新后重试')
      }

      const lockItems = order.items.map((item) => ({
        goodsId: item.goodsId,
        quantity: item.quantity,
      }))
      let selectedWarehouseId = order.lockedWarehouseId

      if (selectedWarehouseId === null) {
        selectedWarehouseId = await lockOrderInventory(tx, lockItems)
      } else {
        await assertOrderInventoryLocked(tx, selectedWarehouseId, lockItems)
      }

      // 3. 完成审批状态转换
      const approved = await tx.order.updateMany({
        where: { id: orderIdInt, status: 'PROCESSING', isDeleted: false },
        data: {
          status: 'APPROVED',
          lockedWarehouseId: selectedWarehouseId,
          approvedBy: userId,
          approvedAt: new Date(),
        },
      })

      if (approved.count !== 1) {
        throw new Error('订单状态已变化，请刷新后重试')
      }

      // 4. 自动生成出库单
      const stockOut = await stockOutService.createFromOrder(orderId, tx, selectedWarehouseId)

      // 5. 记录审批日志
      await tx.approvalLog.create({
        data: {
          orderId: orderIdInt,
          entityType: 'ORDER',
          entityId: String(orderIdInt),
          action: 'APPROVE',
          reason: comment || '审批通过',
          beforeJson: { status: order.status },
          afterJson: { status: 'APPROVED', stockOutId: stockOut.id },
          operatedBy: userId,
        },
      })

      return {
        success: true,
        message: '审批成功',
        stockOutId: String(stockOut.id),
      }
    })
  }

  /**
   * 审批拒绝
   */
  async reject(orderId: string, userId: string, reason: string): Promise<ApprovalResult> {
    const orderIdInt = Number.parseInt(orderId, 10)

    return await prisma.$transaction(async (tx) => {
      const order = await tx.order.findUnique({
        where: { id: orderIdInt },
      })

      if (!order) {
        throw new Error('订单不存在')
      }

      if (order.status !== 'PENDING') {
        throw new Error('订单状态不是待审批,无法拒绝')
      }

      if (order.isDeleted) {
        throw new Error('订单已删除')
      }

      const claimed = await tx.order.updateMany({
        where: {
          id: orderIdInt,
          status: 'PENDING',
          isDeleted: false,
        },
        data: { status: 'PROCESSING' },
      })

      if (claimed.count !== 1) {
        throw new Error('订单状态已变化，请刷新后重试')
      }

      const orderItems = await tx.orderItem.findMany({
        where: { orderId: orderIdInt, isDeleted: false },
      })

      await releaseOrderInventory(
        tx,
        order.lockedWarehouseId,
        orderItems.map((item) => ({
          goodsId: item.goodsId,
          quantity: item.quantity,
        }))
      )

      const rejected = await tx.order.updateMany({
        where: { id: orderIdInt, status: 'PROCESSING', isDeleted: false },
        data: {
          status: 'REJECTED',
          lockedWarehouseId: null,
          revokedBy: userId, // 使用revokedBy字段存储拒绝人
          revokedAt: new Date(), // 使用revokedAt字段存储拒绝时间
          revokeReason: reason, // 使用revokeReason字段存储拒绝原因
        },
      })

      if (rejected.count !== 1) {
        throw new Error('订单状态已变化，请刷新后重试')
      }

      // 记录审批日志
      await tx.approvalLog.create({
        data: {
          orderId: orderIdInt,
          entityType: 'ORDER',
          entityId: String(orderIdInt),
          action: 'REJECT',
          reason: reason,
          beforeJson: { status: order.status },
          afterJson: { status: 'REJECTED', reason },
          operatedBy: userId,
        },
      })

      return {
        success: true,
        message: '已拒绝订单',
      }
    })
  }

  /**
   * 批量审批
   */
  async batchApprove(orderIds: string[], userId: string) {
    const results = []

    for (const orderId of orderIds) {
      try {
        const result = await this.approve(orderId, userId)
        results.push({
          orderId,
          success: true,
          message: result.message,
          stockOutId: result.stockOutId,
        })
      } catch (error) {
        results.push({
          orderId,
          success: false,
          message: error instanceof Error ? error.message : '未知错误',
        })
      }
    }

    return results
  }
}

export const orderApprovalService = new OrderApprovalService()
