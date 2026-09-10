'use client'

import {
  LogoutOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
} from '@ant-design/icons'
import { Avatar, Button, Dropdown, Layout, Space } from 'antd'
import type { MenuProps } from 'antd'
import { logoutAndRedirect } from '@/lib/auth-client'
import AppBreadcrumb from './AppBreadcrumb'

const { Header } = Layout

interface AppHeaderProps {
  collapsed: boolean
  onToggle: () => void
  pathname?: string
  userName?: string
  userDisplayName?: string
}

export default function AppHeader({
  collapsed,
  onToggle,
  pathname,
  userName = '游客',
  userDisplayName,
}: AppHeaderProps) {
  const handleLogout = async () => {
    try {
      await logoutAndRedirect()
    } catch (error) {
      console.error('登出错误:', error)
    }
  }

  // 用户下拉菜单
  const userMenuItems: MenuProps['items'] = [
    {
      key: 'profile',
      icon: <UserOutlined />,
      label: '个人信息',
      onClick: () => {
        // TODO: 跳转到个人信息页面
        console.log('个人信息')
      },
    },
    {
      type: 'divider',
    },
    {
      key: 'logout',
      icon: <LogoutOutlined />,
      label: '退出登录',
      onClick: handleLogout,
      danger: true,
    },
  ]

  return (
    <Header
      style={{
        padding: '0 24px',
        background: '#fff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        borderBottom: '1px solid #f0f0f0',
        position: 'sticky',
        top: 0,
        zIndex: 1,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
        {/* 左侧：折叠按钮与当前页面路径 */}
        <Button
          type="text"
          icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
          aria-label={collapsed ? '展开侧栏' : '收起侧栏'}
          title={collapsed ? '展开侧栏' : '收起侧栏'}
          onClick={onToggle}
          style={{
            fontSize: '16px',
            width: 64,
            height: 64,
            flex: '0 0 auto',
          }}
        />
        <AppBreadcrumb pathname={pathname} />
      </div>

      {/* 右侧：用户信息 */}
      <Space>
        <Dropdown menu={{ items: userMenuItems }} placement="bottomRight">
          <Space style={{ cursor: 'pointer' }}>
            <Avatar icon={<UserOutlined />} />
            <span
              style={{
                maxWidth: 120,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}
            >
              {userDisplayName || userName}
            </span>
          </Space>
        </Dropdown>
      </Space>
    </Header>
  )
}
