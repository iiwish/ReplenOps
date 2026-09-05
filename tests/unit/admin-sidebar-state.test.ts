// @vitest-environment jsdom

import '@testing-library/jest-dom/vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createElement } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AppSidebar from '@/components/admin/AppSidebar'
import { getBreadcrumbItems, menuItems } from '@/config/menuConfig'
import type { UserRole } from '@/types'

vi.mock('next/navigation', () => ({ useRouter: () => ({ prefetch: vi.fn() }) }))
vi.mock('@/components/BrandLogo', () => ({ BrandLogo: () => null }))

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation((media: string) => ({
      matches: false,
      media,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  })
})

afterEach(async () => {
  await act(async () => {})
  cleanup()
})

function sidebar(
  pathname = '/admin/inventory/query',
  collapsed = false,
  roles: UserRole[] = ['super_admin']
) {
  return createElement(AppSidebar, { pathname, collapsed, roles, onNavigate: vi.fn() })
}

const group = (name: string) => screen.getByRole('menuitem', { name: new RegExp(name) })

describe('admin sidebar expansion', () => {
  it('reveals the current group on mount but allows it to close without losing selection', () => {
    render(sidebar())
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'true')
    fireEvent.click(group('库存管理'))
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'false')
    expect(group('库存管理').parentElement).toHaveClass('ant-menu-submenu-selected')
    fireEvent.click(group('库存管理'))
    expect(screen.getByRole('menuitem', { name: '库存查询' })).toHaveClass('ant-menu-item-selected')
  })

  it('preserves manual collapse across rerenders with fresh but equivalent role arrays', () => {
    const view = render(sidebar())
    fireEvent.click(group('库存管理'))
    view.rerender(sidebar())
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'false')
  })

  it('allows multiple open groups without reopening a manually closed current group', () => {
    render(sidebar())
    fireEvent.click(group('库存管理'))
    fireEvent.click(group('基础资料'))
    fireEvent.click(group('报表分析'))
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'false')
    expect(group('基础资料')).toHaveAttribute('aria-expanded', 'true')
    expect(group('报表分析')).toHaveAttribute('aria-expanded', 'true')
  })

  it('reveals a new route and history destination without closing other groups', () => {
    const view = render(sidebar())
    fireEvent.click(group('库存管理'))
    fireEvent.click(group('报表分析'))
    view.rerender(sidebar('/admin/goods/12'))
    expect(group('基础资料')).toHaveAttribute('aria-expanded', 'true')
    expect(group('报表分析')).toHaveAttribute('aria-expanded', 'true')
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'false')
    view.rerender(sidebar())
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'true')
  })

  it('restores inline choices after collapsing and expanding the sidebar', () => {
    const view = render(sidebar())
    fireEvent.click(group('库存管理'))
    fireEvent.click(group('基础资料'))
    view.rerender(sidebar('/admin/inventory/query', true))
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'false')
    expect(group('基础资料')).toHaveAttribute('aria-expanded', 'false')
    view.rerender(sidebar())
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'false')
    expect(group('基础资料')).toHaveAttribute('aria-expanded', 'true')
  })

  it('reveals a route reached in icon mode only after expanding the sidebar', () => {
    const view = render(sidebar('/admin/dashboard', true))
    view.rerender(sidebar('/admin/inventory/query', true))
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'false')
    view.rerender(sidebar())
    expect(group('库存管理')).toHaveAttribute('aria-expanded', 'true')
  })

  it('discards groups removed by role changes instead of restoring stale open state', () => {
    const view = render(sidebar())
    fireEvent.click(group('基础资料'))
    fireEvent.click(group('系统设置'))
    view.rerender(sidebar('/admin/inventory/query', false, ['approver']))
    expect(screen.queryByRole('menuitem', { name: /基础资料|系统设置/ })).not.toBeInTheDocument()
    view.rerender(sidebar())
    expect(group('基础资料')).toHaveAttribute('aria-expanded', 'false')
    expect(group('系统设置')).toHaveAttribute('aria-expanded', 'false')
  })
})

describe('admin menu organization', () => {
  it('places daily work before reports and configuration without changing route ownership', () => {
    expect(menuItems.map((item) => item.key)).toEqual([
      'dashboard',
      'orders',
      'inventory',
      'containers',
      'reports',
      'master-data',
      'system',
    ])
    for (const [path, label] of [
      ['/admin/inventory/logs', '库存流水'],
      ['/admin/inventory/cost-history', '成本变动记录'],
      ['/admin/reports/inventory', '库存分析'],
      ['/admin/stores', '门店档案'],
      ['/admin/system-config', '报货时间设置'],
    ] as const) {
      expect(getBreadcrumbItems(path, menuItems).at(-1)?.label).toBe(label)
    }
    expect(menuItems.flatMap((item) => item.children ?? []).every((item) => !item.icon)).toBe(true)
  })
})
