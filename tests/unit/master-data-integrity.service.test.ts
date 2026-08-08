import { afterEach, describe, expect, it } from 'vitest'

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

async function createGoods(categoryId: number, suffix: string, containerId?: number) {
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
      ...(containerId === undefined ? {} : { containerId: String(containerId), containerRatio: 1 }),
    },
    operatedBy
  )
}

afterEach(async () => {
  const goods = await prisma.goods.findMany({
    where: { code: { startsWith: `${token}-goods-` } },
    select: { id: true },
  })
  const goodsIds = goods.map((item) => item.id)

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

  it('blocks container deletion while an active goods record uses it', async () => {
    const category = await createCategory('container')
    const container = await prisma.container.create({
      data: { code: `${token}-container-used`, name: '周转箱', unit: '个', deposit: 0 },
    })
    await createGoods(category.id, 'container', container.id)

    await expect(containerService.delete(String(container.id), operatedBy)).rejects.toThrow(
      '该包装物仍被活动商品使用，无法删除'
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
    await prisma.goods.update({
      where: { id: Number(goods.id) },
      data: softDeletionData(operatedBy, '测试逻辑孤儿'),
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
