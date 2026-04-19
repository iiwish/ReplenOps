import { requirePageAccess } from '@/lib/rbac-server'
import GoodsCategoryFormClient from '../../GoodsCategoryFormClient'
import { goodsCategoryService } from '@/services/goods-category.service'
import { notFound } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditGoodsCategoryPage({ params }: PageProps) {
  await requirePageAccess('/admin/goods-category')

  const { id } = await params
  let category

  try {
    category = await goodsCategoryService.findById(id)
  } catch {
    notFound()
  }

  return (
    <div>
      <h2 style={{ marginBottom: 24 }}>编辑商品分类</h2>
      <GoodsCategoryFormClient
        mode="edit"
        initialValues={{
          id: String(category.id),
          code: category.code,
          name: category.name,
          sortOrder: category.sortOrder,
        }}
      />
    </div>
  )
}
