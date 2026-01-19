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

  // 获取门店详情和管理员列表
  try {
    const store = await storeService.findById(id)
    const admins = await storeService.listAdmins(id)

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
  } catch (error) {
    // 如果门店不存在，返回 404
    notFound()
  }
}
