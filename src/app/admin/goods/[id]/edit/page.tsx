import { requirePageAccess } from '@/lib/rbac-server'
import GoodsFormClient from '../../GoodsFormClient'
import { goodsService } from '@/services/goods.service'
import { notFound } from 'next/navigation'

interface EditGoodsPageProps {
  params: Promise<{ id: string }>
}

export default async function EditGoodsPage({ params }: EditGoodsPageProps) {
  await requirePageAccess('/admin/goods')

  const { id } = await params
  let goods

  try {
    goods = await goodsService.findById(id)
  } catch {
    notFound()
  }

  const categories = await goodsService.getActiveCategories()

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>编辑商品</h2>
      <GoodsFormClient
        mode="edit"
        initialValues={{
          ...goods,
          id: String(goods.id),
          categoryId: String(goods.categoryId),
          spec: goods.spec || undefined,
          imageUrl: goods.imageUrl || undefined,
          description: goods.description || undefined,
        }}
        categories={categories.map((category) => ({
          ...category,
          id: String(category.id),
        }))}
      />
    </div>
  )
}
