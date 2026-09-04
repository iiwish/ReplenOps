import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('stock-in action UI', () => {
  it.each([
    'src/app/admin/stock-in/StockInListClient.tsx',
    'src/app/admin/stock-in/[id]/StockInDetailClient.tsx',
  ])('does not offer a duplicate reject action in %s', (path) => {
    const source = readSource(path)

    expect(source).not.toContain('const handleReject')
    expect(source).not.toContain('rejectStockIn,')
    expect(source).not.toContain('onClick={handleReject}')
    expect(source).not.toContain('onClick={() => handleReject(record)}')
  })

  it.each([
    'src/app/admin/stock-in/StockInListClient.tsx',
    'src/app/admin/stock-in/[id]/StockInDetailClient.tsx',
  ])('uses contextual feedback and keeps cancel validation synchronous in %s', (path) => {
    const source = readSource(path)

    expect(source).toContain('App.useApp()')
    expect(source).not.toContain('Modal.confirm(')
    expect(source).not.toContain('return Promise.reject()')
  })

  it('uses the current Timeline content API', () => {
    const source = readSource('src/app/admin/stock-in/[id]/StockInDetailClient.tsx')

    expect(source).not.toContain('children: (')
    expect(source).toContain('content: (')
  })
})
