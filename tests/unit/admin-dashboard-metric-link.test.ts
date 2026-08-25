import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'

import { DashboardMetricLink } from '@/components/admin/dashboard/DashboardMetricLink'

describe('admin dashboard metric links', () => {
  it('renders a full-card navigation target with an accessible label', () => {
    const markup = renderToStaticMarkup(
      createElement(DashboardMetricLink, {
        href: '/admin/orders?status=COMPLETED',
        title: '已完成订单',
        value: 12,
        description: '已完成库存出库',
      })
    )

    expect(markup).toContain('href="/admin/orders?status=COMPLETED"')
    expect(markup).toContain('aria-label="查看已完成订单"')
    expect(markup).toContain('已完成库存出库')
    expect(markup).toContain('>12<')
  })
})
