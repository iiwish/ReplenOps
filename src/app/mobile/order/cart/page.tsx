import { requireRoles } from '@/lib/rbac-server'
import CartConfirmClient from './CartConfirmClient'

export default async function CartConfirmPage() {
  // 验证用户权限，仅允许 store_admin 访问
  await requireRoles(['store_admin'])

  return <CartConfirmClient />
}
