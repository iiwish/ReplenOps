import type { UserRole } from '@/types'

/**
 * 角色权限配置
 * 定义每个角色可以访问的路由前缀
 */
export const ROLE_PERMISSIONS: Record<
  UserRole,
  {
    canAccessAdmin: boolean
    canAccessMobile: boolean
    defaultRoute: string
  }
> = {
  super_admin: {
    canAccessAdmin: true,
    canAccessMobile: true,
    defaultRoute: '/admin',
  },
  warehouse_manager: {
    canAccessAdmin: true,
    canAccessMobile: true,
    defaultRoute: '/admin',
  },
  store_admin: {
    canAccessAdmin: false,
    canAccessMobile: true,
    defaultRoute: '/mobile',
  },
  finance: {
    canAccessAdmin: true,
    canAccessMobile: false,
    defaultRoute: '/admin',
  },
  approver: {
    canAccessAdmin: true,
    canAccessMobile: true,
    defaultRoute: '/admin',
  },
}

/**
 * 路由类型
 */
export type RouteType = 'admin' | 'mobile' | 'public'

/**
 * 公开路由（不需要认证）
 */
export const PUBLIC_ROUTES = ['/login', '/api/auth', '/']

/**
 * 路由前缀映射
 */
export const ROUTE_PREFIXES = {
  admin: '/admin',
  mobile: '/mobile',
}

/**
 * 判断路径是否为公开路由
 * @param pathname 路径
 * @returns 是否为公开路由
 */
export function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some((route) => {
    if (route === '/') {
      return pathname === '/'
    }
    return pathname.startsWith(route)
  })
}

/**
 * 获取路由类型
 * @param pathname 路径
 * @returns 路由类型
 */
export function getRouteType(pathname: string): RouteType | null {
  if (pathname.startsWith(ROUTE_PREFIXES.admin)) {
    return 'admin'
  }
  if (pathname.startsWith(ROUTE_PREFIXES.mobile)) {
    return 'mobile'
  }
  if (isPublicRoute(pathname)) {
    return 'public'
  }
  return null
}

/**
 * 检查用户角色是否有权限访问指定路径
 * @param role 用户角色
 * @param pathname 路径
 * @returns 是否有权限
 */
export function hasPermission(role: UserRole, pathname: string): boolean {
  const permissions = ROLE_PERMISSIONS[role]
  if (!permissions) {
    return false
  }

  const routeType = getRouteType(pathname)

  switch (routeType) {
    case 'public':
      return true
    case 'admin':
      return permissions.canAccessAdmin
    case 'mobile':
      return permissions.canAccessMobile
    default:
      return false
  }
}

/**
 * 获取角色的默认路由
 * @param role 用户角色
 * @returns 默认路由
 */
export function getDefaultRoute(role: UserRole): string {
  return ROLE_PERMISSIONS[role]?.defaultRoute || '/login'
}

/**
 * 获取用户应该被重定向到的路由
 * 当用户访问无权限的路由时，将其重定向到合适的页面
 * @param role 用户角色
 * @param attemptedPath 尝试访问的路径
 * @returns 重定向路由
 */
export function getRedirectRoute(
  role: UserRole,
  attemptedPath: string
): string {
  const permissions = ROLE_PERMISSIONS[role]
  const routeType = getRouteType(attemptedPath)

  // 如果用户有权限访问，则返回原路径
  if (hasPermission(role, attemptedPath)) {
    return attemptedPath
  }

  // 如果用户试图访问 admin 但没有权限，且有 mobile 权限，则重定向到 mobile
  if (routeType === 'admin' && !permissions.canAccessAdmin) {
    if (permissions.canAccessMobile) {
      return ROUTE_PREFIXES.mobile
    }
  }

  // 如果用户试图访问 mobile 但没有权限，且有 admin 权限，则重定向到 admin
  if (routeType === 'mobile' && !permissions.canAccessMobile) {
    if (permissions.canAccessAdmin) {
      return ROUTE_PREFIXES.admin
    }
  }

  // 默认返回用户的默认路由
  return getDefaultRoute(role)
}
