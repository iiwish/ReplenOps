import { cookies, headers } from 'next/headers'
import { verifyToken, refreshAccessToken } from './auth-edge'
import type { AuthUser } from './auth'
import type { UserRole } from '@/types'
import { createDomainRoutingConfig, getCookieDomain } from './domain-routing'

export interface Session {
  accessToken: string
  refreshToken?: string
  expiresAt: number
  user: AuthUser
}

const COOKIE_CONFIG = {
  ACCESS_TOKEN: 'replenops_access_token',
  REFRESH_TOKEN: 'replenops_refresh_token',
  EXPIRES_AT: 'replenops_expires_at',
  MAX_AGE: 7 * 24 * 60 * 60,
  PATH: '/',
  SECURE: process.env.NODE_ENV === 'production',
  HTTP_ONLY: true,
  SAME_SITE: 'lax' as const,
}

function getSessionCookieOptions() {
  const domain = getCookieDomain(createDomainRoutingConfig())

  return {
    maxAge: COOKIE_CONFIG.MAX_AGE,
    path: COOKIE_CONFIG.PATH,
    secure: COOKIE_CONFIG.SECURE,
    httpOnly: COOKIE_CONFIG.HTTP_ONLY,
    sameSite: COOKIE_CONFIG.SAME_SITE,
    ...(domain ? { domain } : {}),
  }
}

export async function setSession(
  accessToken: string,
  refreshToken: string | undefined,
  expiresIn: number
): Promise<void> {
  const cookieStore = await cookies()
  const expiresAt = Date.now() + expiresIn * 1000
  const sessionCookieOptions = getSessionCookieOptions()

  cookieStore.set(COOKIE_CONFIG.ACCESS_TOKEN, accessToken, {
    ...sessionCookieOptions,
  })

  if (refreshToken) {
    cookieStore.set(COOKIE_CONFIG.REFRESH_TOKEN, refreshToken, {
      ...sessionCookieOptions,
    })
  }

  cookieStore.set(COOKIE_CONFIG.EXPIRES_AT, expiresAt.toString(), {
    ...sessionCookieOptions,
  })
}

export async function getSession(): Promise<Session | null> {
  const cookieStore = await cookies()
  const headersList = await headers()

  const accessToken = cookieStore.get(COOKIE_CONFIG.ACCESS_TOKEN)?.value
  const refreshToken = cookieStore.get(COOKIE_CONFIG.REFRESH_TOKEN)?.value
  const expiresAt = cookieStore.get(COOKIE_CONFIG.EXPIRES_AT)?.value

  if (!accessToken || !expiresAt) {
    return null
  }

  const expiresAtNumber = parseInt(expiresAt, 10)
  const now = Date.now()

  const userProfileHeader = headersList.get('x-user-profile')
  let userFromHeader: AuthUser | null = null

  if (userProfileHeader) {
    try {
      const userProfileJson = Buffer.from(userProfileHeader, 'base64').toString('utf-8')
      userFromHeader = JSON.parse(userProfileJson)
    } catch (error) {
      console.error('Failed to parse user profile from header:', error)
    }
  }

  const shouldRefresh =
    refreshToken && (expiresAtNumber - now < 5 * 60 * 1000 || expiresAtNumber <= now)

  if (shouldRefresh) {
    try {
      const newToken = await refreshAccessToken(refreshToken)
      if (!newToken) {
        return null
      }

      await setSession(
        newToken.access_token,
        newToken.refresh_token || refreshToken,
        newToken.expires_in
      )

      const user = await verifyToken(newToken.access_token)
      if (!user) {
        return null
      }

      return {
        accessToken: newToken.access_token,
        refreshToken: newToken.refresh_token || refreshToken,
        expiresAt: now + newToken.expires_in * 1000,
        user,
      }
    } catch (error) {
      console.error('Failed to refresh token:', error)
      return null
    }
  }

  if (userFromHeader) {
    return {
      accessToken,
      refreshToken,
      expiresAt: expiresAtNumber,
      user: userFromHeader,
    }
  }

  const user = await verifyToken(accessToken)
  if (!user) {
    return null
  }

  return {
    accessToken,
    refreshToken,
    expiresAt: expiresAtNumber,
    user,
  }
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies()
  const domain = getCookieDomain(createDomainRoutingConfig())

  cookieStore.delete(COOKIE_CONFIG.ACCESS_TOKEN)
  cookieStore.delete(COOKIE_CONFIG.REFRESH_TOKEN)
  cookieStore.delete(COOKIE_CONFIG.EXPIRES_AT)

  if (domain) {
    const deleteOptions = {
      path: COOKIE_CONFIG.PATH,
      secure: COOKIE_CONFIG.SECURE,
      httpOnly: COOKIE_CONFIG.HTTP_ONLY,
      sameSite: COOKIE_CONFIG.SAME_SITE,
      domain,
      maxAge: 0,
    }

    cookieStore.set(COOKIE_CONFIG.ACCESS_TOKEN, '', deleteOptions)
    cookieStore.set(COOKIE_CONFIG.REFRESH_TOKEN, '', deleteOptions)
    cookieStore.set(COOKIE_CONFIG.EXPIRES_AT, '', deleteOptions)
  }
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const session = await getSession()
  return session?.user || null
}

export async function isAuthenticated(): Promise<boolean> {
  const session = await getSession()
  return session !== null
}

export async function requireAuth(): Promise<AuthUser> {
  const user = await getCurrentUser()
  if (!user) {
    throw new Error('Unauthorized')
  }
  return user
}

export function getUserRoles(user: AuthUser | null): UserRole[] {
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

export function getUserRole(user: AuthUser | null): UserRole | null {
  const roles = getUserRoles(user)
  if (roles.length === 0) return null
  return roles[0]!
}

export async function getCurrentUserRole(): Promise<UserRole | null> {
  const user = await getCurrentUser()
  return getUserRole(user)
}

export async function requireRole(
  allowedRoles: UserRole[]
): Promise<{ user: AuthUser; role: UserRole }> {
  const user = await requireAuth()
  const role = getUserRole(user)

  if (!role) {
    throw new Error('User does not have a valid role')
  }

  if (!allowedRoles.includes(role)) {
    throw new Error('Insufficient permissions')
  }

  return { user, role }
}
