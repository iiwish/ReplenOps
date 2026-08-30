import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readFileSync } from 'node:fs'

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

const inventoryMocks = vi.hoisted(() => ({
  transaction: vi.fn(),
  findUnique: vi.fn(),
  update: vi.fn(),
  createLog: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: inventoryMocks.transaction,
  },
}))

describe('third-batch UX regression guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    inventoryMocks.findUnique.mockResolvedValue({
      id: 1,
      warehouseId: 1,
      goodsId: 2,
      quantity: 10,
      availableQuantity: 8,
      lockedQuantity: 2,
    })
    inventoryMocks.transaction.mockImplementation(
      async (
        callback: (client: {
          inventory: { findUnique: typeof inventoryMocks.findUnique; update: typeof inventoryMocks.update }
          inventoryLog: { create: typeof inventoryMocks.createLog }
        }) => Promise<unknown>
      ) =>
        callback({
          inventory: {
            findUnique: inventoryMocks.findUnique,
            update: inventoryMocks.update,
          },
          inventoryLog: { create: inventoryMocks.createLog },
        })
    )
  })

  it('rejects inventory adjustments that do not change stock', async () => {
    const { inventoryService } = await import('@/services/inventory.service')

    await expect(
      inventoryService.adjustStock({
        warehouseId: '1',
        goodsId: '2',
        newQuantity: 10,
        reason: '盘点复核',
        operatorId: 'user-1',
      })
    ).rejects.toThrow('调整后数量与当前库存相同')

    expect(inventoryMocks.update).not.toHaveBeenCalled()
    expect(inventoryMocks.createLog).not.toHaveBeenCalled()
  })

  it('keeps inventory changes behind a before-and-after confirmation', () => {
    const adjustment = readSource(
      'src/components/admin/inventory/InventoryAdjustmentModal.tsx'
    )
    const action = readSource('src/actions/inventory-actions.ts')

    expect(adjustment).toContain("title: '确认提交库存调整？'")
    expect(adjustment).toContain("okText: '确认调整'")
    expect(adjustment).toContain('changeQty === 0')
    expect(action).toContain("z.string().trim().min(2, '调整原因至少2个字符')")
  })

  it('supports multi-select stock-in and protects unsaved form work', () => {
    const stockInForm = readSource('src/app/admin/stock-in/StockInFormClient.tsx')

    expect(stockInForm).toContain('rowSelection={goodsRowSelection}')
    expect(stockInForm).toContain('preserveSelectedRowKeys: true')
    expect(stockInForm).toContain("useUnsavedChangesWarning(isDirty, '当前入库单尚未保存")
    expect(stockInForm).toContain("title: '放弃未保存的入库单？'")
    expect(stockInForm).not.toContain('window.location.href')
  })

  it('separates order filter drafts and ignores stale requests', () => {
    const orderList = readSource('src/app/admin/orders/OrderListClient.tsx')

    expect(orderList).toContain('const [draftFilters, setDraftFilters]')
    expect(orderList).toContain('const currentRequestId = ++requestId.current')
    expect(orderList).toContain('if (currentRequestId !== requestId.current) return')
    expect(orderList).toContain('enterButton="查询"')
    expect(orderList).not.toContain('<Card size="small" className="mb-4">')
  })
})
