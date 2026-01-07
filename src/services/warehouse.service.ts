import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

// 列表参数接口
export interface ListWarehousesParams {
  page?: number
  pageSize?: number
  keyword?: string // 搜索关键词（名称或编码）
}

// 创建仓库 DTO
export interface CreateWarehouseDto {
  code: string
  name: string
  address?: string
  contactName: string
  contactPhone: string
}

// 更新仓库 DTO
export interface UpdateWarehouseDto {
  name: string
  address?: string
  contactName: string
  contactPhone: string
}

// 列表返回数据接口
export interface PaginatedWarehouseResult {
  data: Array<{
    id: string
    code: string
    name: string
    address: string | null
    contactName: string | null
    contactPhone: string | null
    isActive: boolean
    createdAt: Date
    updatedAt: Date
  }>
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export class WarehouseService {
  /**
   * 获取仓库列表（分页）
   */
  async list(params: ListWarehousesParams = {}): Promise<PaginatedWarehouseResult> {
    const { page = 1, pageSize = 20, keyword } = params

    // 构建查询条件
    const where: Prisma.WarehouseWhereInput = {
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
    const total = await prisma.warehouse.count({ where })

    // 查询数据
    const data = await prisma.warehouse.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        contactName: true,
        contactPhone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
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
   * 根据 ID 获取仓库详情
   */
  async findById(id: string) {
    const warehouse = await prisma.warehouse.findUnique({
      where: { id },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        contactName: true,
        contactPhone: true,
        isActive: true,
        isDeleted: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    if (!warehouse || warehouse.isDeleted) {
      throw new Error('仓库不存在')
    }

    // 返回时排除 isDeleted 字段
    const { isDeleted, ...result } = warehouse
    return result
  }

  /**
   * 创建仓库
   */
  async create(data: CreateWarehouseDto) {
    // 检查编码是否已存在
    const existing = await prisma.warehouse.findFirst({
      where: {
        code: data.code,
        isDeleted: false,
      },
    })

    if (existing) {
      throw new Error('仓库编码已存在')
    }

    // 创建仓库
    const warehouse = await prisma.warehouse.create({
      data: {
        code: data.code,
        name: data.name,
        address: data.address,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
        isActive: true,
      },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        contactName: true,
        contactPhone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return warehouse
  }

  /**
   * 更新仓库
   */
  async update(id: string, data: UpdateWarehouseDto) {
    // 检查仓库是否存在
    const existing = await prisma.warehouse.findUnique({
      where: { id },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('仓库不存在')
    }

    // 更新仓库
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: {
        name: data.name,
        address: data.address,
        contactName: data.contactName,
        contactPhone: data.contactPhone,
      },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        contactName: true,
        contactPhone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return warehouse
  }

  /**
   * 删除仓库（软删除）
   */
  async delete(id: string) {
    // 检查仓库是否存在
    const existing = await prisma.warehouse.findUnique({
      where: { id },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('仓库不存在')
    }

    // 检查是否有关联的库存记录
    const inventoryCount = await prisma.inventory.count({
      where: {
        warehouseId: id,
        quantity: { gt: 0 },
      },
    })

    if (inventoryCount > 0) {
      throw new Error('该仓库存在库存记录，无法删除')
    }

    // 软删除
    await prisma.warehouse.update({
      where: { id },
      data: { isDeleted: true },
    })

    return { success: true }
  }

  /**
   * 切换仓库状态（启用/禁用）
   */
  async toggleStatus(id: string) {
    // 检查仓库是否存在
    const existing = await prisma.warehouse.findUnique({
      where: { id },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('仓库不存在')
    }

    // 切换状态
    const warehouse = await prisma.warehouse.update({
      where: { id },
      data: { isActive: !existing.isActive },
      select: {
        id: true,
        code: true,
        name: true,
        address: true,
        contactName: true,
        contactPhone: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    })

    return warehouse
  }

  /**
   * 检查编码是否可用
   */
  async isCodeAvailable(code: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.WarehouseWhereInput = {
      code,
      isDeleted: false,
    }

    if (excludeId) {
      where.id = { not: excludeId }
    }

    const count = await prisma.warehouse.count({ where })
    return count === 0
  }
}

// 导出单例
export const warehouseService = new WarehouseService()
