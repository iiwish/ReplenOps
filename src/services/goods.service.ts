import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { assertGoodsUnitChangeAllowed } from '@/lib/goods-snapshot'
import { archivedCodeError, restorationData, softDeletionData } from '@/lib/master-data-lifecycle'

// 列表参数接口
export interface ListGoodsParams {
  page?: number
  pageSize?: number
  search?: string // 搜索关键词（名称或编码）
  categoryId?: string // 分类筛选
}

// 创建商品 DTO
export interface CreateGoodsDto {
  code: string
  name: string
  categoryId: string
  spec?: string
  unit: string
  measureType: 'INT' | 'DECIMAL'
  costPrice: number
  partnerPrice: number
  defaultInPrice: number
  containerId?: string
  containerRatio?: number
  imageUrl?: string
  description?: string
}

// 更新商品 DTO
export interface UpdateGoodsDto {
  name: string
  categoryId: string
  spec?: string
  unit: string
  measureType: 'INT' | 'DECIMAL'
  costPrice: number
  partnerPrice: number
  defaultInPrice: number
  containerId?: string
  containerRatio?: number
  imageUrl?: string
  description?: string
}

// 列表返回数据接口
export interface PaginatedGoodsResult {
  data: Array<{
    id: string
    code: string
    name: string
    categoryId: string
    categoryName: string
    spec: string | null
    unit: string
    measureType: 'INT' | 'DECIMAL'
    costPrice: number
    partnerPrice: number
    defaultInPrice: number
    containerId: string | null
    containerRatio: number
    containerName: string | null
    imageUrl: string | null
    description: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }>
  total: number
  page: number
  pageSize: number
  totalPages: number
}

interface GoodsRecord {
  id: string
  code: string
  name: string
  categoryId: string
  spec: string | null
  unit: string
  measureType: 'INT' | 'DECIMAL'
  costPrice: number
  partnerPrice: number
  defaultInPrice: number
  containerId: string | null
  containerRatio: number
  containerName: string | null
  imageUrl: string | null
  description: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

export class GoodsService {
  private auditSnapshot(goods: {
    id: number
    code: string
    name: string
    categoryId: number
    spec: string | null
    unit: string
    measureType: 'INT' | 'DECIMAL'
    costPrice: Prisma.Decimal | number
    partnerPrice: Prisma.Decimal | number
    defaultInPrice: Prisma.Decimal | number
    isActive: boolean
    isDeleted?: boolean
  }): Prisma.InputJsonObject {
    return {
      id: goods.id,
      code: goods.code,
      name: goods.name,
      categoryId: goods.categoryId,
      spec: goods.spec,
      unit: goods.unit,
      measureType: goods.measureType,
      costPrice: Number(goods.costPrice),
      partnerPrice: Number(goods.partnerPrice),
      defaultInPrice: Number(goods.defaultInPrice),
      isActive: goods.isActive,
      isDeleted: goods.isDeleted ?? false,
    }
  }

  private parseGoodsId(id: string): number {
    const parsedId = Number.parseInt(id, 10)

    if (Number.isNaN(parsedId)) {
      throw new Error('商品ID无效')
    }

    return parsedId
  }

  private parseCategoryId(categoryId: string): number {
    const parsedId = Number.parseInt(categoryId, 10)

    if (Number.isNaN(parsedId)) {
      throw new Error('商品分类ID无效')
    }

    return parsedId
  }

  private toGoodsRecord(goods: {
    id: number
    code: string
    name: string
    categoryId: number
    spec: string | null
    unit: string
    measureType: 'INT' | 'DECIMAL'
    costPrice: Prisma.Decimal | number
    partnerPrice: Prisma.Decimal | number
    defaultInPrice: Prisma.Decimal | number
    containerId: number | null
    containerRatio: number | null
    container?: {
      name: string
    } | null
    imageUrl: string | null
    description: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }): GoodsRecord {
    return {
      id: String(goods.id),
      code: goods.code,
      name: goods.name,
      categoryId: String(goods.categoryId),
      spec: goods.spec,
      unit: goods.unit,
      measureType: goods.measureType,
      costPrice: Number(goods.costPrice),
      partnerPrice: Number(goods.partnerPrice),
      defaultInPrice: Number(goods.defaultInPrice),
      containerId: goods.containerId !== null ? String(goods.containerId) : null,
      containerRatio: goods.containerRatio || 0,
      containerName: goods.container?.name || null,
      imageUrl: goods.imageUrl,
      description: goods.description,
      isActive: goods.isActive,
      createdAt: goods.createdAt,
      updatedAt: goods.updatedAt,
    }
  }

