import { getCurrentUser, getUserRoles } from '@/lib/session'
import AdminLayoutClient from '@/components/admin/AdminLayoutClient'
import AntdConfigProvider from '@/components/providers/AntdConfigProvider'
import { systemConfigService } from '@/services/system-config.service'

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [user, brandConfig] = await Promise.all([getCurrentUser(), systemConfigService.get()])

  return (
    <AntdConfigProvider>
      <AdminLayoutClient
        userName={user?.name ?? undefined}
        userDisplayName={user?.displayName ?? undefined}
        roles={getUserRoles(user)}
        brandConfig={brandConfig}
      >
        {children}
      </AdminLayoutClient>
    </AntdConfigProvider>
  )
}
