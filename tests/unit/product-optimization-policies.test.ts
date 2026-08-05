import { describe, expect, it } from 'vitest'
import { GOODS_CODE_PATTERN, shouldValidateGoodsCode } from '@/lib/goods-code-policy'
import { getBreadcrumbItems, getOpenKeysForPath, menuItems } from '@/config/menuConfig'

describe('ReplenOps product optimization policies', () => {
  it('keeps the strict goods code rule for creation only', () => {
    expect(shouldValidateGoodsCode('create')).toBe(true)
    expect(shouldValidateGoodsCode('edit')).toBe(false)
    expect(GOODS_CODE_PATTERN.test('G000001')).toBe(true)
    expect(GOODS_CODE_PATTERN.test('GLE00143')).toBe(false)
  })

  it('exposes goods as its own navigation group', () => {
    const goodsGroup = menuItems.find((item) => item.key === 'goods-center')
    const inventoryGroup = menuItems.find((item) => item.key === 'inventory')

    expect(goodsGroup?.label).toBe('商品管理')
    expect(goodsGroup?.children?.map((item) => item.key)).toEqual(['goods', 'goods-category'])
    expect(inventoryGroup?.children?.some((item) => item.key === 'goods')).toBe(false)
  })

  it('keeps navigation context on detail and print routes', () => {
    expect(getBreadcrumbItems('/admin/stock-out/12', menuItems).map((item) => item.key)).toEqual([
      'inventory',
      'stock-out',
    ])
    expect(
      getBreadcrumbItems('/admin/stock-out/12/print', menuItems).map((item) => item.key)
    ).toEqual(['inventory', 'stock-out'])
    expect(getOpenKeysForPath('/admin/stock-out/12/print', menuItems)).toEqual(['inventory'])
    expect(getOpenKeysForPath('/admin/goods/12', menuItems)).toEqual(['goods-center'])
  })
})
