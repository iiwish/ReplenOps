import { prisma } from '@/lib/prisma'
import { InventoryChangeType, Prisma } from '@prisma/client'

// 列表参数接口
export interface ListInventoryLogParams {
  page?: number
  pageSize?: number
  warehouseId?: string
  goodsId?: string
  changeTypes?: string[] // IN, OUT, RETURN, ADJUSTMENT
  startDate?: Date
  endDate?: Date
  operatorId?: string
}

// 库存日志详情项接口
export interface InventoryLogDetailItem {
  id: string
  warehouseId: string
  warehouseName: string
  goodsId: string
  goodsCode: string
  goodsName: string
  goodsUnit: string
  changeType: string
  quantity: number
  beforeQty: number
  afterQty: number
  referenceType: string | null
  referenceId: string | null
  remark: string | null
  operatorId: string
  operatorName: string
  createdAt: Date
}

// 分页返回结果
export interface PaginatedInventoryLogResult {
  data: InventoryLogDetailItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export class InventoryLogService {
  private parseChangeTypes(changeTypes: string[]): InventoryChangeType[] {
    return changeTypes.filter((changeType): changeType is InventoryChangeType =>
      Object.values(InventoryChangeType).includes(changeType as InventoryChangeType)
    )
  }

  private toInventoryLogDetailItem(item: {
    id: number
    changeType: InventoryChangeType
    quantity: Prisma.Decimal | number
    beforeQty: Prisma.Decimal | number
    afterQty: Prisma.Decimal | number
    referenceType: string | null
    referenceId: string | null
    remark: string | null
    operatedBy: string
    createdAt: Date
    inventory: {
      warehouseId: number
      goodsId: number
      warehouse: {
        name: string
      }
      goods: {
        code: string
        name: string
        unit: string
      }
    }
  }): InventoryLogDetailItem {
    return {
      id: String(item.id),
      warehouseId: String(item.inventory.warehouseId),
      warehouseName: item.inventory.warehouse.name,
      goodsId: String(item.inventory.goodsId),
      goodsCode: item.inventory.goods.code,
      goodsName: item.inventory.goods.name,
      goodsUnit: item.inventory.goods.unit,
      changeType: item.changeType,
      quantity: Number(item.quantity),
      beforeQty: Number(item.beforeQty),
      afterQty: Number(item.afterQty),
      referenceType: item.referenceType,
      referenceId: item.referenceId,
      remark: item.remark,
      operatorId: item.operatedBy,
      operatorName: item.operatedBy,
      createdAt: item.createdAt,
    }
  }

  /**
   * 获取库存日志列表（分页）
   */
  async list(
    params: ListInventoryLogParams = {}
  ): Promise<PaginatedInventoryLogResult> {
    const {
      page = 1,
      pageSize = 20,
      warehouseId,
      goodsId,
      changeTypes,
      startDate,
      endDate,
      operatorId,
    } = params

    // 构建查询条件
    const where: Prisma.InventoryLogWhereInput = {}

    // 通过 inventory 关联筛选仓库和商品
    const inventoryWhere: Prisma.InventoryWhereInput = {}

    if (warehouseId) {
      inventoryWhere.warehouseId = Number.parseInt(warehouseId, 10)
    }

    if (goodsId) {
      inventoryWhere.goodsId = Number.parseInt(goodsId, 10)
    }

    if (Object.keys(inventoryWhere).length > 0) {
      where.inventory = inventoryWhere
    }

    // 变动类型筛选（多选）
    if (changeTypes && changeTypes.length > 0) {
      const normalizedChangeTypes = this.parseChangeTypes(changeTypes)

      if (normalizedChangeTypes.length > 0) {
      where.changeType = {
          in: normalizedChangeTypes,
        }
      }
    }

    // 时间范围筛选
    if (startDate || endDate) {
      where.createdAt = {}
      if (startDate) {
        where.createdAt.gte = startDate
      }
      if (endDate) {
        // 包含结束日期当天的所有记录
        const endOfDay = new Date(endDate)
        endOfDay.setHours(23, 59, 59, 999)
        where.createdAt.lte = endOfDay
      }
    }

    // 操作人筛选
    if (operatorId) {
      where.operatedBy = operatorId
    }

    // 查询总数
    const total = await prisma.inventoryLog.count({ where })

    // 查询数据
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
        inventory: {
          select: {
            warehouseId: true,
            goodsId: true,
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
        },
      },
    })

    // 转换数据格式
    // 注意：operatedBy 当前存储的是本地用户 ID
    // 这里直接返回 userId，前端可按需再查询用户展示名
    const formattedData: InventoryLogDetailItem[] = data.map((item) =>
      this.toInventoryLogDetailItem(item)
    )

    return {
      data: formattedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 根据关联单据查询日志
   */
  async findByReference(
    referenceType: string,
    referenceId: string
  ): Promise<InventoryLogDetailItem[]> {
    const data = await prisma.inventoryLog.findMany({
      where: {
        referenceType,
        referenceId,
      },
      orderBy: { createdAt: 'desc' },
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
        inventory: {
          select: {
            warehouseId: true,
            goodsId: true,
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
        },
      },
    })

    // 转换数据格式
    // 注意：operatedBy 当前存储的是本地用户 ID
    return data.map((item) => this.toInventoryLogDetailItem(item))
  }
}

// 导出单例
export const inventoryLogService = new InventoryLogService()
