import { describe, expect, it } from 'vitest'
import { buildCsv, escapeCsvCell } from '@/lib/csv'

describe('CSV export', () => {
  it('quotes delimiters and preserves numeric values', () => {
    expect(escapeCsvCell('包含,逗号')).toBe('"包含,逗号"')
    expect(escapeCsvCell('包含"引号')).toBe('"包含""引号"')
    expect(escapeCsvCell(-12.5)).toBe('-12.5')
    expect(buildCsv([['标题'], ['内容']])).toBe('\uFEFF标题\n内容')
  })

  it.each(['=1+1', '+cmd', '-2+3', '@SUM(A1:A2)', '  =1+1', '\t=1+1'])(
    'neutralizes spreadsheet formula input %s',
    (value) => {
      expect(escapeCsvCell(value)).toBe(`'${value}`)
    }
  )
})
