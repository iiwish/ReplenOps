import { requirePageAccess } from '@/lib/rbac-server'
import GoodsListClient from './GoodsListClient'
import { goodsService } from '@/services/goods.service'
import type { GoodsStatusFilter } from '@/services/goods.service'
import { canPerformAction } from '@/lib/action-permissions'

interface SearchParams {
  page?: string
  search?: string
  categoryId?: string
  status?: string
}

export default async function GoodsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const { user } = await requirePageAccess('/admin/goods')

  // 获取搜索参数
  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const search = params.search
  const categoryId = params.categoryId
  const status: GoodsStatusFilter =
    params.status === 'active' || params.status === 'inactive' || params.status === 'all'
      ? params.status
      : 'active'

  // 获取商品列表数据
  const result = await goodsService.list({
    page,
    pageSize: 20,
    search,
    categoryId,
    status,
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
      canWrite={canPerformAction(user, 'goods:write')}
      initialSearch={search}
      initialCategoryId={categoryId}
      initialStatus={status}
    />
  )
}
