import { requirePageAccess } from '@/lib/rbac-server'
import GoodsCategoryFormClient from '../../GoodsCategoryFormClient'
import { goodsCategoryService } from '@/services/goods-category.service'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditGoodsCategoryPage({ params }: PageProps) {
  await requirePageAccess('/admin/goods-category')

  // 获取分类 ID
  const { id } = await params

  // 获取分类详情
  try {
    const category = await goodsCategoryService.findById(id)

    return (
      <div>
        <h2 style={{ marginBottom: 24 }}>编辑商品分类</h2>
        <GoodsCategoryFormClient
          mode="edit"
          initialValues={{
            id: category.id,
            code: category.code,
            name: category.name,
            sortOrder: category.sortOrder,
          }}
        />
      </div>
    )
  } catch (error) {
    notFound()
  }
}
