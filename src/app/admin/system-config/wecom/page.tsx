import { requireRoles } from '@/lib/rbac-server'
import { getWecomAdminConfig, listWecomBindings } from '@/services/wecom-auth.service'
import WecomSettings from './WecomSettings'

export const dynamic = 'force-dynamic'

export default async function WecomSettingsPage() {
  await requireRoles(['super_admin'], '/admin')
  const config = await getWecomAdminConfig()
  const bindings = await listWecomBindings()
  return <WecomSettings config={config} initialBindings={bindings} />
}
