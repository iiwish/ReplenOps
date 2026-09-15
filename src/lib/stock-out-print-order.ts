import type { StockOutDetail } from '@/services/stock-out.service'

const collator = new Intl.Collator('zh-CN-u-co-pinyin', { numeric: true })

export function sortStockOutPrintItems(items: StockOutDetail['items']): StockOutDetail['items'] {
  return [...items].sort((a, b) => {
    const categoryA = a.categoryName.trim()
    const categoryB = b.categoryName.trim()
    return (
      Number(!categoryA) - Number(!categoryB) ||
      collator.compare(categoryA, categoryB) ||
      collator.compare(a.goodsName, b.goodsName) ||
      collator.compare(a.goodsCode, b.goodsCode) ||
      collator.compare(a.id, b.id)
    )
  })
}
