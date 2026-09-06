import { requirePageAccess } from '@/lib/rbac-server'
import { notFound } from 'next/navigation'
import { storeService } from '@/services/store.service'
import StoreAdminsClient from './StoreAdminsClient'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function StoreAdminsPage({ params }: PageProps) {
  await requirePageAccess('/admin/stores')

  const { id } = await params
  let store
  let admins

  try {
    store = await storeService.findById(id)
    admins = await storeService.listAdmins(id)
  } catch {
    notFound()
  }

  return (
    <div className="admin-list-page">
      <h2 className="mb-4 shrink-0 text-xl font-semibold">门店管理员管理</h2>
      <StoreAdminsClient storeId={id} storeName={store.name} initialAdmins={admins} />
    </div>
  )
}
