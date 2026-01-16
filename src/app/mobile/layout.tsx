import { getCurrentUser } from '@/lib/session'
import MobileLayoutClient from '@/components/mobile/MobileLayoutClient'
import { StoreInitializer } from '@/components/mobile/StoreInitializer'
import { getUserStores } from '@/actions/store-actions'

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 获取当前用户信息（用于权限验证）
  await getCurrentUser()

  // 获取用户可访问的所有门店
  const storesResult = await getUserStores()
  const stores = storesResult.success && storesResult.data
    ? (storesResult.data as Array<{ id: string; code: string; name: string }>)
    : []

  return (
    <>
      <StoreInitializer stores={stores} />
      <MobileLayoutClient>{children}</MobileLayoutClient>
    </>
  )
}
