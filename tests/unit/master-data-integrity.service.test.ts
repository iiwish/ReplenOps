import { afterEach, describe, expect, it } from 'vitest'
import type { Prisma } from '@prisma/client'

import { softDeletionData } from '@/lib/master-data-lifecycle'
import { prisma } from '@/lib/prisma'
import { containerService } from '@/services/container.service'
import { dataIntegrityService } from '@/services/data-integrity.service'
import { goodsService } from '@/services/goods.service'
import { warehouseService } from '@/services/warehouse.service'

const token = `integrity-${process.pid}-${Date.now()}`
const operatedBy = `${token}-operator`

async function createCategory(suffix: string) {
  return prisma.goodsCategory.create({
    data: { code: `${token}-category-${suffix}`, name: `测试分类 ${suffix}` },
  })
}

async function createGoods(categoryId: number, suffix: string) {
  return goodsService.create(
    {
      code: `${token}-goods-${suffix}`,
      name: `测试商品 ${suffix}`,
      categoryId: String(categoryId),
      unit: '个',
      measureType: 'INT',
      costPrice: 1,
      partnerPrice: 1,
      defaultInPrice: 1,
    },
    operatedBy
  )
}

async function raceParentActivationWithItemInsert(
  activateParent: (tx: Prisma.TransactionClient) => Promise<unknown>,
  insertItem: () => Promise<unknown>
) {
  let releaseParent: (() => void) | undefined
  const parentMayCommit = new Promise<void>((resolve) => {
    releaseParent = resolve
  })
  let parentActivated: (() => void) | undefined
  const parentIsUncommitted = new Promise<void>((resolve) => {
    parentActivated = resolve
  })

  const activation = prisma.$transaction(async (tx) => {
    await activateParent(tx)
    parentActivated?.()
    await parentMayCommit
  })
  await parentIsUncommitted

  const insertionResultPromise = Promise.allSettled([insertItem()])
  await new Promise((resolve) => setTimeout(resolve, 100))
  releaseParent?.()
  const [activationResult] = await Promise.allSettled([activation])
  const insertionResults = await insertionResultPromise
  const insertionResult = insertionResults[0]

  expect(activationResult.status).toBe('fulfilled')
  if (!insertionResult) {
    throw new Error('item insertion result is required')
  }
  return insertionResult
}

async function raceItemInsertWithParentActivation(
  insertItem: (tx: Prisma.TransactionClient) => Promise<unknown>,
  activateParent: () => Promise<unknown>
) {
  let releaseItem: (() => void) | undefined
  const itemMayCommit = new Promise<void>((resolve) => {
    releaseItem = resolve
  })
  let itemInserted: (() => void) | undefined
  const itemIsUncommitted = new Promise<void>((resolve) => {
    itemInserted = resolve
  })

  const insertion = prisma.$transaction(async (tx) => {
    await insertItem(tx)
    itemInserted?.()
    await itemMayCommit
  })
  await itemIsUncommitted

  const activationResultPromise = Promise.allSettled([activateParent()])
  await new Promise((resolve) => setTimeout(resolve, 100))
  releaseItem?.()
  const [insertionResult] = await Promise.allSettled([insertion])
  const activationResults = await activationResultPromise
  const activationResult = activationResults[0]

  expect(insertionResult.status).toBe('fulfilled')
  if (!activationResult) {
    throw new Error('parent activation result is required')
  }
  return activationResult
}

afterEach(async () => {
  const goods = await prisma.goods.findMany({
    where: { code: { startsWith: `${token}-goods-` } },
    select: { id: true },
  })
  const goodsIds = goods.map((item) => item.id)

  await prisma.stockOutItem.deleteMany({ where: { goodsId: { in: goodsIds } } })
  await prisma.stockOut.deleteMany({ where: { code: { startsWith: `${token}-stock-out-` } } })
  await prisma.stockInItem.deleteMany({ where: { goodsId: { in: goodsIds } } })
  await prisma.stockIn.deleteMany({ where: { code: { startsWith: `${token}-stock-in-` } } })
  await prisma.orderItem.deleteMany({ where: { goodsId: { in: goodsIds } } })
  await prisma.inventory.deleteMany({ where: { goodsId: { in: goodsIds } } })
  await prisma.order.deleteMany({ where: { code: { startsWith: `${token}-order-` } } })
  await prisma.approvalLog.deleteMany({ where: { operatedBy } })
  await prisma.goods.deleteMany({ where: { id: { in: goodsIds } } })
  await prisma.containerTracking.deleteMany({
    where: { container: { code: { startsWith: `${token}-container-` } } },
  })
  await prisma.container.deleteMany({ where: { code: { startsWith: `${token}-container-` } } })
  await prisma.warehouse.deleteMany({ where: { code: { startsWith: `${token}-warehouse-` } } })
  await prisma.store.deleteMany({ where: { code: { startsWith: `${token}-store-` } } })
  await prisma.goodsCategory.deleteMany({
    where: { code: { startsWith: `${token}-category-` } },
  })
})

