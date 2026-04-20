import { requireRoles } from '@/lib/rbac-server'
import { getCurrentUser } from '@/lib/session'
import { prisma } from '@/lib/prisma'
import { redirect } from 'next/navigation'
import CartConfirmClient from './CartConfirmClient'

export default async function CartConfirmPage() {
  // 验证用户权限，仅允许 store_admin 访问
  await requireRoles(['store_admin'])

  // 获取当前用户
  const user = await getCurrentUser()
  if (!user) {
    redirect('/login')
  }

  // 获取用户的门店信息
  const storeAdmin = await prisma.storeAdmin.findFirst({
    where: {
      userId: user.id,
    },
    include: {
      store: {
        select: {
          id: true,
          name: true,
          isActive: true,
        },
      },
    },
  })

  if (!storeAdmin || !storeAdmin.store.isActive) {
    redirect('/mobile/home')
  }

  return <CartConfirmClient storeId={String(storeAdmin.storeId)} />
}
