import { redirect } from 'next/navigation'
import { requirePageAccess } from '@/lib/rbac-server'

export default async function AdminDashboard() {
  // 验证用户权限并重定向到工作台
  await requirePageAccess('/admin')

  // /admin 路径直接重定向到工作台
  redirect('/admin/dashboard')
}
