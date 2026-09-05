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

  it('redirects the retired adjustment page to the integrated workflow', () => {
    const legacyRoute = readSource('src/app/admin/inventory/adjustment/page.tsx')
    const costHistory = readSource('src/app/admin/inventory/cost-history/CostHistoryListClient.tsx')

    expect(legacyRoute).toContain("redirect('/admin/inventory/logs?adjustment=1')")
    expect(costHistory).not.toContain('/admin/inventory/adjustment')
  })
})
