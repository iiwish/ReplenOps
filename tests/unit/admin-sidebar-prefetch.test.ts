// @vitest-environment jsdom

import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const router = vi.hoisted(() => ({ prefetch: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => router }))
vi.mock('@/components/BrandLogo', () => ({ BrandLogo: () => null }))

import AppSidebar from '@/components/admin/AppSidebar'

describe('admin sidebar intent prefetching', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    Object.defineProperty(window, 'matchMedia', {
      writable: true,
      value: vi.fn().mockImplementation((query: string) => ({
        matches: false,
        media: query,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
      })),
    })
  })

  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  const renderSidebar = () =>
    render(
      createElement(AppSidebar, {
        roles: ['super_admin'],
        collapsed: false,
        pathname: '/admin/stock-in',
        onNavigate: vi.fn(),
      })
    )

  it('does not prefetch all menus on mount or on a passing hover', async () => {
    await act(async () => {
      renderSidebar()
    })
    expect(router.prefetch).not.toHaveBeenCalled()
    const orders = screen.getByRole('menuitem', { name: /订单管理/ })
    fireEvent.mouseEnter(orders)
    await act(async () => {
      vi.advanceTimersByTime(149)
    })
    expect(router.prefetch).not.toHaveBeenCalled()
    fireEvent.mouseLeave(orders)
    await act(async () => {
      vi.advanceTimersByTime(1000)
    })
    expect(router.prefetch).not.toHaveBeenCalled()
  }, 15000)

  it('prefetches the intended route after a deliberate hover or keyboard focus', async () => {
    await act(async () => {
      renderSidebar()
    })
    const orders = screen.getByRole('menuitem', { name: /订单管理/ })
    fireEvent.mouseEnter(orders)
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(router.prefetch).toHaveBeenCalledWith('/admin/orders')
    fireEvent.focus(screen.getByRole('menuitem', { name: '出库管理' }))
    expect(router.prefetch).toHaveBeenCalledWith('/admin/stock-out')
  }, 15000)

  it('skips the current route and cancels pending prefetch on unmount', async () => {
    await act(async () => {
      renderSidebar()
    })
    fireEvent.focus(screen.getByRole('menuitem', { name: '入库管理' }))
    expect(router.prefetch).not.toHaveBeenCalled()
    fireEvent.mouseEnter(screen.getByRole('menuitem', { name: '出库管理' }))
    cleanup()
    await act(async () => {
      vi.advanceTimersByTime(150)
    })
    expect(router.prefetch).not.toHaveBeenCalled()
  }, 15000)
})
