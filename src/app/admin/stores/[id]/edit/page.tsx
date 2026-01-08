import { requirePageAccess } from '@/lib/rbac-server'
import { notFound } from 'next/navigation'
import { storeService } from '@/services/store.service'
import StoreFormClient from '../../StoreFormClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditStorePage({ params }: PageProps) {
  await requirePageAccess('/admin/stores')

  const { id } = await params

  // 获取门店详情
  try {
    const store = await storeService.findById(id)

    return (
      <div>
        <h2 style={{ marginBottom: 24 }}>编辑门店</h2>
        <StoreFormClient
          mode="edit"
          initialValues={{
            id: store.id,
            code: store.code,
            name: store.name,
            address: store.address || undefined,
            contactName: store.contactName || '',
            contactPhone: store.contactPhone || '',
          }}
        />
      </div>
    )
  } catch (error) {
    // 如果门店不存在，返回 404
    notFound()
  }
}
