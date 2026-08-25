import { describe, expect, it } from 'vitest'
import { getBreadcrumbItems, menuItems } from '@/config/menuConfig'

describe('store navigation', () => {
  it('uses one direct store management entry without the redundant overview page', () => {
    const storeItem = menuItems.find((item) => item.key === 'stores')

    expect(storeItem).toMatchObject({
      label: '门店管理',
      path: '/admin/stores',
    })
    expect(storeItem?.children).toBeUndefined()
    expect(JSON.stringify(menuItems)).not.toContain('/admin/store-admins')
  })

  it('keeps store administrator management under the store list breadcrumb', () => {
    expect(
      getBreadcrumbItems('/admin/stores/12/admins', menuItems).map((item) => item.label)
    ).toEqual(['门店管理'])
  })
})
