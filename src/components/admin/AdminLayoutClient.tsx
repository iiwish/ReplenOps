'use client'

import { Layout, theme } from 'antd'
import { useState } from 'react'
import AppBreadcrumb from './AppBreadcrumb'
import AppHeader from './AppHeader'
import AppSidebar from './AppSidebar'

const { Content } = Layout

interface AdminLayoutClientProps {
  children: React.ReactNode
  userName?: string
  userDisplayName?: string
}

export default function AdminLayoutClient({
  children,
  userName,
  userDisplayName,
}: AdminLayoutClientProps) {
  const [collapsed, setCollapsed] = useState(false)

  const {
    token: { colorBgContainer, borderRadiusLG },
  } = theme.useToken()

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* 侧边栏 */}
      <AppSidebar collapsed={collapsed} />

      {/* 主内容区域 */}
      <Layout style={{ marginLeft: collapsed ? 80 : 240, transition: 'all 0.2s' }}>
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
          <AppBreadcrumb />

          {/* 页面内容 */}
          <div
            style={{
              padding: 24,
              minHeight: 360,
              background: colorBgContainer,
              borderRadius: borderRadiusLG,
            }}
          >
            {children}
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
