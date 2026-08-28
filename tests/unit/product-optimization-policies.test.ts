import { describe, expect, it } from 'vitest'
import { GOODS_CODE_PATTERN, shouldValidateGoodsCode } from '@/lib/goods-code-policy'
import {
  getBreadcrumbItems,
  getOpenKeysForPath,
  getVisibleMenuItems,
  menuItems,
} from '@/config/menuConfig'

describe('ReplenOps product optimization policies', () => {
  it('keeps the strict goods code rule for creation only', () => {
    expect(shouldValidateGoodsCode('create')).toBe(true)
    expect(shouldValidateGoodsCode('edit')).toBe(false)
    expect(GOODS_CODE_PATTERN.test('G000001')).toBe(true)
    expect(GOODS_CODE_PATTERN.test('GLE00143')).toBe(false)
  })

  it('groups low-frequency master data and keeps packaging as one direct workspace', () => {
    const masterDataGroup = menuItems.find((item) => item.key === 'master-data')
    const inventoryGroup = menuItems.find((item) => item.key === 'inventory')
    const containers = menuItems.find((item) => item.key === 'containers')

    expect(masterDataGroup?.label).toBe('基础资料')
    expect(masterDataGroup?.children?.map((item) => item.key)).toEqual([
      'goods',
      'goods-category',
      'warehouse',
      'stores',
    ])
    expect(inventoryGroup?.children?.some((item) => item.key === 'goods')).toBe(false)
    expect(containers).toMatchObject({ label: '包装物', path: '/admin/containers' })
    expect(containers?.children).toBeUndefined()
  })

  it('shows navigation by role instead of exposing unavailable management entry points', () => {
    const superAdminKeys = getVisibleMenuItems(menuItems, ['super_admin']).map((item) => item.key)
    const approverKeys = getVisibleMenuItems(menuItems, ['approver']).map((item) => item.key)
    const financeKeys = getVisibleMenuItems(menuItems, ['finance']).map((item) => item.key)

    expect(superAdminKeys).toContain('system')
    expect(superAdminKeys).toContain('master-data')
    expect(approverKeys).not.toContain('system')
    expect(approverKeys).not.toContain('master-data')
    expect(approverKeys).toContain('containers')
    expect(financeKeys).toContain('reports')
    expect(financeKeys).not.toContain('system')
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
    expect(getOpenKeysForPath('/admin/goods/12', menuItems)).toEqual(['master-data'])
    expect(getBreadcrumbItems('/admin/containers', menuItems).map((item) => item.key)).toEqual([
      'containers',
    ])
  })
})
