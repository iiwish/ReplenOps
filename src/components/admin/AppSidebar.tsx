'use client'

import type { Route } from 'next'
import { Layout, Menu } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo } from 'react'
import {
  getKeyToPathMap,
  getMenuItems,
  getPathToKeyMap,
  menuItems,
} from '@/config/menuConfig'

const { Sider } = Layout

interface AppSidebarProps {
  collapsed: boolean
}

export default function AppSidebar({ collapsed }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()

  // 生成菜单项
  const items = useMemo(() => getMenuItems(menuItems), [])

  // 生成路径映射
  const pathToKeyMap = useMemo(() => getPathToKeyMap(menuItems), [])
  const keyToPathMap = useMemo(() => getKeyToPathMap(menuItems), [])

  // 获取当前选中的菜单项
  const selectedKey = useMemo(() => {
    return pathToKeyMap.get(pathname) || ''
  }, [pathname, pathToKeyMap])

  // 获取当前展开的子菜单
  const defaultOpenKeys = useMemo(() => {
    const keys: string[] = []
    // 如果当前路径匹配某个子菜单项，则展开其父菜单
    for (const item of menuItems) {
      if (item.children) {
        const hasMatchingChild = item.children.some(
          (child) => child.path === pathname
        )
        if (hasMatchingChild) {
          keys.push(item.key)
        }
      }
    }
    return keys
  }, [pathname])

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    const path = keyToPathMap.get(key)
    if (path) {
      router.push(path as Route)
    }
  }

  return (
    <Sider
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={240}
      style={{
        overflow: 'auto',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      {/* Logo 区域 */}
      <div
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <div
          style={{
            color: '#fff',
            fontSize: collapsed ? 14 : 18,
            fontWeight: 'bold',
            transition: 'all 0.2s',
          }}
        >
          {collapsed ? 'ERP' : '门店订货与库存协同平台'}
        </div>
      </div>

      {/* 菜单 */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        defaultOpenKeys={defaultOpenKeys}
        items={items}
        onClick={handleMenuClick}
        style={{ borderRight: 0 }}
      />
    </Sider>
  )
}
