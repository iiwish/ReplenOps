import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const readSource = (filePath: string) => readFileSync(resolve(process.cwd(), filePath), 'utf8')

describe('stock-out print navigation', () => {
  it('uses one confirmation style and does not ask about printing after completion', () => {
    const list = readSource('src/app/admin/stock-out/StockOutListClient.tsx')
    const detail = readSource('src/app/admin/stock-out/[id]/StockOutDetailClient.tsx')
    const confirmation = readSource('src/components/admin/stock-out/confirmStockOut.ts')

    expect(list).toContain('confirmStockOut({')
    expect(detail).toContain('confirmStockOut({')
    expect(confirmation).toContain("title: '确认出库'")
    expect(confirmation).toContain("okButtonProps: { danger: true }")
    expect(list).not.toContain('是否立即打印出库单')
    expect(detail).not.toContain('是否立即打印出库单')
  })

  it('opens print preview from completed rows instead of opening a new tab', () => {
    const list = readSource('src/app/admin/stock-out/StockOutListClient.tsx')

    expect(list).toContain('PrinterOutlined')
    expect(list).toContain("status === 'COMPLETED'")
    expect(list).toContain('<StockOutPrintModal')
    expect(list).not.toContain('window.open(`/admin/stock-out/${record.id}/print`')
  })

  it('uses the print preview modal from the stock-out detail page', () => {
    const detail = readSource('src/app/admin/stock-out/[id]/StockOutDetailClient.tsx')

    expect(detail).toContain('<StockOutPrintModal')
    expect(detail).toContain('initialStockOut={stockOut}')
    expect(detail).not.toContain('target="_blank"')
    expect(detail).not.toContain('href={`/admin/stock-out/${stockOut.id}/print`')
  })
})
