import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { Package } from 'lucide-react'
import { describe, expect, it } from 'vitest'

import { QuickActions } from '@/components/mobile/dashboard/QuickActions'
import { StatCard } from '@/components/mobile/dashboard/StatCard'
import { TodoList } from '@/components/mobile/dashboard/TodoList'

describe('mobile dashboard components', () => {
  it('keeps overview cards on the shared compact height', () => {
    const markup = renderToStaticMarkup(
      createElement(StatCard, {
        icon: Package,
        title: '待归还包装物',
        value: 12,
        color: 'green',
      })
    )

    expect(markup).toContain('min-h-[108px]')
    expect(markup).toContain('待归还包装物')
    expect(markup).toContain('>12<')
  })

  it('renders every quick action with an available navigation target', () => {
    const markup = renderToStaticMarkup(createElement(QuickActions))

    expect(markup).toContain('href="/mobile/order"')
    expect(markup.match(/href="\/mobile\/inventory\/scan"/g)).toHaveLength(2)
    expect(markup).toContain('href="/mobile/orders"')
    expect(markup.match(/min-h-\[82px\]/g)).toHaveLength(4)
  })

  it('keeps todo counts and destinations visible in compact rows', () => {
    const markup = renderToStaticMarkup(
      createElement(TodoList, {
        items: [
          {
            key: 'inventory',
            todo: {
              id: 'low-stock',
              type: 'inventory',
              title: '库存预警',
              description: '部分商品库存不足',
              count: 26,
              link: '/mobile/inventory/scan',
            },
          },
        ],
      })
    )

    expect(markup).toContain('href="/mobile/inventory/scan"')
    expect(markup).toContain('库存预警')
    expect(markup).toContain('>26<')
    expect(markup).toContain('min-h-[72px]')
  })
})
