import {
  BarChartOutlined,
  ContainerOutlined,
  DashboardOutlined,
  InboxOutlined,
  SettingOutlined,
  ShopOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'

export type MenuItem = Required<MenuProps>['items'][number]

export interface MenuItemConfig {
  key: string
  label: string
  icon?: React.ReactNode
  path?: string
  children?: MenuItemConfig[]
}

// 菜单配置
export const menuItems: MenuItemConfig[] = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: <DashboardOutlined />,
    path: '/admin/dashboard',
  },
  {
    key: 'inventory',
    label: '库存管理',
    icon: <InboxOutlined />,
    children: [
      {
        key: 'warehouse',
        label: '仓库管理',
        path: '/admin/warehouse',
      },
      {
        key: 'goods',
        label: '商品管理',
        path: '/admin/goods',
      },
      {
        key: 'inventory-query',
        label: '库存查询',
        path: '/admin/inventory',
      },
      {
        key: 'stock-in',
        label: '入库管理',
        path: '/admin/stock-in',
      },
      {
        key: 'stock-out',
        label: '出库管理',
        path: '/admin/stock-out',
      },
    ],
  },
  {
    key: 'stores',
    label: '门店管理',
    icon: <ShopOutlined />,
    children: [
      {
        key: 'store-list',
        label: '门店列表',
        path: '/admin/stores',
      },
      {
        key: 'store-admins',
        label: '门店管理员',
        path: '/admin/store-admins',
      },
    ],
  },
  {
    key: 'orders',
    label: '订单管理',
    icon: <ShoppingCartOutlined />,
    children: [
      {
        key: 'order-list',
        label: '订单列表',
        path: '/admin/orders',
      },
      {
        key: 'order-approval',
        label: '订单审批',
        path: '/admin/order-approval',
      },
    ],
  },
  {
    key: 'containers',
    label: '包装物管理',
    icon: <ContainerOutlined />,
    path: '/admin/containers',
  },
  {
    key: 'reports',
    label: '报表分析',
    icon: <BarChartOutlined />,
    children: [
      {
        key: 'profit-report',
        label: '利润分析',
        path: '/admin/reports/profit',
      },
      {
        key: 'inventory-report',
        label: '库存报表',
        path: '/admin/reports/inventory',
      },
    ],
  },
  {
    key: 'system',
    label: '系统设置',
    icon: <SettingOutlined />,
    children: [
      {
        key: 'users',
        label: '用户管理',
        path: '/admin/users',
      },
      {
        key: 'audit-logs',
        label: '审计日志',
        path: '/admin/audit-logs',
      },
    ],
  },
]

// 将配置转换为 Ant Design Menu 所需的格式
export function getMenuItems(items: MenuItemConfig[]): MenuItem[] {
  return items.map((item) => {
    if (item.children) {
      return {
        key: item.key,
        icon: item.icon,
        label: item.label,
        children: getMenuItems(item.children),
      }
    }
    return {
      key: item.key,
      icon: item.icon,
      label: item.label,
    }
  })
}

// 生成路径到菜单项的映射
export function getPathToKeyMap(items: MenuItemConfig[]): Map<string, string> {
  const map = new Map<string, string>()

  function traverse(items: MenuItemConfig[]) {
    items.forEach((item) => {
      if (item.path) {
        map.set(item.path, item.key)
      }
      if (item.children) {
        traverse(item.children)
      }
    })
  }

  traverse(items)
  return map
}

// 生成 key 到路径的映射
export function getKeyToPathMap(items: MenuItemConfig[]): Map<string, string> {
  const map = new Map<string, string>()

  function traverse(items: MenuItemConfig[]) {
    items.forEach((item) => {
      if (item.path) {
        map.set(item.key, item.path)
      }
      if (item.children) {
        traverse(item.children)
      }
    })
  }

  traverse(items)
  return map
}

// 生成 key 到标签的映射（用于面包屑）
export function getKeyToLabelMap(
  items: MenuItemConfig[]
): Map<string, string> {
  const map = new Map<string, string>()

  function traverse(items: MenuItemConfig[]) {
    items.forEach((item) => {
      map.set(item.key, item.label)
      if (item.children) {
        traverse(item.children)
      }
    })
  }

  traverse(items)
  return map
}

// 根据路径获取面包屑路径
export function getBreadcrumbItems(
  pathname: string,
  items: MenuItemConfig[]
): Array<{ key: string; label: string; path?: string }> {
  const breadcrumbs: Array<{ key: string; label: string; path?: string }> = []

  function findPath(
    items: MenuItemConfig[],
    currentPath: Array<MenuItemConfig>
  ): boolean {
    for (const item of items) {
      const newPath = [...currentPath, item]

      if (item.path === pathname) {
        breadcrumbs.push(
          ...newPath.map((p) => ({
            key: p.key,
            label: p.label,
            path: p.path,
          }))
        )
        return true
      }

      if (item.children && findPath(item.children, newPath)) {
        return true
      }
    }
    return false
  }

  findPath(items, [])
  return breadcrumbs
}
