import { NextRequest, NextResponse } from 'next/server'
import type { AuthUser } from '@/lib/auth'
import type { UserRole } from '@/types'
import { verifyToken, refreshAccessToken } from '@/lib/auth-edge'
import { isPublicRoute, hasPermission, getRedirectRoute } from '@/lib/rbac'
import {
  createDomainRoutingConfig,
  getCookieDomain,
  getCrossDomainRedirectUrl,
  getPathWithSearch,
  getRootRedirectPath,
  type DomainRoutingConfig,
} from '@/lib/domain-routing'

function getSessionCookieOptions(config: DomainRoutingConfig) {
  const domain = getCookieDomain(config)
  return {
    maxAge: 7 * 24 * 60 * 60,
    path: '/',
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax' as const,
    ...(domain ? { domain } : {}),
  }
}

function redirectToLogin(request: NextRequest) {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', getPathWithSearch(request.nextUrl))
  return NextResponse.redirect(loginUrl)
}

function getLoginPath(request: NextRequest): string {
  const loginUrl = new URL('/login', request.url)
  loginUrl.searchParams.set('redirect', getPathWithSearch(request.nextUrl))
  return `${loginUrl.pathname}${loginUrl.search}`
}

function isApiRequest(pathname: string): boolean {
  return pathname.startsWith('/api')
}

