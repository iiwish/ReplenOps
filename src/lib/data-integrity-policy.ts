export const DATA_INTEGRITY_CHECKS = [
  'activeCategoriesWithDeletedParent',
  'activeContainerTrackingWithDeletedContainer',
  'activeContainerTrackingWithDeletedStore',
  'activeGoodsWithDeletedCategory',
  'activeGoodsWithDeletedContainer',
  'activeInventoryWithDeletedGoods',
  'activeInventoryWithDeletedWarehouse',
  'activeOrderItemsWithDeletedGoods',
  'activeOrdersWithDeletedStore',
  'activeStockInItemsWithDeletedGoods',
  'activeStockInsWithDeletedWarehouse',
  'activeStockOutItemsWithDeletedGoods',
  'activeStockOutsWithDeletedWarehouse',
  'deletedActiveCategories',
  'deletedActiveContainers',
  'deletedActiveGoods',
  'deletedActiveStores',
  'deletedActiveWarehouses',
] as const

export type DataIntegrityCheck = (typeof DATA_INTEGRITY_CHECKS)[number]
export type DataIntegrityCounts = Record<DataIntegrityCheck, number>

export interface DataIntegritySummary {
  status: 'PASS' | 'FAIL'
  violations: number
  failedChecks: DataIntegrityCheck[]
}

export function emptyIntegrityCounts(): DataIntegrityCounts {
  return {
    activeCategoriesWithDeletedParent: 0,
    activeContainerTrackingWithDeletedContainer: 0,
    activeContainerTrackingWithDeletedStore: 0,
    activeGoodsWithDeletedCategory: 0,
    activeGoodsWithDeletedContainer: 0,
    activeInventoryWithDeletedGoods: 0,
    activeInventoryWithDeletedWarehouse: 0,
    activeOrderItemsWithDeletedGoods: 0,
    activeOrdersWithDeletedStore: 0,
    activeStockInItemsWithDeletedGoods: 0,
    activeStockInsWithDeletedWarehouse: 0,
    activeStockOutItemsWithDeletedGoods: 0,
    activeStockOutsWithDeletedWarehouse: 0,
    deletedActiveCategories: 0,
    deletedActiveContainers: 0,
    deletedActiveGoods: 0,
    deletedActiveStores: 0,
    deletedActiveWarehouses: 0,
  }
}

export function buildIntegritySummary(counts: DataIntegrityCounts): DataIntegritySummary {
  const failedChecks = DATA_INTEGRITY_CHECKS.filter((check) => counts[check] > 0)
  const violations = DATA_INTEGRITY_CHECKS.reduce((total, check) => total + counts[check], 0)

  return {
    status: failedChecks.length === 0 ? 'PASS' : 'FAIL',
    violations,
    failedChecks,
  }
}
