import bcrypt from 'bcryptjs'
import { Prisma, UserRoleEnum } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { restorationData, softDeletionData } from '@/lib/master-data-lifecycle'

export interface UserCreateInput {
  username: string
  password: string
  name?: string
  email?: string
  phone?: string
  avatar?: string
}

export interface UserUpdateInput {
  username?: string
  password?: string
  name?: string
  email?: string
  phone?: string
  avatar?: string
  isActive?: boolean
}

export interface UserWithRoles {
  id: string
  code: number
  username: string
  name: string | null
  displayName?: string
  email: string | null
  phone: string | null
  avatar: string | null
  isActive: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
  roles: string[]
  storeIds: string[]
}

type UserRecordWithRoles = Prisma.UserGetPayload<{
  include: { roles: true; storeAdmins: true }
}>

const ROLE_MAPPING: Readonly<Record<string, UserRoleEnum>> = {
  super_admin: 'SUPER_ADMIN',
  warehouse_manager: 'WAREHOUSE_MANAGER',
  store_admin: 'STORE_ADMIN',
  finance: 'FINANCE',
  approver: 'APPROVER',
}

function normalizeRoles(roles: string[]): UserRoleEnum[] {
  const normalized = roles.map((role) => {
    const enumRole = ROLE_MAPPING[role.toLowerCase()]
    if (!enumRole) {
      throw new Error(`Invalid role: ${role}`)
    }
    return enumRole
  })

  return [...new Set(normalized)]
}

function normalizeStoreIds(storeIds: string[]): number[] {
  const normalized = storeIds.map((storeId) => Number.parseInt(storeId, 10))
  if (normalized.some((storeId) => !Number.isSafeInteger(storeId) || storeId <= 0)) {
    throw new Error('包含无效的门店')
  }
  return [...new Set(normalized)]
}

function toUserWithRoles(user: UserRecordWithRoles): UserWithRoles {
  return {
    id: user.id,
    code: user.code,
    username: user.username,
    name: user.name,
    displayName: user.name || user.username,
    email: user.email,
    phone: user.phone,
    avatar: user.avatar,
    isActive: user.isActive,
    isDeleted: user.isDeleted,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
    roles: user.roles.map((role) => role.role),
    storeIds: user.storeAdmins.map((storeAdmin) => String(storeAdmin.storeId)),
  }
}

interface SuperAdminContinuityInput {
  currentIsActive: boolean
  currentIsDeleted: boolean
  currentRoles: UserRoleEnum[]
  nextIsActive?: boolean
  nextRoles?: UserRoleEnum[]
  alternativeActiveSuperAdmins: number
}

export function violatesActiveSuperAdminContinuity({
  currentIsActive,
  currentIsDeleted,
  currentRoles,
  nextIsActive,
  nextRoles,
  alternativeActiveSuperAdmins,
}: SuperAdminContinuityInput): boolean {
  const isCurrentlyActiveSuperAdmin =
    currentIsActive && !currentIsDeleted && currentRoles.includes(UserRoleEnum.SUPER_ADMIN)
  if (!isCurrentlyActiveSuperAdmin) return false

  const remainsActive = nextIsActive ?? currentIsActive
  const remainsSuperAdmin = (nextRoles ?? currentRoles).includes(UserRoleEnum.SUPER_ADMIN)
  return !remainsActive || !remainsSuperAdmin ? alternativeActiveSuperAdmins === 0 : false
}

export class UserService {
  private readonly saltRounds = 10

  private async assertActiveSuperAdminContinuity(
    tx: Prisma.TransactionClient,
    userId: string,
    nextIsActive?: boolean,
    nextRoles?: UserRoleEnum[]
  ): Promise<void> {
    const current = await tx.user.findUnique({
      where: { id: userId },
      select: {
        isActive: true,
        isDeleted: true,
        roles: { select: { role: true } },
      },
    })
    if (!current) return

    const isCurrentlyActiveSuperAdmin =
      current.isActive &&
      !current.isDeleted &&
      current.roles.some((role) => role.role === UserRoleEnum.SUPER_ADMIN)
    if (!isCurrentlyActiveSuperAdmin) return

    const remainsActive = nextIsActive ?? current.isActive
    const remainsSuperAdmin = nextRoles
      ? nextRoles.includes(UserRoleEnum.SUPER_ADMIN)
      : current.roles.some((role) => role.role === UserRoleEnum.SUPER_ADMIN)
    if (remainsActive && remainsSuperAdmin) return

    const alternativeCount = await tx.user.count({
      where: {
        id: { not: userId },
        isActive: true,
        isDeleted: false,
        roles: { some: { role: UserRoleEnum.SUPER_ADMIN } },
      },
    })
    if (
      violatesActiveSuperAdminContinuity({
        currentIsActive: current.isActive,
        currentIsDeleted: current.isDeleted,
        currentRoles: current.roles.map((role) => role.role),
        nextIsActive,
        nextRoles,
        alternativeActiveSuperAdmins: alternativeCount,
      })
    ) {
      throw new Error('系统必须至少保留一个启用的超级管理员')
    }
  }

