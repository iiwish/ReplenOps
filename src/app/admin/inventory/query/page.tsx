import { requirePageAccess } from '@/lib/rbac-server'
import { inventoryQueryService } from '@/services/inventory-query.service'
import { warehouseService } from '@/services/warehouse.service'
import { goodsCategoryService } from '@/services/goods-category.service'
import InventoryQueryListClient from './InventoryQueryListClient'

interface SearchParams {
  page?: string
  pageSize?: string
  warehouseIds?: string | string[]
  categoryId?: string
  goodsId?: string
  keyword?: string
  stockStatus?: string
}

export default async function InventoryQueryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePageAccess('/admin/inventory/query')

  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const pageSize = parseInt(params.pageSize || '20', 10)
  const warehouseIds = params.warehouseIds
  const categoryId = params.categoryId
  const goodsId = params.goodsId
  const keyword = params.keyword
  const stockStatus = params.stockStatus || 'all'

  const [initialData, warehouses, categories] = await Promise.all([
    inventoryQueryService.query({
      page,
      pageSize,
      warehouseIds: warehouseIds
        ? Array.isArray(warehouseIds)
          ? warehouseIds
          : [warehouseIds]
        : undefined,
      categoryId,
      goodsId,
      keyword,
      stockStatus: stockStatus as any,
    }),
    warehouseService.listAll(),
    goodsCategoryService.listAll(),
  ])

  return (
    <InventoryQueryListClient
      initialData={initialData}
      warehouses={warehouses}
      categories={categories}
    />
  )
}
