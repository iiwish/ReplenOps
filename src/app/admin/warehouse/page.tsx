import { requirePageAccess } from '@/lib/rbac-server'
import WarehouseListClient from './WarehouseListClient'
import { warehouseService } from '@/services/warehouse.service'

interface SearchParams {
  page?: string
  keyword?: string
}

export default async function WarehousePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePageAccess('/admin/warehouse')

  // 获取搜索参数
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const keyword = params.keyword

  // 获取仓库列表数据
  const result = await warehouseService.list({
    page,
    pageSize: 20,
    keyword,
  })

  return <WarehouseListClient initialData={result} />
}
