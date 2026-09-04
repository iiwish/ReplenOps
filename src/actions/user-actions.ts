'use server'

import { revalidatePath } from 'next/cache'
import { headers } from 'next/headers'
import { z } from 'zod'
import { userService, type UserWithRoles } from '@/services/user.service'
import { getCurrentUser, getUserRoles } from '@/lib/session.server'
import { userListSchema, userCreateSchema, userUpdateSchema } from '@/types/user.types'
import type { UserListInput, UserCreateInput, UserUpdateInput } from '@/types/user.types'
import { getLoginClientAddress } from '@/services/auth-rate-limit.service'

interface ActionResponse<T = unknown> {
  success: boolean
  message?: string
  data?: T
  error?: string
}

const changePasswordSchema = z
  .object({
    oldPassword: z.string().min(1, '请输入当前密码').max(100, '密码最多100个字符'),
    newPassword: z.string().min(6, '新密码至少6个字符').max(100, '密码最多100个字符'),
    confirmPassword: z.string().min(1, '请确认新密码').max(100, '密码最多100个字符'),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: '两次输入的新密码不一致',
    path: ['confirmPassword'],
  })
  .refine((data) => data.oldPassword !== data.newPassword, {
    message: '新密码不能与当前密码相同',
    path: ['newPassword'],
  })

export async function changeCurrentUserPassword(input: unknown): Promise<ActionResponse> {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return { success: false, error: '未登录' }
    }

    const validated = changePasswordSchema.parse(input)
    const changed = await userService.changePassword(
      currentUser.id,
      validated.oldPassword,
      validated.newPassword
    )

    if (!changed) {
      return { success: false, error: '当前密码不正确' }
    }

    return { success: true, message: '密码修改成功' }
  } catch (error) {
    if (error instanceof z.ZodError) {
      const firstIssue = error.issues[0]
      return { success: false, error: firstIssue?.message || '密码格式不正确' }
    }

    console.error('修改密码失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '修改密码失败',
    }
  }
}

export interface PaginatedUserResult {
  data: UserWithRoles[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

export async function listUsers(
  input: UserListInput
): Promise<ActionResponse<PaginatedUserResult>> {
  try {
    const user = await getCurrentUser()

    if (!user) {
      return { success: false, error: '未登录' }
    }

    const roles = getUserRoles(user)
    const isSuperAdmin = roles.includes('super_admin')

    if (!isSuperAdmin) {
      return { success: false, error: '权限不足' }
    }

    const validated = userListSchema.parse(input)
    const { page, pageSize, search } = validated
    const skip = (page - 1) * pageSize

    const { users, total } = await userService.findAll({
      skip,
      take: pageSize,
      search,
    })

    return {
      success: true,
      data: {
        data: users,
        total,
        page,
        pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    }
  } catch (error) {
    console.error('查询用户列表失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '查询用户列表失败',
    }
  }
}

export async function createUser(input: UserCreateInput): Promise<ActionResponse<UserWithRoles>> {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return { success: false, error: '未登录' }
    }

    const roles = getUserRoles(currentUser)
    const isSuperAdmin = roles.includes('super_admin')

    if (!isSuperAdmin) {
      return { success: false, error: '权限不足' }
    }

    const validated = userCreateSchema.parse(input)

    const cleanData: {
      username: string
      password: string
      name?: string
      email?: string
      phone?: string
    } = {
      username: validated.username,
      password: validated.password,
    }

    if (validated.name) cleanData.name = validated.name
    if (validated.email) cleanData.email = validated.email
    if (validated.phone) cleanData.phone = validated.phone

    const newUser = await userService.create(
      cleanData,
      validated.roles,
      validated.storeIds,
      currentUser.id,
      getLoginClientAddress(await headers())
    )

    revalidatePath('/admin/users')

    return {
      success: true,
      message: '用户创建成功',
      data: newUser,
    }
  } catch (error) {
    console.error('创建用户失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '创建用户失败',
    }
  }
}

export async function updateUser(
  userId: string,
  input: UserUpdateInput
): Promise<ActionResponse<UserWithRoles>> {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return { success: false, error: '未登录' }
    }

