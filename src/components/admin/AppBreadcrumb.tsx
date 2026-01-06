'use client'

import { HomeOutlined } from '@ant-design/icons'
import { Breadcrumb } from 'antd'
import { usePathname, useRouter } from 'next/navigation'
import { useMemo } from 'react'
import { getBreadcrumbItems, menuItems } from '@/config/menuConfig'

export default function AppBreadcrumb() {
  const pathname = usePathname()
  const router = useRouter()

  // 获取面包屑项
  const breadcrumbItems = useMemo(() => {
    const items = getBreadcrumbItems(pathname, menuItems)

    // 添加首页作为第一项
    const result = [
      {
        title: (
          <a
            onClick={(e) => {
              e.preventDefault()
              router.push('/admin/dashboard' as any)
            }}
            style={{ display: 'flex', alignItems: 'center', gap: 4 }}
          >
            <HomeOutlined />
            <span>首页</span>
          </a>
        ),
      },
    ]

    // 添加其他面包屑项
    items.forEach((item, index) => {
      const isLast = index === items.length - 1
      result.push({
        title: isLast ? (
          <span>{item.label}</span>
        ) : (
          <a
            onClick={(e) => {
              e.preventDefault()
              if (item.path) {
                router.push(item.path as any)
              }
            }}
          >
            {item.label}
          </a>
        ),
      })
    })

    return result
  }, [pathname, router])

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
