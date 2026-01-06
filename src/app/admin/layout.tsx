import { getCurrentUser } from '@/lib/session'
import AdminLayoutClient from '@/components/admin/AdminLayoutClient'
import AntdProvider from '@/components/providers/AntdProvider'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  // 获取当前用户信息（用于显示在 Header 中）
  const user = await getCurrentUser()

  return (
    <AntdProvider>
      <AdminLayoutClient
        userName={user?.name}
        userDisplayName={user?.displayName}
      >
        {children}
      </AdminLayoutClient>
    </AntdProvider>
  )
}
