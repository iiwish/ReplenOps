import { redirect as nextRedirect } from 'next/navigation'
import type { Route } from 'next'
import { getCurrentUser, getUserRoles, getUserRole } from './session'
import type { UserRole } from '@/types'
import { hasPermission, getRedirectRoute } from './rbac'

// 包装 redirect 以避免类型检查问题
function redirect(url: string): never {
  return nextRedirect(url as Route)
}

type RuntimeEnv = {
  NODE_ENV?: string
  APP_ENV?: string
  DEV_MODE_BYPASS?: string
}

function isProtectedRuntime(env: RuntimeEnv = process.env): boolean {
  return env.NODE_ENV === 'production' || env.APP_ENV === 'production' || env.APP_ENV === 'preview'
}

export function isDevBypassAllowed(env: RuntimeEnv = process.env): boolean {
  const appEnv = env.APP_ENV
  return (
    env.DEV_MODE_BYPASS === 'true' &&
    env.NODE_ENV !== 'production' &&
    (appEnv === undefined || appEnv === '' || appEnv === 'local') &&
    !isProtectedRuntime(env)
  )
}

/**
 * 检查是否处于开发模式（允许绕过权限检查）
 * @param searchParams 可选的搜索参数字符串（服务器端传递），默认从window获取（客户端）
 * @returns {boolean} 如果处于开发模式返回true
 */
export function isDevBypassMode(
  searchParams?: string,
  env: RuntimeEnv = process.env
): boolean {
  if (isProtectedRuntime(env)) {
    return false
  }

  // 开发模式绕过检查 - 检查是否从URL参数中传递了dev=bypass（用于测试）
  if (searchParams !== undefined) {
    const params = new URLSearchParams(searchParams)
    if (params.get('dev') === 'bypass') {
      return true
    }
  } else if (typeof window !== 'undefined') {
    const urlParams = new URLSearchParams(window.location.search)
    if (urlParams.get('dev') === 'bypass') {
      return true
    }
  }
  return false
}

/**
 * 获取开发模式bypass的用户（如果启用bypass但没有用户）
 * 用于测试环境自动创建一个虚拟用户
 */
async function getDevBypassUser(): Promise<{
  id: string
  username: string
  name: string | null
  email: string | null
  phone: string | null
  avatar: string | null
  isActive: boolean
  roles: string[]
  displayName?: string
} | null> {
  if (isDevBypassAllowed() || isDevBypassMode()) {
    return {
      id: 'dev-bypass-user',
      username: 'admin',
      name: '开发测试管理员',
      email: 'admin@test.local',
      phone: null,
      avatar: null,
      isActive: true,
      roles: ['ADMIN'],
      displayName: '开发测试管理员',
    }
  }
  return null
}

// 返回类型定义
type PageAccessResult = {
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
  role: UserRole | null
  roles: UserRole[]
}

/**
 * 检查当前用户是否有权限访问指定路径
 * 如果没有权限，自动重定向到合适的页面
 *
 * @param pathname 要检查的路径
 * @returns {Promise<PageAccessResult>}
 * @throws 如果没有权限，会抛出 redirect 错误
 */
export async function requirePageAccess(pathname: string): Promise<PageAccessResult> {
  // 开发模式绕过检查 - 如果启用bypass但没有真实用户，使用虚拟用户
  if (isDevBypassAllowed() || isDevBypassMode()) {
    let user = await getCurrentUser()
    if (!user) {
      // 尝试获取开发模式虚拟用户
      const bypassUser = await getDevBypassUser()
      if (bypassUser) {
        user = bypassUser as NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
      } else {
        redirect(`/login?redirect=${encodeURIComponent(pathname)}`)
      }
    }
    const roles = getUserRoles(user)
    return {
      user,
      role: getUserRole(user),
      roles,
    }
  }

  // 获取当前用户
  const user = await getCurrentUser()
  if (!user) {
    // 未登录，重定向到登录页
    redirect(`/login?redirect=${encodeURIComponent(pathname)}`)
  }

  // 获取用户所有角色（支持多角色）
  const roles = getUserRoles(user)
  if (roles.length === 0) {
    // 没有有效角色，显示错误页面
    redirect(`/error?message=${encodeURIComponent('User does not have a valid role assigned')}`)
  }

  // 检查权限（支持多角色：只要有一个角色有权限就允许）
  if (!hasPermission(roles, pathname)) {
    // 没有权限，重定向到合适的页面
    const redirectPath = getRedirectRoute(roles, pathname)
    redirect(redirectPath)
  }

  // 返回用户信息和角色：role 返回主要角色
  return {
    user,
    role: getUserRole(user),
    roles,
  }
}

/**
 * 检查当前用户是否有指定角色
 *
 * @param allowedRoles 允许的角色列表
 * @param redirectPath 没有权限时的重定向路径（可选）
 * @returns {Promise<{ user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>; role: UserRole; roles: UserRole[] }>}
 * @throws 如果没有权限，会抛出 redirect 错误
 */
export async function requireRoles(
  allowedRoles: UserRole[],
  redirectPath?: string
): Promise<{
  user: NonNullable<Awaited<ReturnType<typeof getCurrentUser>>>
  role: UserRole
  roles: UserRole[]
}> {
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  // 获取用户所有角色（支持多角色）
  const roles = getUserRoles(user)

  // 检查是否有任何角色在允许列表中
  const hasAllowedRole = roles.some((r: UserRole) => allowedRoles.includes(r))

  if (roles.length === 0 || !hasAllowedRole) {
    if (redirectPath) {
      redirect(redirectPath)
    } else {
      redirect(`/error?message=${encodeURIComponent('Insufficient permissions')}`)
    }
  }

  // 返回用户信息和角色：role 返回主要角色
  const role = getUserRole(user)
  return {
    user,
    role: role as UserRole,
    roles,
  }
}
