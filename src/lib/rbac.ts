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

export const MOBILE_ACCESS_ROLES: UserRole[] = [
  'super_admin',
  'warehouse_manager',
  'store_admin',
  'approver',
]

/**
 * 路由类型
 */
export type RouteType = 'admin' | 'mobile' | 'api' | 'public'

/**
 * 公开路由（不需要认证）
 */
export const PUBLIC_API_ROUTES = [
  '/api/health',
  '/api/auth/login',
  '/api/auth/logout',
  '/api/auth/refresh',
  '/api/auth/session',
]

export const ADMIN_API_ROUTES = [
  '/api/users',
  '/api/ordering-schedule',
  '/api/reports/inventory',
  '/api/reports/stock-out',
]

export const MOBILE_API_ROUTES = [
  '/api/dashboard',
  '/api/stores/user',
  '/api/containers',
  '/api/ordering-schedule/status',
]

export const PUBLIC_ROUTES = ['/', '/login', ...PUBLIC_API_ROUTES]

/**
 * 路由前缀映射
 */
export const ROUTE_PREFIXES = {
  admin: '/admin',
  mobile: '/mobile',
}

type ApiPermissionType = 'public' | 'admin' | 'mobile'

function matchesRouteOrChild(pathname: string, route: string): boolean {
  return pathname === route || pathname.startsWith(`${route}/`)
}

function getApiPermissionType(pathname: string): ApiPermissionType | null {
  if (PUBLIC_API_ROUTES.includes(pathname)) {
    return 'public'
  }

  if (MOBILE_API_ROUTES.some((route) => matchesRouteOrChild(pathname, route))) {
    return 'mobile'
  }

  if (ADMIN_API_ROUTES.some((route) => matchesRouteOrChild(pathname, route))) {
    return 'admin'
  }

  return null
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
    if (route.startsWith('/api/')) {
      return pathname === route
    }
    return matchesRouteOrChild(pathname, route)
  })
}

/**
 * 获取路由类型
 * @param pathname 路径
 * @returns 路由类型
 */
export function getRouteType(pathname: string): RouteType | null {
  if (isPublicRoute(pathname)) {
    return 'public'
  }
  if (pathname.startsWith(ROUTE_PREFIXES.admin)) {
    return 'admin'
  }
  if (pathname.startsWith(ROUTE_PREFIXES.mobile)) {
    return 'mobile'
  }
  if (pathname.startsWith('/api')) {
    return 'api'
  }
  return null
}

/**
 * 检查用户角色是否有权限访问指定路径
 * @param role 用户角色（单个角色或角色数组）
 * @param pathname 路径
 * @returns 是否有权限
 */
export function hasPermission(role: UserRole | UserRole[], pathname: string): boolean {
  // 支持多角色：只要有一个角色有权限就允许访问
  const roles = Array.isArray(role) ? role : [role]

  const routeType = getRouteType(pathname)

  // 公开路由所有人都可以访问
  if (routeType === 'public') {
    return true
  }

  const apiPermissionType = routeType === 'api' ? getApiPermissionType(pathname) : null
  if (routeType === 'api' && apiPermissionType === null) {
    return false
  }

  // 检查是否有任何角色具有访问权限
  for (const r of roles) {
    const permissions = ROLE_PERMISSIONS[r]
    if (!permissions) {
      continue
    }

    switch (routeType) {
      case 'admin':
        if (permissions.canAccessAdmin) return true
        break
      case 'mobile':
        if (permissions.canAccessMobile) return true
        break
      case 'api':
        if (apiPermissionType === 'admin' && permissions.canAccessAdmin) return true
        if (
          apiPermissionType === 'mobile' &&
          (permissions.canAccessMobile || permissions.canAccessAdmin)
        ) {
          return true
        }
        if (apiPermissionType === 'public') return true
        break
    }
  }

  return false
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
 * @param role 用户角色（单个角色或角色数组）
 * @param attemptedPath 尝试访问的路径
 * @returns 重定向路由
 */
export function getRedirectRoute(role: UserRole | UserRole[], attemptedPath: string): string {
  // 如果用户有权限访问，则返回原路径
  if (hasPermission(role, attemptedPath)) {
    return attemptedPath
  }

  // 支持多角色
  const roles = Array.isArray(role) ? role : [role]
  const routeType = getRouteType(attemptedPath)

  // 如果用户试图访问 admin 但没有权限，检查是否有 mobile 权限
  if (routeType === 'admin') {
    for (const r of roles) {
      const permissions = ROLE_PERMISSIONS[r]
      if (permissions && permissions.canAccessMobile) {
        return ROUTE_PREFIXES.mobile
      }
    }
  }

  // 如果用户试图访问 mobile 但没有权限，检查是否有 admin 权限
  if (routeType === 'mobile') {
    for (const r of roles) {
      const permissions = ROLE_PERMISSIONS[r]
      if (permissions && permissions.canAccessAdmin) {
        return ROUTE_PREFIXES.admin
      }
    }
  }

  // 智能选择默认路由：优先选择 admin 权限的角色，因为 admin 权限更高
  // 如果没有 admin 权限，再选择 mobile 权限的角色
  for (const r of roles) {
    const permissions = ROLE_PERMISSIONS[r]
    if (permissions && permissions.canAccessAdmin) {
      return getDefaultRoute(r)
    }
  }

  for (const r of roles) {
    const permissions = ROLE_PERMISSIONS[r]
    if (permissions && permissions.canAccessMobile) {
      return getDefaultRoute(r)
    }
  }

  // 兜底：返回第一个角色的默认路由
  return getDefaultRoute(roles[0] as UserRole)
}
