import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main(): Promise<void> {
  const url = process.env.DATABASE_URL
  const database = url ? decodeURIComponent(new URL(url).pathname.slice(1)) : ''
  if (!/^replenops_demo(?:_[a-z0-9_]+)?$/.test(database)) {
    throw new Error('Demo verification requires a replenops_demo database')
  }

  const [stores, warehouses, goods, orders, stockOuts, inventory, users] = await Promise.all([
    prisma.store.count({ where: { isDeleted: false } }),
    prisma.warehouse.count({ where: { isDeleted: false } }),
    prisma.goods.count({ where: { isDeleted: false } }),
    prisma.order.count({ where: { isDeleted: false } }),
    prisma.stockOut.count({ where: { isDeleted: false } }),
    prisma.inventory.findMany({ select: { quantity: true, lockedQuantity: true, availableQuantity: true } }),
    prisma.user.findMany({ where: { username: { in: ['demo_store', 'demo_warehouse', 'demo_owner'] } }, select: { username: true, isActive: true, isDeleted: true } }),
  ])

  if (stores < 8 || warehouses < 2 || goods < 60 || orders < 70 || stockOuts < 50) {
    throw new Error('Demo master data or workflow history is incomplete')
  }
  if (users.length !== 3 || users.some((user) => !user.isActive || user.isDeleted)) {
    throw new Error('Demo accounts are incomplete')
  }
  if (
    inventory.some(
      (row) =>
        row.quantity.isNegative() ||
        row.lockedQuantity.isNegative() ||
        !row.availableQuantity.equals(row.quantity.minus(row.lockedQuantity))
    )
  ) {
    throw new Error('Demo inventory quantities are inconsistent')
  }

  const activeByStore = await prisma.order.groupBy({
    by: ['storeId'],
    where: { status: { in: ['PENDING', 'APPROVED', 'PROCESSING'] }, isDeleted: false },
    _count: { _all: true },
  })
  if (activeByStore.some((group) => group._count._all > 1)) {
    throw new Error('A demo store has more than one active order')
  }

  const activeOrders = await prisma.order.findMany({
    where: { status: { in: ['APPROVED', 'PROCESSING'] }, isDeleted: false },
    select: { status: true, lockedWarehouseId: true, stockOut: { select: { status: true, warehouseId: true } } },
  })
  if (
    activeOrders.some(
      (order) =>
        !order.stockOut ||
        (order.status === 'APPROVED' &&
          (order.stockOut.status !== 'PENDING' || order.lockedWarehouseId !== order.stockOut.warehouseId)) ||
        (order.status === 'PROCESSING' && order.stockOut.status !== 'COMPLETED')
    )
  ) {
    throw new Error('Demo order and stock-out states are inconsistent')
  }

  console.info(`Demo verified: ${stores} stores, ${warehouses} warehouses, ${goods} goods, ${orders} orders, ${stockOuts} stock-outs`)
}

main()
  .catch((error: unknown) => {
    console.error('Demo verification failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
