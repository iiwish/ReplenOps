import { requirePageAccess } from '@/lib/rbac-server'
import StoreListClient from './StoreListClient'
import { storeService } from '@/services/store.service'

interface SearchParams {
  page?: string
  keyword?: string
}

export default async function StorePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePageAccess('/admin/stores')

  // 获取搜索参数
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const keyword = params.keyword

  // 获取门店列表数据
  const result = await storeService.list({
    page,
    pageSize: 20,
    keyword,
  })

  return <StoreListClient initialData={result} />
}
