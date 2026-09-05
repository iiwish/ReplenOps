'use client'

import { Layout, theme } from 'antd'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'
import AppBreadcrumb from './AppBreadcrumb'
import AppHeader from './AppHeader'
import AppSidebar from './AppSidebar'
import AdminPageLoading from './AdminPageLoading'
import type { UserRole } from '@/types'
import { requestAppNavigation } from '@/lib/unsaved-changes'

const { Content } = Layout

interface AdminLayoutClientProps {
  children: React.ReactNode
  userName?: string
  userDisplayName?: string
  roles: UserRole[]
}

export default function AdminLayoutClient({
  children,
  userName,
  userDisplayName,
  roles,
}: AdminLayoutClientProps) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const [targetPathname, setTargetPathname] = useOptimistic(pathname)
  const [isPending, startTransition] = useTransition()
  const isNavigating = isPending && targetPathname !== pathname

  const navigate = (path: string) => {
    if (isNavigating && path === targetPathname) return
    if (!isNavigating && !requestAppNavigation()) return

    startTransition(() => {
      setTargetPathname(path)
      router.push(path as Route)
    })
  }

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <AppSidebar
        collapsed={collapsed}
        roles={roles}
        pathname={targetPathname}
        onNavigate={navigate}
      />

      {/* 主内容区域 */}
      <Layout style={{ minWidth: 0, marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
        {/* 顶部导航栏 */}
        <AppHeader
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          userName={userName}
          userDisplayName={userDisplayName}
        />

        {/* 内容区域 */}
        <Content style={{ margin: '0 16px' }}>
          {/* 面包屑 */}
          <AppBreadcrumb pathname={targetPathname} />

          {/* 页面内容 */}
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {isNavigating && <AdminPageLoading />}
            {/* Keep the previous form mounted until navigation commits, including on failure. */}
            <div hidden={isNavigating}>{children}</div>
          </div>
        </Content>

        {/* 底部 */}
        <Layout.Footer style={{ textAlign: 'center' }}>
          ReplenOps © {new Date().getFullYear()} iiwish
        </Layout.Footer>
      </Layout>
    </Layout>
  )
}
