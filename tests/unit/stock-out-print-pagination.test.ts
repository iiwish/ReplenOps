import { describe, expect, it } from 'vitest'
import { paginateStockOutPrintRows } from '@/lib/stock-out-print-pagination'

function heights(rowCount: number, rowHeight = 20) {
  return { heading: 40, info: 100, head: 30, rows: Array(rowCount).fill(rowHeight), total: 24 }
}

describe('stock-out print pagination', () => {
  it('fits a short table on a single page with the total row', () => {
    expect(paginateStockOutPrintRows(3, heights(3))).toEqual([[0, 1, 2]])
  })

  it('reserves first-page information as well as the total and signatures', () => {
    const chunks = paginateStockOutPrintRows(
      43,
      { ...heights(43), signatures: 40 },
      {
        contentHeightPx: 1000,
        reservePx: 0,
      }
    )
    expect(chunks.map((chunk) => chunk.length)).toEqual([42, 1])
  })

  it('retains a section for the total when there are no items', () => {
    expect(paginateStockOutPrintRows(0, heights(0))).toEqual([[]])
  })

  it('packs the first page with header overhead and fills middle pages', () => {
    const chunks = paginateStockOutPrintRows(100, heights(100), {
      contentHeightPx: 1000,
      reservePx: 0,
    })
    expect(chunks[0]).toHaveLength(43)
    expect(chunks[1]).toHaveLength(48)
    expect(chunks.flat()).toEqual(Array.from({ length: 100 }, (_, index) => index))
  })

  it('moves trailing rows so the total row stays on the last page', () => {
    const chunks = paginateStockOutPrintRows(91, heights(91), {
      contentHeightPx: 1000,
      reservePx: 0,
    })
    expect(chunks.map((chunk) => chunk.length)).toEqual([43, 47, 1])
    expect(chunks.flat()).toEqual(Array.from({ length: 91 }, (_, index) => index))
  })

  it('keeps tall rows whole and never splits them across pages', () => {
    const tall = heights(5)
    tall.rows = [20, 20, 900, 20, 20]
    const chunks = paginateStockOutPrintRows(5, tall, { contentHeightPx: 1000, reservePx: 0 })
    expect(chunks.flat()).toEqual([0, 1, 2, 3, 4])
    expect(chunks.findIndex((chunk) => chunk.includes(2))).toBeGreaterThan(0)
  })

  it('includes the heading height when margin boxes are unsupported', () => {
    const withBoxes = paginateStockOutPrintRows(100, heights(100), {
      contentHeightPx: 1000,
      reservePx: 0,
      marginBoxesSupported: true,
    })
    const withoutBoxes = paginateStockOutPrintRows(100, heights(100), {
      contentHeightPx: 1000,
      reservePx: 0,
      marginBoxesSupported: false,
    })
    expect(withoutBoxes[0]!.length).toBeLessThan(withBoxes[0]!.length)
  })
})