describe('master data integrity services', () => {
  it('archives and restores the same goods identity without allowing code reuse', async () => {
    const category = await createCategory('lifecycle')
    const goods = await createGoods(category.id, 'lifecycle')

    await goodsService.delete(goods.id, operatedBy, '测试归档')

    const archived = await prisma.goods.findUniqueOrThrow({ where: { id: Number(goods.id) } })
    expect(archived).toMatchObject({
      isDeleted: true,
      isActive: false,
      deletedBy: operatedBy,
      deleteReason: '测试归档',
    })
    expect(archived.deletedAt).toBeInstanceOf(Date)

    await expect(createGoods(category.id, 'lifecycle')).rejects.toThrow(
      '商品编码已归档，请恢复原记录'
    )

    const restored = await goodsService.restore(goods.id, operatedBy)
    expect(restored.id).toBe(goods.id)
    expect(restored.isActive).toBe(false)

    const persisted = await prisma.goods.findUniqueOrThrow({ where: { id: Number(goods.id) } })
    expect(persisted).toMatchObject({
      isDeleted: false,
      isActive: false,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
    })
  })

  it('blocks warehouse deletion for locked inventory, including zero physical quantity', async () => {
    const category = await createCategory('warehouse')
    const goods = await createGoods(category.id, 'warehouse')
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `${token}-warehouse-locked`,
        name: '锁定库存仓库',
      },
    })
    await prisma.inventory.create({
      data: {
        warehouseId: warehouse.id,
        goodsId: Number(goods.id),
        quantity: 0,
        lockedQuantity: 1,
        availableQuantity: -1,
      },
    })

    await expect(warehouseService.delete(warehouse.id, operatedBy)).rejects.toThrow(
      '该仓库仍有库存、锁定库存或可用库存，无法删除'
    )
  })

  it('blocks goods deletion when only available inventory is non-zero', async () => {
    const category = await createCategory('goods-available')
    const goods = await createGoods(category.id, 'goods-available')
    const warehouse = await prisma.warehouse.create({
      data: {
        code: `${token}-warehouse-goods-available`,
        name: '可用库存仓库',
      },
    })
    await prisma.inventory.create({
      data: {
        warehouseId: warehouse.id,
        goodsId: Number(goods.id),
        quantity: 0,
        lockedQuantity: 0,
        availableQuantity: 1,
      },
    })

    await expect(goodsService.delete(goods.id, operatedBy)).rejects.toThrow(
      '商品仍有库存、锁定库存或可用库存，不能删除'
    )
  })

  it('prevents a concurrent active order from racing with goods deletion', async () => {
    const category = await createCategory('goods-concurrent')
    const goods = await createGoods(category.id, 'goods-concurrent')
    const store = await prisma.store.create({
      data: { code: `${token}-store-concurrent`, name: '并发删除测试门店' },
    })

    let releaseReference: (() => void) | undefined
    const referenceMayCommit = new Promise<void>((resolve) => {
      releaseReference = resolve
    })
    let referenceCreated: (() => void) | undefined
    const referenceIsUncommitted = new Promise<void>((resolve) => {
      referenceCreated = resolve
    })

    const createReference = prisma.$transaction(async (tx) => {
      const order = await tx.order.create({
        data: {
          code: `${token}-order-concurrent`,
          storeId: store.id,
          status: 'PENDING',
          totalAmount: 1,
          createdBy: operatedBy,
        },
      })
      await tx.orderItem.create({
        data: {
          orderId: order.id,
          goodsId: Number(goods.id),
          quantity: 1,
          unitPrice: 1,
          totalPrice: 1,
        },
      })
      referenceCreated?.()
      await referenceMayCommit
    })

    await referenceIsUncommitted
    const deleteGoods = goodsService.delete(goods.id, operatedBy, '并发归档测试')
    await new Promise((resolve) => setTimeout(resolve, 100))
    releaseReference?.()
    await createReference

    await expect(deleteGoods).rejects.toThrow()
    await expect(
      prisma.goods.findUniqueOrThrow({ where: { id: Number(goods.id) } })
    ).resolves.toMatchObject({ isDeleted: false })
  })

  it('serializes order activation with insertion of an item that uses deleted goods', async () => {
    const category = await createCategory('order-activation')
    const goods = await createGoods(category.id, 'order-activation')
    const store = await prisma.store.create({
      data: { code: `${token}-store-order-activation`, name: '订单激活测试门店' },
    })
    const order = await prisma.order.create({
      data: {
        code: `${token}-order-activation`,
        storeId: store.id,
        status: 'COMPLETED',
        totalAmount: 1,
        createdBy: operatedBy,
      },
    })
    await goodsService.delete(goods.id, operatedBy, '订单激活并发测试')

    const insertionResult = await raceParentActivationWithItemInsert(
      (tx) => tx.order.update({ where: { id: order.id }, data: { status: 'PENDING' } }),
      () =>
        prisma.orderItem.create({
          data: {
            orderId: order.id,
            goodsId: Number(goods.id),
            quantity: 1,
            unitPrice: 1,
            totalPrice: 1,
          },
        })
    )

    expect(insertionResult.status).toBe('rejected')
    expect(await prisma.orderItem.count({ where: { orderId: order.id } })).toBe(0)

    await prisma.order.update({ where: { id: order.id }, data: { status: 'COMPLETED' } })
    const activationResult = await raceItemInsertWithParentActivation(
      (tx) =>
        tx.orderItem.create({
          data: {
            orderId: order.id,
            goodsId: Number(goods.id),
            quantity: 1,
            unitPrice: 1,
            totalPrice: 1,
          },
        }),
      () => prisma.order.update({ where: { id: order.id }, data: { status: 'PENDING' } })
    )

    expect(activationResult.status).toBe('rejected')
    await expect(
      prisma.order.findUniqueOrThrow({ where: { id: order.id } })
    ).resolves.toMatchObject({ status: 'COMPLETED' })
  })

  it('serializes stock-in activation with insertion of an item that uses deleted goods', async () => {
    const category = await createCategory('stock-in-activation')
    const goods = await createGoods(category.id, 'stock-in-activation')
    const warehouse = await prisma.warehouse.create({
      data: { code: `${token}-warehouse-stock-in-activation`, name: '入库激活测试仓库' },
    })
    const stockIn = await prisma.stockIn.create({
      data: {
        code: `${token}-stock-in-activation`,
        warehouseId: warehouse.id,
        status: 'COMPLETED',
        totalAmount: 1,
        createdBy: operatedBy,
      },
    })
    await goodsService.delete(goods.id, operatedBy, '入库激活并发测试')

    const insertionResult = await raceParentActivationWithItemInsert(
      (tx) => tx.stockIn.update({ where: { id: stockIn.id }, data: { status: 'PENDING' } }),
      () =>
        prisma.stockInItem.create({
          data: {
            stockInId: stockIn.id,
            goodsId: Number(goods.id),
            quantity: 1,
            unitPrice: 1,
            totalPrice: 1,
          },
        })
    )

    expect(insertionResult.status).toBe('rejected')
    expect(await prisma.stockInItem.count({ where: { stockInId: stockIn.id } })).toBe(0)

    await prisma.stockIn.update({ where: { id: stockIn.id }, data: { status: 'COMPLETED' } })
    const activationResult = await raceItemInsertWithParentActivation(
      (tx) =>
        tx.stockInItem.create({
          data: {
            stockInId: stockIn.id,
            goodsId: Number(goods.id),
            quantity: 1,
            unitPrice: 1,
            totalPrice: 1,
          },
        }),
      () => prisma.stockIn.update({ where: { id: stockIn.id }, data: { status: 'PENDING' } })
    )

    expect(activationResult.status).toBe('rejected')
    await expect(
      prisma.stockIn.findUniqueOrThrow({ where: { id: stockIn.id } })
    ).resolves.toMatchObject({ status: 'COMPLETED' })
  })

  it('serializes stock-out activation with insertion of an item that uses deleted goods', async () => {
    const category = await createCategory('stock-out-activation')
    const goods = await createGoods(category.id, 'stock-out-activation')
    const store = await prisma.store.create({
      data: { code: `${token}-store-stock-out-activation`, name: '出库激活测试门店' },
    })
    const warehouse = await prisma.warehouse.create({
      data: { code: `${token}-warehouse-stock-out-activation`, name: '出库激活测试仓库' },
    })
    const order = await prisma.order.create({
      data: {
        code: `${token}-order-stock-out-activation`,
        storeId: store.id,
        status: 'COMPLETED',
        totalAmount: 1,
        createdBy: operatedBy,
      },
    })
    const stockOut = await prisma.stockOut.create({
      data: {
        code: `${token}-stock-out-activation`,
        warehouseId: warehouse.id,
        orderId: order.id,
        status: 'COMPLETED',
        totalCost: 1,
        totalProfit: 0,
        createdBy: operatedBy,
      },
    })
    await goodsService.delete(goods.id, operatedBy, '出库激活并发测试')

    const insertionResult = await raceParentActivationWithItemInsert(
      (tx) => tx.stockOut.update({ where: { id: stockOut.id }, data: { status: 'PENDING' } }),
      () =>
        prisma.stockOutItem.create({
          data: {
            stockOutId: stockOut.id,
            goodsId: Number(goods.id),
            quantity: 1,
            snapshotCost: 1,
            salePrice: 1,
            profit: 0,
          },
        })
    )

    expect(insertionResult.status).toBe('rejected')
    expect(await prisma.stockOutItem.count({ where: { stockOutId: stockOut.id } })).toBe(0)

    await prisma.stockOut.update({ where: { id: stockOut.id }, data: { status: 'COMPLETED' } })
    const activationResult = await raceItemInsertWithParentActivation(
      (tx) =>
        tx.stockOutItem.create({
          data: {
            stockOutId: stockOut.id,
            goodsId: Number(goods.id),
            quantity: 1,
            snapshotCost: 1,
            salePrice: 1,
            profit: 0,
          },
        }),
      () => prisma.stockOut.update({ where: { id: stockOut.id }, data: { status: 'PENDING' } })
    )

    expect(activationResult.status).toBe('rejected')
    await expect(
      prisma.stockOut.findUniqueOrThrow({ where: { id: stockOut.id } })
    ).resolves.toMatchObject({ status: 'COMPLETED' })
  })

  it('blocks container deletion while an active goods record uses it', async () => {
    const category = await createCategory('container')
    const container = await prisma.container.create({
      data: { code: `${token}-container-used`, name: '周转箱', unit: '个', deposit: 0 },
    })
    const goods = await createGoods(category.id, 'container')
    await prisma.containerGoodsBinding.create({
      data: {
        containerId: container.id,
        goodsId: Number(goods.id),
        goodsQuantityPerContainer: 1,
      },
    })

    await expect(containerService.delete(String(container.id), operatedBy)).rejects.toThrow(
      '该包装物仍有关联商品，无法删除'
    )
  })

  it('detects an active order that references a logically deleted goods record', async () => {
    const category = await createCategory('scan')
    const goods = await createGoods(category.id, 'scan')
    const store = await prisma.store.create({
      data: { code: `${token}-store-scan`, name: '完整性测试门店' },
    })
    const order = await prisma.order.create({
      data: {
        code: `${token}-order-scan`,
        storeId: store.id,
        totalAmount: 1,
        createdBy: operatedBy,
      },
    })
    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        goodsId: Number(goods.id),
        quantity: 1,
        unitPrice: 1,
        totalPrice: 1,
      },
    })
    await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe('SET LOCAL session_replication_role = replica')
      await tx.goods.update({
        where: { id: Number(goods.id) },
        data: softDeletionData(operatedBy, '测试逻辑孤儿'),
      })
    })

    const report = await dataIntegrityService.scan()

    expect(report.summary.status).toBe('FAIL')
    expect(report.counts.activeOrderItemsWithDeletedGoods).toBeGreaterThanOrEqual(1)
    expect(report.summary.failedChecks).toContain('activeOrderItemsWithDeletedGoods')
  })

  it('rejects a category whose parent does not exist', async () => {
    await expect(
      prisma.goodsCategory.create({
        data: {
          code: `${token}-category-orphan`,
          name: '孤儿分类',
          parentId: 2_147_483_000,
        },
      })
    ).rejects.toMatchObject({ code: 'P2003' })
  })
})
