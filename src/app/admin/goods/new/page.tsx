import { requirePageAccess } from '@/lib/rbac-server'
import GoodsFormClient from '../GoodsFormClient'
import { goodsService } from '@/services/goods.service'

export default async function NewGoodsPage() {
  await requirePageAccess('/admin/goods')

  // 获取分类列表
  const categories = await goodsService.getActiveCategories()

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>新建商品</h2>
      <GoodsFormClient
        mode="create"
        categories={categories.map((category) => ({
          ...category,
          id: String(category.id),
        }))}
      />
    </div>
  )
}
