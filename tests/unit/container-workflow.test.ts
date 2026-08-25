import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { containerService } from '@/services/container.service'
import { containerTrackingService } from '@/services/container-tracking.service'
import { stockOutService } from '@/services/stock-out.service'
import { orderApprovalService } from '@/services/order-approval.service'

async function cleanDatabase() {
  const [stores, warehouses, goods, containers, orders] = await Promise.all([
    prisma.store.findMany({ where: { code: { startsWith: 'CW-' } }, select: { id: true } }),
    prisma.warehouse.findMany({ where: { code: { startsWith: 'CW-' } }, select: { id: true } }),
    prisma.goods.findMany({ where: { code: { startsWith: 'CW-' } }, select: { id: true } }),
    prisma.container.findMany({ where: { code: { startsWith: 'C-CW-' } }, select: { id: true } }),
    prisma.order.findMany({ where: { code: { startsWith: 'CW-' } }, select: { id: true } }),
  ])
  const storeIds = stores.map(({ id }) => id)
  const warehouseIds = warehouses.map(({ id }) => id)
  const goodsIds = goods.map(({ id }) => id)
  const containerIds = containers.map(({ id }) => id)
  const orderIds = orders.map(({ id }) => id)

  await prisma.containerLog.deleteMany({
    where: {
      OR: [
        { containerId: { in: containerIds } },
        { orderId: { in: orderIds } },
        { tracking: { storeId: { in: storeIds } } },
      ],
    },
  })
  await prisma.containerReturn.deleteMany({ where: { storeId: { in: storeIds } } })
  await prisma.containerTracking.deleteMany({
    where: { OR: [{ storeId: { in: storeIds } }, { containerId: { in: containerIds } }] },
  })
  await prisma.stockOutContainerItem.deleteMany({
    where: {
      OR: [{ containerId: { in: containerIds } }, { stockOut: { orderId: { in: orderIds } } }],
    },
  })
  await prisma.stockOutItem.deleteMany({ where: { stockOut: { orderId: { in: orderIds } } } })
  await prisma.stockOut.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.orderItem.deleteMany({ where: { orderId: { in: orderIds } } })
  await prisma.order.deleteMany({ where: { id: { in: orderIds } } })
  await prisma.containerGoodsBinding.deleteMany({
    where: { OR: [{ goodsId: { in: goodsIds } }, { containerId: { in: containerIds } }] },
  })
  await prisma.costHistory.deleteMany({
    where: { OR: [{ goodsId: { in: goodsIds } }, { warehouseId: { in: warehouseIds } }] },
  })
  await prisma.inventoryLog.deleteMany({ where: { inventory: { goodsId: { in: goodsIds } } } })
  await prisma.inventory.deleteMany({
    where: { OR: [{ goodsId: { in: goodsIds } }, { warehouseId: { in: warehouseIds } }] },
  })
  await prisma.goods.deleteMany({ where: { id: { in: goodsIds } } })
  await prisma.goodsCategory.deleteMany({ where: { code: { startsWith: 'CW-' } } })
  await prisma.store.deleteMany({ where: { id: { in: storeIds } } })
  await prisma.warehouse.deleteMany({ where: { id: { in: warehouseIds } } })
  await prisma.container.deleteMany({ where: { id: { in: containerIds } } })
}

async function seedMasterData() {
  const [store, warehouse, category] = await prisma.$transaction([
    prisma.store.create({ data: { code: 'CW-STORE', name: 'Container Store' } }),
    prisma.warehouse.create({ data: { code: 'CW-WH', name: 'Container Warehouse' } }),
    prisma.goodsCategory.create({ data: { code: 'CW-CAT', name: 'Container Category' } }),
  ])
  const goods = await prisma.goods.create({
    data: {
      code: 'CW-GOODS-1',
      name: 'Container Goods 1',
      categoryId: category.id,
      unit: '件',
      measureType: 'INT',
      partnerPrice: new Prisma.Decimal(8),
      costPrice: new Prisma.Decimal(5),
      defaultInPrice: new Prisma.Decimal(5),
    },
  })
  const secondGoods = await prisma.goods.create({
    data: {
      code: 'CW-GOODS-2',
      name: 'Container Goods 2',
      categoryId: category.id,
      unit: '件',
      measureType: 'INT',
      partnerPrice: new Prisma.Decimal(8),
      costPrice: new Prisma.Decimal(5),
      defaultInPrice: new Prisma.Decimal(5),
    },
  })

  return { store, warehouse, goods, secondGoods }
}

