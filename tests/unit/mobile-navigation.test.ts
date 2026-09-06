// @vitest-environment jsdom

import { createElement } from 'react'
import { cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import MobileTabBar from '@/components/mobile/MobileTabBar'
import MobilePageError from '@/app/mobile/error'

afterEach(cleanup)

describe('mobile navigation', () => {
  it.each([
    ['/mobile/order', '下单'],
    ['/mobile/order/cart', '下单'],
    ['/mobile/orders', '订单'],
    ['/mobile/orders/123', '订单'],
    ['/mobile/profile/info', '我的'],
  ])('selects exactly one tab for %s', (pathname, label) => {
    render(createElement(MobileTabBar, { pathname, onNavigate: vi.fn() }))
    expect(screen.getByRole('link', { name: label }).getAttribute('aria-current')).toBe('page')
    expect(
      screen.getAllByRole('link').filter((link) => link.getAttribute('aria-current') === 'page')
    ).toHaveLength(1)
  })

  it('offers retry without displaying internal server errors', () => {
    const retry = vi.fn()
    render(createElement(MobilePageError, { retry, error: new Error('internal server details') }))
    expect(screen.getByRole('alert').textContent).toContain('页面加载失败')
    expect(screen.queryByText('internal server details')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: '重新加载' }))
    expect(retry).toHaveBeenCalledOnce()
  })
})
