import { getCurrentUser, getUserRoles } from '@/lib/session'
import AdminLayoutClient from '@/components/admin/AdminLayoutClient'
import AntdConfigProvider from '@/components/providers/AntdConfigProvider'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <AntdConfigProvider>
      <AdminLayoutClient
        userName={user?.name ?? undefined}
        userDisplayName={user?.displayName ?? undefined}
        roles={getUserRoles(user)}
      >
        {children}
      </AdminLayoutClient>
    </AntdConfigProvider>
  )
}
