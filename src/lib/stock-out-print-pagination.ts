const MM_TO_CSS_PX = 96 / 25.4

export const STOCK_OUT_PRINT_CONTENT_WIDTH_MM = 186
export const STOCK_OUT_PRINT_CONTENT_HEIGHT_MM = 262

export const STOCK_OUT_PRINT_CONTENT_HEIGHT_PX = STOCK_OUT_PRINT_CONTENT_HEIGHT_MM * MM_TO_CSS_PX

export const STOCK_OUT_PRINT_MEASURE_RESERVE_PX = 24

export interface StockOutPrintMeasuredHeights {
  heading: number
  info: number
  head: number
  rows: number[]
  total: number
  signatures?: number
}

interface PaginateOptions {
  marginBoxesSupported?: boolean
  contentHeightPx?: number
  reservePx?: number
}

export function paginateStockOutPrintRows(
  rowCount: number,
  heights: StockOutPrintMeasuredHeights,
  options: PaginateOptions = {}
): number[][] {
  const {
    marginBoxesSupported = true,
    contentHeightPx = STOCK_OUT_PRINT_CONTENT_HEIGHT_PX,
    reservePx = STOCK_OUT_PRINT_MEASURE_RESERVE_PX,
  } = options
  const pageHeight = contentHeightPx - reservePx
  const firstPageBudget =
    pageHeight - (marginBoxesSupported ? 0 : heights.heading) - heights.info - heights.head
  const middlePageBudget = pageHeight - heights.head
  const footerHeight = heights.total + (heights.signatures ?? 0)

  const chunks: number[][] = []
  let current: number[] = []
  let used = 0
  const budgetFor = (pageIndex: number) => (pageIndex === 0 ? firstPageBudget : middlePageBudget)

  for (let index = 0; index < rowCount; index += 1) {
    const height = heights.rows[index] ?? 0
    const budget = budgetFor(chunks.length)
    const requiredHeight = height + (index === rowCount - 1 ? footerHeight : 0)
    if (current.length > 0 && used + requiredHeight > budget) {
      chunks.push(current)
      current = []
      used = 0
    }
    current.push(index)
    used += height
  }
  if (current.length > 0) chunks.push(current)
  return chunks.length > 0 ? chunks : [[]]
}
