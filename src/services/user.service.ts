import { prisma } from '@/lib/prisma'
import { Prisma, UserRoleEnum } from '@prisma/client'
import bcrypt from 'bcryptjs'

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

export class UserService {
  private saltRounds = 10

  async findById(id: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { id },
      include: { roles: true },
    })

    if (!user) return null

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
      roles: user.roles.map((r) => r.role),
    }
  }

  async findByUsername(username: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { roles: true },
    })

    if (!user) return null

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
      roles: user.roles.map((r) => r.role),
    }
  }

  async findByIdentifier(identifier: string): Promise<UserWithRoles | null> {
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: identifier }, { phone: identifier }],
        isDeleted: false,
      },
      include: { roles: true },
    })

    if (!user) return null

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
      roles: user.roles.map((r) => r.role),
    }
  }

  async create(input: UserCreateInput): Promise<UserWithRoles> {
    const hashedPassword = await bcrypt.hash(input.password, this.saltRounds)

    const user = await prisma.user.create({
      data: {
        username: input.username,
        password: hashedPassword,
        name: input.name,
        email: input.email,
        phone: input.phone,
        avatar: input.avatar,
      },
      include: { roles: true },
    })

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
      roles: user.roles.map((r) => r.role),
    }
  }

  async update(id: string, input: UserUpdateInput): Promise<UserWithRoles> {
    const updateData: Prisma.UserUpdateInput = {}

    if (input.username) updateData.username = input.username
    if (input.name) updateData.name = input.name
    if (input.email) updateData.email = input.email
    if (input.phone) updateData.phone = input.phone
    if (input.avatar) updateData.avatar = input.avatar
    if (input.isActive !== undefined) updateData.isActive = input.isActive
    if (input.password) {
      updateData.password = await bcrypt.hash(input.password, this.saltRounds)
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: { roles: true },
    })

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
      roles: user.roles.map((r) => r.role),
    }
  }

  async deleteById(id: string): Promise<void> {
    await prisma.user.update({
      where: { id },
      data: { isDeleted: true },
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

    const result = users.map((user) => ({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      avatar: user.avatar,
      isActive: user.isActive,
      isDeleted: user.isDeleted,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
      roles: user.roles.map((r) => r.role),
    }))

    return { users: result, total }
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

    if (!storedUser) return null

    const isValid = await bcrypt.compare(password, storedUser.password)

    if (!isValid) return null

    return user
  }

  async changePassword(userId: string, oldPassword: string, newPassword: string): Promise<boolean> {
    const storedUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true, isActive: true, isDeleted: true },
    })

    if (!storedUser || !storedUser.isActive || storedUser.isDeleted) {
      return false
    }

    const isValid = await bcrypt.compare(oldPassword, storedUser.password)

    if (!isValid) return false

    const hashedPassword = await bcrypt.hash(newPassword, this.saltRounds)

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    })

    return true
  }

  async addRole(userId: string, role: string): Promise<void> {
    const roleMapping: Record<string, UserRoleEnum> = {
      super_admin: 'SUPER_ADMIN',
      warehouse_manager: 'WAREHOUSE_MANAGER',
      store_admin: 'STORE_ADMIN',
    }

    const mappedRole = roleMapping[role.toLowerCase()]

    if (!mappedRole) {
      throw new Error(`Invalid role: ${role}`)
    }

    const existing = await prisma.userRole.findUnique({
      where: { userId_role: { userId, role: mappedRole } },
    })

    if (existing) return

    await prisma.userRole.create({
      data: {
        userId,
          role: mappedRole,
      },
    })
  }

  async removeRole(userId: string, role: string): Promise<void> {
    const roleMapping: Record<string, UserRoleEnum> = {
      super_admin: 'SUPER_ADMIN',
      warehouse_manager: 'WAREHOUSE_MANAGER',
      store_admin: 'STORE_ADMIN',
    }

    const mappedRole = roleMapping[role.toLowerCase()]

    if (!mappedRole) {
      throw new Error(`Invalid role: ${role}`)
    }

    await prisma.userRole.deleteMany({
      where: {
        userId,
        role: mappedRole,
      },
    })
  }

  async setRoles(userId: string, roles: string[]): Promise<void> {
    await prisma.$transaction(async (tx) => {
      await tx.userRole.deleteMany({ where: { userId } })

      const roleMapping: Record<string, UserRoleEnum> = {
        super_admin: 'SUPER_ADMIN',
        warehouse_manager: 'WAREHOUSE_MANAGER',
        store_admin: 'STORE_ADMIN',
      }

      for (const role of roles) {
        const mappedRole = roleMapping[role.toLowerCase()]

        if (!mappedRole) continue

        await tx.userRole.create({
          data: {
            userId,
            role: mappedRole,
          },
        })
      }
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

    await prisma.storeAdmin.create({
      data: {
        userId,
        storeId: storeIdInt,
      },
    })
  }

  async removeStoreAdmin(userId: string, storeId: string): Promise<void> {
    const storeIdInt = Number.parseInt(storeId, 10)

    await prisma.storeAdmin.deleteMany({
      where: {
        userId,
        storeId: storeIdInt,
      },
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
      .filter((sa) => sa.store.isActive && !sa.store.isDeleted)
      .map((sa) => ({
        id: String(sa.store.id),
        code: sa.store.code,
        name: sa.store.name,
      }))
  }
}

export const userService = new UserService()
