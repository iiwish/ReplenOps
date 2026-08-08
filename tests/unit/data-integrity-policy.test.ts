import { describe, expect, it } from 'vitest'

import { buildIntegritySummary, emptyIntegrityCounts } from '@/lib/data-integrity-policy'

describe('data integrity policy', () => {
  it('passes only when every logical orphan count is zero', () => {
    const counts = emptyIntegrityCounts()

    expect(buildIntegritySummary(counts)).toEqual({
      status: 'PASS',
      violations: 0,
      failedChecks: [],
    })
  })

  it('reports the exact failed checks without exposing rows', () => {
    const counts = emptyIntegrityCounts()
    counts.activeInventoryWithDeletedGoods = 2
    counts.activeGoodsWithDeletedCategory = 1

    expect(buildIntegritySummary(counts)).toEqual({
      status: 'FAIL',
      violations: 3,
      failedChecks: ['activeGoodsWithDeletedCategory', 'activeInventoryWithDeletedGoods'],
    })
  })
})