  private parseOptionalContainer(data: { containerId?: string; containerRatio?: number }): {
    containerId: number | null
    containerRatio: number
  } {
    if (!data.containerId) {
      return { containerId: null, containerRatio: 0 }
    }

    const containerId = Number.parseInt(data.containerId, 10)
    if (Number.isNaN(containerId)) {
      throw new Error('包装物ID无效')
    }

    const containerRatio = data.containerRatio || 0
    if (!Number.isInteger(containerRatio) || containerRatio <= 0) {
      throw new Error('绑定包装物时配比必须为正整数')
    }

    return { containerId, containerRatio }
  }

  /**
   * 获取商品列表（分页）
   */
  async list(params: ListGoodsParams = {}): Promise<PaginatedGoodsResult> {
    const { page = 1, pageSize = 20, search, categoryId } = params

    // 构建查询条件
    const where: Prisma.GoodsWhereInput = {
      isDeleted: false,
    }

    // 分类筛选
    if (categoryId) {
      where.categoryId = Number.parseInt(categoryId, 10)
    }

    // 如果有搜索关键词，按名称或编码搜索
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ]
    }

    // 查询总数
    const total = await prisma.goods.count({ where })

    // 查询数据
    const data = await prisma.goods.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        categoryId: true,
        spec: true,
        unit: true,
        measureType: true,
        costPrice: true,
        partnerPrice: true,
        defaultInPrice: true,
        containerId: true,
        containerRatio: true,
        imageUrl: true,
        description: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            name: true,
          },
        },
        container: {
          select: {
            name: true,
          },
        },
      },
    })

    // 转换数据格式
    const formattedData = data.map((item) => ({
      id: String(item.id),
      code: item.code,
      name: item.name,
      categoryId: String(item.categoryId),
      categoryName: item.category.name,
      spec: item.spec,
      unit: item.unit,
      measureType: item.measureType,
      costPrice: Number(item.costPrice),
      partnerPrice: Number(item.partnerPrice),
      defaultInPrice: Number(item.defaultInPrice),
      containerId: item.containerId !== null ? String(item.containerId) : null,
      containerRatio: item.containerRatio || 0,
      containerName: item.container?.name || null,
      imageUrl: item.imageUrl,
      description: item.description,
      isActive: item.isActive,
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
   * 根据 ID 获取商品详情
   */
  async findById(id: string) {
    const goodsId = this.parseGoodsId(id)

    const goods = await prisma.goods.findUnique({
      where: { id: goodsId },
      select: {
        id: true,
        code: true,
        name: true,
        categoryId: true,
        spec: true,
        unit: true,
        measureType: true,
        costPrice: true,
        partnerPrice: true,
        defaultInPrice: true,
        containerId: true,
        containerRatio: true,
        imageUrl: true,
        description: true,
        isActive: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
        category: {
          select: {
            name: true,
          },
        },
        container: {
          select: {
            name: true,
          },
        },
      },
    })

    if (!goods || goods.isDeleted) {
      throw new Error('商品不存在')
    }

    // 返回时排除 isDeleted 字段，并转换 Decimal
    const { isDeleted: _isDeleted, category, ...rest } = goods
    return {
      ...this.toGoodsRecord(rest),
      categoryName: category.name,
    }
  }

  /**
   * 创建商品
   */
  async create(data: CreateGoodsDto, operatedBy = 'system') {
    const categoryId = this.parseCategoryId(data.categoryId)

    // 检查编码是否已存在
    const existing = await prisma.goods.findUnique({ where: { code: data.code } })

    if (existing) {
      throw new Error(archivedCodeError('商品', existing.isDeleted))
    }

    // 检查分类是否存在
    const category = await prisma.goodsCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category || category.isDeleted) {
      throw new Error('商品分类不存在')
    }

    const containerBinding = this.parseOptionalContainer(data)

    if (containerBinding.containerId !== null) {
      const container = await prisma.container.findFirst({
        where: { id: containerBinding.containerId, isDeleted: false, isActive: true },
        select: { id: true },
      })

      if (!container) {
        throw new Error('包装物不存在或未启用')
      }
    }

    // 创建商品
    const goods = await prisma.$transaction(async (tx) => {
      const created = await tx.goods.create({
        data: {
          code: data.code,
          name: data.name,
          categoryId,
          spec: data.spec,
          unit: data.unit,
          measureType: data.measureType,
          costPrice: data.costPrice,
          partnerPrice: data.partnerPrice,
          defaultInPrice: data.defaultInPrice,
          containerId: containerBinding.containerId,
          containerRatio: containerBinding.containerRatio,
          imageUrl: data.imageUrl,
          description: data.description,
          isActive: true,
        },
        select: {
          id: true,
          code: true,
          name: true,
          categoryId: true,
          spec: true,
          unit: true,
          measureType: true,
          costPrice: true,
          partnerPrice: true,
          defaultInPrice: true,
          containerId: true,
          containerRatio: true,
          imageUrl: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          container: {
            select: {
              name: true,
            },
          },
        },
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'GOODS',
          entityId: String(created.id),
          action: 'GOODS_CREATE',
          reason: `创建商品 ${created.code}`,
          afterJson: this.auditSnapshot(created),
          operatedBy,
        },
      })
      return created
    })

    return this.toGoodsRecord(goods)
  }

  /**
   * 更新商品
   */
  async update(id: string, data: UpdateGoodsDto, operatedBy = 'system') {
    const goodsId = this.parseGoodsId(id)
    const categoryId = this.parseCategoryId(data.categoryId)

    // 检查商品是否存在
    const existing = await prisma.goods.findUnique({
      where: { id: goodsId },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('商品不存在')
    }

    const [inventoryCount, orderItemCount, stockInItemCount, stockOutItemCount] =
      await prisma.$transaction([
        prisma.inventory.count({
          where: {
            goodsId,
            isDeleted: false,
            OR: [
              { quantity: { not: 0 } },
              { lockedQuantity: { not: 0 } },
              { availableQuantity: { not: 0 } },
            ],
          },
        }),
        prisma.orderItem.count({ where: { goodsId, isDeleted: false } }),
        prisma.stockInItem.count({ where: { goodsId, isDeleted: false } }),
        prisma.stockOutItem.count({ where: { goodsId, isDeleted: false } }),
      ])

    assertGoodsUnitChangeAllowed(existing, data, {
      inventoryCount,
      orderItemCount,
      stockInItemCount,
      stockOutItemCount,
    })

    // 检查分类是否存在
    const category = await prisma.goodsCategory.findUnique({
      where: { id: categoryId },
    })

    if (!category || category.isDeleted) {
      throw new Error('商品分类不存在')
    }

    const containerBinding = this.parseOptionalContainer(data)

    if (containerBinding.containerId !== null) {
      const container = await prisma.container.findFirst({
        where: { id: containerBinding.containerId, isDeleted: false, isActive: true },
        select: { id: true },
      })

      if (!container) {
        throw new Error('包装物不存在或未启用')
      }
    }

    // 更新商品
    const goods = await prisma.$transaction(async (tx) => {
      const updated = await tx.goods.update({
        where: { id: goodsId },
        data: {
          name: data.name,
          categoryId,
          spec: data.spec,
          unit: data.unit,
          measureType: data.measureType,
          costPrice: data.costPrice,
          partnerPrice: data.partnerPrice,
          defaultInPrice: data.defaultInPrice,
          containerId: containerBinding.containerId,
          containerRatio: containerBinding.containerRatio,
          imageUrl: data.imageUrl,
          description: data.description,
        },
        select: {
          id: true,
          code: true,
          name: true,
          categoryId: true,
          spec: true,
          unit: true,
          measureType: true,
          costPrice: true,
          partnerPrice: true,
          defaultInPrice: true,
          containerId: true,
          containerRatio: true,
          imageUrl: true,
          description: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
          container: {
            select: {
              name: true,
            },
          },
        },
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'GOODS',
          entityId: String(updated.id),
          action: 'GOODS_UPDATE',
          reason: `修改商品 ${updated.code}`,
          beforeJson: this.auditSnapshot(existing),
          afterJson: this.auditSnapshot(updated),
          operatedBy,
        },
      })
      return updated
    })

    return this.toGoodsRecord(goods)
  }

  /**
   * 删除商品（软删除）
   */
  async delete(id: string, operatedBy = 'system', reason = '管理员删除') {
    const goodsId = this.parseGoodsId(id)

    // 检查商品是否存在
    const existing = await prisma.goods.findUnique({
      where: { id: goodsId },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('商品不存在')
    }

    const activeStatuses = ['PENDING', 'APPROVED', 'PROCESSING'] as const
    const [inventoryCount, activeOrderCount, activeStockInCount, activeStockOutCount] =
      await prisma.$transaction([
        prisma.inventory.count({
          where: {
            goodsId,
            isDeleted: false,
            OR: [
              { quantity: { not: 0 } },
              { lockedQuantity: { not: 0 } },
              { availableQuantity: { not: 0 } },
            ],
          },
        }),
        prisma.orderItem.count({
          where: {
            goodsId,
            isDeleted: false,
            order: { isDeleted: false, status: { in: [...activeStatuses] } },
          },
        }),
        prisma.stockInItem.count({
          where: {
            goodsId,
            isDeleted: false,
            stockIn: { isDeleted: false, status: { in: [...activeStatuses] } },
          },
        }),
        prisma.stockOutItem.count({
          where: {
            goodsId,
            isDeleted: false,
            stockOut: { isDeleted: false, status: { in: [...activeStatuses] } },
          },
        }),
      ])

    if (inventoryCount > 0) {
      throw new Error('商品仍有库存、锁定库存或可用库存，不能删除')
    }
    if (activeOrderCount + activeStockInCount + activeStockOutCount > 0) {
      throw new Error('商品存在未完成的订单或出入库单，不能删除')
    }

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.goods.update({
        where: { id: goodsId },
        data: softDeletionData(operatedBy, reason),
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'GOODS',
          entityId: String(goodsId),
          action: 'GOODS_DELETE',
          reason: `删除商品 ${existing.code}`,
          beforeJson: this.auditSnapshot(existing),
          afterJson: this.auditSnapshot(deleted),
          operatedBy,
        },
      })
    })

    return { success: true }
  }

  async restore(id: string, operatedBy = 'system', reason = '恢复归档商品') {
    const goodsId = this.parseGoodsId(id)
    const existing = await prisma.goods.findUnique({ where: { id: goodsId } })

    if (!existing || !existing.isDeleted) {
      throw new Error('归档商品不存在')
    }

    const [category, container] = await Promise.all([
      prisma.goodsCategory.findFirst({
        where: { id: existing.categoryId, isDeleted: false },
        select: { id: true },
      }),
      existing.containerId === null
        ? Promise.resolve(null)
        : prisma.container.findFirst({
            where: { id: existing.containerId, isDeleted: false },
            select: { id: true },
          }),
    ])

    if (!category) {
      throw new Error('商品分类已归档，无法恢复商品')
    }
    if (existing.containerId !== null && !container) {
      throw new Error('关联包装物已归档，无法恢复商品')
    }

    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.goods.update({
        where: { id: goodsId },
        data: restorationData(),
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'GOODS',
          entityId: String(goodsId),
          action: 'GOODS_RESTORE',
          reason,
          beforeJson: this.auditSnapshot(existing),
          afterJson: this.auditSnapshot(updated),
          operatedBy,
        },
      })
      return updated
    })

    return this.toGoodsRecord(restored)
  }

  /**
   * 切换商品状态（启用/禁用）
   */
  async toggleStatus(id: string, operatedBy = 'system') {
    const goodsId = this.parseGoodsId(id)

    // 检查商品是否存在
    const existing = await prisma.goods.findUnique({
      where: { id: goodsId },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('商品不存在')
    }

    // 切换状态
    const goods = await prisma.$transaction(async (tx) => {
      const updated = await tx.goods.update({
        where: { id: goodsId },
        data: { isActive: !existing.isActive },
        select: {
          id: true,
          code: true,
          name: true,
          isActive: true,
        },
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'GOODS',
          entityId: String(goodsId),
          action: 'GOODS_STATUS_CHANGE',
          reason: `${updated.isActive ? '启用' : '禁用'}商品 ${updated.code}`,
          beforeJson: { isActive: existing.isActive },
          afterJson: { isActive: updated.isActive },
          operatedBy,
        },
      })
      return updated
    })

    return {
      id: String(goods.id),
      code: goods.code,
      name: goods.name,
      isActive: goods.isActive,
    }
  }

  /**
   * 检查编码是否可用
   */
  async isCodeAvailable(code: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.GoodsWhereInput = {
      code,
      isDeleted: false,
    }

    if (excludeId) {
      where.id = { not: this.parseGoodsId(excludeId) }
    }

    const count = await prisma.goods.count({ where })
    return count === 0
  }

  /**
   * 获取所有启用的分类（用于下拉选择）
   */
  async getActiveCategories() {
    const categories = await prisma.goodsCategory.findMany({
      where: {
        isDeleted: false,
        isActive: true,
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        code: true,
        name: true,
      },
    })

    return categories.map((category) => ({
      id: String(category.id),
      code: category.code,
      name: category.name,
    }))
  }
}

// 导出单例
export const goodsService = new GoodsService()
