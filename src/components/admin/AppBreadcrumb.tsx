'use client'

import type { Route } from 'next'
import Link from 'next/link'
import { HomeOutlined } from '@ant-design/icons'
import { Breadcrumb } from 'antd'
import { usePathname } from 'next/navigation'
import { useMemo } from 'react'
import { getBreadcrumbItems, menuItems } from '@/config/menuConfig'

export default function AppBreadcrumb() {
  const pathname = usePathname()

  // 获取面包屑项
  const breadcrumbItems = useMemo(() => {
    const items = getBreadcrumbItems(pathname, menuItems)

    // 添加首页作为第一项
    const result = [
      {
        title: (
          <Link href="/admin/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <HomeOutlined />
            <span>首页</span>
          </Link>
        ),
      },
    ]

    // 添加其他面包屑项
    items.forEach((item, index) => {
      const isLast = index === items.length - 1
      result.push({
        title:
          isLast || !item.path ? (
            <span>{item.label}</span>
          ) : (
            <Link href={item.path as Route}>{item.label}</Link>
          ),
      })
    })

    return result
  }, [pathname])

  // 如果在首页，不显示面包屑
  if (pathname === '/admin' || pathname === '/admin/dashboard') {
    return null
  }

  return (
    <Breadcrumb
      items={breadcrumbItems}
      style={{
        margin: '16px 0',
      }}
    />
  )
}
