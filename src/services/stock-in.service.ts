import { prisma } from '@/lib/prisma'
import { Prisma, StockStatus } from '@prisma/client'
import { costCalculator } from './cost-calculator.service'
import { buildGoodsSnapshot, resolveGoodsSnapshot } from '@/lib/goods-snapshot'

// 列表参数接口
export interface ListStockInParams {
  page?: number
  pageSize?: number
  keyword?: string // 搜索关键词（单号、备注）
  status?: string // 状态筛选
  warehouseId?: string // 仓库筛选
  startDate?: string // 开始日期
  endDate?: string // 结束日期
}

// 创建入库单 DTO
export interface CreateStockInDto {
  warehouseId: string
  items: Array<{
    goodsId: string
    quantity: number
    price: number
  }>
  remark?: string
  createdBy: string
  submitForApproval?: boolean // 是否直接提交审批
}

// 更新入库单 DTO (仅草稿状态可以更新)
export interface UpdateStockInDto {
  warehouseId?: string
  items?: Array<{
    goodsId: string
    quantity: number
    price: number
  }>
  remark?: string
}

// 入库单列表项接口
export interface StockInListItem {
  id: string
  code: string
  warehouseId: string
  warehouseName: string
  status: string
  totalAmount: number
  remark: string | null
  createdBy: string
  approvedBy: string | null
  approvedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
}

