import { Prisma } from '@prisma/client'

export interface InventoryLockItem {
  goodsId: number
  quantity: Prisma.Decimal | number | string
}

function toDecimal(value: Prisma.Decimal | number | string): Prisma.Decimal {
  return new Prisma.Decimal(value.toString())
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values))
}

export async function lockOrderInventory(
  tx: Prisma.TransactionClient,
  items: InventoryLockItem[]
): Promise<number> {
  const goodsIds = uniqueNumbers(items.map((item) => item.goodsId))
  const inventories = await tx.inventory.findMany({
    where: {
      goodsId: { in: goodsIds },
      isDeleted: false,
      warehouse: {
        isActive: true,
        isDeleted: false,
      },
    },
    orderBy: [{ warehouseId: 'asc' }, { goodsId: 'asc' }],
  })

  const warehouseIds = uniqueNumbers(inventories.map((inventory) => inventory.warehouseId))
  const selectedWarehouseId = warehouseIds.find((warehouseId) =>
    items.every((item) => {
      const inventory = inventories.find(
        (candidate) => candidate.warehouseId === warehouseId && candidate.goodsId === item.goodsId
      )
      if (!inventory) return false

      return inventory.availableQuantity.gte(toDecimal(item.quantity))
    })
  )

  if (selectedWarehouseId === undefined) {
    throw new Error('库存不足：没有单一仓库可满足该订单全部商品库存')
  }

  for (const item of items) {
    const quantity = toDecimal(item.quantity)
    const inventory = inventories.find(
      (candidate) =>
        candidate.warehouseId === selectedWarehouseId && candidate.goodsId === item.goodsId
    )

    if (!inventory) {
      throw new Error(`商品 ${item.goodsId} 库存记录不存在`)
    }

    const locked = await tx.inventory.updateMany({
      where: {
        id: inventory.id,
        isDeleted: false,
        availableQuantity: { gte: quantity },
      },
      data: {
        lockedQuantity: { increment: quantity },
        availableQuantity: { decrement: quantity },
      },
    })

    if (locked.count !== 1) {
      throw new Error(`商品 ${item.goodsId} 库存不足,请刷新后重试`)
    }
  }

  return selectedWarehouseId
}

export async function assertOrderInventoryLocked(
  tx: Prisma.TransactionClient,
  warehouseId: number,
  items: InventoryLockItem[]
): Promise<void> {
  for (const item of items) {
    const inventory = await tx.inventory.findUnique({
      where: {
        warehouseId_goodsId: {
          warehouseId,
          goodsId: item.goodsId,
        },
      },
    })

    if (!inventory) {
      throw new Error(`商品 ${item.goodsId} 库存记录不存在`)
    }

    if (inventory.lockedQuantity.lt(toDecimal(item.quantity))) {
      throw new Error(`商品 ${item.goodsId} 锁定库存不足,请撤回后重新报货`)
    }
  }
}

export async function releaseOrderInventory(
  tx: Prisma.TransactionClient,
  warehouseId: number | null,
  items: InventoryLockItem[]
): Promise<void> {
  if (warehouseId === null) {
    return
  }

  for (const item of items) {
    const quantity = toDecimal(item.quantity)
    const released = await tx.inventory.updateMany({
      where: {
        warehouseId,
        goodsId: item.goodsId,
        isDeleted: false,
        lockedQuantity: { gte: quantity },
      },
      data: {
        lockedQuantity: { decrement: quantity },
        availableQuantity: { increment: quantity },
      },
    })

    if (released.count !== 1) {
      throw new Error(`商品 ${item.goodsId} 锁定库存不足,无法释放`)
    }
  }
}
