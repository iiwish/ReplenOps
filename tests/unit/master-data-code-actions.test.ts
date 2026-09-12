import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createStore, updateStore } from '@/actions/store-actions'
import { createWarehouse, updateWarehouse } from '@/actions/warehouse-actions'
import { createGoodsCategory, updateGoodsCategory } from '@/actions/goods-category-actions'

const service = vi.hoisted(() => ({ create: vi.fn(), update: vi.fn() }))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))
vi.mock('@/lib/action-permissions', () => ({
  requireActionPermission: vi.fn().mockResolvedValue({ id: 'admin' }),
}))
vi.mock('@/services/store.service', () => ({ storeService: service }))
vi.mock('@/services/warehouse.service', () => ({ warehouseService: service }))
vi.mock('@/services/goods-category.service', () => ({ goodsCategoryService: service }))

beforeEach(() => {
  vi.clearAllMocks()
  service.update.mockResolvedValue({})
  service.create.mockResolvedValue({})
})

describe.each([
  {
    name: 'store',
    create: createStore,
    update: (data: FormData) => updateStore('1', data),
    code: 'ST0001',
  },
  {
    name: 'warehouse',
    create: createWarehouse,
    update: (data: FormData) => updateWarehouse(1, data),
    code: 'WH0001',
  },
  {
    name: 'category',
    create: createGoodsCategory,
    update: (data: FormData) => updateGoodsCategory('1', data),
    code: 'GC0001',
  },
])('$name code boundary', ({ create, update, code }) => {
  function payload(value: string) {
    const data = new FormData()
    Object.entries({
      code: value,
      name: '测试名称',
      contactName: '测试员',
      contactPhone: '13800138000',
      sortOrder: '0',
    }).forEach(([key, entry]) => data.set(key, entry))
    return data
  }

  it.each(['LEGACY', 'FORGED', ''])(
    'does not pass submitted code %s to the update service',
    async (value) => {
      expect((await update(payload(value))).success).toBe(true)
      expect(service.update).toHaveBeenCalledOnce()
      expect(service.update.mock.calls[0]?.[1]).not.toHaveProperty('code')
    }
  )

  it('rejects invalid codes on create', async () => {
    expect((await create(payload('LEGACY'))).success).toBe(false)
    expect(service.create).not.toHaveBeenCalled()
  })

  it('passes valid new codes to the service', async () => {
    expect((await create(payload(code))).success).toBe(true)
    expect(service.create.mock.calls[0]?.[0]).toHaveProperty('code', code)
  })
})
