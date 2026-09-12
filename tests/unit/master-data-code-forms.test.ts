// @vitest-environment jsdom

import { createElement } from 'react'
import { App } from 'antd'
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import StoreForm from '@/app/admin/stores/StoreFormClient'
import CategoryForm from '@/app/admin/goods-category/GoodsCategoryFormClient'
import WarehouseForm from '@/app/admin/warehouse/WarehouseFormClient'

const actions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
vi.mock('@/actions/store-actions', () => ({
  createStore: actions.create,
  updateStore: actions.update,
}))
vi.mock('@/actions/goods-category-actions', () => ({
  createGoodsCategory: actions.create,
  updateGoodsCategory: actions.update,
}))
vi.mock('@/actions/warehouse-actions', () => ({
  createWarehouse: actions.create,
  updateWarehouse: actions.update,
}))

beforeAll(() => {
  vi.stubGlobal(
    'ResizeObserver',
    class {
      observe() {}
      unobserve() {}
      disconnect() {}
    }
  )
  window.matchMedia = vi.fn().mockImplementation(() => ({
    matches: false,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  }))
})
afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
afterAll(() => vi.unstubAllGlobals())
beforeEach(() => {
  actions.create.mockResolvedValue({ success: true })
})

const surfaces = [
  {
    label: '门店编码',
    form: (mode: 'create' | 'edit') =>
      createElement(StoreForm, {
        mode,
        initialValues: { id: '1', code: 'LEGACY', name: '测试门店' },
        onCancel: vi.fn(),
        onSuccess: vi.fn(),
      }),
  },
  {
    label: '分类编码',
    form: (mode: 'create' | 'edit') =>
      createElement(CategoryForm, {
        mode,
        initialValues: { id: '1', code: 'LEGACY', name: '测试分类', sortOrder: 0 },
        onCancel: vi.fn(),
        onSuccess: vi.fn(),
      }),
  },
  {
    label: '仓库编码',
    form: (mode: 'create' | 'edit') =>
      createElement(WarehouseForm, {
        mode,
        initialValues: {
          id: 1,
          code: 'LEGACY',
          name: '测试仓库',
          contactName: '测试员',
          contactPhone: '13800138000',
        },
        onCancel: vi.fn(),
        onSuccess: vi.fn(),
      }),
  },
]

describe.each(surfaces)('$label', ({ label, form }) => {
  it('saves legacy records without validating or submitting the locked code', async () => {
    actions.update.mockResolvedValue({ success: true })
    const view = render(createElement(App, null, form('edit')))
    expect(screen.getByLabelText(label).hasAttribute('disabled')).toBe(true)
    fireEvent.submit(view.container.querySelector('form')!)
    await waitFor(() => expect(actions.update).toHaveBeenCalledOnce())
    const payload = actions.update.mock.calls[0]?.[1] as FormData
    expect(payload.has('code')).toBe(false)
    expect(payload.get('name')).toContain('测试')
  })

  it('rejects invalid new codes', async () => {
    const view = render(createElement(App, null, form('create')))
    fireEvent.submit(view.container.querySelector('form')!)
    await screen.findByText(/编码格式错误/)
    expect(actions.create).not.toHaveBeenCalled()
  })
})
