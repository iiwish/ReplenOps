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
    expect(markup).not.toContain('href="/mobile/inventory/scan"')
    expect(markup).toContain('href="/mobile/orders"')
    expect(markup).not.toContain('扫码')
    expect(markup.match(/min-h-\[82px\]/g)).toHaveLength(2)
  })

  it('keeps todo counts and destinations visible in compact rows', () => {
    const markup = renderToStaticMarkup(
      createElement(TodoList, {
        items: [
          {
            key: 'container',
            todo: {
              id: 'containers-return',
              type: 'container',
              title: '可归还包装物',
              description: '当前门店可申请归还的包装物数量',
              count: 2,
              link: '/mobile/container-return',
            },
          },
        ],
      })
    )

    expect(markup).toContain('href="/mobile/container-return"')
    expect(markup).toContain('可归还包装物')
    expect(markup).toContain('>2<')
    expect(markup).toContain('min-h-[72px]')
  })
})
