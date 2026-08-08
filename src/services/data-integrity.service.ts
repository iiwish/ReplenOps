import { prisma } from '@/lib/prisma'
import {
  buildIntegritySummary,
  type DataIntegrityCounts,
  type DataIntegritySummary,
} from '@/lib/data-integrity-policy'

const activeDocumentStatuses = ['PENDING', 'APPROVED', 'PROCESSING'] as const

export interface DataIntegrityReport {
  checkedAt: Date
  counts: DataIntegrityCounts
  summary: DataIntegritySummary
}

export class DataIntegrityService {
  async scan(): Promise<DataIntegrityReport> {
    const [
      activeCategoriesWithDeletedParent,
      activeContainerTrackingWithDeletedContainer,
      activeContainerTrackingWithDeletedStore,
      activeGoodsWithDeletedCategory,
      activeGoodsWithDeletedContainer,
      activeInventoryWithDeletedGoods,
      activeInventoryWithDeletedWarehouse,
      activeOrderItemsWithDeletedGoods,
      activeOrdersWithDeletedStore,
      activeStockInItemsWithDeletedGoods,
      activeStockInsWithDeletedWarehouse,
      activeStockOutItemsWithDeletedGoods,
      activeStockOutsWithDeletedWarehouse,
      deletedActiveCategories,
      deletedActiveContainers,
      deletedActiveGoods,
      deletedActiveStores,
      deletedActiveWarehouses,
    ] = await prisma.$transaction([
      prisma.goodsCategory.count({ where: { isDeleted: false, parent: { isDeleted: true } } }),
      prisma.containerTracking.count({
        where: { isDeleted: false, container: { isDeleted: true } },
      }),
      prisma.containerTracking.count({ where: { isDeleted: false, store: { isDeleted: true } } }),
      prisma.goods.count({ where: { isDeleted: false, category: { isDeleted: true } } }),
      prisma.goods.count({ where: { isDeleted: false, container: { isDeleted: true } } }),
      prisma.inventory.count({
        where: {
          isDeleted: false,
          goods: { isDeleted: true },
          OR: [
            { quantity: { not: 0 } },
            { lockedQuantity: { not: 0 } },
            { availableQuantity: { not: 0 } },
          ],
        },
      }),
      prisma.inventory.count({
        where: {
          isDeleted: false,
          warehouse: { isDeleted: true },
          OR: [
            { quantity: { not: 0 } },
            { lockedQuantity: { not: 0 } },
            { availableQuantity: { not: 0 } },
          ],
        },
      }),
      prisma.orderItem.count({
        where: {
          isDeleted: false,
          goods: { isDeleted: true },
          order: { isDeleted: false, status: { in: [...activeDocumentStatuses] } },
        },
      }),
      prisma.order.count({
        where: {
          isDeleted: false,
          status: { in: [...activeDocumentStatuses] },
          store: { isDeleted: true },
        },
      }),
      prisma.stockInItem.count({
        where: {
          isDeleted: false,
          goods: { isDeleted: true },
          stockIn: { isDeleted: false, status: { in: [...activeDocumentStatuses] } },
        },
      }),
      prisma.stockIn.count({
        where: {
          isDeleted: false,
          status: { in: [...activeDocumentStatuses] },
          warehouse: { isDeleted: true },
        },
      }),
      prisma.stockOutItem.count({
        where: {
          isDeleted: false,
          goods: { isDeleted: true },
          stockOut: { isDeleted: false, status: { in: [...activeDocumentStatuses] } },
        },
      }),
      prisma.stockOut.count({
        where: {
          isDeleted: false,
          status: { in: [...activeDocumentStatuses] },
          warehouse: { isDeleted: true },
        },
      }),
      prisma.goodsCategory.count({ where: { isDeleted: true, isActive: true } }),
      prisma.container.count({ where: { isDeleted: true, isActive: true } }),
      prisma.goods.count({ where: { isDeleted: true, isActive: true } }),
      prisma.store.count({ where: { isDeleted: true, isActive: true } }),
      prisma.warehouse.count({ where: { isDeleted: true, isActive: true } }),
    ])

    const counts: DataIntegrityCounts = {
      activeCategoriesWithDeletedParent,
      activeContainerTrackingWithDeletedContainer,
      activeContainerTrackingWithDeletedStore,
      activeGoodsWithDeletedCategory,
      activeGoodsWithDeletedContainer,
      activeInventoryWithDeletedGoods,
      activeInventoryWithDeletedWarehouse,
      activeOrderItemsWithDeletedGoods,
      activeOrdersWithDeletedStore,
      activeStockInItemsWithDeletedGoods,
      activeStockInsWithDeletedWarehouse,
      activeStockOutItemsWithDeletedGoods,
      activeStockOutsWithDeletedWarehouse,
      deletedActiveCategories,
      deletedActiveContainers,
      deletedActiveGoods,
      deletedActiveStores,
      deletedActiveWarehouses,
    }

    return {
      checkedAt: new Date(),
      counts,
      summary: buildIntegritySummary(counts),
    }
  }

  async assertHealthy(): Promise<DataIntegrityReport> {
    const report = await this.scan()
    if (report.summary.status === 'FAIL') {
      throw new Error(`DATA_INTEGRITY_VIOLATION:${report.summary.failedChecks.join(',')}`)
    }
    return report
  }
}

export const dataIntegrityService = new DataIntegrityService()
