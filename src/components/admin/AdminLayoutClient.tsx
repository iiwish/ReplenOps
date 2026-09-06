'use client'

import { Layout, theme } from 'antd'
import type { Route } from 'next'
import { usePathname, useRouter } from 'next/navigation'
import { useOptimistic, useState, useTransition } from 'react'
import AppHeader from './AppHeader'
import AppSidebar from './AppSidebar'
import AdminPageLoading from './AdminPageLoading'
import type { UserRole } from '@/types'
import { requestAppNavigation } from '@/lib/unsaved-changes'
import type { BrandIdentity } from '@/config/brand'

const { Content } = Layout

const ADMIN_LIST_PATHS = new Set([
  '/admin/audit-logs',
  '/admin/containers',
  '/admin/goods',
  '/admin/goods-category',
  '/admin/inventory/cost-history',
  '/admin/inventory/logs',
  '/admin/inventory/query',
  '/admin/reports/stock-out',
  '/admin/stock-in',
  '/admin/stock-out',
  '/admin/stores',
  '/admin/users',
  '/admin/warehouse',
])

function isAdminListPage(pathname: string) {
  return ADMIN_LIST_PATHS.has(pathname) || /^\/admin\/stores\/[^/]+\/admins$/.test(pathname)
}

interface AdminLayoutClientProps {
  children: React.ReactNode
  userName?: string
  userDisplayName?: string
  roles: UserRole[]
  brandConfig?: BrandIdentity
}

export default function AdminLayoutClient({
  children,
  userName,
  userDisplayName,
  roles,
  brandConfig,
}: AdminLayoutClientProps) {
  const [collapsed, setCollapsed] = useState(false)
  const router = useRouter()
  const pathname = usePathname()
  const [targetPathname, setTargetPathname] = useOptimistic(pathname)
  const [isPending, startTransition] = useTransition()
  const isNavigating = isPending && targetPathname !== pathname
  const isOrdersPage = targetPathname === '/admin/orders'
  const isListPage = isOrdersPage || isAdminListPage(targetPathname)

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
    <Layout
      style={{
        minHeight: '100vh',
        ...(isListPage ? { height: '100dvh', overflow: 'hidden' } : {}),
      }}
    >
      {/* 侧边栏 */}
      <AppSidebar
        collapsed={collapsed}
        roles={roles}
        pathname={targetPathname}
        onNavigate={navigate}
        brandConfig={brandConfig}
      />

      {/* 主内容区域 */}
      <Layout
        style={{
          minWidth: 0,
          marginLeft: collapsed ? 80 : 240,
          transition: 'all 0.2s',
          ...(isListPage ? { height: '100%', minHeight: 0, overflow: 'hidden' } : {}),
        }}
      >
        {/* 顶部导航栏 */}
        <AppHeader
          collapsed={collapsed}
          onToggle={() => setCollapsed(!collapsed)}
          pathname={targetPathname}
          userName={userName}
          userDisplayName={userDisplayName}
        />

        {/* 内容区域 */}
        <Content
          style={{
            margin: '0 16px',
            ...(isListPage
              ? {
                  display: 'flex',
                  flex: 1,
                  minHeight: 0,
                  minWidth: 0,
                  flexDirection: 'column',
                  overflow: 'hidden',
                }
              : {}),
          }}
        >
          {/* 页面内容 */}
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
              ...(isListPage
                ? {
                    display: 'flex',
                    flex: 1,
                    minHeight: 0,
                    minWidth: 0,
                    flexDirection: 'column',
                    overflow: 'hidden',
                    padding: '12px 24px 8px',
                  }
                : {}),
            }}
          >
            {isNavigating && <AdminPageLoading ariaLabel="正在切换页面" />}
            {/* Keep the previous form mounted until navigation commits, including on failure. */}
            <div
              hidden={isNavigating}
              style={
                isListPage
                  ? {
                      display: 'flex',
                      flex: 1,
                      minHeight: 0,
                      minWidth: 0,
                      flexDirection: 'column',
                      overflow: 'hidden',
                    }
                  : undefined
              }
            >
              {children}
            </div>
          </div>
        </Content>
      </Layout>
    </Layout>
  )
}
