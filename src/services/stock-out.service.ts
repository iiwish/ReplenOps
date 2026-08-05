import { prisma } from '@/lib/prisma'
import { Prisma, StockStatus } from '@prisma/client'
import { containerTrackingService } from './container-tracking.service'
import { releaseOrderInventory } from './inventory-lock.service'
import { buildGoodsSnapshot, resolveGoodsSnapshot } from '@/lib/goods-snapshot'
import { getShanghaiDateRange } from '@/lib/shanghai-time'

// 列表参数接口
export interface ListStockOutParams {
  page?: number
  pageSize?: number
  keyword?: string // 搜索关键词（单号、订单号）
  status?: string // 状态筛选
  warehouseId?: string // 仓库筛选
  startDate?: string // 开始日期
  endDate?: string // 结束日期
}

// 出库单列表项接口
export interface StockOutListItem {
  id: string
  code: string
  orderId: string
  orderCode: string
  orderIsDeleted: boolean
  storeName: string
  warehouseId: string
  warehouseName: string
  status: string
  totalQuantity: number
  issueAmount: number
  totalCost: number
  remark: string | null
  createdBy: string
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// 分页返回结果
export interface PaginatedStockOutResult {
  data: StockOutListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 出库单详情接口
export interface StockOutDetail {
  id: string
  code: string
  orderId: string
  orderCode: string
  orderIsDeleted: boolean
  orderCreatedBy: string
  orderedAt: Date
  approvedBy: string | null
  approvedAt: Date | null
  orderRemark: string | null
  storeId: string
  storeName: string
  warehouseId: string
  warehouseName: string
  status: string
  totalCost: number
  remark: string | null
  createdBy: string
  completedAt: Date | null
  revokedBy: string | null
  revokedAt: Date | null
  revokeReason: string | null
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    goodsId: string
    goodsCode: string
    goodsName: string
    goodsSpec: string | null
    goodsUnit: string
    quantity: number
    unitPrice: number
    snapshotCost: number
    lineAmount: number
    costAmount: number
  }>
}

export class StockOutService {
  /**
   * 生成出库单号(格式: SO + YYYYMMDD + 流水号)
   */
  private async generateCode(tx?: Prisma.TransactionClient): Promise<string> {
    const prismaClient = tx || prisma
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '')
    const prefix = `SO${dateStr}`

    const lastStockOut = await prismaClient.stockOut.findFirst({
      where: {
        code: {
          startsWith: prefix,
        },
      },
      orderBy: {
        code: 'desc',
      },
    })

    let sequence = 1
    if (lastStockOut) {
      const lastSequence = parseInt(lastStockOut.code.slice(-4))
      sequence = lastSequence + 1
    }

    return `${prefix}${sequence.toString().padStart(4, '0')}`
  }