describe('container workflow', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  afterEach(async () => {
    await cleanDatabase()
  })

  it('maintains multiple goods bindings from the container master', async () => {
    const { goods, secondGoods } = await seedMasterData()

    const container = await containerService.create({
      code: 'C-CW-1',
      name: '周转筐',
      unit: '个',
      deposit: 20,
      goodsBindings: [
        { goodsId: String(goods.id), goodsQuantityPerContainer: 30 },
        { goodsId: String(secondGoods.id), goodsQuantityPerContainer: 12.5 },
      ],
    })

    expect(container.goodsBindings).toEqual([
      expect.objectContaining({ goodsId: String(goods.id), goodsQuantityPerContainer: 30 }),
      expect.objectContaining({ goodsId: String(secondGoods.id), goodsQuantityPerContainer: 12.5 }),
    ])

    const updated = await containerService.update(container.id, {
      goodsBindings: [{ goodsId: String(secondGoods.id), goodsQuantityPerContainer: 15 }],
    })
    expect(updated.goodsBindings).toEqual([
      expect.objectContaining({
        goodsId: String(secondGoods.id),
        goodsQuantityPerContainer: 15,
      }),
    ])
  })

  it('keeps the balance unchanged until warehouse receipt and applies actual quantity', async () => {
    const { store } = await seedMasterData()
    const container = await prisma.container.create({
      data: { code: 'C-CW-2', name: '周转箱', unit: '个', deposit: 10 },
    })
    const tracking = await prisma.containerTracking.create({
      data: {
        storeId: store.id,
        containerId: container.id,
        totalBorrowed: 10,
        currentBorrowed: 10,
      },
    })

    const request = await containerTrackingService.submitReturnRequest({
      storeId: String(store.id),
      items: [{ containerId: String(container.id), quantity: 6 }],
      operatorId: 'store-user',
    })

    await expect(
      prisma.containerTracking.findUniqueOrThrow({ where: { id: tracking.id } })
    ).resolves.toMatchObject({
      currentBorrowed: 10,
      pendingReturnQuantity: 6,
    })

    await containerTrackingService.completeReturnRequest(
      String(request.id),
      [{ itemId: String(request.items[0]!.id), receivedQuantity: 4 }],
      'warehouse-user',
      '实收4个'
    )

    await expect(
      prisma.containerTracking.findUniqueOrThrow({ where: { id: tracking.id } })
    ).resolves.toMatchObject({
      totalReturned: 4,
      currentBorrowed: 6,
      pendingReturnQuantity: 0,
    })
    expect(await prisma.containerLog.count({ where: { opType: 'RETURN', quantity: 4 } })).toBe(1)
  })

  it('releases pending quantity when a warehouse rejects the return', async () => {
    const { store } = await seedMasterData()
    const container = await prisma.container.create({
      data: { code: 'C-CW-3', name: '托盘', unit: '个', deposit: 30 },
    })
    const tracking = await prisma.containerTracking.create({
      data: { storeId: store.id, containerId: container.id, totalBorrowed: 5, currentBorrowed: 5 },
    })
    const request = await containerTrackingService.submitReturnRequest({
      storeId: String(store.id),
      items: [{ containerId: String(container.id), quantity: 3 }],
      operatorId: 'store-user',
    })

    await containerTrackingService.rejectReturnRequest(
      String(request.id),
      '未收到实物',
      'warehouse-user'
    )

    await expect(
      prisma.containerTracking.findUniqueOrThrow({ where: { id: tracking.id } })
    ).resolves.toMatchObject({
      currentBorrowed: 5,
      pendingReturnQuantity: 0,
    })
    await expect(
      prisma.containerReturn.findUniqueOrThrow({ where: { id: request.id } })
    ).resolves.toMatchObject({
      status: 'REJECTED',
      reviewReason: '未收到实物',
    })
  })

  it('releases pending quantity when the store cancels its request', async () => {
    const { store } = await seedMasterData()
    const container = await prisma.container.create({
      data: { code: 'C-CW-7', name: '可撤回筐', unit: '个', deposit: 10 },
    })
    const tracking = await prisma.containerTracking.create({
      data: { storeId: store.id, containerId: container.id, totalBorrowed: 8, currentBorrowed: 8 },
    })
    const request = await containerTrackingService.submitReturnRequest({
      storeId: String(store.id),
      items: [{ containerId: String(container.id), quantity: 5 }],
      operatorId: 'store-user',
    })

    await containerTrackingService.cancelReturnRequest(
      String(request.id),
      String(store.id),
      'store-user'
    )

    await expect(
      prisma.containerTracking.findUniqueOrThrow({ where: { id: tracking.id } })
    ).resolves.toMatchObject({
      currentBorrowed: 8,
      pendingReturnQuantity: 0,
    })
    await expect(
      prisma.containerReturn.findUniqueOrThrow({ where: { id: request.id } })
    ).resolves.toMatchObject({
      status: 'CANCELLED',
    })
  })

  it('prevents concurrent return requests from exceeding the available balance', async () => {
    const { store } = await seedMasterData()
    const container = await prisma.container.create({
      data: { code: 'C-CW-4', name: '周转桶', unit: '个', deposit: 15 },
    })
    await prisma.containerTracking.create({
      data: {
        storeId: store.id,
        containerId: container.id,
        totalBorrowed: 10,
        currentBorrowed: 10,
      },
    })

    const results = await Promise.allSettled([
      containerTrackingService.submitReturnRequest({
        storeId: String(store.id),
        items: [{ containerId: String(container.id), quantity: 7 }],
        operatorId: 'store-user',
      }),
      containerTrackingService.submitReturnRequest({
        storeId: String(store.id),
        items: [{ containerId: String(container.id), quantity: 7 }],
        operatorId: 'store-user',
      }),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    await expect(
      prisma.containerTracking.findUniqueOrThrow({
        where: { storeId_containerId: { storeId: store.id, containerId: container.id } },
      })
    ).resolves.toMatchObject({ currentBorrowed: 10, pendingReturnQuantity: 7 })
  })

  it('borrows containers from the stock-out snapshot without reading goods bindings', async () => {
    const { store, warehouse } = await seedMasterData()
    const container = await prisma.container.create({
      data: { code: 'C-CW-5', name: '配送筐', unit: '个', deposit: 8 },
    })
    const order = await prisma.order.create({
      data: { code: 'CW-ORDER', storeId: store.id, status: 'APPROVED', createdBy: 'admin' },
    })
    const stockOut = await prisma.stockOut.create({
      data: {
        code: 'CW-STOCK-OUT',
        warehouseId: warehouse.id,
        orderId: order.id,
        status: 'PENDING',
        containerItems: {
          create: {
            containerId: container.id,
            containerCodeSnapshot: container.code,
            containerNameSnapshot: container.name,
            containerUnitSnapshot: container.unit,
            expectedQuantity: 3,
            shippedQuantity: 3,
          },
        },
      },
    })

    await containerTrackingService.borrowContainers(String(stockOut.id), 'warehouse-user')

    await expect(
      prisma.containerTracking.findUniqueOrThrow({
        where: { storeId_containerId: { storeId: store.id, containerId: container.id } },
      })
    ).resolves.toMatchObject({ totalBorrowed: 3, currentBorrowed: 3 })
  })

  it('shows aggregated container requirements in pending-order approval details', async () => {
    const { store, goods, secondGoods } = await seedMasterData()
    const container = await prisma.container.create({
      data: {
        code: 'C-CW-8',
        name: '组合配送筐',
        unit: '个',
        deposit: 10,
        goodsBindings: {
          create: [
            { goodsId: goods.id, goodsQuantityPerContainer: 30 },
            { goodsId: secondGoods.id, goodsQuantityPerContainer: 12.5 },
          ],
        },
      },
    })
    const order = await prisma.order.create({
      data: {
        code: 'CW-ORDER-APPROVAL-CONTAINERS',
        storeId: store.id,
        status: 'PENDING',
        createdBy: 'admin',
        items: {
          create: [
            { goodsId: goods.id, quantity: 31, unitPrice: 8, totalPrice: 248 },
            { goodsId: secondGoods.id, quantity: 25, unitPrice: 8, totalPrice: 200 },
          ],
        },
      },
    })

    const detail = await orderApprovalService.getOrderDetailWithStock(String(order.id))

    expect(detail.containers).toEqual([
      expect.objectContaining({
        containerId: container.id,
        containerCode: container.code,
        containerName: container.name,
        expectedQuantity: 4,
        sources: [
          expect.objectContaining({ goodsId: goods.id, expectedQuantity: 2 }),
          expect.objectContaining({ goodsId: secondGoods.id, expectedQuantity: 2 }),
        ],
      }),
    ])
  })

  it('creates an immutable container snapshot when the stock-out is created', async () => {
    const { store, warehouse, goods } = await seedMasterData()
    const container = await prisma.container.create({
      data: {
        code: 'C-CW-6',
        name: '鸡蛋筐',
        unit: '个',
        deposit: 12,
        goodsBindings: {
          create: { goodsId: goods.id, goodsQuantityPerContainer: 30 },
        },
      },
    })
    const order = await prisma.order.create({
      data: {
        code: 'CW-ORDER-SNAPSHOT',
        storeId: store.id,
        status: 'APPROVED',
        createdBy: 'admin',
        items: {
          create: {
            goodsId: goods.id,
            quantity: 31,
            unitPrice: 8,
            totalPrice: 248,
          },
        },
      },
    })

    const stockOut = await prisma.$transaction((tx) =>
      stockOutService.createFromOrder(String(order.id), tx, warehouse.id)
    )

    await expect(
      prisma.stockOutContainerItem.findUniqueOrThrow({
        where: {
          stockOutId_containerId: { stockOutId: stockOut.id, containerId: container.id },
        },
      })
    ).resolves.toMatchObject({ expectedQuantity: 2, shippedQuantity: 2 })
  })
})
