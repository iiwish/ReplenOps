import { requirePageAccess } from '@/lib/rbac-server'
import { prisma } from '@/lib/prisma'
import { userService } from '@/services/user.service'
import { App } from 'antd'
import StoreAdminsPageClient from './StoreAdminsPageClient'

export default async function StoreAdminsPage() {
  await requirePageAccess('/admin/store-admins')

  // 获取所有门店及其管理员
  const stores = await prisma.store.findMany({
    where: {
      isDeleted: false,
    },
    select: {
      id: true,
      code: true,
      name: true,
      isActive: true,
      storeAdmins: {
        select: {
          userId: true,
        },
      },
    },
    orderBy: {
      code: 'asc',
    },
  })

  // 获取所有管理员的详细信息
  const data = await Promise.all(
    stores.map(async (store) => {
      const admins = await Promise.all(
        store.storeAdmins.map(async (admin) => {
          const user = await userService.findById(admin.userId)
          return {
            userId: admin.userId,
            displayName: user?.displayName || user?.name || admin.userId,
            email: user?.email || '',
            avatar: user?.avatar || undefined,
          }
        })
      )

      return {
        storeId: String(store.id),
        storeCode: store.code,
        storeName: store.name,
        isActive: store.isActive,
        admins,
      }
    })
  )

  return (
    <App>
      <StoreAdminsPageClient data={data} />
    </App>
  )
}
