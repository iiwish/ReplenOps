import { requirePageAccess } from '@/lib/rbac-server'
import UserListClient from './UserListClient'
import { listUsers } from '@/actions/user-actions'

interface SearchParams {
  page?: string
  keyword?: string
}

export default async function UsersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  await requirePageAccess('/admin/users')

  const params = await searchParams
  const page = parseInt(params.page || '1', 10)
  const keyword = params.keyword

  const result = await listUsers({
    page,
    pageSize: 20,
    search: keyword,
  })

  if (!result.success || !result.data) {
    return (
      <div>
        <h1 style={{ fontSize: 24, fontWeight: 600, marginBottom: 16 }}>用户管理</h1>
        <p style={{ color: 'red' }}>{result.error || '加载失败'}</p>
      </div>
    )
  }

  return <UserListClient initialData={result.data} />
}
