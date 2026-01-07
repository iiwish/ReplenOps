import { requirePageAccess } from '@/lib/rbac-server'
import { notFound } from 'next/navigation'
import { warehouseService } from '@/services/warehouse.service'
import WarehouseFormClient from '../../WarehouseFormClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditWarehousePage({ params }: PageProps) {
  await requirePageAccess('/admin/warehouse')

  const { id } = await params

  // 获取仓库详情
  try {
    const warehouse = await warehouseService.findById(id)

    return (
      <div>
        <h2 style={{ marginBottom: 24 }}>编辑仓库</h2>
        <WarehouseFormClient
          mode="edit"
          initialValues={{
            id: warehouse.id,
            code: warehouse.code,
            name: warehouse.name,
            address: warehouse.address || undefined,
            contactName: warehouse.contactName || '',
            contactPhone: warehouse.contactPhone || '',
          }}
        />
      </div>
    )
  } catch (error) {
    // 如果仓库不存在，返回 404
    notFound()
  }
}
