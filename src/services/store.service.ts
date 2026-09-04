import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import {
  archivedCodeError,
  masterAuditSnapshot,
  restorationData,
  softDeletionData,
} from '@/lib/master-data-lifecycle'
import { userService } from './user.service'

// 列表参数接口
export interface ListStoresParams {
  page?: number
  pageSize?: number
  keyword?: string // 搜索关键词（门店名称、编码或管理员）
}

// 创建门店 DTO
export interface CreateStoreDto {
  code: string
  name: string
  address?: string
  contactName?: string
  contactPhone?: string
}

// 更新门店 DTO
export interface UpdateStoreDto {
  name: string
  address?: string
  contactName?: string
  contactPhone?: string
}

// 门店列表数据项
export interface StoreListItem {
  id: string
  code: string
  name: string
  address: string | null
  contactName: string | null
  contactPhone: string | null
  isActive: boolean
  admins: Array<{
    userId: string
    displayName: string
  }>
  createdAt: Date
  updatedAt: Date
}

// 列表返回数据接口
export interface PaginatedStoreResult {
  data: StoreListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 门店详情
export interface StoreDetail {
  id: string
  code: string
  name: string
  address: string | null
  contactName: string | null
  contactPhone: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

// 门店管理员信息
export interface StoreAdminInfo {
  id: string
  userId: string
  storeId: string
  createdAt: Date
  user?: {
    code: number
    displayName: string
    email: string
    avatar?: string
  }
}

export interface StoreOption {
  id: string
  code: string
  name: string
}

export class StoreService {
  async listActiveOptions(): Promise<StoreOption[]> {
    const stores = await prisma.store.findMany({
      where: { isActive: true, isDeleted: false },
      orderBy: [{ name: 'asc' }, { code: 'asc' }],
      select: { id: true, code: true, name: true },
    })

    return stores.map((store) => ({ ...store, id: String(store.id) }))
  }

