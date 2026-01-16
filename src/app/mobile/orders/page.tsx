import { requireRoles } from '@/lib/rbac-server'
import OrdersClientPage from './OrdersClientPage'

export default async function MobileOrdersPage() {
  // 验证用户权限，仅允许 store_admin 访问
  await requireRoles(['store_admin'])

  return <OrdersClientPage />
}
