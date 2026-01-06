import { requirePageAccess } from '@/lib/rbac-server'
import PlaceholderPage from '@/components/admin/PlaceholderPage'

export default async function GoodsPage() {
  await requirePageAccess('/admin/goods')
  return <PlaceholderPage title="商品管理" />
}
