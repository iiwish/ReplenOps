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

  try {
    // 获取商品详情
    const goods = await goodsService.findById(id)

    // 获取分类列表
    const categories = await goodsService.getActiveCategories()

    return (
      <div>
        <h2 style={{ marginBottom: 24 }}>编辑商品</h2>
        <GoodsFormClient
          mode="edit"
          initialValues={{
            ...goods,
            spec: goods.spec || undefined,
            imageUrl: goods.imageUrl || undefined,
            description: goods.description || undefined,
          }}
          categories={categories}
        />
      </div>
    )
  } catch (error) {
    notFound()
  }
}
