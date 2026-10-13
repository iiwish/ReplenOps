// @vitest-environment jsdom

import { createElement } from 'react'
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react'
import { message } from 'antd'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import GoodsFormClient, { type GoodsFormData } from '@/app/admin/goods/GoodsFormClient'

const actions = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
vi.mock('@/actions/goods-actions', () => ({
  createGoods: actions.create,
  updateGoods: actions.update,
}))

const warning = '仅修改单位名称，不换算库存数量及价格'
const initialValues: GoodsFormData & { id: string } = {
  id: '1',
  code: 'G000001',
  name: '测试商品',
  categoryId: '1',
  unit: '箱',
  measureType: 'INT',
  costPrice: 10,
  partnerPrice: 12,
  defaultInPrice: 9,
}

function renderForm(mode: 'create' | 'edit' = 'edit') {
  const onSuccess = vi.fn()
  const onSubmittingChange = vi.fn()
  const view = render(
    createElement(GoodsFormClient, {
      mode,
      initialValues: mode === 'edit' ? initialValues : undefined,
      initialCode: 'G000002',
      formId: 'goods-unit-test-form',
      categories: [{ id: '1', code: 'CAT', name: '测试分类' }],
      onSuccess,
      onSubmittingChange,
    })
  )
  return { ...view, onSuccess, onSubmittingChange }
}

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

beforeEach(() => {
  actions.update.mockResolvedValue({ success: true, message: '商品更新成功' })
})

afterEach(async () => {
  await act(async () => {
    message.destroy()
  })
  if (screen.queryByText('商品更新成功')) {
    const notice = await waitFor(() => {
      const exitingNotice = document.querySelector('.ant-message-move-up-leave-active')
      expect(exitingNotice).not.toBeNull()
      return exitingNotice!
    })
    // jsdom does not dispatch CSS animation completion events.
    fireEvent.animationEnd(notice)
    fireEvent(notice, new window.Event('webkitAnimationEnd', { bubbles: true }))
  }
  await waitFor(() => expect(screen.queryByText('商品更新成功')).toBeNull())
  await act(async () => {
    cleanup()
  })
  vi.clearAllMocks()
})

afterAll(() => vi.unstubAllGlobals())

describe('goods unit label edits', () => {
  it('warns only while the edited unit differs from the original value', async () => {
    renderForm()
    const unit = screen.getByRole('textbox', { name: '单位' })
    expect(screen.queryByText(warning)).toBeNull()

    fireEvent.change(unit, { target: { value: '瓶' } })
    await screen.findByText(warning)
    expect(screen.getByRole('alert').textContent).toContain(warning)

    fireEvent.change(unit, { target: { value: '箱' } })
    await waitFor(() => expect(screen.queryByText(warning)).toBeNull())
  })

  it('does not warn when entering a unit for new goods', () => {
    renderForm('create')
    fireEvent.change(screen.getByRole('textbox', { name: '单位' }), {
      target: { value: '瓶' },
    })
    expect(screen.queryByText(warning)).toBeNull()
  })

  it('submits the edited unit without changing the selected measurement type or prices', async () => {
    const view = renderForm()
    fireEvent.change(screen.getByRole('textbox', { name: '单位' }), {
      target: { value: '瓶' },
    })
    fireEvent.submit(view.container.querySelector('form')!)

    await waitFor(() => expect(actions.update).toHaveBeenCalledOnce())
    const [id, payload] = actions.update.mock.calls[0] as [string, FormData]
    expect(id).toBe('1')
    expect(payload.get('unit')).toBe('瓶')
    expect(payload.get('measureType')).toBe('INT')
    expect(payload.get('costPrice')).toBe('10')
    expect(payload.get('partnerPrice')).toBe('12')
    expect(payload.get('defaultInPrice')).toBe('9')
    await waitFor(() => expect(view.onSuccess).toHaveBeenCalledOnce())
    expect(view.onSubmittingChange.mock.calls).toEqual([[true], [false]])
    await screen.findByText('商品更新成功')
  })
})