  /**
   * 获取门店列表（分页）
   */
  async list(params: ListStoresParams = {}): Promise<PaginatedStoreResult> {
    const { page = 1, pageSize = 20, keyword } = params

    // 构建查询条件
    const where: Prisma.StoreWhereInput = {
      isDeleted: false,
    }

    // 如果有搜索关键词，按门店或管理员信息搜索
    if (keyword) {
      where.OR = [
        { name: { contains: keyword, mode: 'insensitive' } },
        { code: { contains: keyword, mode: 'insensitive' } },
        {
          storeAdmins: {
            some: {
              user: {
                OR: [
                  { name: { contains: keyword, mode: 'insensitive' } },
                  { username: { contains: keyword, mode: 'insensitive' } },
                  { email: { contains: keyword, mode: 'insensitive' } },
                ],
              },
            },
          },
        },
      ]
    }

    // 查询总数
    const total = await prisma.store.count({ where })

    // 查询数据（包含管理员姓名）
    const data = await prisma.store.findMany({
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
        storeAdmins: {
          select: {
            userId: true,
            user: {
              select: {
                name: true,
                username: true,
              },
            },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    // 转换数据，添加管理员显示姓名
    const transformedData: StoreListItem[] = data.map((item) => ({
      id: String(item.id),
      code: item.code,
      name: item.name,
      address: item.address,
      contactName: item.contactName,
      contactPhone: item.contactPhone,
      isActive: item.isActive,
      admins: item.storeAdmins.map((admin) => ({
        userId: admin.userId,
        displayName: admin.user.name || admin.user.username,
      })),
      createdAt: item.createdAt,
      updatedAt: item.updatedAt,
    }))

    return {
      data: transformedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 根据 ID 获取门店详情
   */
  async findById(id: string): Promise<StoreDetail> {
    const storeId = Number.parseInt(id, 10)

    const store = await prisma.store.findUnique({
      where: { id: storeId },
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

    if (!store || store.isDeleted) {
      throw new Error('门店不存在')
    }

    // 返回时排除 isDeleted 字段
    const { isDeleted: _isDeleted, ...result } = store
    return {
      ...result,
      id: String(result.id),
    }
  }

  /**
   * 创建门店
   */
  async create(data: CreateStoreDto): Promise<StoreDetail> {
    // 检查编码是否已存在
    const existing = await prisma.store.findUnique({ where: { code: data.code } })

    if (existing) {
      throw new Error(archivedCodeError('门店', existing.isDeleted))
    }

    // 创建门店
    const store = await prisma.store.create({
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

    return {
      ...store,
      id: String(store.id),
    }
  }

  /**
   * 更新门店
   */
  async update(id: string, data: UpdateStoreDto): Promise<StoreDetail> {
    const storeId = Number.parseInt(id, 10)

    // 检查门店是否存在
    const existing = await prisma.store.findUnique({
      where: { id: storeId },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('门店不存在')
    }

    // 更新门店
    const store = await prisma.store.update({
      where: { id: storeId },
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

    return {
      ...store,
      id: String(store.id),
    }
  }

  /**
   * 删除门店（软删除）
   */
  async delete(
    id: string,
    operatedBy = 'system',
    reason = '管理员删除'
  ): Promise<{ success: boolean }> {
    const storeId = Number.parseInt(id, 10)

    // 检查门店是否存在
    const existing = await prisma.store.findUnique({
      where: { id: storeId },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('门店不存在')
    }

    const activeStatuses = ['PENDING', 'APPROVED', 'PROCESSING'] as const
    const [orderCount, borrowedContainerCount] = await prisma.$transaction([
      prisma.order.count({
        where: { storeId, isDeleted: false, status: { in: [...activeStatuses] } },
      }),
      prisma.containerTracking.count({
        where: { storeId, isDeleted: false, currentBorrowed: { not: 0 } },
      }),
    ])

    if (orderCount > 0) {
      throw new Error('该门店存在未完成订单，无法删除')
    }
    if (borrowedContainerCount > 0) {
      throw new Error('该门店仍有未归还包装物，无法删除')
    }

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.store.update({
        where: { id: storeId },
        data: softDeletionData(operatedBy, reason),
      })
      await tx.containerTracking.updateMany({
        where: { storeId, isDeleted: false },
        data: { isDeleted: true },
      })
      await tx.storeAdmin.deleteMany({ where: { storeId } })
      await tx.approvalLog.create({
        data: {
          entityType: 'STORE',
          entityId: String(storeId),
          action: 'STORE_DELETE',
          reason,
          beforeJson: masterAuditSnapshot(existing),
          afterJson: masterAuditSnapshot(deleted),
          operatedBy,
        },
      })
    })

    return { success: true }
  }

  async restore(id: string, operatedBy = 'system', reason = '恢复归档门店') {
    const storeId = Number.parseInt(id, 10)
    const existing = await prisma.store.findUnique({ where: { id: storeId } })
    if (!existing || !existing.isDeleted) {
      throw new Error('归档门店不存在')
    }

    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.store.update({ where: { id: storeId }, data: restorationData() })
      await tx.approvalLog.create({
        data: {
          entityType: 'STORE',
          entityId: String(storeId),
          action: 'STORE_RESTORE',
          reason,
          beforeJson: masterAuditSnapshot(existing),
          afterJson: masterAuditSnapshot(updated),
          operatedBy,
        },
      })
      return updated
    })

    return {
      id: String(restored.id),
      code: restored.code,
      name: restored.name,
      address: restored.address,
      contactName: restored.contactName,
      contactPhone: restored.contactPhone,
      isActive: restored.isActive,
      createdAt: restored.createdAt,
      updatedAt: restored.updatedAt,
    }
  }

  /**
   * 切换门店状态（启用/禁用）
   */
  async toggleStatus(id: string): Promise<StoreDetail> {
    const storeId = Number.parseInt(id, 10)

    // 检查门店是否存在
    const existing = await prisma.store.findUnique({
      where: { id: storeId },
    })

    if (!existing || existing.isDeleted) {
      throw new Error('门店不存在')
    }

    // 切换状态
    const store = await prisma.store.update({
      where: { id: storeId },
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

    return {
      ...store,
      id: String(store.id),
    }
  }

  /**
   * 检查编码是否可用
   */
  async isCodeAvailable(code: string, excludeId?: string): Promise<boolean> {
    const where: Prisma.StoreWhereInput = {
      code,
      isDeleted: false,
    }

    if (excludeId) {
      where.id = { not: Number.parseInt(excludeId, 10) }
    }

    const count = await prisma.store.count({ where })
    return count === 0
  }

  /**
   * 获取门店的管理员列表
   */
  async listAdmins(storeId: string): Promise<StoreAdminInfo[]> {
    const storeIdInt = Number.parseInt(storeId, 10)

    // 检查门店是否存在
    const store = await prisma.store.findUnique({
      where: { id: storeIdInt },
    })

    if (!store || store.isDeleted) {
      throw new Error('门店不存在')
    }

    const admins = await prisma.storeAdmin.findMany({
      where: { storeId: storeIdInt },
      select: {
        id: true,
        userId: true,
        storeId: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const adminsWithUserInfo = await Promise.all(
      admins.map(async (admin) => {
        const user = await userService.findById(admin.userId)
        return {
          ...admin,
          id: String(admin.id),
          storeId: String(admin.storeId),
          user: user
            ? {
                code: user.code,
                displayName: user.displayName || user.name || '',
                email: user.email || '',
                avatar: user.avatar || undefined,
              }
            : undefined,
        }
      })
    )

    return adminsWithUserInfo
  }

  /**
   * 添加门店管理员
   */
  async addAdmin(
    storeId: string,
    userId: string,
    operatedBy = 'system',
    operatorIp?: string
  ): Promise<StoreAdminInfo> {
    const storeIdInt = Number.parseInt(storeId, 10)

    const admin = await prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeIdInt } })
      if (!store || store.isDeleted) {
        throw new Error('门店不存在')
      }

      const existing = await tx.storeAdmin.findUnique({
        where: { userId_storeId: { userId, storeId: storeIdInt } },
      })
      if (existing) {
        throw new Error('该用户已是门店管理员')
      }

      const created = await tx.storeAdmin.create({
        data: { userId, storeId: storeIdInt },
        select: { id: true, userId: true, storeId: true, createdAt: true },
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'STORE',
          entityId: String(storeIdInt),
          action: 'STORE_ADMIN_ADD',
          reason: '添加门店管理员',
          beforeJson: { storeId: storeIdInt, userId, assigned: false },
          afterJson: { storeId: storeIdInt, userId, assigned: true },
          operatedBy,
          operatorIp,
        },
      })
      return created
    })

    return {
      ...admin,
      id: String(admin.id),
      storeId: String(admin.storeId),
    }
  }

  /**
   * 移除门店管理员
   */
  async removeAdmin(
    storeId: string,
    userId: string,
    operatedBy = 'system',
    operatorIp?: string
  ): Promise<{ success: boolean }> {
    const storeIdInt = Number.parseInt(storeId, 10)

    await prisma.$transaction(async (tx) => {
      const store = await tx.store.findUnique({ where: { id: storeIdInt } })
      if (!store || store.isDeleted) {
        throw new Error('门店不存在')
      }

      const existing = await tx.storeAdmin.findUnique({
        where: { userId_storeId: { userId, storeId: storeIdInt } },
      })
      if (!existing) {
        throw new Error('该管理员不存在')
      }

      await tx.storeAdmin.delete({
        where: { userId_storeId: { userId, storeId: storeIdInt } },
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'STORE',
          entityId: String(storeIdInt),
          action: 'STORE_ADMIN_REMOVE',
          reason: '移除门店管理员',
          beforeJson: { storeId: storeIdInt, userId, assigned: true },
          afterJson: { storeId: storeIdInt, userId, assigned: false },
          operatedBy,
          operatorIp,
        },
      })
    })

    return { success: true }
  }

  /**
   * 获取用户可访问的所有门店
   * @param user 用户信息（必须提供）
   */
  async getUserStores(user: AuthUser) {
    if (!user) {
      throw new Error('用户信息不能为空')
    }

    // 查询用户关联的所有门店（使用UUID格式的userId）
    const storeAdmins = await prisma.storeAdmin.findMany({
      where: {
        userId: user.id,
      },
      include: {
        store: {
          select: {
            id: true,
            code: true,
            name: true,
            isActive: true,
            isDeleted: true,
          },
        },
      },
    })

    // 过滤出启用的门店
    const stores = storeAdmins
      .filter((sa) => sa.store.isActive && !sa.store.isDeleted)
      .map((sa) => ({
        id: String(sa.store.id),
        code: sa.store.code,
        name: sa.store.name,
      }))

    return stores
  }
}

// 导出单例
export const storeService = new StoreService()