    const roles = getUserRoles(currentUser)
    const isSuperAdmin = roles.includes('super_admin')

    if (!isSuperAdmin) {
      return { success: false, error: '权限不足' }
    }

    const validated = userUpdateSchema.parse(input)

    if (userId === currentUser.id && validated.isActive === false) {
      return { success: false, error: '不能禁用自己的账号' }
    }

    const cleanData: {
      username?: string
      password?: string
      name?: string
      email?: string
      phone?: string
      isActive?: boolean
    } = {}

    if (validated.username) cleanData.username = validated.username
    if (validated.password && validated.password.length > 0) {
      cleanData.password = validated.password
    }
    if (validated.name) cleanData.name = validated.name
    if (validated.email) cleanData.email = validated.email
    if (validated.phone) cleanData.phone = validated.phone
    if (validated.isActive !== undefined) cleanData.isActive = validated.isActive

    const updatedUser = await userService.update(
      userId,
      cleanData,
      validated.roles,
      validated.storeIds,
      currentUser.id,
      getLoginClientAddress(await headers())
    )

    revalidatePath('/admin/users')

    return {
      success: true,
      message: '用户更新成功',
      data: updatedUser,
    }
  } catch (error) {
    console.error('更新用户失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '更新用户失败',
    }
  }
}

export async function deleteUser(userId: string): Promise<ActionResponse> {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return { success: false, error: '未登录' }
    }

    const roles = getUserRoles(currentUser)
    const isSuperAdmin = roles.includes('super_admin')

    if (!isSuperAdmin) {
      return { success: false, error: '权限不足' }
    }

    if (userId === currentUser.id) {
      return { success: false, error: '不能删除自己' }
    }

    await userService.deleteById(userId, currentUser.id)

    revalidatePath('/admin/users')

    return { success: true, message: '用户删除成功' }
  } catch (error) {
    console.error('删除用户失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '删除用户失败',
    }
  }
}

export async function toggleUserStatus(userId: string): Promise<ActionResponse<UserWithRoles>> {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return { success: false, error: '未登录' }
    }

    const roles = getUserRoles(currentUser)
    const isSuperAdmin = roles.includes('super_admin')

    if (!isSuperAdmin) {
      return { success: false, error: '权限不足' }
    }

    const existingUser = await userService.findById(userId)

    if (!existingUser) {
      return { success: false, error: '用户不存在' }
    }

    if (userId === currentUser.id && existingUser.isActive) {
      return { success: false, error: '不能禁用自己的账号' }
    }

    const updatedUser = await userService.update(
      userId,
      { isActive: !existingUser.isActive },
      undefined,
      undefined,
      currentUser.id,
      getLoginClientAddress(await headers())
    )

    revalidatePath('/admin/users')

    return {
      success: true,
      message: updatedUser.isActive ? '用户已启用' : '用户已禁用',
      data: updatedUser,
    }
  } catch (error) {
    console.error('切换用户状态失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '切换用户状态失败',
    }
  }
}

export async function getUserById(userId: string): Promise<ActionResponse<UserWithRoles>> {
  try {
    const currentUser = await getCurrentUser()

    if (!currentUser) {
      return { success: false, error: '未登录' }
    }

    const roles = getUserRoles(currentUser)
    const isSuperAdmin = roles.includes('super_admin')

    if (!isSuperAdmin) {
      return { success: false, error: '权限不足' }
    }

    const user = await userService.findById(userId)

    if (!user) {
      return { success: false, error: '用户不存在' }
    }

    return { success: true, data: user }
  } catch (error) {
    console.error('获取用户详情失败:', error)
    return {
      success: false,
      error: error instanceof Error ? error.message : '获取用户详情失败',
    }
  }
}