  /**
   * 从订单自动创建出库单(审批通过时调用)
   *
   * @param orderId 订单ID
   * @param tx Prisma事务对象(可选,支持外部事务)
   */
  async createFromOrder(orderId: string, tx?: Prisma.TransactionClient, warehouseId?: number) {
    const prismaClient = tx || prisma
    const orderIdInt = Number.parseInt(orderId, 10)

    // 查询订单
    const order = await prismaClient.order.findUnique({
      where: { id: orderIdInt },
      include: {
        items: {
          include: {
            goods: { include: { category: { select: { name: true } } } },
          },
        },
      },
    })

    if (!order) {
      throw new Error('订单不存在')
    }

    if (order.status !== 'APPROVED') {
      throw new Error('只有已审批的订单才能生成出库单')
    }

    // 生成出库单号
    const code = await this.generateCode(tx)

    const warehouse =
      warehouseId !== undefined
        ? await prismaClient.warehouse.findFirst({
            where: { id: warehouseId, isActive: true, isDeleted: false },
          })
        : await prismaClient.warehouse.findFirst({
            where: { isActive: true, isDeleted: false },
            orderBy: { createdAt: 'asc' },
          })

    if (!warehouse) {
      throw new Error('未找到可用仓库')
    }

    // 创建出库单主表
    const stockOut = await prismaClient.stockOut.create({
      data: {
        code: code,
        orderId: order.id,
        warehouseId: warehouse.id,
        status: 'PENDING',
        totalCost: 0, // 成本在确认出库时计算
        totalProfit: 0, // 数据库兼容字段，库存系统不计算利润
        remark: `订单 ${order.code} 自动生成`,
        createdBy: order.approvedBy || order.createdBy,
      },
    })

    // 创建出库单明细
    for (const item of order.items) {
      const snapshot = item.goodsCodeSnapshot
        ? {
            goodsCodeSnapshot: item.goodsCodeSnapshot,
            goodsNameSnapshot: item.goodsNameSnapshot ?? item.goods.name,
            goodsSpecSnapshot: item.goodsSpecSnapshot ?? item.goods.spec,
            goodsUnitSnapshot: item.goodsUnitSnapshot ?? item.goods.unit,
            measureTypeSnapshot: item.measureTypeSnapshot ?? item.goods.measureType,
            categoryIdSnapshot: item.categoryIdSnapshot ?? item.goods.categoryId,
            categoryNameSnapshot: item.categoryNameSnapshot ?? item.goods.category.name,
          }
        : buildGoodsSnapshot(item.goods)
      await prismaClient.stockOutItem.create({
        data: {
          stockOutId: stockOut.id,
          goodsId: item.goodsId,
          ...snapshot,
          quantity: item.quantity,
          salePrice: item.unitPrice, // 数据库兼容字段，业务含义为内部领用价
          snapshotCost: 0, // 成本快照在确认出库时填充
          profit: 0, // 数据库兼容字段，库存系统不计算利润
        },
      })
    }

    return stockOut
  }

