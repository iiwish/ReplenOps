import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('high-priority UX regression guards', () => {
  it('keeps checkout closed until the ordering window is confirmed open', () => {
    const orderPage = readSource('src/app/mobile/order/MobileOrderClient.tsx')

    expect(orderPage).toContain('const checkoutDisabled = orderingStatus?.isOpen !== true')
    expect(orderPage).toContain("title: orderingStatus ? '当前暂停报货'")
    expect(orderPage).toContain('disabled={isSubmitting || !orderingStatus?.isOpen}')
  })

  it('renders loading before deciding that an order is unavailable', () => {
    const orderDetail = readSource('src/app/admin/orders/[id]/OrderDetailClient.tsx')

    expect(orderDetail).toContain('const [loading, setLoading] = useState(true)')
    expect(orderDetail.indexOf('if (loading)')).toBeLessThan(orderDetail.indexOf('if (!order)'))
  })

  it('prevents credential autofill and binds stores in the user workflow', () => {
    const userForm = readSource('src/app/admin/users/UserFormModal.tsx')

    expect(userForm).toContain('autoComplete="new-password"')
    expect(userForm).toContain('form.setFieldsValue({ roles: [], storeIds: [] })')
    expect(userForm).toContain('name="storeIds"')
  })

  it('keeps the inventory table within the common desktop content width', () => {
    const inventoryQuery = readSource('src/app/admin/inventory/query/InventoryQueryListClient.tsx')

    expect(inventoryQuery).toContain('scroll={{ x: 1040 }}')
    expect(inventoryQuery).not.toContain('scroll={{ x: 1400 }}')
  })

  it('keeps goods actions in the modal footer while the form body scrolls', () => {
    const goodsList = readSource('src/app/admin/goods/GoodsListClient.tsx')

    expect(goodsList).toContain('form={GOODS_FORM_ID}')
    expect(goodsList).toContain("maxHeight: 'calc(100dvh - 220px)'")
    expect(goodsList).not.toContain('footer={null}')
  })
})
