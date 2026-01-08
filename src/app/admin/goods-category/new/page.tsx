import { requirePageAccess } from '@/lib/rbac-server'
import GoodsCategoryFormClient from '../GoodsCategoryFormClient'

export default async function NewGoodsCategoryPage() {
  await requirePageAccess('/admin/goods-category')

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>新增商品分类</h2>
      <GoodsCategoryFormClient mode="create" />
    </div>
  )
}
