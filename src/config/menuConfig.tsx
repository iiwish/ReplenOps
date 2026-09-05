import {
  BarChartOutlined,
  AppstoreOutlined,
  ContainerOutlined,
  DashboardOutlined,
  InboxOutlined,
  SettingOutlined,
  ShoppingCartOutlined,
} from '@ant-design/icons'
import type { MenuProps } from 'antd'
import type { UserRole } from '@/types'

export type MenuItem = Required<MenuProps>['items'][number]

export interface MenuItemConfig {
  key: string
  label: string
  icon?: React.ReactNode
  path?: string
  roles?: readonly UserRole[]
  children?: MenuItemConfig[]
}

const ADMIN_ROLES: readonly UserRole[] = ['super_admin', 'warehouse_manager', 'finance', 'approver']

const MASTER_DATA_ROLES: readonly UserRole[] = ['super_admin', 'warehouse_manager', 'finance']
const WAREHOUSE_ROLES: readonly UserRole[] = ['super_admin', 'warehouse_manager']
const REPORT_ROLES: readonly UserRole[] = ['super_admin', 'warehouse_manager', 'finance']

// 菜单配置
export const menuItems: MenuItemConfig[] = [
  {
    key: 'dashboard',
    label: '工作台',
    icon: <DashboardOutlined />,
    path: '/admin/dashboard',
    roles: ADMIN_ROLES,
  },
  {
    key: 'orders',
    label: '订单管理',
    icon: <ShoppingCartOutlined />,
    path: '/admin/orders',
    roles: ADMIN_ROLES,
  },
  {
    key: 'inventory',
    label: '库存管理',
    icon: <InboxOutlined />,
    children: [
      {
        key: 'inventory-query',
        label: '库存查询',
        path: '/admin/inventory/query',
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
      {
        key: 'inventory-logs',
        label: '库存流水',
        path: '/admin/inventory/logs',
      },
      {
        key: 'cost-history',
        label: '成本变动记录',
        path: '/admin/inventory/cost-history',
        roles: REPORT_ROLES,
      },
    ],
    roles: ADMIN_ROLES,
  },
  {
    key: 'containers',
    label: '包装物',
    icon: <ContainerOutlined />,
    path: '/admin/containers',
    roles: ADMIN_ROLES,
  },
  {
    key: 'reports',
    label: '报表分析',
    icon: <BarChartOutlined />,
    roles: REPORT_ROLES,
    children: [
      {
        key: 'inventory-report',
        label: '库存分析',
        path: '/admin/reports/inventory',
      },
      {
        key: 'stock-out-report',
        label: '月度出库报表',
        path: '/admin/reports/stock-out',
      },
    ],
  },
  {
    key: 'master-data',
    label: '基础资料',
    icon: <AppstoreOutlined />,
    roles: MASTER_DATA_ROLES,
    children: [
      {
        key: 'goods',
        label: '商品档案',
        path: '/admin/goods',
      },
      {
        key: 'goods-category',
        label: '商品分类',
        path: '/admin/goods-category',
      },
      {
        key: 'warehouse',
        label: '仓库档案',
        path: '/admin/warehouse',
        roles: WAREHOUSE_ROLES,
      },
      {
        key: 'stores',
        label: '门店档案',
        path: '/admin/stores',
        roles: WAREHOUSE_ROLES,
      },
    ],
  },
  {
    key: 'system',
    label: '系统设置',
    icon: <SettingOutlined />,
    roles: ['super_admin'],
    children: [
      {
        key: 'system-config',
        label: '报货时间设置',
        path: '/admin/system-config',
      },
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

export function getVisibleMenuItems(
  items: MenuItemConfig[],
  roles: readonly UserRole[]
): MenuItemConfig[] {
  return items.flatMap((item) => {
    if (item.roles && !item.roles.some((role) => roles.includes(role))) {
      return []
    }

    const children = item.children ? getVisibleMenuItems(item.children, roles) : undefined
    if (item.children && children?.length === 0) {
      return []
    }

    return [{ ...item, children }]
  })
}

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
export function getKeyToLabelMap(items: MenuItemConfig[]): Map<string, string> {
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

export function getOpenKeysForPath(pathname: string, items: MenuItemConfig[]): string[] {
  const openKeys: string[] = []

  function visit(menuItems: MenuItemConfig[]): boolean {
    for (const item of menuItems) {
      const matchesPath =
        item.path && (item.path === pathname || pathname.startsWith(`${item.path}/`))
      const matchesChild = item.children ? visit(item.children) : false

      if (matchesChild && item.children) {
        openKeys.push(item.key)
      }

      if (matchesPath || matchesChild) {
        return true
      }
    }

    return false
  }

  visit(items)
  return openKeys
}

// 根据路径获取面包屑路径
export function getBreadcrumbItems(
  pathname: string,
  items: MenuItemConfig[]
): Array<{ key: string; label: string; path?: string }> {
  const breadcrumbs: Array<{ key: string; label: string; path?: string }> = []

  function findPath(items: MenuItemConfig[], currentPath: Array<MenuItemConfig>): boolean {
    for (const item of items) {
      const newPath = [...currentPath, item]

      if (item.path && (item.path === pathname || pathname.startsWith(`${item.path}/`))) {
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
