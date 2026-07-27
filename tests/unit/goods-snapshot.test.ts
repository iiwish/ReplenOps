import { describe, expect, it } from 'vitest'

import {
  assertGoodsUnitChangeAllowed,
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

  it('blocks unit changes after the goods has been used', () => {
    expect(() =>
      assertGoodsUnitChangeAllowed(
        goods,
        { unit: '个', measureType: 'INT' },
        { inventoryCount: 0, orderItemCount: 1, stockInItemCount: 0, stockOutItemCount: 0 }
      )
    ).toThrow('不能直接修改单位或计量类型')
  })

  it('allows unchanged units and unused goods', () => {
    expect(() =>
      assertGoodsUnitChangeAllowed(goods, goods, {
        inventoryCount: 1,
        orderItemCount: 1,
        stockInItemCount: 1,
        stockOutItemCount: 1,
      })
    ).not.toThrow()

    expect(() =>
      assertGoodsUnitChangeAllowed(
        goods,
        { unit: '个', measureType: 'INT' },
        {
          inventoryCount: 0,
          orderItemCount: 0,
          stockInItemCount: 0,
          stockOutItemCount: 0,
        }
      )
    ).not.toThrow()
  })
})
