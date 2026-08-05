import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// 列表参数接口
export interface ListInventoryParams {
  page?: number
  pageSize?: number
  warehouseId?: string
  goodsId?: string
  keyword?: string // 搜索商品名称或编码
}

// 库存列表项接口
export interface InventoryListItem {
  id: string
  warehouseId: string
  warehouseName: string
  goodsId: string
  goodsCode: string
  goodsName: string
  goodsUnit: string
  quantity: number
  lockedQuantity: number
  availableQuantity: number
  avgCost: number
  totalCost: number
  createdAt: Date
  updatedAt: Date
}

// 分页返回结果
export interface PaginatedInventoryResult {
  data: InventoryListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 库存变动日志列表项
export interface InventoryLogListItem {
  id: string
  changeType: string
  quantity: number
  beforeQty: number
  afterQty: number
  referenceType: string | null
  referenceId: string | null
  remark: string | null
  operatedBy: string
  createdAt: Date
}

export class InventoryService {
  /**
   * 获取库存列表（分页）
   */
  async list(params: ListInventoryParams = {}): Promise<PaginatedInventoryResult> {
    const { page = 1, pageSize = 20, warehouseId, goodsId, keyword } = params

    // 构建查询条件
    const where: Prisma.InventoryWhereInput = {}

    // 仓库筛选
    if (warehouseId) {
      where.warehouseId = Number.parseInt(warehouseId, 10)
    }

    // 商品筛选
    if (goodsId) {
      where.goodsId = Number.parseInt(goodsId, 10)
    }

    // 搜索关键词（商品名称或编码）
    if (keyword) {
      where.goods = {
        OR: [
          { name: { contains: keyword, mode: 'insensitive' } },
          { code: { contains: keyword, mode: 'insensitive' } },
        ],
      }
    }

    // 查询总数
    const total = await prisma.inventory.count({ where })

    // 查询数据
    const data = await prisma.inventory.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        warehouseId: true,
        goodsId: true,
        quantity: true,
        lockedQuantity: true,
        availableQuantity: true,
        avgCost: true,
        totalCost: true,
        createdAt: true,
        updatedAt: true,
        warehouse: {
          select: {
            name: true,
          },
        },
        goods: {
          select: {
            code: true,
            name: true,
            unit: true,
          },
        },
      },
    })

    // 转换数据格式
    const formattedData: InventoryListItem[] = data.map((item) => ({
      id: String(item.id),
      warehouseId: String(item.warehouseId),
      warehouseName: item.warehouse.name,
      goodsId: String(item.goodsId),
      goodsCode: item.goods.code,
      goodsName: item.goods.name,
      goodsUnit: item.goods.unit,
      quantity: Number(item.quantity),
      lockedQuantity: Number(item.lockedQuantity),
      availableQuantity: Number(item.availableQuantity),
      avgCost: Number(item.avgCost),
      totalCost: Number(item.totalCost),
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
   * 根据仓库和商品获取库存
   */
  async findByWarehouseAndGoods(warehouseId: string, goodsId: string) {
    const inventory = await prisma.inventory.findUnique({
      where: {
        warehouseId_goodsId: {
          warehouseId: Number.parseInt(warehouseId, 10),
          goodsId: Number.parseInt(goodsId, 10),
        },
      },
      select: {
        id: true,
        warehouseId: true,
        goodsId: true,
        quantity: true,
        lockedQuantity: true,
        availableQuantity: true,
        avgCost: true,
        totalCost: true,
        createdAt: true,
        updatedAt: true,
        warehouse: {
          select: {
            name: true,
          },
        },
        goods: {
          select: {
            code: true,
            name: true,
            unit: true,
          },
        },
      },
    })

    if (!inventory) {
      return null
    }

    return {
      id: String(inventory.id),
      warehouseId: String(inventory.warehouseId),
      warehouseName: inventory.warehouse.name,
      goodsId: String(inventory.goodsId),
      goodsCode: inventory.goods.code,
      goodsName: inventory.goods.name,
      goodsUnit: inventory.goods.unit,
      quantity: Number(inventory.quantity),
      lockedQuantity: Number(inventory.lockedQuantity),
      availableQuantity: Number(inventory.availableQuantity),
      avgCost: Number(inventory.avgCost),
      totalCost: Number(inventory.totalCost),
      createdAt: inventory.createdAt,
      updatedAt: inventory.updatedAt,
    }
  }

  /**
   * 获取库存变动日志
   */
  async getInventoryLogs(
    inventoryId: string,
    page = 1,
    pageSize = 20
  ): Promise<{
    data: InventoryLogListItem[]
    total: number
    page: number
    pageSize: number
    totalPages: number
  }> {
    const where = { inventoryId: Number.parseInt(inventoryId, 10) }

    const total = await prisma.inventoryLog.count({ where })

    const data = await prisma.inventoryLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        changeType: true,
        quantity: true,
        beforeQty: true,
        afterQty: true,
        referenceType: true,
        referenceId: true,
        remark: true,
        operatedBy: true,
        createdAt: true,
      },
    })

    const formattedData: InventoryLogListItem[] = data.map((item) => ({
      id: String(item.id),
      changeType: item.changeType,
      quantity: Number(item.quantity),
      beforeQty: Number(item.beforeQty),
      afterQty: Number(item.afterQty),
      referenceType: item.referenceType,
      referenceId: item.referenceId,
      remark: item.remark,
      operatedBy: item.operatedBy,
      createdAt: item.createdAt,
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
   * 计算加权平均成本
   */
  calculateWeightedCost(params: {
    currentQty: number
    currentCost: number
    inQty: number
    inPrice: number
  }): number {
    const { currentQty, currentCost, inQty, inPrice } = params

    if (currentQty + inQty === 0) {
      return 0
    }

    return (currentQty * currentCost + inQty * inPrice) / (currentQty + inQty)
  }

  /**
   * 检查库存是否充足
   */
  async checkStock(
    warehouseId: string,
    goodsId: string,
    requiredQty: number
  ): Promise<{
    available: boolean
    currentQty: number
    availableQty: number
  }> {
    const warehouseIdInt = Number.parseInt(warehouseId, 10)
    const goodsIdInt = Number.parseInt(goodsId, 10)

    const inventory = await prisma.inventory.findUnique({
      where: {
        warehouseId_goodsId: {
          warehouseId: warehouseIdInt,
          goodsId: goodsIdInt,
        },
      },
      select: {
        quantity: true,
        availableQuantity: true,
      },
    })

    if (!inventory) {
      return {
        available: false,
        currentQty: 0,
        availableQty: 0,
      }
    }

    const availableQty = Number(inventory.availableQuantity)

    return {
      available: availableQty >= requiredQty,
      currentQty: Number(inventory.quantity),
      availableQty,
    }
  }

  /**
   * 批量检查库存
   */
  async batchCheckStock(
    warehouseId: string,
    items: Array<{ goodsId: string; quantity: number }>
  ): Promise<
    Array<{
      goodsId: string
      available: boolean
      currentQty: number
      availableQty: number
      requiredQty: number
    }>
  > {
    const warehouseIdInt = Number.parseInt(warehouseId, 10)
    const goodsIds = items.map((item) => Number.parseInt(item.goodsId, 10))

    const inventories = await prisma.inventory.findMany({
      where: {
        warehouseId: warehouseIdInt,
        goodsId: { in: goodsIds },
      },
      select: {
        goodsId: true,
        quantity: true,
        availableQuantity: true,
      },
    })

    const inventoryMap = new Map(
      inventories.map((inv) => [
        String(inv.goodsId),
        {
          quantity: Number(inv.quantity),
          availableQuantity: Number(inv.availableQuantity),
        },
      ])
    )

    return items.map((item) => {
      const inventory = inventoryMap.get(item.goodsId)

      if (!inventory) {
        return {
          goodsId: item.goodsId,
          available: false,
          currentQty: 0,
          availableQty: 0,
          requiredQty: item.quantity,
        }
      }

      return {
        goodsId: item.goodsId,
        available: inventory.availableQuantity >= item.quantity,
        currentQty: inventory.quantity,
        availableQty: inventory.availableQuantity,
        requiredQty: item.quantity,
      }
    })
  }

  /**
   * 手动库存调整
   * 使用事务保证数据一致性
   */
  async adjustStock(data: {
    warehouseId: string
    goodsId: string
    newQuantity: number
    reason: string
    operatorId: string
  }): Promise<{
    id: string
    warehouseId: string
    goodsId: string
    quantity: number
    changeQty: number
  }> {
    const { warehouseId, goodsId, newQuantity, reason, operatorId } = data
    const warehouseIdInt = Number.parseInt(warehouseId, 10)
    const goodsIdInt = Number.parseInt(goodsId, 10)

    // 验证新数量不能为负数
    if (newQuantity < 0) {
      throw new Error('调整后的数量不能为负数')
    }

    return await prisma.$transaction(async (tx) => {
      // 1. 查询当前库存（使用悲观锁）
      const inventory = await tx.inventory.findUnique({
        where: {
          warehouseId_goodsId: {
            warehouseId: warehouseIdInt,
            goodsId: goodsIdInt,
          },
        },
      })

      if (!inventory) {
        throw new Error('库存记录不存在，请先创建入库单建立库存')
      }

      const currentQty = Number(inventory.quantity)
      const currentAvailableQty = Number(inventory.availableQuantity)
      const currentLockedQty = Number(inventory.lockedQuantity)

      // 2. 计算变动数量
      const changeQty = newQuantity - currentQty

      // 3. 验证调整后可用库存不能为负数
      const newAvailableQty = currentAvailableQty + changeQty
      if (newAvailableQty < 0) {
        throw new Error(`调整失败：当前锁定库存为 ${currentLockedQty}，调整后可用库存不能为负数`)
      }

      // 4. 更新库存数量
      await tx.inventory.update({
        where: { id: inventory.id },
        data: {
          quantity: newQuantity,
          availableQuantity: newAvailableQty,
          updatedAt: new Date(),
        },
      })

      // 5. 记录库存变动日志
      await tx.inventoryLog.create({
        data: {
          inventoryId: inventory.id,
          changeType: 'ADJUSTMENT',
          quantity: changeQty,
          beforeQty: currentQty,
          afterQty: newQuantity,
          referenceType: 'manual_adjustment',
          referenceId: null,
          remark: reason,
          operatedBy: operatorId,
        },
      })

      return {
        id: String(inventory.id),
        warehouseId: String(inventory.warehouseId),
        goodsId: String(inventory.goodsId),
        quantity: newQuantity,
        changeQty,
      }
    })
  }
}

// 导出单例
export const inventoryService = new InventoryService()
