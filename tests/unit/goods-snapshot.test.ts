import { describe, expect, it } from 'vitest'

import {
  assertGoodsMeasureTypeChangeAllowed,
  buildGoodsSnapshot,
  resolveGoodsSnapshot,
} from '@/lib/goods-snapshot'

const goods = {
  code: 'GLE00143',
  name: '冰袋80袋/箱',
  spec: '80袋/箱',
  unit: '箱',
  measureType: 'INT' as const,
  categoryId: 2,
  category: { name: '耗材' },
}

describe('goods document snapshots', () => {
  it('captures the goods master when a document is created', () => {
    expect(buildGoodsSnapshot(goods)).toEqual({
      goodsCodeSnapshot: 'GLE00143',
      goodsNameSnapshot: '冰袋80袋/箱',
      goodsSpecSnapshot: '80袋/箱',
      goodsUnitSnapshot: '箱',
      measureTypeSnapshot: 'INT',
      categoryIdSnapshot: 2,
      categoryNameSnapshot: '耗材',
    })
  })

  it('uses the historical snapshot instead of the latest master', () => {
    const snapshot = resolveGoodsSnapshot(
      {
        goodsCodeSnapshot: 'GLE00143',
        goodsNameSnapshot: '冰袋',
        goodsSpecSnapshot: null,
        goodsUnitSnapshot: '个',
        measureTypeSnapshot: 'INT',
        categoryIdSnapshot: 1,
        categoryNameSnapshot: '日用品',
      },
      goods
    )

    expect(snapshot.goodsNameSnapshot).toBe('冰袋')
    expect(snapshot.goodsUnitSnapshot).toBe('个')
    expect(snapshot.categoryNameSnapshot).toBe('日用品')
  })

  it.each([
    { inventoryCount: 1, orderItemCount: 0, stockInItemCount: 0, stockOutItemCount: 0 },
    { inventoryCount: 0, orderItemCount: 1, stockInItemCount: 0, stockOutItemCount: 0 },
    { inventoryCount: 0, orderItemCount: 0, stockInItemCount: 1, stockOutItemCount: 0 },
    { inventoryCount: 0, orderItemCount: 0, stockInItemCount: 0, stockOutItemCount: 1 },
  ])('allows unit label changes for used goods: %j', (usage) => {
    expect(() =>
      assertGoodsMeasureTypeChangeAllowed(goods, { unit: '个', measureType: 'INT' }, usage)
    ).not.toThrow()

    expect(() =>
      assertGoodsMeasureTypeChangeAllowed(
        { unit: '公斤', measureType: 'DECIMAL' },
        { unit: 'kg', measureType: 'DECIMAL' },
        usage
      )
    ).not.toThrow()
  })

  it.each([
    { inventoryCount: 1, orderItemCount: 0, stockInItemCount: 0, stockOutItemCount: 0 },
    { inventoryCount: 0, orderItemCount: 1, stockInItemCount: 0, stockOutItemCount: 0 },
    { inventoryCount: 0, orderItemCount: 0, stockInItemCount: 1, stockOutItemCount: 0 },
    { inventoryCount: 0, orderItemCount: 0, stockInItemCount: 0, stockOutItemCount: 1 },
  ])('blocks measurement type changes in either direction for used goods: %j', (usage) => {
    expect(() =>
      assertGoodsMeasureTypeChangeAllowed(goods, { unit: '个', measureType: 'DECIMAL' }, usage)
    ).toThrow('商品已有库存或单据记录，不能直接修改计量类型；请新建商品编码')

    expect(() =>
      assertGoodsMeasureTypeChangeAllowed(
        { unit: 'kg', measureType: 'DECIMAL' },
        { unit: 'kg', measureType: 'INT' },
        usage
      )
    ).toThrow('商品已有库存或单据记录，不能直接修改计量类型；请新建商品编码')
  })

  it('allows unchanged measurement types for used goods', () => {
    expect(() =>
      assertGoodsMeasureTypeChangeAllowed(goods, goods, {
        inventoryCount: 1,
        orderItemCount: 1,
        stockInItemCount: 1,
        stockOutItemCount: 1,
      })
    ).not.toThrow()
  })

  it.each(['INT', 'DECIMAL'] as const)(
    'allows unused goods to change labels and measurement type to %s',
    (measureType) => {
      expect(() =>
        assertGoodsMeasureTypeChangeAllowed(
          { unit: 'kg', measureType: measureType === 'INT' ? 'DECIMAL' : 'INT' },
          { unit: '个', measureType },
          {
            inventoryCount: 0,
            orderItemCount: 0,
            stockInItemCount: 0,
            stockOutItemCount: 0,
          }
        )
      ).not.toThrow()
    }
  )
})
