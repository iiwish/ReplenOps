import { requirePageAccess } from '@/lib/rbac-server'
import { notFound } from 'next/navigation'
import { storeService } from '@/services/store.service'
import { App } from 'antd'
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
    <App>
      <div>
        <h2 style={{ marginBottom: 24 }}>门店管理员管理</h2>
        <StoreAdminsClient
          storeId={id}
          storeName={store.name}
          initialAdmins={admins}
        />
      </div>
    </App>
  )
}
