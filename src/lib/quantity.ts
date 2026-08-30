export function formatGoodsQuantity(quantity: number, measureType: string): string {
  if (!Number.isFinite(quantity)) return '0'

  if (measureType === 'INT') {
    return Math.round(quantity).toLocaleString('zh-CN')
  }

  return quantity.toLocaleString('zh-CN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  })
}
