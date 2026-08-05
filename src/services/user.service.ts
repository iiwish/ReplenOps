import bcrypt from 'bcryptjs'
import { Prisma, UserRoleEnum } from '@prisma/client'
import { prisma } from '@/lib/prisma'

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
}

type UserRecordWithRoles = Prisma.UserGetPayload<{ include: { roles: true } }>

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

function toUserWithRoles(user: UserRecordWithRoles): UserWithRoles {
  return {
    id: user.id,
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
  }
}

export class UserService {
  private readonly saltRounds = 10

  async findById(id: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    })

    return user ? toUserWithRoles(user) : null
  }

  async findByUsername(username: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { roles: true },
    })

    return user ? toUserWithRoles(user) : null
  }

  async findByIdentifier(identifier: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { phone: identifier }],
        isDeleted: false,
      },
      include: { roles: true },
    })

    return user ? toUserWithRoles(user) : null
  }

  async create(input: UserCreateInput, roles: string[] = []): Promise<UserWithRoles> {
    const hashedPassword = await bcrypt.hash(input.password, this.saltRounds)
    const normalizedRoles = normalizeRoles(roles)

    const user = await prisma.user.create({
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
      },
      include: { roles: true },
    })

    return toUserWithRoles(user)
  }

  async update(id: string, input: UserUpdateInput, roles?: string[]): Promise<UserWithRoles> {
    const updateData: Prisma.UserUpdateInput = {}
    const revokesSessions =
      input.username !== undefined ||
      input.password !== undefined ||
      input.isActive !== undefined ||
      roles !== undefined

    if (input.username) updateData.username = input.username
    if (input.name) updateData.name = input.name
    if (input.email) updateData.email = input.email
    if (input.phone) updateData.phone = input.phone
    if (input.avatar) updateData.avatar = input.avatar
    if (input.isActive !== undefined) updateData.isActive = input.isActive
    if (input.password) {
      updateData.password = await bcrypt.hash(input.password, this.saltRounds)
    }
    if (roles !== undefined) {
      const normalizedRoles = normalizeRoles(roles)
      updateData.roles = {
        deleteMany: {},
        create: normalizedRoles.map((role) => ({ role })),
      }
    }
    if (revokesSessions) {
      updateData.sessionVersion = { increment: 1 }
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { roles: true },
    })

    return toUserWithRoles(user)
  }

  async deleteById(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: {
        isDeleted: true,
        sessionVersion: { increment: 1 },
      },
    })
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
        include: { roles: true },
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

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.userRole.deleteMany({
        where: { userId, role: mappedRole },
      })

      if (deleted.count > 0) {
        await tx.user.update({
          where: { id: userId },
          data: { sessionVersion: { increment: 1 } },
        })
      }
    })
  }

  async setRoles(userId: string, roles: string[]): Promise<void> {
    const normalizedRoles = normalizeRoles(roles)

    await prisma.user.update({
      where: { id: userId },
      data: {
        sessionVersion: { increment: 1 },
        roles: {
          deleteMany: {},
          create: normalizedRoles.map((role) => ({ role })),
        },
      },
    })
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
