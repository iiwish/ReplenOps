import { requirePageAccess } from '@/lib/rbac-server'
import { notFound } from 'next/navigation'
import { warehouseService } from '@/services/warehouse.service'
import WarehouseFormClient from '../../WarehouseFormClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function EditWarehousePage({ params }: PageProps) {
  await requirePageAccess('/admin/warehouse')

  const { id: idParam } = await params
  const id = parseInt(idParam, 10)
  let warehouse

  try {
    warehouse = await warehouseService.findById(id)
  } catch {
    notFound()
  }

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
}
