import { describe, expect, it } from 'vitest'
import { getLoginUrl, isProtectedPath } from '@/lib/auth-client'

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
})
