import { describe, expect, it } from 'vitest'
import { sortStockOutPrintItems } from '@/lib/stock-out-print-order'
import type { StockOutDetail } from '@/services/stock-out.service'

function item(
  id: string,
  categoryName: string,
  goodsName: string,
  goodsCode: string
): StockOutDetail['items'][number] {
  return {
    id,
    categoryName,
    goodsName,
    goodsCode,
    goodsId: id,
    goodsSpec: null,
    goodsUnit: '袋',
    quantity: 2,
    unitPrice: 3,
    lineAmount: 6,
    snapshotCost: 1,
    costAmount: 2,
  }
}

describe('stock-out print ordering', () => {
  it('groups by Chinese category, then name, natural code, and stable item id', () => {
    const input = [
      item('8', '', '饼干', 'G1'),
      item('7', '饮料', '白水', 'G1'),
      item('4', '饼干', '苏打', 'G10'),
      item('3', '饼干', '苏打', 'G2'),
      item('2', '饼干', '薄饼', 'G20'),
      item('1', '饼干', '薄饼', 'G20'),
    ]
    const original = [...input]
    expect(sortStockOutPrintItems(input).map((row) => row.id)).toEqual([
      '1',
      '2',
      '3',
      '4',
      '7',
      '8',
    ])
    expect(input).toEqual(original)
    expect(sortStockOutPrintItems(input).reduce((sum, row) => sum + row.lineAmount, 0)).toBe(36)
  })

  it('handles empty input and puts whitespace-only categories last', () => {
    expect(sortStockOutPrintItems([])).toEqual([])
    expect(
      sortStockOutPrintItems([item('1', ' ', '白水', 'G1'), item('2', '饮料', '白水', 'G1')]).map(
        (row) => row.id
      )
    ).toEqual(['2', '1'])
  })
})
