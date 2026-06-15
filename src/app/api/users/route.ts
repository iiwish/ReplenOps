import { NextRequest, NextResponse } from 'next/server'
import { userService, type UserUpdateInput } from '@/services/user.service'
import { getUserRoles, requireAuth } from '@/lib/session'
import { hasPermission } from '@/lib/rbac'
import { z } from 'zod'

const userUpdateSchema = z.object({
  username: z.string().min(3, '用户名至少3个字符').max(50, '用户名最多50个字符').optional(),
  password: z.string().min(6, '密码至少6个字符').max(100, '密码最多100个字符').optional(),
  name: z.string().min(1, '姓名不能为空').max(100, '姓名最多100个字符').optional(),
  email: z.string().email('邮箱格式不正确').optional(),
  phone: z
    .string()
    .regex(/^1[3-9]\d{9}$/, '手机号格式不正确')
    .optional(),
  avatar: z.string().url('头像 URL 格式不正确').optional(),
  isActive: z.boolean().optional(),
})

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth()
    const roles = getUserRoles(user)

    if (!hasPermission(roles, '/api/users')) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 })
    }

    const { search, skip, take } = Object.fromEntries(request.nextUrl.searchParams.entries())

    const skipNum = parseInt(skip || '0')
    const takeNum = Math.min(parseInt(take || '20'), 100)

    const { users, total } = await userService.findAll({
      skip: skipNum,
      take: takeNum,
      search: search,
    })

    return NextResponse.json({
      success: true,
      users,
      total,
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ success: false, error: '获取用户列表失败' }, { status: 500 })
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const user = await requireAuth()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const userId = searchParams.userId as string

    if (!userId) {
      return NextResponse.json({ success: false, error: '缺少用户ID' }, { status: 400 })
    }

    const body = await request.json()
    const result = userUpdateSchema.safeParse(body)

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: '参数验证失败', details: result.error.format() },
        { status: 400 }
      )
    }

    const roles = getUserRoles(user)

    if (!hasPermission(roles, '/api/users')) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 })
    }

    const userData = result.data as UserUpdateInput

    const updatedUser = await userService.update(userId, userData)

    return NextResponse.json({
      success: true,
      user: updatedUser,
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ success: false, error: '更新用户失败' }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth()

    const searchParams = Object.fromEntries(request.nextUrl.searchParams.entries())
    const userId = searchParams.userId as string

    if (!userId) {
      return NextResponse.json({ success: false, error: '缺少用户ID' }, { status: 400 })
    }

    const roles = getUserRoles(user)

    if (!roles.includes('super_admin')) {
      return NextResponse.json({ success: false, error: '权限不足' }, { status: 403 })
    }

    await userService.deleteById(userId)

    return NextResponse.json({
      success: true,
      message: '用户已删除',
    })
  } catch (error) {
    console.error('Error deleting user:', error)
    return NextResponse.json({ success: false, error: '删除用户失败' }, { status: 500 })
  }
}
