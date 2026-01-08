import { requirePageAccess } from '@/lib/rbac-server'
import GoodsCategoryListClient from './GoodsCategoryListClient'
import { goodsCategoryService } from '@/services/goods-category.service'

interface SearchParams {
  page?: string
  keyword?: string
}

export default async function GoodsCategoryPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePageAccess('/admin/goods-category')

  // 获取搜索参数
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const keyword = params.keyword

  // 获取商品分类列表数据
  const result = await goodsCategoryService.list({
    page,
    pageSize: 20,
    keyword,
  })

  return <GoodsCategoryListClient initialData={result} />
}
