'use client'

const AUTH_EVENT_KEY = 'replenops:auth-ended'

export function isProtectedPath(pathname: string): boolean {
  return (
    pathname === '/admin' ||
    pathname.startsWith('/admin/') ||
    pathname === '/mobile' ||
    pathname.startsWith('/mobile/')
  )
}

export function getLoginUrl(location: Pick<Location, 'pathname' | 'search' | 'hash'>): string {
  const redirect = `${location.pathname}${location.search}${location.hash}`
  const params = new URLSearchParams({ redirect })
  return `/login?${params.toString()}`
}

export function announceSessionEnded(): void {
  try {
    localStorage.setItem(AUTH_EVENT_KEY, `${Date.now()}:${crypto.randomUUID()}`)
  } catch (error) {
    console.error('无法通知其他页面会话已结束:', error)
  }
}

export function redirectToLogin(): void {
  if (!isProtectedPath(window.location.pathname)) return
  window.location.replace(getLoginUrl(window.location))
}

export function endClientSession(): void {
  announceSessionEnded()
  redirectToLogin()
}

export function isSessionEndedStorageEvent(event: StorageEvent): boolean {
  return event.key === AUTH_EVENT_KEY && event.newValue !== null
}

export async function logoutAndRedirect(): Promise<void> {
  const response = await fetch('/api/auth/logout', { method: 'POST' })

  if (!response.ok) {
    throw new Error('Logout request failed')
  }

  endClientSession()
}
