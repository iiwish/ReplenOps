import { requirePageAccess } from '@/lib/rbac-server'

export default async function MobileHome() {
  // 验证用户权限
  const { user, role } = await requirePageAccess('/mobile')

  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">移动端首页</h1>
      <p className="text-muted-foreground mt-2">
        欢迎使用 ERP 移动端
      </p>

      <div className="mt-8 rounded-lg border p-4">
        <h2 className="text-lg font-semibold mb-4">当前用户信息</h2>
        {user && (
          <div className="space-y-2">
            <p>
              <span className="font-medium">用户名:</span> {user.name}
            </p>
            <p>
              <span className="font-medium">显示名:</span> {user.displayName}
            </p>
            <p>
              <span className="font-medium">邮箱:</span> {user.email}
            </p>
            <p>
              <span className="font-medium">角色:</span>{' '}
              <span className="rounded bg-blue-100 px-2 py-1 text-blue-700">
                {role || '未设置'}
              </span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-4 rounded-lg border border-green-200 bg-green-50 p-4">
        <p className="text-green-800">
          ✅ 您有权限访问移动端页面
        </p>
      </div>
    </div>
  )
}
