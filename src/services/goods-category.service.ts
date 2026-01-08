import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// 列表参数接口
export interface ListGoodsCategoriesParams {
  page?: number
  pageSize?: number
  keyword?: string // 搜索关键词（名称或编码）
}

// 创建商品分类 DTO
export interface CreateGoodsCategoryDto {
  code: string
  name: string
  sortOrder?: number
}

// 更新商品分类 DTO
export interface UpdateGoodsCategoryDto {
  name: string
  sortOrder?: number
}

// 列表返回数据接口
export interface PaginatedGoodsCategoryResult {
  data: Array<{
    id: string
    code: string
    name: string
    sortOrder: number
    isActive: boolean
    createdAt: Date
    updatedAt: Date
    _count: {
      goods: number
    }
  }>
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export class GoodsCategoryService {
  /**
   * 获取商品分类列表（分页）
   */
  async list(params: ListGoodsCategoriesParams = {}): Promise<PaginatedGoodsCategoryResult> {
    const { page = 1, pageSize = 20, keyword } = params

    // 构建查询条件
    const where: Prisma.GoodsCategoryWhereInput = {
      isDeleted: false,
    }

    // 如果有搜索关键词，按名称或编码搜索
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { code: { contains: keyword, mode: 'insensitive' } },
      ]
    }

    // 查询总数
    const total = await prisma.goodsCategory.count({ where })

    // 查询数据，按 sortOrder 排序
    const data = await prisma.goodsCategory.findMany({
      where,
      orderBy: { sortOrder: 'asc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
        _count: {
          select: { goods: true },
        },
      },
    })

    return {
      data,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 根据 ID 获取商品分类详情
   */
  async findById(id: string) {
    const category = await prisma.goodsCategory.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        sortOrder: true,
        isActive: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!category || category.isDeleted) {
      throw new Error('商品分类不存在')
    }

    // 返回时排除 isDeleted 字段
    const { isDeleted, ...result } = category
    return result
  }

  /**
   * 创建商品分类
   */
  async create(data: CreateGoodsCategoryDto) {
    // 检查编码是否已存在
    const existing = await prisma.goodsCategory.findFirst({
      where: {
        code: data.code,
        isDeleted: false,
      },
    })

    if (existing) {
      throw new Error('分类编码已存在')
    }

    // 创建商品分类
    const category = await prisma.goodsCategory.create({
      data: {
        code: data.code,
        name: data.name,
        sortOrder: data.sortOrder ?? 0,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return category
  }

  /**
   * 更新商品分类
   */
  async update(id: string, data: UpdateGoodsCategoryDto) {
    // 检查分类是否存在
    const existing = await prisma.goodsCategory.findUnique({
      where: { id },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('商品分类不存在')
    }

    // 更新商品分类
    const category = await prisma.goodsCategory.update({
      where: { id },
      data: {
        name: data.name,
        sortOrder: data.sortOrder ?? existing.sortOrder,
      },
      select: {
        id: true,
        code: true,
        name: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return category
  }

  /**
   * 删除商品分类（软删除）
   */
  async delete(id: string) {
    // 检查分类是否存在
    const existing = await prisma.goodsCategory.findUnique({
      where: { id },
      include: {
        _count: {
          select: { goods: true },
        },
      },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('商品分类不存在')
    }

    // 检查是否有关联的商品
    if (existing._count.goods > 0) {
      throw new Error('该分类下存在商品，无法删除')
    }

    // 软删除
    await prisma.goodsCategory.update({
      where: { id },
      data: { isDeleted: true },
    })

    return { success: true }
  }

  /**
   * 切换分类状态（启用/禁用）
   */
  async toggleStatus(id: string) {
    // 检查分类是否存在
    const existing = await prisma.goodsCategory.findUnique({
      where: { id },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('商品分类不存在')
    }

    // 切换状态
    const category = await prisma.goodsCategory.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: {
        id: true,
        code: true,
        name: true,
        sortOrder: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return category
  }

  /**
   * 更新排序
   */
  async updateSortOrder(orders: { id: string; sortOrder: number }[]) {
    // 批量更新排序
    const updatePromises = orders.map((item) =>
      prisma.goodsCategory.update({
        where: { id: item.id },
        data: { sortOrder: item.sortOrder },
      })
    )

    await Promise.all(updatePromises)
    return { success: true }
  }

  /**
   * 检查编码是否可用
   */
  async isCodeAvailable(code: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.GoodsCategoryWhereInput = {
      code,
      isDeleted: false,
    }

    if (excludeId) {
      where.id = { not: excludeId }
    }

    const count = await prisma.goodsCategory.count({ where })
    return count === 0
  }
}

// 导出单例
export const goodsCategoryService = new GoodsCategoryService()
