'use client'

const AUTH_EVENT_KEY = 'replenops:auth-ended'
type SessionEndReason = 'expired' | 'logout'
let explicitLogout = false

export function isProtectedPath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/mobile' ||
    pathname.startsWith('/mobile/')
  )
}

export function getLoginUrl(
  location: Pick<Location, 'pathname' | 'search' | 'hash'>,
  reason: SessionEndReason = 'expired'
): string {
  const redirect =
    reason === 'logout' &&
    (location.pathname === '/mobile' || location.pathname.startsWith('/mobile/'))
      ? '/mobile/home'
      : `${location.pathname}${location.search}${location.hash}`
  const params = new URLSearchParams({ redirect })
  return `/login?${params.toString()}`
}

export function announceSessionEnded(reason: SessionEndReason = 'expired'): void {
  try {
    localStorage.setItem(AUTH_EVENT_KEY, JSON.stringify({ id: crypto.randomUUID(), reason }))
  } catch (error) {
    console.error('无法通知其他页面会话已结束:', error)
  }
}

export function redirectToLogin(reason: SessionEndReason = 'expired'): void {
  if (!isProtectedPath(window.location.pathname)) return
  window.location.replace(getLoginUrl(window.location, explicitLogout ? 'logout' : reason))
}

export function endClientSession(reason: SessionEndReason = 'expired'): void {
  reason = explicitLogout ? 'logout' : reason
  announceSessionEnded(reason)
  redirectToLogin(reason)
}

export function getSessionEndReason(value: string | null): SessionEndReason {
  try {
    const event: unknown = JSON.parse(value ?? 'null')
    return typeof event === 'object' &&
      event !== null &&
      'reason' in event &&
      event.reason === 'logout'
      ? 'logout'
      : 'expired'
  } catch {
    return 'expired'
  }
}

export function isSessionEndedStorageEvent(event: StorageEvent): boolean {
  return event.key === AUTH_EVENT_KEY && event.newValue !== null
}

export async function logoutAndRedirect(): Promise<void> {
  // Preserve the user's destination when an in-flight session check returns 401.
  explicitLogout = true
  try {
    const response = await fetch('/api/auth/logout', { method: 'POST' })
    if (!response.ok) throw new Error('Logout request failed')
    endClientSession('logout')
  } catch (error) {
    explicitLogout = false
    throw error
  }
}