  /**
   * 分页查询出库单列表
   */
  async list(params: ListStockOutParams = {}): Promise<PaginatedStockOutResult> {
    const { page = 1, pageSize = 20, keyword, status, warehouseId, startDate, endDate } = params

    const where: Prisma.StockOutWhereInput = {
      isDeleted: false,
    }

    // 关键词搜索（单号或订单号）
    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: 'insensitive' } },
        { order: { code: { contains: keyword, mode: 'insensitive' } } },
      ]
    }

    // 状态筛选
    if (status) {
      where.status = status as StockStatus
    }

    // 仓库筛选
    if (warehouseId) {
      where.warehouseId = Number.parseInt(warehouseId, 10)
    }

    // 日期范围筛选
    if (startDate || endDate) {
      const range = getShanghaiDateRange(startDate, endDate)
      where.createdAt = {
        ...(range.start ? { gte: range.start } : {}),
        ...(range.endExclusive ? { lt: range.endExclusive } : {}),
      }
    }

    const total = await prisma.stockOut.count({ where })

    const data = await prisma.stockOut.findMany({
      where,
      include: {
        warehouse: {
          select: {
            name: true,
          },
        },
        order: {
          select: {
            code: true,
            isDeleted: true,
            storeNameSnapshot: true,
            store: {
              select: {
                name: true,
              },
            },
          },
        },
        items: {
          where: { isDeleted: false },
          select: {
            quantity: true,
            salePrice: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
    })

    const formattedData: StockOutListItem[] = data.map((item) => {
      const totalQuantity = item.items.reduce(
        (sum, stockOutItem) => sum.plus(stockOutItem.quantity),
        new Prisma.Decimal(0)
      )
      const issueAmount = item.items.reduce(
        (sum, stockOutItem) => sum.plus(stockOutItem.salePrice.mul(stockOutItem.quantity)),
        new Prisma.Decimal(0)
      )

      return {
        id: String(item.id),
        code: item.code,
        orderId: String(item.orderId),
        orderCode: item.order.code,
        orderIsDeleted: item.order.isDeleted,
        storeName: item.order.storeNameSnapshot ?? item.order.store.name,
        warehouseId: String(item.warehouseId),
        warehouseName: item.warehouse.name,
        status: item.status,
        totalQuantity: totalQuantity.toNumber(),
        issueAmount: issueAmount.toNumber(),
        totalCost: item.totalCost.toNumber(),
        remark: item.remark,
        createdBy: item.createdBy || '',
        completedAt: item.completedAt,
        createdAt: item.createdAt,
        updatedAt: item.updatedAt,
      }
    })

    return {
      data: formattedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 查询出库单详情
   */
  async findById(id: string): Promise<StockOutDetail | null> {
    const stockOutId = Number.parseInt(id, 10)

    const stockOut = await prisma.stockOut.findFirst({
      where: { id: stockOutId, isDeleted: false },
      include: {
        warehouse: {
          select: {
            name: true,
          },
        },
        order: {
          select: {
            code: true,
            isDeleted: true,
            storeNameSnapshot: true,
            createdBy: true,
            orderedAt: true,
            approvedBy: true,
            approvedAt: true,
            remark: true,
            store: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
        items: {
          where: { isDeleted: false },
          include: {
            goods: { include: { category: { select: { name: true } } } },
          },
        },
      },
    })

    if (!stockOut) return null

    return {
      id: String(stockOut.id),
      code: stockOut.code,
      orderId: String(stockOut.orderId),
      orderCode: stockOut.order?.code || '',
      orderIsDeleted: stockOut.order.isDeleted,
      orderCreatedBy: stockOut.order.createdBy,
      orderedAt: stockOut.order.orderedAt,
      approvedBy: stockOut.order.approvedBy,
      approvedAt: stockOut.order.approvedAt,
      orderRemark: stockOut.order.remark,
      storeId: stockOut.order?.store?.id ? String(stockOut.order.store.id) : '',
      storeName: stockOut.order.storeNameSnapshot ?? stockOut.order.store.name,
      warehouseId: String(stockOut.warehouseId),
      warehouseName: stockOut.warehouse.name,
      status: stockOut.status,
      totalCost: stockOut.totalCost.toNumber(),
      remark: stockOut.remark,
      createdBy: stockOut.createdBy || '',
      completedAt: stockOut.completedAt,
      revokedBy: stockOut.revokedBy,
      revokedAt: stockOut.revokedAt,
      revokeReason: stockOut.revokeReason,
      createdAt: stockOut.createdAt,
      updatedAt: stockOut.updatedAt,
      items: stockOut.items.map((item) => {
        const snapshot = resolveGoodsSnapshot(item, item.goods)
        return {
          id: String(item.id),
          goodsId: String(item.goodsId),
          goodsCode: snapshot.goodsCodeSnapshot,
          goodsName: snapshot.goodsNameSnapshot,
          goodsSpec: snapshot.goodsSpecSnapshot,
          goodsUnit: snapshot.goodsUnitSnapshot,
          quantity: item.quantity.toNumber(),
          unitPrice: item.salePrice.toNumber(),
          snapshotCost: item.snapshotCost.toNumber(),
          lineAmount: item.salePrice.toNumber() * item.quantity.toNumber(),
          costAmount: item.snapshotCost.toNumber() * item.quantity.toNumber(),
        }
      }),
    }
  }

  /**
   * 确认出库（核心业务逻辑）
   */
  async complete(id: string, userId: string) {
    const stockOutId = Number.parseInt(id, 10)

    return await prisma.$transaction(async (tx) => {
      // 1. 获取出库单及明细
      const stockOut = await tx.stockOut.findFirst({
        where: { id: stockOutId, isDeleted: false },
        include: {
          items: true,
          order: true,
        },
      })

      if (!stockOut) {
        throw new Error('出库单不存在')
      }

      if (stockOut.status !== 'PENDING') {
        throw new Error('只有待出库状态才能确认出库')
      }

      const claimed = await tx.stockOut.updateMany({
        where: {
          id: stockOutId,
          status: 'PENDING',
          isDeleted: false,
        },
        data: {
          status: 'PROCESSING',
        },
      })

      if (claimed.count !== 1) {
        throw new Error('出库单状态已变化，请刷新后重试')
      }

      let totalCost = 0

      // 2. 处理每个商品
      for (const item of stockOut.items) {
        // 查询当前库存
        const inventory = await tx.inventory.findUnique({
          where: {
            warehouseId_goodsId: {
              warehouseId: stockOut.warehouseId,
              goodsId: item.goodsId,
            },
          },
        })

        if (!inventory) {
          throw new Error(`商品 ${item.goodsId} 库存记录不存在`)
        }

        const lockedQty = inventory.lockedQuantity.toNumber()
        const requiredQty = item.quantity.toNumber()

        // 检查锁定库存是否足够
        if (lockedQty < requiredQty) {
          throw new Error(
            `商品 ${item.goodsId} 锁定库存不足，需要: ${requiredQty}，可用锁定: ${lockedQty}`
          )
        }

        // 快照记录当前成本
        const snapshotCost = inventory.avgCost.toNumber()
        const quantity = item.quantity.toNumber()
        const costAmount = snapshotCost * quantity

        totalCost += costAmount

        // 更新出库单明细，固定出库时的成本快照。
        await tx.stockOutItem.update({
          where: { id: item.id },
          data: {
            snapshotCost: snapshotCost,
            profit: 0,
          },
        })

        // 扣减库存（物理库存和锁定库存）
        await tx.inventory.update({
          where: { id: inventory.id },
          data: {
            quantity: { decrement: quantity },
            lockedQuantity: { decrement: quantity },
          },
        })

        // 记录库存变动日志
        await tx.inventoryLog.create({
          data: {
            inventoryId: inventory.id,
            changeType: 'OUT',
            quantity: -quantity,
            beforeQty: inventory.quantity.toNumber(),
            afterQty: inventory.quantity.toNumber() - quantity,
            referenceType: 'STOCK_OUT',
            referenceId: String(stockOut.id),
            operatedBy: userId,
          },
        })
      }

      // 3. 更新出库单状态
      const completed = await tx.stockOut.updateMany({
        where: {
          id: stockOutId,
          status: 'PROCESSING',
          isDeleted: false,
        },
        data: {
          status: 'COMPLETED',
          totalCost: totalCost,
          totalProfit: 0,
          completedAt: new Date(),
        },
      })

      if (completed.count !== 1) {
        throw new Error('出库单状态已变化，请刷新后重试')
      }

      // 4. 更新订单状态为已完成
      await tx.order.update({
        where: { id: stockOut.orderId },
        data: {
          status: 'COMPLETED',
          lockedWarehouseId: null,
          completedAt: new Date(),
        },
      })

      // 5. 自动借出包装物
      await containerTrackingService.borrowContainers(String(stockOut.id), userId, tx)

      await tx.approvalLog.create({
        data: {
          entityType: 'STOCK_OUT',
          entityId: String(stockOut.id),
          action: 'STOCK_OUT_COMPLETE',
          reason: `确认出库 ${stockOut.code}`,
          beforeJson: { status: stockOut.status },
          afterJson: { status: 'COMPLETED', totalCost },
          operatedBy: userId,
        },
      })

      return {
        ...stockOut,
        totalCost,
      }
    })
  }

  /**
   * 取消出库单
   */
  async cancel(id: string, reason: string, userId: string) {
    const stockOutId = Number.parseInt(id, 10)

    return await prisma.$transaction(async (tx) => {
      const stockOut = await tx.stockOut.findFirst({
        where: { id: stockOutId, isDeleted: false },
        include: {
          items: true,
        },
      })

      if (!stockOut) {
        throw new Error('出库单不存在')
      }

      if (stockOut.status !== 'PENDING') {
        throw new Error('只有待出库状态才能取消')
      }

      const cancelled = await tx.stockOut.updateMany({
        where: {
          id: stockOutId,
          status: 'PENDING',
          isDeleted: false,
        },
        data: {
          status: 'CANCELLED',
          revokedBy: userId,
          revokedAt: new Date(),
          revokeReason: reason,
        },
      })

      if (cancelled.count !== 1) {
        throw new Error('出库单状态已变化，请刷新后重试')
      }

      await releaseOrderInventory(
        tx,
        stockOut.warehouseId,
        stockOut.items.map((item) => ({
          goodsId: item.goodsId,
          quantity: item.quantity,
        }))
      )

      // 更新订单状态
      await tx.order.update({
        where: { id: stockOut.orderId },
        data: {
          status: 'CANCELLED',
          lockedWarehouseId: null,
          revokedBy: userId,
          revokedAt: new Date(),
          revokeReason: reason,
        },
      })

      await tx.approvalLog.create({
        data: {
          entityType: 'STOCK_OUT',
          entityId: String(stockOut.id),
          action: 'STOCK_OUT_CANCEL',
          reason,
          beforeJson: { status: stockOut.status },
          afterJson: { status: 'CANCELLED', reason },
          operatedBy: userId,
        },
      })

      return stockOut
    })
  }
}

export const stockOutService = new StockOutService()