function authRequiredResponse(request: NextRequest) {
  if (request.headers.has('next-action')) {
    return new NextResponse(null, {
      status: 200,
      headers: {
        'content-type': 'text/plain; charset=utf-8',
        'x-action-redirect': `${getLoginPath(request)};replace`,
      },
    })
  }

  if (isApiRequest(request.nextUrl.pathname)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  return redirectToLogin(request)
}

function registerDisabledResponse() {
  return NextResponse.json({ success: false, error: '注册接口不可用' }, { status: 404 })
}

function getAccessToken(request: NextRequest): string | undefined {
  return request.cookies.get('replenops_access_token')?.value
}

function getRefreshToken(request: NextRequest): string | undefined {
  return request.cookies.get('replenops_refresh_token')?.value
}

function getExpiresAt(request: NextRequest): number | undefined {
  const expiresAt = request.cookies.get('replenops_expires_at')?.value
  return expiresAt ? parseInt(expiresAt, 10) : undefined
}

type RefreshedToken = NonNullable<Awaited<ReturnType<typeof refreshAccessToken>>>

function getRefreshedRequestHeaders(
  request: NextRequest,
  refreshedToken: RefreshedToken,
  expiresAt: number
): Headers {
  const requestHeaders = new Headers(request.headers)
  const requestCookies = new Map(
    request.cookies.getAll().map((cookie) => [cookie.name, cookie.value] as const)
  )

  requestCookies.set('replenops_access_token', refreshedToken.access_token)
  if (refreshedToken.refresh_token) {
    requestCookies.set('replenops_refresh_token', refreshedToken.refresh_token)
  }
  requestCookies.set('replenops_expires_at', expiresAt.toString())
  requestHeaders.set(
    'cookie',
    Array.from(requestCookies, ([name, value]) => `${name}=${encodeURIComponent(value)}`).join('; ')
  )

  return requestHeaders
}

function applyRefreshedSession(
  response: NextResponse,
  refreshedToken: RefreshedToken | null,
  expiresAt: number,
  config: DomainRoutingConfig
): NextResponse {
  if (!refreshedToken) return response

  const sessionCookieOptions = getSessionCookieOptions(config)

  response.cookies.set('replenops_access_token', refreshedToken.access_token, {
    ...sessionCookieOptions,
  })

  if (refreshedToken.refresh_token) {
    response.cookies.set('replenops_refresh_token', refreshedToken.refresh_token, {
      ...sessionCookieOptions,
    })
  }

  response.cookies.set('replenops_expires_at', expiresAt.toString(), {
    ...sessionCookieOptions,
  })

  return response
}

async function verifyTokenAndGetUser(token: string): Promise<AuthUser | null> {
  try {
    const user = await verifyToken(token)
    return user
  } catch (error) {
    console.error('Token verification failed:', error)
    return null
  }
}

function getUserRolesFromAuthUser(user: AuthUser | null): UserRole[] {
  if (!user) {
    return []
  }

  const validRoles: UserRole[] = [
    'super_admin',
    'warehouse_manager',
    'store_admin',
    'finance',
    'approver',
  ]

  const roleMapping: Record<string, UserRole> = {
    SUPER_ADMIN: 'super_admin',
    WAREHOUSE_MANAGER: 'warehouse_manager',
    STORE_ADMIN: 'store_admin',
    FINANCE: 'finance',
    APPROVER: 'approver',
  }

  return user.roles
    .map((role) => roleMapping[role])
    .filter((role): role is UserRole => role !== undefined && validRoles.includes(role))
}

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl
  const domainRoutingConfig = createDomainRoutingConfig()
  const crossDomainRedirectUrl = getCrossDomainRedirectUrl(request.nextUrl, domainRoutingConfig)

  if (crossDomainRedirectUrl) {
    return NextResponse.redirect(crossDomainRedirectUrl)
  }

  const rootRedirectPath = getRootRedirectPath(request.nextUrl, domainRoutingConfig)

  if (rootRedirectPath) {
    return NextResponse.redirect(new URL(rootRedirectPath, request.url))
  }

  if (pathname === '/api/auth/register') {
    return registerDisabledResponse()
  }

  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  let accessToken = getAccessToken(request)
  const refreshToken = getRefreshToken(request)
  const expiresAt = getExpiresAt(request)
  let refreshedToken: Awaited<ReturnType<typeof refreshAccessToken>> = null
  let refreshedExpiresAt = 0

  if (!accessToken) {
    return authRequiredResponse(request)
  }

  const now = Date.now()
  const shouldRefresh =
    refreshToken && expiresAt && (expiresAt - now < 5 * 60 * 1000 || expiresAt <= now)

  if (shouldRefresh) {
    try {
      const newToken = await refreshAccessToken(refreshToken)

      if (!newToken) {
        return authRequiredResponse(request)
      }

      accessToken = newToken.access_token
      refreshedToken = newToken
      refreshedExpiresAt = now + newToken.expires_in * 1000
    } catch (error) {
      console.error('Token refresh failed:', error)
      return authRequiredResponse(request)
    }
  }

  const user = await verifyTokenAndGetUser(accessToken)

  if (!user) {
    return authRequiredResponse(request)
  }

  const roles = getUserRolesFromAuthUser(user)

  if (roles.length === 0) {
    return applyRefreshedSession(
      NextResponse.json({ error: 'User does not have a valid role' }, { status: 403 }),
      refreshedToken,
      refreshedExpiresAt,
      domainRoutingConfig
    )
  }

  if (!hasPermission(roles, pathname)) {
    if (isApiRequest(pathname)) {
      return applyRefreshedSession(
        NextResponse.json(
          { error: 'You do not have permission to access this resource' },
          { status: 403 }
        ),
        refreshedToken,
        refreshedExpiresAt,
        domainRoutingConfig
      )
    }

    const redirectPath = getRedirectRoute(roles, pathname)
    if (redirectPath !== pathname) {
      const redirectUrl = new URL(redirectPath, request.url)
      return applyRefreshedSession(
        NextResponse.redirect(redirectUrl),
        refreshedToken,
        refreshedExpiresAt,
        domainRoutingConfig
      )
    }

    return applyRefreshedSession(
      NextResponse.json(
        { error: 'You do not have permission to access this resource' },
        { status: 403 }
      ),
      refreshedToken,
      refreshedExpiresAt,
      domainRoutingConfig
    )
  }

  const response = refreshedToken
    ? NextResponse.next({
        request: {
          headers: getRefreshedRequestHeaders(request, refreshedToken, refreshedExpiresAt),
        },
      })
    : NextResponse.next()

  return applyRefreshedSession(response, refreshedToken, refreshedExpiresAt, domainRoutingConfig)
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|manifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp|webmanifest)$).*)',
  ],
}
