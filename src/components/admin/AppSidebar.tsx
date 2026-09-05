'use client'

import type { Route } from 'next'
import { Layout, Menu } from 'antd'
import { useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { BrandLogo } from '@/components/BrandLogo'
import {
  getKeyToPathMap,
  getMenuItems,
  getOpenKeysForPath,
  getPathToKeyMap,
  getVisibleMenuItems,
  menuItems,
  type MenuItem,
} from '@/config/menuConfig'
import type { UserRole } from '@/types'
import styles from './AppSidebar.module.css'

const { Sider } = Layout

interface AppSidebarProps {
  collapsed: boolean
  roles: UserRole[]
  pathname: string
  onNavigate: (path: string) => void
}

export default function AppSidebar({ collapsed, roles, pathname, onNavigate }: AppSidebarProps) {
  const router = useRouter()
  const visibleMenuItems = useMemo(() => getVisibleMenuItems(menuItems, roles), [roles])
  const hoverTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const cancelPrefetch = useCallback(() => {
    clearTimeout(hoverTimer.current)
  }, [])

  useEffect(() => cancelPrefetch, [cancelPrefetch])

  const prefetch = useCallback(
    (path: string) => {
      if (path !== pathname) router.prefetch(path as Route)
    },
    [pathname, router]
  )

  // 生成路径映射
  const pathToKeyMap = useMemo(() => getPathToKeyMap(visibleMenuItems), [visibleMenuItems])
  const keyToPathMap = useMemo(() => getKeyToPathMap(visibleMenuItems), [visibleMenuItems])

  const items = useMemo(() => {
    const withPrefetch = (entries: MenuItem[]): MenuItem[] =>
      entries.map((item) => {
        if (!item) return item
        if ('children' in item && item.children) {
          return { ...item, children: withPrefetch(item.children) }
        }
        const path = keyToPathMap.get(String(item.key))
        if (!path) return item
        return {
          ...item,
          onMouseEnter: () => {
            cancelPrefetch()
            hoverTimer.current = setTimeout(() => prefetch(path), 150)
          },
          onMouseLeave: cancelPrefetch,
          onFocus: () => prefetch(path),
        }
      })

    return withPrefetch(getMenuItems(visibleMenuItems))
  }, [cancelPrefetch, keyToPathMap, prefetch, visibleMenuItems])

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
  const groupKeys = visibleMenuItems.filter((item) => item.children).map((item) => item.key)
  const groupSignature = JSON.stringify(groupKeys)
  const [expansion, setExpansion] = useState(() => ({
    pathname,
    groupSignature,
    collapsed,
    inlineKeys: routeOpenKeys,
    popupKeys: [] as string[],
  }))

  // Reveal destinations once, not on every render; icon popups never overwrite inline choices.
  if (
    expansion.pathname !== pathname ||
    expansion.groupSignature !== groupSignature ||
    expansion.collapsed !== collapsed
  ) {
    setExpansion({
      pathname,
      groupSignature,
      collapsed,
      inlineKeys: [
        ...new Set([
          ...expansion.inlineKeys,
          ...(expansion.pathname !== pathname ? routeOpenKeys : []),
        ]),
      ].filter((key) => groupKeys.includes(key)),
      popupKeys: [],
    })
  }

  const handleOpenChange = (keys: string[]) => {
    setExpansion((current) => ({
      ...current,
      [collapsed ? 'popupKeys' : 'inlineKeys']: keys.filter((key) => groupKeys.includes(key)),
    }))
  }
  const openKeys = collapsed ? expansion.popupKeys : expansion.inlineKeys

  // 处理菜单点击
  const handleMenuClick = ({ key }: { key: string }) => {
    const path = keyToPathMap.get(key)
    cancelPrefetch()
    if (path) onNavigate(path)
  }

  return (
    <Sider
      className={styles.sidebar}
      collapsible
      collapsed={collapsed}
      trigger={null}
      width={240}
      style={{
        overflow: 'hidden',
        height: '100vh',
        position: 'fixed',
        left: 0,
        top: 0,
        bottom: 0,
      }}
    >
      {/* Logo 区域 */}
      <div
        className={styles.brand}
        style={{
          height: 64,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)',
        }}
      >
        <BrandLogo
          compact={collapsed}
          logoClassName={collapsed ? 'h-8 w-8' : 'h-9 w-9'}
          textClassName="text-white"
        />
      </div>

      {/* 菜单 */}
      <nav className={styles.navigation} aria-label="主导航">
        <Menu
          theme="dark"
          mode="inline"
          selectedKeys={[selectedKey]}
          openKeys={openKeys}
          onOpenChange={handleOpenChange}
          items={items}
          onClick={handleMenuClick}
          style={{ borderRight: 0 }}
        />
      </nav>
    </Sider>
  )
}