  private auditSnapshot(user: {
    id: string
    code: number
    username: string
    name: string | null
    isActive: boolean
    isDeleted: boolean
    deletedAt?: Date | null
    deletedBy?: string | null
    deleteReason?: string | null
    roles?: Array<{ role: UserRoleEnum }>
    storeAdmins?: Array<{ storeId: number }>
  }): Prisma.InputJsonObject {
    return {
      id: user.id,
      code: user.code,
      username: user.username,
      name: user.name,
      isActive: user.isActive,
      isDeleted: user.isDeleted,
      deletedAt: user.deletedAt?.toISOString() ?? null,
      deletedBy: user.deletedBy ?? null,
      deleteReason: user.deleteReason ?? null,
      ...(user.roles ? { roles: user.roles.map(({ role }) => role).sort() } : {}),
      ...(user.storeAdmins
        ? {
            storeIds: user.storeAdmins.map(({ storeId }) => storeId).sort((a, b) => a - b),
          }
        : {}),
    }
  }

  async findById(id: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: true, storeAdmins: true },
    })

    return user ? toUserWithRoles(user) : null
  }

  async findByUsername(username: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { roles: true, storeAdmins: true },
    })

    return user ? toUserWithRoles(user) : null
  }

  async findByIdentifier(identifier: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { phone: identifier }],
        isDeleted: false,
      },
      include: { roles: true, storeAdmins: true },
    })

    return user ? toUserWithRoles(user) : null
  }

  async create(
    input: UserCreateInput,
    roles: string[] = [],
    storeIds: string[] = [],
    operatedBy = 'system',
    operatorIp?: string
  ): Promise<UserWithRoles> {
    const existing = await prisma.user.findFirst({
      where: {
        OR: [
          { username: input.username },
          ...(input.email ? [{ email: input.email }] : []),
          ...(input.phone ? [{ phone: input.phone }] : []),
        ],
      },
    })
    if (existing) {
      throw new Error(
        existing.isDeleted ? '用户账号信息已归档，请恢复原用户' : '用户账号信息已存在'
      )
    }

    const hashedPassword = await bcrypt.hash(input.password, this.saltRounds)
    const normalizedRoles = normalizeRoles(roles)
    const normalizedStoreIds = normalizeStoreIds(storeIds)

    if (normalizedStoreIds.length > 0) {
      const assignableStoreCount = await prisma.store.count({
        where: { id: { in: normalizedStoreIds }, isActive: true, isDeleted: false },
      })
      if (assignableStoreCount !== normalizedStoreIds.length) {
        throw new Error('所选门店不存在或已停用')
      }
    }

    const user = await prisma.$transaction(async (tx) => {
      const created = await tx.user.create({
        data: {
          username: input.username,
          password: hashedPassword,
          name: input.name,
          email: input.email,
          phone: input.phone,
          avatar: input.avatar,
          roles: {
            create: normalizedRoles.map((role) => ({ role })),
          },
          storeAdmins: {
            create: normalizedStoreIds.map((storeId) => ({ storeId })),
          },
        },
        include: { roles: true, storeAdmins: true },
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'USER',
          entityId: created.id,
          action: 'USER_CREATE',
          reason: '创建用户',
          afterJson: this.auditSnapshot(created),
          operatedBy,
          operatorIp,
        },
      })
      return created
    })

    return toUserWithRoles(user)
  }

  async update(
    id: string,
    input: UserUpdateInput,
    roles?: string[],
    storeIds?: string[],
    operatedBy = 'system',
    operatorIp?: string
  ): Promise<UserWithRoles> {
    const updateData: Prisma.UserUpdateInput = {}
    const normalizedRoles = roles !== undefined ? normalizeRoles(roles) : undefined
    const revokesSessions =
      input.username !== undefined ||
      input.password !== undefined ||
      input.isActive !== undefined ||
      roles !== undefined ||
      storeIds !== undefined

    if (input.username) updateData.username = input.username
    if (input.name) updateData.name = input.name
    if (input.email) updateData.email = input.email
    if (input.phone) updateData.phone = input.phone
    if (input.avatar) updateData.avatar = input.avatar
    if (input.isActive !== undefined) updateData.isActive = input.isActive
    if (input.password) {
      updateData.password = await bcrypt.hash(input.password, this.saltRounds)
    }
    if (normalizedRoles !== undefined) {
      updateData.roles = {
        deleteMany: {},
        create: normalizedRoles.map((role) => ({ role })),
      }
    }
    if (storeIds !== undefined) {
      const normalizedStoreIds = normalizeStoreIds(storeIds)
      if (normalizedStoreIds.length > 0) {
        const assignableStoreCount = await prisma.store.count({
          where: { id: { in: normalizedStoreIds }, isActive: true, isDeleted: false },
        })
        if (assignableStoreCount !== normalizedStoreIds.length) {
          throw new Error('所选门店不存在或已停用')
        }
      }
      updateData.storeAdmins = {
        deleteMany: {},
        create: normalizedStoreIds.map((storeId) => ({ storeId })),
      }
    }
    if (revokesSessions) {
      updateData.sessionVersion = { increment: 1 }
    }

    const user = await prisma.$transaction(
      async (tx) => {
        const existing = await tx.user.findUnique({
          where: { id },
          include: { roles: true, storeAdmins: true },
        })
        if (!existing || existing.isDeleted) {
          throw new Error('用户不存在')
        }

        await this.assertActiveSuperAdminContinuity(tx, id, input.isActive, normalizedRoles)
        const updated = await tx.user.update({
          where: { id },
          data: updateData,
          include: { roles: true, storeAdmins: true },
        })
        const changedFields = Object.keys(input)
        const action =
          roles === undefined &&
          storeIds === undefined &&
          changedFields.length === 1 &&
          input.isActive !== undefined
            ? 'USER_STATUS_UPDATE'
            : 'USER_UPDATE'

        await tx.approvalLog.create({
          data: {
            entityType: 'USER',
            entityId: id,
            action,
            reason:
              action === 'USER_STATUS_UPDATE'
                ? updated.isActive
                  ? '启用用户'
                  : '禁用用户'
                : '修改用户资料或权限',
            beforeJson: this.auditSnapshot(existing),
            afterJson: this.auditSnapshot(updated),
            operatedBy,
            operatorIp,
          },
        })

        return updated
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )

    return toUserWithRoles(user)
  }

  async deleteById(id: string, operatedBy = 'system', reason = '管理员删除'): Promise<void> {
    if (id === operatedBy) {
      throw new Error('不能删除自己的账号')
    }

    await prisma.$transaction(
      async (tx) => {
        const existing = await tx.user.findUnique({ where: { id } })
        if (!existing || existing.isDeleted) {
          throw new Error('用户不存在')
        }

        await this.assertActiveSuperAdminContinuity(tx, id, false)
        const deleted = await tx.user.update({
          where: { id },
          data: {
            ...softDeletionData(operatedBy, reason),
            sessionVersion: { increment: 1 },
          },
        })
        await tx.approvalLog.create({
          data: {
            entityType: 'USER',
            entityId: id,
            action: 'USER_DELETE',
            reason,
            beforeJson: this.auditSnapshot(existing),
            afterJson: this.auditSnapshot(deleted),
            operatedBy,
          },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  }

  async restoreById(
    id: string,
    newPassword: string,
    operatedBy = 'system',
    reason = '恢复归档用户'
  ): Promise<UserWithRoles> {
    const existing = await prisma.user.findUnique({ where: { id } })
    if (!existing || !existing.isDeleted) {
      throw new Error('归档用户不存在')
    }

    const password = await bcrypt.hash(newPassword, this.saltRounds)
    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.user.update({
        where: { id },
        data: {
          ...restorationData(),
          password,
          sessionVersion: { increment: 1 },
        },
        include: { roles: true, storeAdmins: true },
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'USER',
          entityId: id,
          action: 'USER_RESTORE',
          reason,
          beforeJson: this.auditSnapshot(existing),
          afterJson: this.auditSnapshot(updated),
          operatedBy,
        },
      })
      return updated
    })

    return toUserWithRoles(restored)
  }

  async findAll(options?: {
    skip?: number
    take?: number
    search?: string
  }): Promise<{ users: UserWithRoles[]; total: number }> {
    const where: Prisma.UserWhereInput = { isDeleted: false }

    if (options?.search) {
      where.OR = [
        { username: { contains: options.search, mode: 'insensitive' } },
        { name: { contains: options.search, mode: 'insensitive' } },
        { email: { contains: options.search, mode: 'insensitive' } },
        { phone: { contains: options.search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip: options?.skip,
        take: options?.take,
        orderBy: { createdAt: 'desc' },
        include: { roles: true, storeAdmins: true },
      }),
      prisma.user.count({ where }),
    ])

    return { users: users.map(toUserWithRoles), total }
  }

  async verifyPassword(identifier: string, password: string): Promise<UserWithRoles | null> {
    const user = await this.findByIdentifier(identifier)

    if (!user || !user.isActive || user.isDeleted) {
      return null
    }

    const storedUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { password: true },
    })

    if (!storedUser || !(await bcrypt.compare(password, storedUser.password))) {
      return null
    }

    return user
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const storedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, isActive: true, isDeleted: true },
    })

    if (
      !storedUser ||
      !storedUser.isActive ||
      storedUser.isDeleted ||
      !(await bcrypt.compare(oldPassword, storedUser.password))
    ) {
      return false
    }

    await prisma.user.update({
      where: { id: userId },
      data: {
        password: await bcrypt.hash(newPassword, this.saltRounds),
        sessionVersion: { increment: 1 },
      },
    })

    return true
  }

  async addRole(userId: string, role: string): Promise<void> {
    const mappedRole = normalizeRoles([role])[0]
    if (!mappedRole) throw new Error(`Invalid role: ${role}`)

    await prisma.$transaction(async (tx) => {
      const existing = await tx.userRole.findUnique({
        where: { userId_role: { userId, role: mappedRole } },
      })

      if (existing) return

      await tx.userRole.create({ data: { userId, role: mappedRole } })
      await tx.user.update({
        where: { id: userId },
        data: { sessionVersion: { increment: 1 } },
      })
    })
  }

  async removeRole(userId: string, role: string): Promise<void> {
    const mappedRole = normalizeRoles([role])[0]
    if (!mappedRole) throw new Error(`Invalid role: ${role}`)

    await prisma.$transaction(
      async (tx) => {
        if (mappedRole === UserRoleEnum.SUPER_ADMIN) {
          const currentRoles = await tx.userRole.findMany({
            where: { userId },
            select: { role: true },
          })
          await this.assertActiveSuperAdminContinuity(
            tx,
            userId,
            undefined,
            currentRoles.map((item) => item.role).filter((item) => item !== mappedRole)
          )
        }

        const deleted = await tx.userRole.deleteMany({
          where: { userId, role: mappedRole },
        })

        if (deleted.count > 0) {
          await tx.user.update({
            where: { id: userId },
            data: { sessionVersion: { increment: 1 } },
          })
        }
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  }

  async setRoles(userId: string, roles: string[]): Promise<void> {
    const normalizedRoles = normalizeRoles(roles)

    await prisma.$transaction(
      async (tx) => {
        await this.assertActiveSuperAdminContinuity(tx, userId, undefined, normalizedRoles)
        await tx.user.update({
          where: { id: userId },
          data: {
            sessionVersion: { increment: 1 },
            roles: {
              deleteMany: {},
              create: normalizedRoles.map((role) => ({ role })),
            },
          },
        })
      },
      { isolationLevel: Prisma.TransactionIsolationLevel.Serializable }
    )
  }

  async addStoreAdmin(userId: string, storeId: string): Promise<void> {
    const storeIdInt = Number.parseInt(storeId, 10)
    const existing = await prisma.storeAdmin.findUnique({
      where: { userId_storeId: { userId, storeId: storeIdInt } },
    })

    if (existing) {
      throw new Error('用户已经是该门店的管理员')
    }

    await prisma.storeAdmin.create({ data: { userId, storeId: storeIdInt } })
  }

  async removeStoreAdmin(userId: string, storeId: string): Promise<void> {
    await prisma.storeAdmin.deleteMany({
      where: { userId, storeId: Number.parseInt(storeId, 10) },
    })
  }

  async getUserStores(userId: string): Promise<Array<{ id: string; code: string; name: string }>> {
    const storeAdmins = await prisma.storeAdmin.findMany({
      where: { userId },
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

    return storeAdmins
      .filter((storeAdmin) => storeAdmin.store.isActive && !storeAdmin.store.isDeleted)
      .map((storeAdmin) => ({
        id: String(storeAdmin.store.id),
        code: storeAdmin.store.code,
        name: storeAdmin.store.name,
      }))
  }
}

export const userService = new UserService()
