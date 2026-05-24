import { requirePageAccess } from '@/lib/rbac-server'
import GoodsListClient from './GoodsListClient'
import { goodsService } from '@/services/goods.service'

interface SearchParams {
  page?: string
  search?: string
  categoryId?: string
}

export default async function GoodsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  await requirePageAccess('/admin/goods')

  // 获取搜索参数
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const search = params.search
  const categoryId = params.categoryId

  // 获取商品列表数据
  const result = await goodsService.list({
    page,
    pageSize: 20,
    search,
    categoryId,
  })

  // 获取分类列表（用于筛选）
  const categories = await goodsService.getActiveCategories()

  return (
    <GoodsListClient
      initialData={result}
      categories={categories.map((category) => ({
        ...category,
        id: String(category.id),
      }))}
    />
  )
}
