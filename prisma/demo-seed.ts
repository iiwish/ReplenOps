import bcrypt from 'bcryptjs'
import { PrismaClient, type Container, type Store } from '@prisma/client'

const prisma = new PrismaClient()

const categories = [
  {
    name: '米面粮油',
    unit: '袋',
    names: ['东北大米', '长粒香米', '糯米', '高筋面粉', '低筋面粉', '挂面', '小米', '燕麦片'],
  },
  {
    name: '调味干货',
    unit: '箱',
    names: ['生抽', '老抽', '蚝油', '米醋', '白砂糖', '食盐', '花椒', '干香菇'],
  },
  {
    name: '新鲜蔬菜',
    unit: '筐',
    names: ['番茄', '黄瓜', '土豆', '胡萝卜', '西兰花', '菠菜', '洋葱', '青椒', '生菜', '香菜'],
  },
  {
    name: '肉禽蛋类',
    unit: '箱',
    names: ['鸡胸肉', '鸡腿肉', '五花肉', '牛腩', '牛肉片', '鸭胸肉', '鸡蛋', '鹌鹑蛋'],
  },
  {
    name: '水产海鲜',
    unit: '箱',
    names: ['虾仁', '巴沙鱼', '三文鱼', '鱿鱼圈', '扇贝肉', '带鱼段', '墨鱼丸', '海带丝'],
  },
  {
    name: '乳品饮料',
    unit: '箱',
    names: ['纯牛奶', '酸奶', '豆浆', '椰奶', '橙汁', '矿泉水', '乌龙茶', '苏打水'],
  },
  {
    name: '速冻食品',
    unit: '箱',
    names: ['手工水饺', '小笼包', '薯条', '鸡块', '汤圆', '蛋挞皮', '披萨饼底', '油条'],
  },
  {
    name: '餐厨用品',
    unit: '箱',
    names: ['餐巾纸', '一次性手套', '打包餐盒', '保鲜膜', '吸管', '纸杯', '垃圾袋', '清洁海绵'],
  },
] as const

const storeNames = [
  '海港城示范店',
  '中环示范店',
  '铜锣湾示范店',
  '尖沙咀示范店',
  '太古示范店',
  '旺角示范店',
  '沙田示范店',
  '荃湾示范店',
]

function dateDaysAgo(days: number, hours = 10): Date {
  const date = new Date()
  date.setHours(hours, 0, 0, 0)
  date.setDate(date.getDate() - days)
  return date
}

function money(cents: number): string {
  return (cents / 100).toFixed(2)
}

function assertDemoTarget(): void {
  const url = process.env.DATABASE_URL
  const database = url ? decodeURIComponent(new URL(url).pathname.slice(1)) : ''
  if (
    process.env.APP_ENV !== 'preview' ||
    process.env.DEMO_SEED_CONFIRM !== 'replenops-demo-only' ||
    !/^replenops_demo(?:_[a-z0-9_]+)?$/.test(database)
  ) {
    throw new Error('Demo seed requires APP_ENV=preview and a replenops_demo database')
  }
}

