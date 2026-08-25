import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { menuItems } from '@/config/menuConfig'

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('order approval navigation', () => {
  it('keeps order management on a single list menu entry', () => {
    const orders = menuItems.find((item) => item.key === 'orders')

    expect(orders).toMatchObject({
      label: '订单管理',
      path: '/admin/orders',
    })
    expect(orders?.children).toBeUndefined()
    expect(JSON.stringify(menuItems)).not.toContain('/admin/order-approval')
  })

  it('redirects legacy approval routes into the pending order list', () => {
    const listRoute = readSource('src/app/admin/order-approval/page.tsx')
    const detailRoute = readSource('src/app/admin/order-approval/[id]/page.tsx')

    expect(listRoute).toContain("redirect('/admin/orders?status=PENDING')")
    expect(detailRoute).toContain('/admin/orders?status=PENDING&approval=')
  })

  it('opens approval from the order list instead of linking to the removed page', () => {
    const orderList = readSource('src/app/admin/orders/OrderListClient.tsx')

    expect(orderList).toContain('<OrderApprovalModal')
    expect(orderList).not.toContain('href={`/admin/order-approval/')
  })
})
