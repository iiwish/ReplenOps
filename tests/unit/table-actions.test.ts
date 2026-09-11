import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { readFileSync, readdirSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import ActionTextButton from '@/components/admin/ActionTextButton'
import TableActions from '@/components/admin/TableActions'

describe('table text actions', () => {
  it('renders visible text, accessible names and danger/disabled states', () => {
    const html = renderToStaticMarkup(
      createElement(ActionTextButton, { label: '删除', danger: true, disabled: true })
    )
    expect(html).toContain('>删除</span>')
    expect(html).toContain('aria-label="删除"')
    expect(html).toContain('ant-btn-link')
    expect(html).toContain('ant-btn-dangerous')
    expect(html).toContain('disabled=""')
    expect(html).not.toContain('ant-btn-icon-only')
  })

  it('keeps loading actions labelled and groups bounded with wrapping', () => {
    const html = renderToStaticMarkup(
      createElement(
        TableActions,
        null,
        createElement(ActionTextButton, { label: '确认出库', loading: true })
      )
    )
    expect(html).toContain('确认出库')
    expect(html).toContain('ant-btn-loading')
    expect(html).toContain('flex-wrap')
    expect(html).toContain('max-w-full')
    expect(html).toContain('gap-x-3')
  })

  it('uses text actions across every admin action column', () => {
    for (const directory of ['src/app/admin', 'src/components/admin']) {
      const root = new URL(`../../${directory}/`, import.meta.url)
      for (const file of readdirSync(root, { recursive: true })) {
        if (typeof file !== 'string' || !file.endsWith('.tsx')) continue
        const source = readFileSync(new URL(file, root), 'utf8')
        if (!source.includes("title: '操作',")) continue
        expect(source, file).toContain('ActionTextButton')
        expect(source, file).not.toContain('ActionIconButton')
      }
    }
  })
})
