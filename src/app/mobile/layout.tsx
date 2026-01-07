import { getCurrentUser } from '@/lib/session'
import MobileLayoutClient from '@/components/mobile/MobileLayoutClient'

export default async function MobileLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 获取当前用户信息（用于权限验证）
  await getCurrentUser()

  return <MobileLayoutClient>{children}</MobileLayoutClient>
}
