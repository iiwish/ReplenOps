// @vitest-environment jsdom
import { createElement } from 'react'
import { cleanup, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import StockOutPrintContent from '@/components/admin/stock-out/StockOutPrintContent'
import type { StockOutDetail } from '@/services/stock-out.service'

vi.mock('@/components/admin/stock-out/PrintButton', () => ({ PrintButton: () => null }))

function documentWithRows(count: number): StockOutDetail {
  const date = new Date('2026-09-20T00:00:00Z')
  return {
    id: '1',
    code: 'PRINT-TEST',
    orderId: '1',
    orderCode: 'ORDER-TEST',
    orderIsDeleted: false,
    orderCreatedBy: 'test',
    orderCreatedByName: 'Test',
    orderedAt: date,
    approvedBy: null,
    approvedByName: null,
    approvedAt: null,
    orderRemark: null,
    storeId: '1',
    storeName: 'Store',
    warehouseId: '1',
    warehouseName: 'Warehouse',
    status: 'COMPLETED',
    totalCost: count,
    remark: null,
    createdBy: 'test',
    createdByName: 'Test',
    completedAt: date,
    revokedBy: null,
    revokedByName: null,
    revokedAt: null,
    revokeReason: null,
    createdAt: date,
    updatedAt: date,
    containers: [],
    items: Array.from({ length: count }, (_, index) => ({
      id: String(index),
      goodsId: String(index),
      goodsCode: `P${index}`,
      goodsName: `Goods ${index}`,
      categoryName: 'Category',
      goodsSpec: null,
      goodsUnit: 'unit',
      quantity: 1,
      unitPrice: 2,
      snapshotCost: 1,
      lineAmount: 2,
      costAmount: 1,
    })),
  }
}

beforeEach(() => {
  vi.stubGlobal('matchMedia', () => ({ addEventListener: vi.fn(), removeEventListener: vi.fn() }))
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('stock-out print content updates', () => {
  it('does not lose new items when a previously paginated document grows', () => {
    const view = render(createElement(StockOutPrintContent, { stockOut: documentWithRows(2) }))
    expect(view.container.querySelectorAll('[data-print-row]')).toHaveLength(2)
    view.rerender(createElement(StockOutPrintContent, { stockOut: documentWithRows(5) }))
    expect(view.container.querySelectorAll('[data-print-row]')).toHaveLength(5)
    expect(view.getByText('P4')).toBeTruthy()
  })
})