async function main(): Promise<void> {
  assertDemoTarget()
  const accountPassword = process.env.DEMO_ACCOUNT_PASSWORD
  const ownerPassword = process.env.DEMO_OWNER_PASSWORD
  if (
    !accountPassword ||
    accountPassword.length < 24 ||
    !ownerPassword ||
    ownerPassword.length < 24
  ) {
    throw new Error('Demo account passwords must be at least 24 characters')
  }
  if ((await prisma.goods.count()) > 0 || (await prisma.order.count()) > 0) {
    throw new Error('Demo seed only runs on an empty database')
  }

  const passwordHash = await bcrypt.hash(accountPassword, 12)
  const ownerPasswordHash = await bcrypt.hash(ownerPassword, 12)
  const [storeUser, warehouseUser, ownerUser] = await Promise.all([
    prisma.user.create({
      data: {
        username: 'demo_store',
        name: '演示门店员',
        password: passwordHash,
        roles: { create: { role: 'STORE_ADMIN' } },
      },
    }),
    prisma.user.create({
      data: {
        username: 'demo_warehouse',
        name: '演示仓库员',
        password: passwordHash,
        roles: { create: { role: 'WAREHOUSE_MANAGER' } },
      },
    }),
    prisma.user.create({
      data: {
        username: 'demo_owner',
        name: '演示环境管理员',
        password: ownerPasswordHash,
        roles: { create: { role: 'SUPER_ADMIN' } },
      },
    }),
  ])

  const warehouses = await Promise.all([
    prisma.warehouse.create({
      data: { code: 'WH-DEMO-01', name: '常温配送中心', address: '演示数据 · 九龙' },
    }),
    prisma.warehouse.create({
      data: { code: 'WH-DEMO-02', name: '冷链配送中心', address: '演示数据 · 新界' },
    }),
  ])
  const primaryWarehouse = warehouses[0]
  if (!primaryWarehouse) throw new Error('Primary warehouse is missing')
  const stores: Store[] = []
  for (const [index, name] of storeNames.entries()) {
    const store = await prisma.store.create({
      data: {
        code: `ST-DEMO-${String(index + 1).padStart(2, '0')}`,
        name,
        address: '仅供项目演示使用',
      },
    })
    stores.push(store)
    await prisma.storeAdmin.create({ data: { userId: storeUser.id, storeId: store.id } })
  }

  const goods: Array<{
    id: number
    code: string
    name: string
    spec: string
    unit: string
    categoryId: number
    categoryName: string
    measureType: 'INT' | 'DECIMAL'
    priceCents: number
    costCents: number
  }> = []
  for (const [categoryIndex, category] of categories.entries()) {
    const createdCategory = await prisma.goodsCategory.create({
      data: {
        code: `CAT-DEMO-${String(categoryIndex + 1).padStart(2, '0')}`,
        name: category.name,
        sortOrder: categoryIndex + 1,
      },
    })
    for (const [itemIndex, name] of category.names.entries()) {
      const code = `GD-DEMO-${String(categoryIndex + 1).padStart(2, '0')}${String(itemIndex + 1).padStart(2, '0')}`
      const priceCents = 980 + categoryIndex * 320 + itemIndex * 145
      const costCents = Math.round(priceCents * 0.68)
      const measureType = categoryIndex === 2 ? 'DECIMAL' : 'INT'
      const spec = categoryIndex === 2 ? '5千克/筐' : '标准装'
      const created = await prisma.goods.create({
        data: {
          code,
          name,
          categoryId: createdCategory.id,
          spec,
          unit: category.unit,
          measureType,
          minStock: 25,
          costPrice: money(costCents),
          partnerPrice: money(priceCents),
          defaultInPrice: money(costCents),
          description: '合成演示商品，不对应真实采购记录',
        },
      })
      goods.push({
        id: created.id,
        code,
        name,
        spec,
        unit: category.unit,
        categoryId: createdCategory.id,
        categoryName: category.name,
        measureType,
        priceCents,
        costCents,
      })
    }
  }

  const inventoryByGoods = new Map<number, { id: number; quantity: number; locked: number }>()
  let stockInCount = 0
  for (const [warehouseIndex, warehouse] of warehouses.entries()) {
    const stockedGoods = goods.filter(
      (item) =>
        warehouseIndex === 0 ||
        ['新鲜蔬菜', '肉禽蛋类', '水产海鲜', '乳品饮料', '速冻食品'].includes(item.categoryName)
    )
    for (let batch = 0; batch < stockedGoods.length; batch += 10) {
      const batchGoods = stockedGoods.slice(batch, batch + 10)
      const receivedAt = dateDaysAgo(90 - Math.floor(batch / 10) * 2 - warehouseIndex, 9)
      const stockIn = await prisma.stockIn.create({
        data: {
          code: `SI-DEMO-${String(++stockInCount).padStart(3, '0')}`,
          warehouseId: warehouse.id,
          status: 'COMPLETED',
          createdBy: warehouseUser.id,
          approvedBy: ownerUser.id,
          approvedAt: receivedAt,
          completedAt: receivedAt,
          createdAt: receivedAt,
          remark: '演示期初采购入库',
          totalAmount: money(
            batchGoods.reduce((sum, item, offset) => sum + item.costCents * (180 + offset * 8), 0)
          ),
        },
      })
      for (const [offset, item] of batchGoods.entries()) {
        const quantity = 180 + offset * 8
        await prisma.stockInItem.create({
          data: {
            stockInId: stockIn.id,
            goodsId: item.id,
            goodsCodeSnapshot: item.code,
            goodsNameSnapshot: item.name,
            goodsSpecSnapshot: item.spec,
            goodsUnitSnapshot: item.unit,
            measureTypeSnapshot: item.measureType,
            categoryIdSnapshot: item.categoryId,
            categoryNameSnapshot: item.categoryName,
            quantity,
            unitPrice: money(item.costCents),
            totalPrice: money(item.costCents * quantity),
            createdAt: receivedAt,
          },
        })
        const inventory = await prisma.inventory.create({
          data: {
            warehouseId: warehouse.id,
            goodsId: item.id,
            quantity,
            availableQuantity: quantity,
            avgCost: money(item.costCents),
            totalCost: money(item.costCents * quantity),
          },
        })
        await prisma.inventoryLog.create({
          data: {
            inventoryId: inventory.id,
            changeType: 'IN',
            quantity,
            beforeQty: 0,
            afterQty: quantity,
            referenceType: 'STOCK_IN',
            referenceId: String(stockIn.id),
            operatedBy: warehouseUser.id,
            createdAt: receivedAt,
          },
        })
        await prisma.costHistory.create({
          data: {
            warehouseId: warehouse.id,
            goodsId: item.id,
            beforeCost: 0,
            afterCost: money(item.costCents),
            beforeQty: 0,
            afterQty: quantity,
            inQty: quantity,
            inPrice: money(item.costCents),
            referenceType: 'STOCK_IN',
            referenceId: String(stockIn.id),
            createdAt: receivedAt,
          },
        })
        if (warehouseIndex === 0)
          inventoryByGoods.set(item.id, { id: inventory.id, quantity, locked: 0 })
      }
    }
  }

  const containers: Container[] = []
  for (const [index, name] of ['周转筐', '保温箱', '塑料托盘'].entries()) {
    containers.push(
      await prisma.container.create({
        data: { code: `CT-DEMO-0${index + 1}`, name, unit: '个', deposit: 20 + index * 30 },
      })
    )
  }
  for (const [index, item] of goods.slice(0, 18).entries()) {
    const container = containers[index % containers.length]
    if (!container) throw new Error('Demo container is missing')
    await prisma.containerGoodsBinding.create({
      data: {
        containerId: container.id,
        goodsId: item.id,
        goodsQuantityPerContainer: 4 + (index % 3) * 2,
      },
    })
  }

  let orderCount = 0
  let stockOutCount = 0
  async function createOrder(
    storeIndex: number,
    status: 'PENDING' | 'APPROVED' | 'PROCESSING' | 'COMPLETED' | 'REJECTED' | 'CANCELLED',
    daysAgo: number,
    withCancelledStockOut = false
  ): Promise<number> {
    const store = stores[storeIndex]
    if (!store) throw new Error(`Demo store ${storeIndex} is missing`)
    const selected = Array.from({ length: 3 + (orderCount % 4) }, (_, offset) => {
      const item = goods[(orderCount * 7 + offset * 11) % (goods.length - 8)]
      if (!item) throw new Error('Demo goods are missing')
      return { item, quantity: 2 + ((orderCount + offset) % 5) }
    })
    const totalCents = selected.reduce(
      (sum, { item, quantity }) => sum + item.priceCents * quantity,
      0
    )
    const orderedAt = dateDaysAgo(daysAgo, 10 + (orderCount % 6))
    const approvedAt = new Date(orderedAt.getTime() + 30 * 60 * 1000)
    const shippedAt = new Date(orderedAt.getTime() + 2 * 60 * 60 * 1000)
    const completedAt = new Date(orderedAt.getTime() + 4 * 60 * 60 * 1000)
    const code = `OR-DEMO-${String(++orderCount).padStart(4, '0')}`
    const order = await prisma.order.create({
      data: {
        code,
        storeId: store.id,
        storeNameSnapshot: store.name,
        status,
        totalAmount: money(totalCents),
        remark: status === 'PENDING' ? '等待仓库审批的演示订单' : '合成演示订单',
        createdBy: storeUser.id,
        orderedAt,
        createdAt: orderedAt,
        approvedBy: ['APPROVED', 'PROCESSING', 'COMPLETED'].includes(status)
          ? warehouseUser.id
          : null,
        approvedAt: ['APPROVED', 'PROCESSING', 'COMPLETED'].includes(status) ? approvedAt : null,
        completedAt: status === 'COMPLETED' ? completedAt : null,
        lockedWarehouseId: status === 'APPROVED' ? primaryWarehouse.id : null,
        revokedBy: ['REJECTED', 'CANCELLED'].includes(status) ? warehouseUser.id : null,
        revokedAt: ['REJECTED', 'CANCELLED'].includes(status) ? approvedAt : null,
        revokeReason:
          status === 'REJECTED'
            ? '演示：调整数量后可重新提交'
            : status === 'CANCELLED'
              ? '演示：订单已取消'
              : null,
      },
    })
    for (const { item, quantity } of selected) {
      await prisma.orderItem.create({
        data: {
          orderId: order.id,
          goodsId: item.id,
          goodsCodeSnapshot: item.code,
          goodsNameSnapshot: item.name,
          goodsSpecSnapshot: item.spec,
          goodsUnitSnapshot: item.unit,
          measureTypeSnapshot: item.measureType,
          categoryIdSnapshot: item.categoryId,
          categoryNameSnapshot: item.categoryName,
          quantity,
          unitPrice: money(item.priceCents),
          totalPrice: money(item.priceCents * quantity),
          createdAt: orderedAt,
        },
      })
    }
    await prisma.approvalLog.create({
      data: {
        orderId: order.id,
        entityType: 'ORDER',
        entityId: String(order.id),
        action: 'SUBMIT',
        reason: '演示门店提交订单',
        operatedBy: storeUser.id,
        createdAt: orderedAt,
      },
    })
    if (['APPROVED', 'PROCESSING', 'COMPLETED'].includes(status)) {
      await prisma.approvalLog.create({
        data: {
          orderId: order.id,
          entityType: 'ORDER',
          entityId: String(order.id),
          action: 'APPROVE',
          reason: '演示仓库审批通过',
          operatedBy: warehouseUser.id,
          createdAt: approvedAt,
        },
      })
    }
    if (status === 'REJECTED') {
      await prisma.approvalLog.create({
        data: {
          orderId: order.id,
          entityType: 'ORDER',
          entityId: String(order.id),
          action: 'REJECT',
          reason: '演示：调整数量后可重新提交',
          operatedBy: warehouseUser.id,
          createdAt: approvedAt,
        },
      })
    }

    if (['APPROVED', 'PROCESSING', 'COMPLETED'].includes(status) || withCancelledStockOut) {
      const stockOutStatus = withCancelledStockOut
        ? 'CANCELLED'
        : status === 'APPROVED'
          ? 'PENDING'
          : 'COMPLETED'
      const stockOut = await prisma.stockOut.create({
        data: {
          code: `SO-DEMO-${String(++stockOutCount).padStart(4, '0')}`,
          warehouseId: primaryWarehouse.id,
          orderId: order.id,
          status: stockOutStatus,
          totalCost: money(
            selected.reduce((sum, { item, quantity }) => sum + item.costCents * quantity, 0)
          ),
          totalProfit: money(
            selected.reduce(
              (sum, { item, quantity }) => sum + (item.priceCents - item.costCents) * quantity,
              0
            )
          ),
          createdBy: warehouseUser.id,
          completedAt: ['PROCESSING', 'COMPLETED'].includes(status) ? shippedAt : null,
          revokedBy: withCancelledStockOut ? warehouseUser.id : null,
          revokedAt: withCancelledStockOut ? approvedAt : null,
          revokeReason: withCancelledStockOut ? '演示：取消待出库单及订单' : null,
          createdAt: approvedAt,
        },
      })
      for (const { item, quantity } of selected) {
        await prisma.stockOutItem.create({
          data: {
            stockOutId: stockOut.id,
            goodsId: item.id,
            goodsCodeSnapshot: item.code,
            goodsNameSnapshot: item.name,
            goodsSpecSnapshot: item.spec,
            goodsUnitSnapshot: item.unit,
            measureTypeSnapshot: item.measureType,
            categoryIdSnapshot: item.categoryId,
            categoryNameSnapshot: item.categoryName,
            quantity,
            snapshotCost: money(item.costCents),
            salePrice: money(item.priceCents),
            profit: money((item.priceCents - item.costCents) * quantity),
            createdAt: approvedAt,
          },
        })
        const current = inventoryByGoods.get(item.id)
        if (!current) throw new Error(`Missing inventory for ${item.code}`)
        if (stockOutStatus === 'PENDING') {
          current.locked += quantity
          await prisma.inventory.update({
            where: { id: current.id },
            data: {
              lockedQuantity: current.locked,
              availableQuantity: current.quantity - current.locked,
            },
          })
        } else if (stockOutStatus === 'COMPLETED') {
          const before = current.quantity
          current.quantity -= quantity
          if (current.quantity < 0) throw new Error(`Negative inventory for ${item.code}`)
          await prisma.inventory.update({
            where: { id: current.id },
            data: {
              quantity: current.quantity,
              availableQuantity: current.quantity - current.locked,
              totalCost: money(current.quantity * item.costCents),
            },
          })
          await prisma.inventoryLog.create({
            data: {
              inventoryId: current.id,
              changeType: 'OUT',
              quantity,
              beforeQty: before,
              afterQty: current.quantity,
              referenceType: 'STOCK_OUT',
              referenceId: String(stockOut.id),
              operatedBy: warehouseUser.id,
              createdAt: shippedAt,
            },
          })
        }
      }
      if (stockOutStatus === 'COMPLETED') {
        await prisma.approvalLog.create({
          data: {
            orderId: order.id,
            entityType: 'STOCK_OUT',
            entityId: String(stockOut.id),
            action: 'STOCK_OUT_COMPLETE',
            reason: '演示仓库确认出库',
            operatedBy: warehouseUser.id,
            createdAt: shippedAt,
          },
        })
      }
    }
    if (status === 'COMPLETED') {
      await prisma.approvalLog.create({
        data: {
          orderId: order.id,
          entityType: 'ORDER',
          entityId: String(order.id),
          action: 'RECEIVE',
          reason: '演示门店确认收货',
          operatedBy: storeUser.id,
          createdAt: completedAt,
        },
      })
    }
    if (status === 'CANCELLED') {
      await prisma.approvalLog.create({
        data: {
          orderId: order.id,
          entityType: 'ORDER',
          entityId: String(order.id),
          action: 'CANCEL',
          reason: '演示订单取消',
          operatedBy: warehouseUser.id,
          createdAt: approvedAt,
        },
      })
    }
    return order.id
  }

  const completedOrderIds: number[] = []
  for (let index = 0; index < 56; index += 1) {
    completedOrderIds.push(await createOrder(index % stores.length, 'COMPLETED', 58 - index))
  }
  for (let index = 0; index < 10; index += 1)
    await createOrder(index % stores.length, 'REJECTED', 14 - index)
  for (let index = 0; index < 6; index += 1)
    await createOrder(index % stores.length, 'CANCELLED', 12 - index, index < 3)
  await createOrder(3, 'PENDING', 0)
  await createOrder(4, 'PENDING', 0)
  await createOrder(5, 'APPROVED', 0)
  await createOrder(6, 'APPROVED', 0)
  await createOrder(7, 'PROCESSING', 0)

  for (const [storeIndex, store] of stores.entries()) {
    for (const [containerIndex, container] of containers.entries()) {
      const borrowed = 18 + storeIndex * 2 + containerIndex * 3
      const returned = 10 + storeIndex + containerIndex
      const tracking = await prisma.containerTracking.create({
        data: {
          storeId: store.id,
          containerId: container.id,
          totalBorrowed: borrowed,
          totalReturned: returned,
          currentBorrowed: borrowed - returned,
          lastBorrowAt: dateDaysAgo(4),
          lastReturnAt: dateDaysAgo(2),
        },
      })
      const completedOrderId = completedOrderIds[storeIndex]
      if (!completedOrderId) throw new Error('Completed demo order is missing')
      await prisma.containerLog.create({
        data: {
          containerId: container.id,
          containerTrackingId: tracking.id,
          orderId: completedOrderId,
          opType: 'BORROW',
          quantity: borrowed,
          beforeBorrowed: 0,
          afterBorrowed: borrowed,
          remark: '演示配送借出包装物',
          operatedBy: warehouseUser.id,
          operatedAt: dateDaysAgo(5),
          createdAt: dateDaysAgo(5),
        },
      })
      await prisma.containerLog.create({
        data: {
          containerId: container.id,
          containerTrackingId: tracking.id,
          opType: 'RETURN',
          quantity: returned,
          beforeBorrowed: borrowed,
          afterBorrowed: borrowed - returned,
          remark: '演示门店归还包装物',
          operatedBy: warehouseUser.id,
          operatedAt: dateDaysAgo(2),
          createdAt: dateDaysAgo(2),
        },
      })
    }
  }

  const firstStore = stores[0]
  const firstContainer = containers[0]
  if (!firstStore || !firstContainer) throw new Error('Demo master data is incomplete')
  const returnDocument = await prisma.containerReturn.create({
    data: {
      code: 'CR-DEMO-001',
      storeId: firstStore.id,
      status: 'PENDING',
      submittedBy: storeUser.id,
      submittedAt: dateDaysAgo(0),
      remark: '等待仓库确认的演示归还单',
    },
  })
  const returnTracking = await prisma.containerTracking.findUniqueOrThrow({
    where: { storeId_containerId: { storeId: firstStore.id, containerId: firstContainer.id } },
  })
  await prisma.containerReturnItem.create({
    data: {
      containerReturnId: returnDocument.id,
      containerTrackingId: returnTracking.id,
      containerId: firstContainer.id,
      requestedQuantity: 3,
    },
  })
  await prisma.containerTracking.update({
    where: { id: returnTracking.id },
    data: { pendingReturnQuantity: 3 },
  })

  await prisma.systemConfig.upsert({
    where: { id: 1 },
    create: { id: 1, name: 'ReplenOps 演示环境' },
    update: { name: 'ReplenOps 演示环境' },
  })
  await prisma.orderingSchedule.updateMany({
    data: { startTime: '00:00', endTime: '23:59', isActive: true },
  })

  console.info(
    `Demo seed complete: ${stores.length} stores, ${warehouses.length} warehouses, ${goods.length} goods, ${orderCount} orders, ${stockInCount} stock-ins, ${stockOutCount} stock-outs`
  )
}

main()
  .catch((error: unknown) => {
    console.error('Demo seed failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
