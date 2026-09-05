import { describe, expect, it } from 'vitest'
import { getBreadcrumbItems, menuItems } from '@/config/menuConfig'

describe('store navigation', () => {
  it('uses one direct store management entry without the redundant overview page', () => {
    const masterData = menuItems.find((item) => item.key === 'master-data')
    const storeItem = masterData?.children?.find((item) => item.key === 'stores')

    expect(storeItem).toMatchObject({
      label: '门店档案',
      path: '/admin/stores',
    })
    expect(storeItem?.children).toBeUndefined()
    expect(JSON.stringify(menuItems)).not.toContain('/admin/store-admins')
  })

  it('keeps store administrator management under the store list breadcrumb', () => {
    expect(
      getBreadcrumbItems('/admin/stores/12/admins', menuItems).map((item) => item.label)
    ).toEqual(['基础资料', '门店档案'])
  })
})