// 分页返回结果
export interface PaginatedStockInResult {
  data: StockInListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 入库单详情接口
export interface StockInDetail {
  id: string
  code: string
  warehouseId: string
  warehouseName: string
  status: string
  totalAmount: number
  remark: string | null
  createdBy: string
  approvedBy: string | null
  approvedAt: Date | null
  completedAt: Date | null
  createdAt: Date
  updatedAt: Date
  items: Array<{
    id: string
    goodsId: string
    goodsCode: string
    goodsName: string
    goodsUnit: string
    measureType: string
    quantity: number
    unitPrice: number
    totalPrice: number
  }>
}

export class StockInService {
  /**
   * 生成入库单号（格式：SI + YYYYMMDD + 流水号）
   */
  private async generateCode(): Promise<string> {
    const today = new Date()
    const dateStr = today.toISOString().slice(0, 10).replace(/-/g, '') // YYYYMMDD

    // 查询今天已有的入库单数量
    const startOfDay = new Date(today.setHours(0, 0, 0, 0))
    const endOfDay = new Date(today.setHours(23, 59, 59, 999))

    const count = await prisma.stockIn.count({
      where: {
        createdAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    })

    // 流水号（4位，从0001开始）
    const serial = String(count + 1).padStart(4, '0')

    return `SI${dateStr}${serial}`
  }

  /**
   * 获取入库单列表（分页）
   */
  async list(params: ListStockInParams = {}): Promise<PaginatedStockInResult> {
    const { page = 1, pageSize = 20, keyword, status, warehouseId, startDate, endDate } = params

    // 构建查询条件
    const where: Prisma.StockInWhereInput = {
      isDeleted: false,
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
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = new Date(startDate)
      }
      if (endDate) {
        const end = new Date(endDate)
        end.setHours(23, 59, 59, 999)
        where.createdAt.lte = end
      }
    }

    // 搜索关键词（单号或备注）
    if (keyword) {
      where.OR = [
        { code: { contains: keyword, mode: 'insensitive' } },
        { remark: { contains: keyword, mode: 'insensitive' } },
      ]
    }

    // 查询总数
    const total = await prisma.stockIn.count({ where })

    // 查询数据
    const data = await prisma.stockIn.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        warehouseId: true,
        status: true,
        totalAmount: true,
        remark: true,
        createdBy: true,
        approvedBy: true,
        approvedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        warehouse: {
          select: {
            name: true,
          },
        },
      },
    })

    // 转换数据格式
    const formattedData: StockInListItem[] = data.map((item) => ({
      id: String(item.id),
      code: item.code,
      warehouseId: String(item.warehouseId),
      warehouseName: item.warehouse.name,
      status: item.status,
      totalAmount: Number(item.totalAmount),
      remark: item.remark,
      createdBy: item.createdBy,
      approvedBy: item.approvedBy,
      approvedAt: item.approvedAt,
      completedAt: item.completedAt,
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    return {
      data: formattedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 根据 ID 获取入库单详情
   */
  async findById(id: string): Promise<StockInDetail> {
    const stockInId = Number.parseInt(id, 10)

    const stockIn = await prisma.stockIn.findUnique({
      where: { id: stockInId },
      select: {
        id: true,
        code: true,
        warehouseId: true,
        status: true,
        totalAmount: true,
        remark: true,
        createdBy: true,
        approvedBy: true,
        approvedAt: true,
        completedAt: true,
        createdAt: true,
        updatedAt: true,
        isDeleted: true,
        warehouse: {
          select: {
            name: true,
          },
        },
        items: {
          select: {
            id: true,
            goodsId: true,
            quantity: true,
            unitPrice: true,
            totalPrice: true,
            goodsCodeSnapshot: true,
            goodsNameSnapshot: true,
            goodsSpecSnapshot: true,
            goodsUnitSnapshot: true,
            measureTypeSnapshot: true,
            categoryIdSnapshot: true,
            categoryNameSnapshot: true,
          },
        },
      },
    })

    if (!stockIn || stockIn.isDeleted) {
      throw new Error('入库单不存在')
    }

    // 获取商品信息
    const goodsIds = stockIn.items.map((item) => item.goodsId)
    const goodsList = await prisma.goods.findMany({
      where: { id: { in: goodsIds } },
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        measureType: true,
        spec: true,
        categoryId: true,
        category: { select: { name: true } },
      },
    })

    const goodsMap = new Map(goodsList.map((g) => [g.id, g]))

    const { isDeleted: _isDeleted, warehouse, items, ...rest } = stockIn

    return {
      ...rest,
      id: String(rest.id),
      warehouseId: String(rest.warehouseId),
      warehouseName: warehouse.name,
      totalAmount: Number(rest.totalAmount),
      items: items.map((item) => {
        const goods = goodsMap.get(item.goodsId)
        if (!goods) {
          throw new Error('入库单商品不存在')
        }
        const snapshot = resolveGoodsSnapshot(item, goods)
        return {
          id: String(item.id),
          goodsId: String(item.goodsId),
          goodsCode: snapshot.goodsCodeSnapshot,
          goodsName: snapshot.goodsNameSnapshot,
          goodsUnit: snapshot.goodsUnitSnapshot,
          measureType: snapshot.measureTypeSnapshot,
          quantity: Number(item.quantity),
          unitPrice: Number(item.unitPrice),
          totalPrice: Number(item.totalPrice),
        }
      }),
    }
  }

  /**
   * 创建入库单
   */
  async create(data: CreateStockInDto): Promise<StockInDetail> {
    const warehouseId = Number.parseInt(data.warehouseId, 10)

    // 检查仓库是否存在
    const warehouse = await prisma.warehouse.findUnique({
      where: { id: warehouseId },
    })

    if (!warehouse || warehouse.isDeleted) {
      throw new Error('仓库不存在')
    }

    // 检查商品是否存在
    const goodsIds = Array.from(
      new Set(data.items.map((item) => Number.parseInt(item.goodsId, 10)))
    )
    const goods = await prisma.goods.findMany({
      where: {
        id: { in: goodsIds },
        isDeleted: false,
      },
      include: { category: { select: { name: true } } },
    })

    if (goods.length !== goodsIds.length) {
      throw new Error('部分商品不存在')
    }
    const goodsMap = new Map(goods.map((item) => [item.id, item]))

    // 计算总金额
    const totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0)

    // 生成入库单号
    const code = await this.generateCode()

    // 创建入库单
    const stockIn = await prisma.stockIn.create({
      data: {
        code,
        warehouseId,
        status: data.submitForApproval ? 'PENDING' : 'PENDING', // 默认为PENDING状态
        totalAmount,
        remark: data.remark,
        createdBy: data.createdBy,
        items: {
          create: data.items.map((item) => {
            const goodsId = Number.parseInt(item.goodsId, 10)
            const goodsItem = goodsMap.get(goodsId)
            if (!goodsItem) {
              throw new Error('商品不存在')
            }
            return {
              goodsId,
              ...buildGoodsSnapshot(goodsItem),
              quantity: item.quantity,
              unitPrice: item.price,
              totalPrice: item.quantity * item.price,
            }
          }),
        },
      },
      select: {
        id: true,
      },
    })

    // 返回完整详情
    return this.findById(String(stockIn.id))
  }

  /**
   * 更新入库单（仅PENDING状态可以更新）
   */
  async update(id: string, data: UpdateStockInDto): Promise<StockInDetail> {
    const stockInId = Number.parseInt(id, 10)

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockIn.findUnique({
        where: { id: stockInId },
      })

      if (!existing || existing.isDeleted) {
        throw new Error('入库单不存在')
      }

      if (existing.status !== 'PENDING') {
        throw new Error('只有待审批状态的入库单才能修改')
      }

      const warehouseId = data.warehouseId ? Number.parseInt(data.warehouseId, 10) : undefined
      if (warehouseId !== undefined) {
        const warehouse = await tx.warehouse.findFirst({
          where: { id: warehouseId, isDeleted: false },
        })

        if (!warehouse) {
          throw new Error('仓库不存在')
        }
      }

      let totalAmount: number | undefined
      let itemData: Prisma.StockInItemCreateManyInput[] | undefined
      if (data.items) {
        const goodsIds = Array.from(
          new Set(data.items.map((item) => Number.parseInt(item.goodsId, 10)))
        )
        const goods = await tx.goods.findMany({
          where: {
            id: { in: goodsIds },
            isDeleted: false,
          },
          include: { category: { select: { name: true } } },
        })

        if (goods.length !== goodsIds.length) {
          throw new Error('部分商品不存在')
        }

        const goodsMap = new Map(goods.map((item) => [item.id, item]))
        totalAmount = data.items.reduce((sum, item) => sum + item.quantity * item.price, 0)
        itemData = data.items.map((item) => {
          const goodsId = Number.parseInt(item.goodsId, 10)
          const goodsItem = goodsMap.get(goodsId)
          if (!goodsItem) {
            throw new Error('商品不存在')
          }

          return {
            stockInId,
            goodsId,
            ...buildGoodsSnapshot(goodsItem),
            quantity: item.quantity,
            unitPrice: item.price,
            totalPrice: item.quantity * item.price,
          }
        })
      }

      // 先原子锁定待审批单据，避免编辑与审批同时发生。
      const updated = await tx.stockIn.updateMany({
        where: {
          id: stockInId,
          status: 'PENDING',
          isDeleted: false,
          updatedAt: existing.updatedAt,
        },
        data: {
          warehouseId,
          remark: data.remark,
          totalAmount,
        },
      })

      if (updated.count !== 1) {
        throw new Error('入库单已被其他操作修改，请刷新后重试')
      }

      if (itemData) {
        await tx.stockInItem.deleteMany({ where: { stockInId } })
        await tx.stockInItem.createMany({ data: itemData })
      }
    })

    // 返回完整详情
    return this.findById(id)
  }

  /**
   * 提交审批（PENDING -> PENDING，实际上不需要改变状态）
   * 注：根据schema，创建时已经是PENDING状态
   */
  async submit(id: string): Promise<StockInDetail> {
    const stockInId = Number.parseInt(id, 10)

    const existing = await prisma.stockIn.findUnique({
      where: { id: stockInId },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('入库单不存在')
    }

    if (existing.status !== 'PENDING') {
      throw new Error('只有待审批状态的入库单才能提交审批')
    }

    // 这里不需要做任何操作，因为PENDING就是待审批状态
    return this.findById(id)
  }

  /**
   * 审批通过
   */
  async approve(id: string, userId: string): Promise<StockInDetail> {
    const stockInId = Number.parseInt(id, 10)

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockIn.findFirst({
        where: { id: stockInId, isDeleted: false },
      })

      if (!existing) {
        throw new Error('入库单不存在')
      }

      if (existing.status !== 'PENDING') {
        throw new Error('只有待审批状态的入库单才能审批')
      }

      const approved = await tx.stockIn.updateMany({
        where: { id: stockInId, status: 'PENDING', isDeleted: false },
        data: { status: 'APPROVED', approvedBy: userId, approvedAt: new Date() },
      })

      if (approved.count !== 1) {
        throw new Error('入库单状态已变化，请刷新后重试')
      }

      await tx.approvalLog.create({
        data: {
          entityType: 'STOCK_IN',
          entityId: String(stockInId),
          action: 'STOCK_IN_APPROVE',
          reason: `审批入库单 ${existing.code}`,
          beforeJson: { status: existing.status },
          afterJson: { status: 'APPROVED' },
          operatedBy: userId,
        },
      })
    })

    return this.findById(id)
  }

  /**
   * 审批拒绝
   */
  async reject(id: string, reason: string, userId: string): Promise<StockInDetail> {
    const stockInId = Number.parseInt(id, 10)

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockIn.findFirst({
        where: { id: stockInId, isDeleted: false },
      })

      if (!existing) {
        throw new Error('入库单不存在')
      }

      if (existing.status !== 'PENDING') {
        throw new Error('只有待审批状态的入库单才能审批')
      }

      const rejected = await tx.stockIn.updateMany({
        where: { id: stockInId, status: 'PENDING', isDeleted: false },
        data: { status: 'REJECTED', remark: reason },
      })

      if (rejected.count !== 1) {
        throw new Error('入库单状态已变化，请刷新后重试')
      }

      await tx.approvalLog.create({
        data: {
          entityType: 'STOCK_IN',
          entityId: String(stockInId),
          action: 'STOCK_IN_REJECT',
          reason,
          beforeJson: { status: existing.status },
          afterJson: { status: 'REJECTED', reason },
          operatedBy: userId,
        },
      })
    })

    return this.findById(id)
  }

  /**
   * 确认入库（核心业务逻辑）
   * 使用数据库事务确保一致性
   */
  async complete(id: string, userId: string): Promise<StockInDetail> {
    const stockInId = Number.parseInt(id, 10)

    await prisma.$transaction(async (tx) => {
      // 1. 获取入库单及明细
      const stockIn = await tx.stockIn.findUnique({
        where: { id: stockInId },
        include: {
          items: true,
        },
      })

      if (!stockIn || stockIn.isDeleted) {
        throw new Error('入库单不存在')
      }

      if (stockIn.status !== 'APPROVED') {
        throw new Error('只有已审批的入库单才能确认入库')
      }

      const claimed = await tx.stockIn.updateMany({
        where: { id: stockInId, status: 'APPROVED', isDeleted: false },
        data: { status: 'PROCESSING' },
      })

      if (claimed.count !== 1) {
        throw new Error('入库单状态已变化，请刷新后重试')
      }

      // 按固定顺序锁定库存键，避免不同入库单并发更新同一库存时丢失数量或成本。
      const goodsIds = Array.from(new Set(stockIn.items.map((item) => item.goodsId))).sort(
        (left, right) => left - right
      )
      for (const goodsId of goodsIds) {
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(${stockIn.warehouseId}::integer, ${goodsId}::integer)
        `
      }

      for (const item of stockIn.items) {
        // 查询或创建库存记录
        const inventory = await tx.inventory.findUnique({
          where: {
            warehouseId_goodsId: {
              warehouseId: stockIn.warehouseId,
              goodsId: item.goodsId,
            },
          },
        })

        const itemQty = Number(item.quantity)
        const itemPrice = Number(item.unitPrice)

        if (inventory) {
          // 库存已存在，更新库存数量和加权平均成本
          const oldQty = Number(inventory.quantity)
          const oldCost = Number(inventory.avgCost)
          const newQty = oldQty + itemQty

          // 使用成本计算器计算加权平均成本
          const newCost = costCalculator.calculateWeightedAvgCost({
            currentQty: oldQty,
            currentCost: oldCost,
            inQty: itemQty,
            inPrice: itemPrice,
          })

          // 更新库存
          await tx.inventory.update({
            where: { id: inventory.id },
            data: {
              quantity: newQty,
              availableQuantity: Number(inventory.availableQuantity) + itemQty,
              avgCost: newCost,
              totalCost: newQty * newCost,
            },
          })

          // 记录成本历史
          await tx.costHistory.create({
            data: {
              warehouseId: stockIn.warehouseId,
              goodsId: item.goodsId,
              beforeCost: oldCost,
              afterCost: newCost,
              beforeQty: oldQty,
              afterQty: newQty,
              inQty: itemQty,
              inPrice: itemPrice,
              referenceType: 'STOCK_IN',
              referenceId: id,
            },
          })

          // 记录库存变动日志
          await tx.inventoryLog.create({
            data: {
              inventoryId: inventory.id,
              changeType: 'IN',
              quantity: itemQty,
              beforeQty: oldQty,
              afterQty: newQty,
              referenceType: 'STOCK_IN',
              referenceId: id,
              operatedBy: userId,
            },
          })
        } else {
          // 库存不存在，创建新库存记录
          const newInventory = await tx.inventory.create({
            data: {
              warehouseId: stockIn.warehouseId,
              goodsId: item.goodsId,
              quantity: itemQty,
              lockedQuantity: 0,
              availableQuantity: itemQty,
              avgCost: itemPrice,
              totalCost: itemQty * itemPrice,
            },
          })

          // 记录成本历史（首次入库）
          await tx.costHistory.create({
            data: {
              warehouseId: stockIn.warehouseId,
              goodsId: item.goodsId,
              beforeCost: 0,
              afterCost: itemPrice,
              beforeQty: 0,
              afterQty: itemQty,
              inQty: itemQty,
              inPrice: itemPrice,
              referenceType: 'STOCK_IN',
              referenceId: id,
            },
          })

          // 记录库存变动日志
          await tx.inventoryLog.create({
            data: {
              inventoryId: newInventory.id,
              changeType: 'IN',
              quantity: itemQty,
              beforeQty: 0,
              afterQty: itemQty,
              referenceType: 'STOCK_IN',
              referenceId: id,
              operatedBy: userId,
            },
          })
        }
      }

      const completed = await tx.stockIn.updateMany({
        where: { id: stockInId, status: 'PROCESSING', isDeleted: false },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
        },
      })

      if (completed.count !== 1) {
        throw new Error('入库单状态已变化，请刷新后重试')
      }

      await tx.approvalLog.create({
        data: {
          entityType: 'STOCK_IN',
          entityId: String(stockInId),
          action: 'STOCK_IN_COMPLETE',
          reason: `确认入库 ${stockIn.code}`,
          beforeJson: { status: stockIn.status },
          afterJson: { status: 'COMPLETED' },
          operatedBy: userId,
        },
      })
    })

    // 返回完整详情
    return this.findById(id)
  }

  /**
   * 取消入库单
   */
  async cancel(id: string, reason: string, userId: string): Promise<StockInDetail> {
    const stockInId = Number.parseInt(id, 10)

    await prisma.$transaction(async (tx) => {
      const existing = await tx.stockIn.findFirst({
        where: { id: stockInId, isDeleted: false },
      })

      if (!existing) {
        throw new Error('入库单不存在')
      }

      if (!['PENDING', 'APPROVED', 'REJECTED'].includes(existing.status)) {
        throw new Error(
          existing.status === 'CANCELLED' ? '入库单已取消' : '当前状态的入库单无法取消'
        )
      }

      const cancelled = await tx.stockIn.updateMany({
        where: {
          id: stockInId,
          status: existing.status,
          isDeleted: false,
        },
        data: { status: 'CANCELLED', remark: `${existing.remark || ''}\n取消原因: ${reason}` },
      })

      if (cancelled.count !== 1) {
        throw new Error('入库单状态已变化，请刷新后重试')
      }

      await tx.approvalLog.create({
        data: {
          entityType: 'STOCK_IN',
          entityId: String(stockInId),
          action: 'STOCK_IN_CANCEL',
          reason,
          beforeJson: { status: existing.status },
          afterJson: { status: 'CANCELLED', reason },
          operatedBy: userId,
        },
      })
    })

    return this.findById(id)
  }

  /**
   * 删除入库单（软删除，仅PENDING和REJECTED状态可以删除）
   */
  async delete(id: string): Promise<{ success: boolean }> {
    const stockInId = Number.parseInt(id, 10)

    const existing = await prisma.stockIn.findUnique({
      where: { id: stockInId },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('入库单不存在')
    }

    if (
      existing.status !== 'PENDING' &&
      existing.status !== 'REJECTED' &&
      existing.status !== 'CANCELLED'
    ) {
      throw new Error('只有待审批、已拒绝或已取消的入库单才能删除')
    }

    const deleted = await prisma.stockIn.updateMany({
      where: {
        id: stockInId,
        status: existing.status,
        isDeleted: false,
      },
      data: { isDeleted: true },
    })

    if (deleted.count !== 1) {
      throw new Error('入库单状态已变化，请刷新后重试')
    }

    return { success: true }
  }

  /**
   * 获取所有启用的仓库（用于下拉选择）
   */
  async getActiveWarehouses() {
    const warehouses = await prisma.warehouse.findMany({
      where: {
        isDeleted: false,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
      },
    })

    return warehouses.map((warehouse) => ({
      ...warehouse,
      id: String(warehouse.id),
    }))
  }

  /**
   * 搜索商品（用于商品选择器）
   */
  async searchGoods(keyword: string, page = 1, pageSize = 20) {
    const goods = await prisma.goods.findMany({
      where: {
        isDeleted: false,
        isActive: true,
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { code: { contains: keyword, mode: 'insensitive' } },
        ],
      },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        unit: true,
        measureType: true,
        defaultInPrice: true,
      },
    })

    return goods.map((g) => ({
      ...g,
      id: String(g.id),
      defaultInPrice: Number(g.defaultInPrice),
    }))
  }
}

// 导出单例
export const stockInService = new StockInService()
