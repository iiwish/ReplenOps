import { Prisma } from '@prisma/client'

export const orderingInventoryWhere = {
  isDeleted: false,
  warehouse: { isActive: true, isDeleted: false },
} satisfies Prisma.InventoryWhereInput

export function getSingleWarehouseAvailableQty(
  inventories: ReadonlyArray<{ availableQuantity: Prisma.Decimal }>
): number {
  return inventories.reduce((max, item) => Math.max(max, item.availableQuantity.toNumber()), 0)
}

export function describeOrderingShortage(
  items: ReadonlyArray<{ goodsId: number; quantity: Prisma.Decimal | number | string }>,
  inventories: ReadonlyArray<{ goodsId: number; availableQuantity: Prisma.Decimal }>,
  goods: ReadonlyArray<{ id: number; name: string; code: string; unit: string }>
): string {
  const details = items.map((item) => {
    const product = goods.find((candidate) => candidate.id === item.goodsId)
    const name = product ? `${product.name}（${product.code}）` : `商品 ${item.goodsId}`
    const unit = product?.unit ?? ''
    const requested = new Prisma.Decimal(item.quantity)
    const available = new Prisma.Decimal(
      getSingleWarehouseAvailableQty(
        inventories.filter((inventory) => inventory.goodsId === item.goodsId)
      )
    )
    return { name, unit, requested, available }
  })
  const shortages = details.filter((item) => item.requested.gt(item.available))
  if (shortages.length > 0) {
    return `库存不足：\n${shortages.map((item) => `${item.name}：订购 ${item.requested} ${item.unit}，单仓最多可订 ${item.available} ${item.unit}，缺少 ${item.requested.minus(item.available)} ${item.unit}`).join('\n')}`
  }
  return `商品无法同仓配齐：${details.map((item) => item.name).join('、')}。\n各商品单独可供，但没有单一仓库能满足整单；请调整商品或联系仓库调拨。`
}
