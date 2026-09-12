import { afterEach, describe, expect, it, vi } from 'vitest'
import { getLoginUrl, getSessionEndReason, isProtectedPath } from '@/lib/auth-client'

describe('client authentication navigation', () => {
  afterEach(() => vi.unstubAllGlobals())

  it('preserves explicit logout intent when a session check races with logout', async () => {
    vi.resetModules()
    const auth = await import('@/lib/auth-client')
    const replace = vi.fn()
    const setItem = vi.fn()
    vi.stubGlobal('window', {
      location: { pathname: '/mobile/profile', search: '', hash: '', replace },
    })
    vi.stubGlobal('localStorage', { setItem })
    let resolve!: (response: Response) => void
    vi.stubGlobal(
      'fetch',
      vi.fn(
        () =>
          new Promise<Response>((done) => {
            resolve = done
          })
      )
    )
    const logout = auth.logoutAndRedirect()
    auth.endClientSession()
    expect(replace).toHaveBeenLastCalledWith('/login?redirect=%2Fmobile%2Fhome')
    expect(setItem).toHaveBeenCalledWith(
      'replenops:auth-ended',
      expect.stringContaining('"reason":"logout"')
    )
    resolve(new Response(null, { status: 200 }))
    await logout
    auth.endClientSession()
    expect(replace).toHaveBeenLastCalledWith('/login?redirect=%2Fmobile%2Fhome')
  })

  it('clears explicit logout intent when logout fails', async () => {
    vi.resetModules()
    const auth = await import('@/lib/auth-client')
    const replace = vi.fn()
    vi.stubGlobal('window', {
      location: { pathname: '/mobile/profile', search: '', hash: '', replace },
    })
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')))
    await expect(auth.logoutAndRedirect()).rejects.toThrow('offline')
    auth.redirectToLogin()
    expect(replace).toHaveBeenCalledWith('/login?redirect=%2Fmobile%2Fprofile')
  })

  it('recognizes protected application routes without matching similar public paths', () => {
    expect(isProtectedPath('/admin/orders')).toBe(true)
    expect(isProtectedPath('/mobile/home')).toBe(true)
    expect(isProtectedPath('/administrator')).toBe(false)
    expect(isProtectedPath('/login')).toBe(false)
  })

  it('preserves the current path, query, and hash for login return navigation', () => {
    expect(
      getLoginUrl({
        pathname: '/admin/orders/1',
        search: '?tab=items',
        hash: '#history',
      })
    ).toBe('/login?redirect=%2Fadmin%2Forders%2F1%3Ftab%3Ditems%23history')
  })

  it('returns to the mobile home after explicit logout without changing expired-session redirects', () => {
    const location = { pathname: '/mobile/orders/123', search: '?tab=items', hash: '#history' }
    expect(getLoginUrl(location, 'logout')).toBe('/login?redirect=%2Fmobile%2Fhome')
    expect(getLoginUrl(location)).toContain('%2Fmobile%2Forders%2F123')
    const admin = { pathname: '/admin/orders', search: '?status=PENDING', hash: '' }
    expect(getLoginUrl(admin, 'logout')).toBe(getLoginUrl(admin))
  })

  it('distinguishes explicit logout across tabs and accepts older session events', () => {
    expect(getSessionEndReason(JSON.stringify({ reason: 'logout', id: 'test' }))).toBe('logout')
    expect(getSessionEndReason(JSON.stringify({ reason: 'expired' }))).toBe('expired')
    expect(getSessionEndReason('123:legacy-event')).toBe('expired')
    expect(getSessionEndReason(null)).toBe('expired')
  })
})
