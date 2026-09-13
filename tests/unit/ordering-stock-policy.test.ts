import { describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import {
  getSingleWarehouseAvailableQty,
  describeOrderingShortage,
} from '@/services/ordering-stock-policy'

const inventory = (warehouseId: number, goodsId: number, quantity: string) => ({
  warehouseId,
  goodsId,
  availableQuantity: new Prisma.Decimal(quantity),
})
const goods = [
  { id: 1, name: '面粉', code: 'FLOUR', unit: '袋' },
  { id: 2, name: '糖', code: 'SUGAR', unit: '袋' },
]

describe('single warehouse ordering stock', () => {
  it('uses the largest single warehouse balance instead of adding warehouses', () => {
    expect(getSingleWarehouseAvailableQty([inventory(1, 1, '3'), inventory(2, 1, '4')])).toBe(4)
    expect(getSingleWarehouseAvailableQty([])).toBe(0)
  })
  it('identifies every insufficient item with exact decimal shortages', () => {
    const message = describeOrderingShortage(
      [
        { goodsId: 1, quantity: '0.3' },
        { goodsId: 2, quantity: 2 },
      ],
      [inventory(1, 1, '0.1')],
      goods
    )
    expect(message).toContain('面粉（FLOUR）：订购 0.3 袋，单仓最多可订 0.1 袋，缺少 0.2 袋')
    expect(message).toContain('糖（SUGAR）：订购 2 袋，单仓最多可订 0 袋，缺少 2 袋')
  })
  it('distinguishes a cross-warehouse combination from individual shortage', () => {
    const message = describeOrderingShortage(
      [
        { goodsId: 1, quantity: 2 },
        { goodsId: 2, quantity: 2 },
      ],
      [inventory(1, 1, '3'), inventory(2, 2, '3')],
      goods
    )
    expect(message).toContain('无法同仓配齐')
    expect(message).toContain('面粉（FLOUR）')
    expect(message).toContain('糖（SUGAR）')
    expect(message).not.toContain('缺少')
  })
})
