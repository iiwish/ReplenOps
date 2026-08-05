import { beforeEach, describe, expect, it } from 'vitest'
import { Prisma, UserRoleEnum } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { orderService } from '@/services/order.service'
import { orderApprovalService } from '@/services/order-approval.service'
import { stockOutService } from '@/services/stock-out.service'
import { goodsService } from '@/services/goods.service'
import { stockInService } from '@/services/stock-in.service'

const adminUser: AuthUser = {
  id: 'stage2-admin',
  username: 'stage2-admin',
  name: 'Stage2 Admin',
  email: null,
  phone: null,
  avatar: null,
  isActive: true,
  roles: ['SUPER_ADMIN'],
}

interface TestFixtures {
  warehouseId: number
  storeId: number
  goodsId: number
}

async function cleanDatabase() {
  await prisma.containerLog.deleteMany()
  await prisma.containerTracking.deleteMany()
  await prisma.approvalLog.deleteMany()
  await prisma.stockOutItem.deleteMany()
  await prisma.stockOut.deleteMany()
  await prisma.orderItem.deleteMany()
  await prisma.order.deleteMany()
  await prisma.inventoryLog.deleteMany()
  await prisma.costHistory.deleteMany()
  await prisma.inventory.deleteMany()
  await prisma.stockInItem.deleteMany()
  await prisma.stockIn.deleteMany()
  await prisma.goods.deleteMany()
  await prisma.goodsCategory.deleteMany()
  await prisma.storeAdmin.deleteMany()
  await prisma.store.deleteMany()
  await prisma.warehouse.deleteMany()
  await prisma.userRole.deleteMany()
  await prisma.user.deleteMany()
}

async function seedFixtures(quantity = 10): Promise<TestFixtures> {
  const [warehouse, store, category] = await prisma.$transaction([
    prisma.warehouse.create({
      data: {
        code: 'WH-STAGE2',
        name: 'Stage2 Warehouse',
        isActive: true,
      },
    }),
    prisma.store.create({
      data: {
        code: 'ST-STAGE2',
        name: 'Stage2 Store',
        isActive: true,
      },
    }),
    prisma.goodsCategory.create({
      data: {
        code: 'CAT-STAGE2',
        name: 'Stage2 Category',
        isActive: true,
      },
    }),
    prisma.user.create({
      data: {
        id: adminUser.id,
        username: adminUser.username,
        password: 'not-used-in-service-tests',
        name: adminUser.name,
        roles: {
          create: {
            role: UserRoleEnum.SUPER_ADMIN,
          },
        },
      },
    }),
  ])

  const goods = await prisma.goods.create({
    data: {
      code: 'G-STAGE2',
      name: 'Stage2 Goods',
      categoryId: category.id,
      unit: '件',
      measureType: 'INT',
      partnerPrice: new Prisma.Decimal(8),
      costPrice: new Prisma.Decimal(5),
      defaultInPrice: new Prisma.Decimal(5),
      isActive: true,
    },
  })

  await prisma.inventory.create({
    data: {
      warehouseId: warehouse.id,
      goodsId: goods.id,
      quantity: new Prisma.Decimal(quantity),
      lockedQuantity: new Prisma.Decimal(0),
      availableQuantity: new Prisma.Decimal(quantity),
      avgCost: new Prisma.Decimal(5),
      totalCost: new Prisma.Decimal(quantity * 5),
    },
  })

  return {
    warehouseId: warehouse.id,
    storeId: store.id,
    goodsId: goods.id,
  }
}

async function getInventory(goodsId: number, warehouseId: number) {
  const inventory = await prisma.inventory.findUniqueOrThrow({
    where: {
      warehouseId_goodsId: {
        warehouseId,
        goodsId,
      },
    },
  })

  return {
    quantity: inventory.quantity.toNumber(),
    lockedQuantity: inventory.lockedQuantity.toNumber(),
    availableQuantity: inventory.availableQuantity.toNumber(),
  }
}

