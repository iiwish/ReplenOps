import { beforeEach, describe, expect, it, vi } from 'vitest'
import { deferred } from '../helpers/deferred'

const mocks = vi.hoisted(() => ({
  access: vi.fn(),
  stockInList: vi.fn(),
  stockOutList: vi.fn(),
  warehouses: vi.fn(),
}))

vi.mock('@/lib/rbac-server', () => ({ requirePageAccess: mocks.access }))
vi.mock('@/services/stock-in.service', () => ({
  stockInService: { list: mocks.stockInList, getActiveWarehouses: mocks.warehouses },
}))
vi.mock('@/services/stock-out.service', () => ({ stockOutService: { list: mocks.stockOutList } }))
vi.mock('@/app/admin/stock-in/StockInListClient', () => ({ default: () => null }))
vi.mock('@/app/admin/stock-out/StockOutListClient', () => ({ default: () => null }))

import StockInPage from '@/app/admin/stock-in/page'
import StockOutPage from '@/app/admin/stock-out/page'

describe('stock page data loading', () => {
  beforeEach(() => {
    vi.resetAllMocks()
    mocks.access.mockResolvedValue({ user: { roles: ['SUPER_ADMIN'] } })
    mocks.warehouses.mockResolvedValue([])
  })

  for (const [name, page, list] of [
    ['stock-in', StockInPage, mocks.stockInList],
    ['stock-out', StockOutPage, mocks.stockOutList],
  ] as const) {
    it(`${name} loads warehouses alongside the list after checking access`, async () => {
      const data = deferred<object>()
      list.mockReturnValue(data.promise)
      const rendering = page({ searchParams: Promise.resolve({ keyword: 'TEST' }) })
      try {
        await vi.waitFor(() => expect(list).toHaveBeenCalled())
        expect(mocks.access).toHaveBeenCalledWith(`/admin/${name}`)
        expect(mocks.warehouses).toHaveBeenCalledOnce()
      } finally {
        data.resolve({ data: [], total: 0, page: 1, pageSize: 20, totalPages: 0 })
        await rendering
      }
    })

    it(`${name} does not query business data when access is denied`, async () => {
      mocks.access.mockRejectedValue(new Error('Forbidden'))
      await expect(page({ searchParams: Promise.resolve({}) })).rejects.toThrow('Forbidden')
      expect(list).not.toHaveBeenCalled()
      expect(mocks.warehouses).not.toHaveBeenCalled()
    })
  }
})
