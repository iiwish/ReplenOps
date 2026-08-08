import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  archivedCodeError,
  masterAuditSnapshot,
  restorationData,
  softDeletionData,
} from '@/lib/master-data-lifecycle'

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
    id: number
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
  async findById(id: number) {
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
    const { isDeleted: _isDeleted, ...result } = warehouse
    return result
  }

  /**
   * 创建仓库
   */
  async create(data: CreateWarehouseDto) {
    // 检查编码是否已存在
    const existing = await prisma.warehouse.findUnique({ where: { code: data.code } })

    if (existing) {
      throw new Error(archivedCodeError('仓库', existing.isDeleted))
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
  async update(id: number, data: UpdateWarehouseDto) {
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
  async delete(id: number, operatedBy = 'system', reason = '管理员删除') {
    // 检查仓库是否存在
    const existing = await prisma.warehouse.findUnique({
      where: { id },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('仓库不存在')
    }

    const activeStatuses = ['PENDING', 'APPROVED', 'PROCESSING'] as const
    const [inventoryCount, stockInCount, stockOutCount] = await prisma.$transaction([
      prisma.inventory.count({
        where: {
          warehouseId: id,
          isDeleted: false,
          OR: [
            { quantity: { not: 0 } },
            { lockedQuantity: { not: 0 } },
            { availableQuantity: { not: 0 } },
          ],
        },
      }),
      prisma.stockIn.count({
        where: { warehouseId: id, isDeleted: false, status: { in: [...activeStatuses] } },
      }),
      prisma.stockOut.count({
        where: { warehouseId: id, isDeleted: false, status: { in: [...activeStatuses] } },
      }),
    ])

    if (inventoryCount > 0) {
      throw new Error('该仓库仍有库存、锁定库存或可用库存，无法删除')
    }
    if (stockInCount + stockOutCount > 0) {
      throw new Error('该仓库存在未完成的出入库单，无法删除')
    }

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.warehouse.update({
        where: { id },
        data: softDeletionData(operatedBy, reason),
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'WAREHOUSE',
          entityId: String(id),
          action: 'WAREHOUSE_DELETE',
          reason,
          beforeJson: masterAuditSnapshot(existing),
          afterJson: masterAuditSnapshot(deleted),
          operatedBy,
        },
      })
    })

    return { success: true }
  }

  async restore(id: number, operatedBy = 'system', reason = '恢复归档仓库') {
    const existing = await prisma.warehouse.findUnique({ where: { id } })
    if (!existing || !existing.isDeleted) {
      throw new Error('归档仓库不存在')
    }

    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.warehouse.update({ where: { id }, data: restorationData() })
      await tx.approvalLog.create({
        data: {
          entityType: 'WAREHOUSE',
          entityId: String(id),
          action: 'WAREHOUSE_RESTORE',
          reason,
          beforeJson: masterAuditSnapshot(existing),
          afterJson: masterAuditSnapshot(updated),
          operatedBy,
        },
      })
      return updated
    })

    const {
      isDeleted: _isDeleted,
      deletedAt: _deletedAt,
      deletedBy: _deletedBy,
      deleteReason: _deleteReason,
      ...result
    } = restored
    return result
  }

  /**
   * 切换仓库状态（启用/禁用）
   */
  async toggleStatus(id: number) {
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
  async isCodeAvailable(code: string, excludeId?: number): Promise<boolean> {
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

  /**
   * 获取所有仓库（用于下拉选择）
   */
  async listAll(): Promise<Array<{ id: number; code: string; name: string }>> {
    const warehouses = await prisma.warehouse.findMany({
      where: {
        isActive: true,
        isDeleted: false,
      },
      select: {
        id: true,
        code: true,
        name: true,
      },
      orderBy: {
        code: 'asc',
      },
    })

    return warehouses
  }
}

// 导出单例
export const warehouseService = new WarehouseService()