async function createStage2Order(fixtures: TestFixtures, quantity: number) {
  return orderService.create({
    storeId: String(fixtures.storeId),
    createdBy: adminUser.id,
    items: [
      {
        goodsId: String(fixtures.goodsId),
        quantity,
        unitPrice: 8,
      },
    ],
  })
}

describe('order inventory locking', () => {
  beforeEach(async () => {
    await cleanDatabase()
  })

  it('locks inventory when an order is created and does not lock again on approval', async () => {
    const fixtures = await seedFixtures(10)

    const order = await createStage2Order(fixtures, 3)
    const lockedAfterCreate = await getInventory(fixtures.goodsId, fixtures.warehouseId)

    expect(order.status).toBe('PENDING')
    expect(order.lockedWarehouseId).toBe(fixtures.warehouseId)
    expect(lockedAfterCreate).toEqual({
      quantity: 10,
      lockedQuantity: 3,
      availableQuantity: 7,
    })

    await orderApprovalService.approve(String(order.id), adminUser.id)
    const lockedAfterApproval = await getInventory(fixtures.goodsId, fixtures.warehouseId)

    expect(lockedAfterApproval).toEqual({
      quantity: 10,
      lockedQuantity: 3,
      availableQuantity: 7,
    })

    const stockOut = await prisma.stockOut.findUniqueOrThrow({
      where: { orderId: order.id },
    })

    await stockOutService.complete(String(stockOut.id), adminUser.id)
    const inventoryAfterOut = await getInventory(fixtures.goodsId, fixtures.warehouseId)

    expect(inventoryAfterOut).toEqual({
      quantity: 7,
      lockedQuantity: 0,
      availableQuantity: 7,
    })

    const completedStockOut = await prisma.stockOut.findUniqueOrThrow({
      where: { id: stockOut.id },
      include: { items: true },
    })
    expect(completedStockOut.totalCost.toNumber()).toBe(15)
    expect(completedStockOut.totalProfit.toNumber()).toBe(0)
    expect(completedStockOut.items[0]?.snapshotCost.toNumber()).toBe(5)
    expect(completedStockOut.items[0]?.profit.toNumber()).toBe(0)
  })

  it('releases locked inventory when an order is rejected', async () => {
    const fixtures = await seedFixtures(10)
    const order = await createStage2Order(fixtures, 4)

    await orderApprovalService.reject(String(order.id), adminUser.id, '库存暂不发放')

    const inventory = await getInventory(fixtures.goodsId, fixtures.warehouseId)
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })

    expect(updatedOrder.status).toBe('REJECTED')
    expect(updatedOrder.lockedWarehouseId).toBeNull()
    expect(inventory).toEqual({
      quantity: 10,
      lockedQuantity: 0,
      availableQuantity: 10,
    })
  })

  it('releases locked inventory when a pending stock-out is cancelled', async () => {
    const fixtures = await seedFixtures(10)
    const order = await createStage2Order(fixtures, 3)

    await orderApprovalService.approve(String(order.id), adminUser.id)
    const stockOut = await prisma.stockOut.findUniqueOrThrow({
      where: { orderId: order.id },
    })

    await stockOutService.cancel(String(stockOut.id), '门店取消报货', adminUser.id)

    const inventory = await getInventory(fixtures.goodsId, fixtures.warehouseId)
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })

    expect(updatedOrder.status).toBe('CANCELLED')
    expect(updatedOrder.lockedWarehouseId).toBeNull()
    expect(inventory).toEqual({
      quantity: 10,
      lockedQuantity: 0,
      availableQuantity: 10,
    })
  })

  it('releases locked inventory and restores cart items when a store withdraws an order', async () => {
    const fixtures = await seedFixtures(10)
    const order = await createStage2Order(fixtures, 2)

    const restoredItems = await orderService.revokeOrder(order.id, adminUser)

    const inventory = await getInventory(fixtures.goodsId, fixtures.warehouseId)
    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })

    expect(updatedOrder.isDeleted).toBe(true)
    expect(updatedOrder.lockedWarehouseId).toBeNull()
    expect(restoredItems).toHaveLength(1)
    expect(restoredItems[0]?.quantity).toBe(2)
    expect(inventory).toEqual({
      quantity: 10,
      lockedQuantity: 0,
      availableQuantity: 10,
    })
  })

  it('rolls back all locks when any item is out of stock', async () => {
    const fixtures = await seedFixtures(2)

    await expect(createStage2Order(fixtures, 3)).rejects.toThrow(/库存不足/)

    const inventory = await getInventory(fixtures.goodsId, fixtures.warehouseId)
    const orderCount = await prisma.order.count()

    expect(orderCount).toBe(0)
    expect(inventory).toEqual({
      quantity: 2,
      lockedQuantity: 0,
      availableQuantity: 2,
    })
  })

  it('does not oversell when concurrent orders compete for the same stock', async () => {
    const fixtures = await seedFixtures(5)

    const results = await Promise.allSettled([
      createStage2Order(fixtures, 4),
      createStage2Order(fixtures, 4),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

    const inventory = await getInventory(fixtures.goodsId, fixtures.warehouseId)
    const orderCount = await prisma.order.count()

    expect(orderCount).toBe(1)
    expect(inventory).toEqual({
      quantity: 5,
      lockedQuantity: 4,
      availableQuantity: 1,
    })
  })

  it('generates a unique order code with the OR prefix', async () => {
    const fixtures = await seedFixtures(10)
    await prisma.order.create({
      data: {
        code: 'OR202606140001',
        storeId: fixtures.storeId,
        status: 'COMPLETED',
        totalAmount: new Prisma.Decimal(0),
        createdBy: adminUser.id,
      },
    })

    const order = await createStage2Order(fixtures, 1)

    expect(order.code).toMatch(/^OR\d{8}\d{4}$/)
    expect(order.code).not.toBe('OR202606140001')
  })

  it('keeps document goods snapshots and protects used goods master data', async () => {
    const fixtures = await seedFixtures(10)
    const order = await createStage2Order(fixtures, 2)
    const newCategory = await prisma.goodsCategory.create({
      data: { code: 'CAT-NEW', name: 'New Category', isActive: true },
    })
    await prisma.store.update({
      where: { id: fixtures.storeId },
      data: { name: 'Renamed Store' },
    })

    await goodsService.update(
      String(fixtures.goodsId),
      {
        name: 'Renamed Goods',
        categoryId: String(newCategory.id),
        spec: 'New Spec',
        unit: '件',
        measureType: 'INT',
        costPrice: 5,
        partnerPrice: 8,
        defaultInPrice: 5,
      },
      adminUser.id
    )

    const detail = await orderService.getById(String(order.id), adminUser)
    expect(detail?.items[0]).toMatchObject({
      goodsCode: 'G-STAGE2',
      goodsName: 'Stage2 Goods',
      goodsUnit: '件',
      categoryName: 'Stage2 Category',
    })
    expect(detail?.storeName).toBe('Stage2 Store')

    await orderApprovalService.approve(String(order.id), adminUser.id)
    const stockOutItem = await prisma.stockOutItem.findFirstOrThrow({
      where: { stockOut: { orderId: order.id } },
    })
    expect(stockOutItem.goodsNameSnapshot).toBe('Stage2 Goods')
    expect(stockOutItem.categoryNameSnapshot).toBe('Stage2 Category')

    const stockOut = await prisma.stockOut.findUniqueOrThrow({ where: { orderId: order.id } })
    const approvedDetail = await orderService.getById(String(order.id), adminUser)
    expect(approvedDetail?.stockOut).toMatchObject({
      id: String(stockOut.id),
      code: stockOut.code,
    })
    await stockOutService.complete(String(stockOut.id), adminUser.id)

    await expect(
      goodsService.update(
        String(fixtures.goodsId),
        {
          name: 'Renamed Goods',
          categoryId: String(newCategory.id),
          spec: 'New Spec',
          unit: '箱',
          measureType: 'INT',
          costPrice: 5,
          partnerPrice: 8,
          defaultInPrice: 5,
        },
        adminUser.id
      )
    ).rejects.toThrow('不能直接修改单位或计量类型')

    await expect(goodsService.delete(String(fixtures.goodsId), adminUser.id)).rejects.toThrow(
      '仍有库存或锁定库存'
    )

    const audit = await prisma.approvalLog.findFirstOrThrow({
      where: { entityType: 'GOODS', entityId: String(fixtures.goodsId), action: 'GOODS_UPDATE' },
    })
    expect(audit.beforeJson).toMatchObject({ name: 'Stage2 Goods' })
    expect(audit.afterJson).toMatchObject({ name: 'Renamed Goods' })
  })

  it('does not combine stock from different warehouses during approval checks', async () => {
    const fixtures = await seedFixtures(10)
    const warehouse2 = await prisma.warehouse.create({
      data: { code: 'WH-STAGE2-B', name: 'Stage2 Warehouse B', isActive: true },
    })
    const goods = await prisma.goods.findUniqueOrThrow({ where: { id: fixtures.goodsId } })
    const goods2 = await prisma.goods.create({
      data: {
        code: 'G-STAGE2-B',
        name: 'Stage2 Goods B',
        categoryId: goods.categoryId,
        unit: '件',
        measureType: 'INT',
        partnerPrice: new Prisma.Decimal(8),
        costPrice: new Prisma.Decimal(5),
        defaultInPrice: new Prisma.Decimal(5),
        isActive: true,
      },
    })
    await prisma.inventory.create({
      data: {
        warehouseId: warehouse2.id,
        goodsId: goods2.id,
        quantity: new Prisma.Decimal(10),
        lockedQuantity: new Prisma.Decimal(0),
        availableQuantity: new Prisma.Decimal(10),
        avgCost: new Prisma.Decimal(5),
        totalCost: new Prisma.Decimal(50),
      },
    })
    const order = await prisma.order.create({
      data: {
        code: 'OR-SPLIT-WAREHOUSE',
        storeId: fixtures.storeId,
        storeNameSnapshot: 'Stage2 Store',
        status: 'PENDING',
        totalAmount: new Prisma.Decimal(32),
        createdBy: adminUser.id,
        items: {
          create: [
            {
              goodsId: fixtures.goodsId,
              quantity: new Prisma.Decimal(2),
              unitPrice: new Prisma.Decimal(8),
              totalPrice: new Prisma.Decimal(16),
            },
            {
              goodsId: goods2.id,
              quantity: new Prisma.Decimal(2),
              unitPrice: new Prisma.Decimal(8),
              totalPrice: new Prisma.Decimal(16),
            },
          ],
        },
      },
    })

    const detail = await orderApprovalService.getOrderDetailWithStock(String(order.id))

    expect(detail.warehouseId).toBeNull()
    expect(detail.canApprove).toBe(false)
    expect(detail.items.every((item) => item.stockStatus === 'insufficient')).toBe(true)
  })

  it('allows only one result when approval and rejection race', async () => {
    const fixtures = await seedFixtures(10)
    const order = await createStage2Order(fixtures, 3)

    const results = await Promise.allSettled([
      orderApprovalService.approve(String(order.id), adminUser.id),
      orderApprovalService.reject(String(order.id), adminUser.id, '并发审批拒绝'),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

    const updatedOrder = await prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    const stockOutCount = await prisma.stockOut.count({ where: { orderId: order.id } })
    const inventory = await getInventory(fixtures.goodsId, fixtures.warehouseId)

    if (updatedOrder.status === 'APPROVED') {
      expect(stockOutCount).toBe(1)
      expect(inventory).toEqual({ quantity: 10, lockedQuantity: 3, availableQuantity: 7 })
    } else {
      expect(updatedOrder.status).toBe('REJECTED')
      expect(stockOutCount).toBe(0)
      expect(inventory).toEqual({ quantity: 10, lockedQuantity: 0, availableQuantity: 10 })
    }
  })

  it('completes a stock-in document at most once', async () => {
    const fixtures = await seedFixtures(10)
    const stockIn = await stockInService.create({
      warehouseId: String(fixtures.warehouseId),
      createdBy: adminUser.id,
      items: [{ goodsId: String(fixtures.goodsId), quantity: 4, price: 6 }],
    })
    await stockInService.approve(stockIn.id, adminUser.id)

    const results = await Promise.allSettled([
      stockInService.complete(stockIn.id, adminUser.id),
      stockInService.complete(stockIn.id, adminUser.id),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)
    expect(await getInventory(fixtures.goodsId, fixtures.warehouseId)).toEqual({
      quantity: 14,
      lockedQuantity: 0,
      availableQuantity: 14,
    })
    expect(
      await prisma.costHistory.count({
        where: { referenceType: 'STOCK_IN', referenceId: stockIn.id },
      })
    ).toBe(1)
  })

  it('allows only one stock-in approval decision', async () => {
    const fixtures = await seedFixtures(10)
    const stockIn = await stockInService.create({
      warehouseId: String(fixtures.warehouseId),
      createdBy: adminUser.id,
      items: [{ goodsId: String(fixtures.goodsId), quantity: 2, price: 6 }],
    })

    const results = await Promise.allSettled([
      stockInService.approve(stockIn.id, adminUser.id),
      stockInService.reject(stockIn.id, '并发审批拒绝', adminUser.id),
    ])

    expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1)

    const updated = await prisma.stockIn.findUniqueOrThrow({
      where: { id: Number.parseInt(stockIn.id, 10) },
    })
    expect(['APPROVED', 'REJECTED']).toContain(updated.status)
    expect(
      await prisma.approvalLog.count({
        where: { entityType: 'STOCK_IN', entityId: stockIn.id },
      })
    ).toBe(1)
  })

  it('serializes different stock-ins that update the same inventory', async () => {
    const fixtures = await seedFixtures(10)
    const first = await stockInService.create({
      warehouseId: String(fixtures.warehouseId),
      createdBy: adminUser.id,
      items: [{ goodsId: String(fixtures.goodsId), quantity: 3, price: 6 }],
    })
    const second = await stockInService.create({
      warehouseId: String(fixtures.warehouseId),
      createdBy: adminUser.id,
      items: [{ goodsId: String(fixtures.goodsId), quantity: 4, price: 7 }],
    })
    await stockInService.approve(first.id, adminUser.id)
    await stockInService.approve(second.id, adminUser.id)

    await Promise.all([
      stockInService.complete(first.id, adminUser.id),
      stockInService.complete(second.id, adminUser.id),
    ])

    expect(await getInventory(fixtures.goodsId, fixtures.warehouseId)).toEqual({
      quantity: 17,
      lockedQuantity: 0,
      availableQuantity: 17,
    })
  })

  it('rolls back the stock-in header and items when item replacement fails', async () => {
    const fixtures = await seedFixtures(10)
    const stockIn = await stockInService.create({
      warehouseId: String(fixtures.warehouseId),
      createdBy: adminUser.id,
      items: [{ goodsId: String(fixtures.goodsId), quantity: 1, price: 5 }],
    })

    await expect(
      stockInService.update(stockIn.id, {
        items: [{ goodsId: String(fixtures.goodsId), quantity: 100_000_000, price: 0 }],
      })
    ).rejects.toThrow()

    const unchanged = await stockInService.findById(stockIn.id)
    expect(unchanged.totalAmount).toBe(5)
    expect(unchanged.items).toHaveLength(1)
    expect(unchanged.items[0]?.quantity).toBe(1)
    expect(unchanged.items[0]?.totalPrice).toBe(5)
  })
})
