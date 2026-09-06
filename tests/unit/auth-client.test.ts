import { describe, expect, it } from 'vitest'
import { getLoginUrl, getSessionEndReason, isProtectedPath } from '@/lib/auth-client'

describe('client authentication navigation', () => {
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
