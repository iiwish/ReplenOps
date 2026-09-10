import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { menuItems } from '@/config/menuConfig'

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('inventory adjustment navigation', () => {
  it('keeps inventory changes as the single menu entry for logs and adjustments', () => {
    const inventory = menuItems.find((item) => item.key === 'inventory')

    expect(inventory?.children).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ label: '库存流水', path: '/admin/inventory/logs' }),
      ])
    )
    expect(JSON.stringify(inventory)).not.toContain('/admin/inventory/adjustment')
  })

  it('opens inventory adjustment in the log page modal', () => {
    const inventoryLogs = readSource('src/app/admin/inventory/logs/InventoryLogListClient.tsx')

    expect(inventoryLogs).toContain('<InventoryAdjustmentModal')
    expect(inventoryLogs).not.toContain('href="/admin/inventory/adjustment"')
  })

  it('applies log filters immediately without extra action buttons', () => {
    const inventoryLogs = readSource('src/app/admin/inventory/logs/InventoryLogListClient.tsx')
    const inventoryLogPage = readSource('src/app/admin/inventory/logs/page.tsx')

    expect(inventoryLogs).toContain('const applyFilters = (nextFilters: typeof filters)')
    expect(inventoryLogs).toContain('title="确认导出"')
    expect(inventoryLogs).toContain('type="primary"')
    expect(inventoryLogs).not.toContain('应用筛选')
    expect(inventoryLogs).not.toContain('重置')
    expect(inventoryLogs).not.toContain('刷新')
    expect(inventoryLogPage).toContain('getShanghaiYesterdayMonthDateRange')
  })

  it('redirects the retired adjustment page to the integrated workflow', () => {
    const legacyRoute = readSource('src/app/admin/inventory/adjustment/page.tsx')
    const costHistory = readSource('src/app/admin/inventory/cost-history/CostHistoryListClient.tsx')

    expect(legacyRoute).toContain("redirect('/admin/inventory/logs?adjustment=1')")
    expect(costHistory).not.toContain('/admin/inventory/adjustment')
  })

  it('applies cost history filters immediately in the shared toolbar layout', () => {
    const costHistory = readSource('src/app/admin/inventory/cost-history/CostHistoryListClient.tsx')

    expect(costHistory).toContain('const applyFilters = (nextFilters: typeof filters)')
    expect(costHistory).toContain('aria-label="仓库"')
    expect(costHistory).toContain('aria-label="商品ID"')
    expect(costHistory).toContain('aria-label="时间范围"')
    expect(costHistory).toContain("justifyContent: 'flex-end'")
    expect(costHistory).toContain('type="primary"')
    expect(costHistory).toContain('title="确认导出"')
    expect(costHistory).toContain('确认导出')
    expect(costHistory).not.toContain('handleFilter')
    expect(costHistory).not.toContain('handleReset')
    expect(costHistory).not.toContain('handleRefresh')
    expect(costHistory).not.toContain('<Card')
    expect(costHistory).not.toContain('<Typography.Title')
    expect(costHistory).not.toContain('>筛选<')
    expect(costHistory).not.toContain('>重置<')
    expect(costHistory).not.toContain('>刷新<')
  })
})
