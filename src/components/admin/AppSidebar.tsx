'use client'

import type { Route } from 'next'
import { Layout, Menu } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo, useState } from 'react'
import {
  getKeyToPathMap,
  getMenuItems,
  getOpenKeysForPath,
  getPathToKeyMap,
  getVisibleMenuItems,
  menuItems,
} from '@/config/menuConfig'
import type { UserRole } from '@/types'

const { Sider } = Layout

interface AppSidebarProps {
  collapsed: boolean
  roles: UserRole[]
}

export default function AppSidebar({ collapsed, roles }: AppSidebarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const visibleMenuItems = useMemo(() => getVisibleMenuItems(menuItems, roles), [roles])

  // 生成菜单项
  const items = useMemo(() => getMenuItems(visibleMenuItems), [visibleMenuItems])

  // 生成路径映射
  const pathToKeyMap = useMemo(() => getPathToKeyMap(visibleMenuItems), [visibleMenuItems])
  const keyToPathMap = useMemo(() => getKeyToPathMap(visibleMenuItems), [visibleMenuItems])

  // 获取当前选中的菜单项
  const selectedKey = useMemo(() => {
    const matchedPath = [...pathToKeyMap.keys()]
      .sort((a, b) => b.length - a.length)
      .find((path) => path === pathname || pathname.startsWith(`${path}/`))

    return matchedPath ? pathToKeyMap.get(matchedPath) || '' : ''
  }, [pathname, pathToKeyMap])

  // 获取当前展开的子菜单
  const routeOpenKeys = useMemo(
    () => getOpenKeysForPath(pathname, visibleMenuItems),
    [pathname, visibleMenuItems]
  )
  const [userOpenKeys, setUserOpenKeys] = useState<string[]>([])
  const openKeys = useMemo(
    () => [...new Set([...userOpenKeys, ...routeOpenKeys])],
    [routeOpenKeys, userOpenKeys]
  )

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
          {collapsed ? 'RO' : 'ReplenOps'}
        </div>
      </div>

      {/* 菜单 */}
      <Menu
        theme="dark"
        mode="inline"
        selectedKeys={[selectedKey]}
        openKeys={openKeys}
        onOpenChange={setUserOpenKeys}
        items={items}
        onClick={handleMenuClick}
        style={{ borderRight: 0 }}
      />
    </Sider>
  )
}
