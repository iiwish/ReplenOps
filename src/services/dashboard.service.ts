import { prisma } from '@/lib/prisma'
import { ContainerReturnStatus, OrderStatus, StockStatus } from '@prisma/client'
import type { AuthUser } from '@/lib/auth'
import { assertCanReadStore, canReadAllStores, getAccessibleStoreIds } from '@/lib/store-access'
import {
  getShanghaiDate,
  getShanghaiDateRange,
  getShanghaiMonth,
  getShanghaiMonthRange,
} from '@/lib/shanghai-time'

const PENDING_ORDER_STATUSES: OrderStatus[] = ['PENDING', 'APPROVED', 'PROCESSING', 'REJECTED']
const ACTIONABLE_ORDER_STATUSES: OrderStatus[] = ['PENDING', 'APPROVED', 'PROCESSING']
const ACTIVE_STOCK_STATUSES: StockStatus[] = ['PENDING', 'APPROVED', 'PROCESSING']

export interface TodayStats {
  orderCount: number
  pendingCount: number
  lowStockCount: number
  containerToReturnCount: number
  monthlyOrderCount: number
  monthlyPendingCount: number
  monthlyCompletedCount: number
}

export interface TodoItem {
  id: string
  type: 'order' | 'container' | 'inventory'
  title: string
  description: string
  count: number
  link: string
}

export interface TodoList {
  pendingOrders: TodoItem
  containersToReturn: TodoItem
}

export interface DashboardInventoryItem {
  id: string
  goodsCode: string
  goodsName: string
  goodsSpec: string | null
  goodsUnit: string
  warehouseName: string
  availableQuantity: number
  minStock: number
  shortageQuantity: number
}

export interface DashboardInventoryChange {
  date: string
  inbound: number
  outbound: number
  returned: number
  adjustment: number
  netChange: number
}

export interface DashboardRecentChange {
  id: string
  changeType: string
  quantity: number
  goodsName: string
  goodsUnit: string
  warehouseName: string
  createdAt: Date
}

export interface DashboardTask {
  id: string
  label: string
  count: number
  href: string
}

export interface AdminDashboardData {
  todayStats: TodayStats
  inventory: {
    totalQuantity: number
    availableQuantity: number
    lockedQuantity: number
    totalValue: number
    lowStockCount: number
    zeroStockCount: number
    lowStockItems: DashboardInventoryItem[]
  }
  inventoryChanges: DashboardInventoryChange[]
  recentInventoryChanges: DashboardRecentChange[]
  tasks: DashboardTask[]
}

export class DashboardService {
  async getTodayStats(storeId?: string, user?: AuthUser): Promise<TodayStats> {
    const storeScope = await this.getStoreScope(storeId, user)

    const todayRange = getShanghaiDateRange(getShanghaiDate(), getShanghaiDate())
    const monthRange = getShanghaiMonthRange(getShanghaiMonth())
    const monthOrderScope = {
      ...(storeScope !== undefined && { storeId: storeScope }),
      createdAt: { gte: monthRange.start, lt: monthRange.endExclusive },
      isDeleted: false,
    }

    const [
      orderCountResult,
      pendingCountResult,
      lowStockCountResult,
      containerToReturnCountResult,
      monthlyOrderCountResult,
      monthlyPendingCountResult,
      monthlyCompletedCountResult,
    ] = await Promise.all([
      prisma.order.count({
        where: {
          ...(storeScope !== undefined && { storeId: storeScope }),
          orderedAt: { gte: todayRange.start, lt: todayRange.endExclusive },
          isDeleted: false,
        },
      }),
      prisma.order.count({
        where: {
          ...(storeScope !== undefined && { storeId: storeScope }),
          status: { in: PENDING_ORDER_STATUSES },
          isDeleted: false,
        },
      }),
      prisma.inventory.findMany({
        where: {
          isDeleted: false,
          goods: {
            isActive: true,
            isDeleted: false,
          },
          warehouse: {
            isActive: true,
            isDeleted: false,
          },
        },
        include: {
          goods: {
            select: {
              minStock: true,
            },
          },
        },
      }),
      prisma.containerTracking.findMany({
        where: {
          ...(storeScope !== undefined && { storeId: storeScope }),
          currentBorrowed: { gt: 0 },
        },
      }),
      prisma.order.count({
        where: monthOrderScope,
      }),
      prisma.order.count({
        where: {
          ...monthOrderScope,
          status: { in: PENDING_ORDER_STATUSES },
        },
      }),
      prisma.order.count({
        where: {
          ...monthOrderScope,
          status: 'COMPLETED',
        },
      }),
    ])

    const lowStockCount = lowStockCountResult.filter(
      (inv) => inv.availableQuantity < inv.goods.minStock
    ).length

    const containerToReturnCount = containerToReturnCountResult.reduce(
      (sum, tracking) => sum + Number(tracking.currentBorrowed),
      0
    )

    return {
      orderCount: orderCountResult,
      pendingCount: pendingCountResult,
      lowStockCount,
      containerToReturnCount,
      monthlyOrderCount: monthlyOrderCountResult,
      monthlyPendingCount: monthlyPendingCountResult,
      monthlyCompletedCount: monthlyCompletedCountResult,
    }
  }

  async getAdminDashboardData(user: AuthUser): Promise<AdminDashboardData> {
    if (!canReadAllStores(user)) {
      throw new Error('权限不足')
    }

    const monthRange = getShanghaiMonthRange(getShanghaiMonth())

    const [
      todayStats,
      inventoryRows,
      movementLogs,
      recentLogs,
      pendingOrderCount,
      stockInCount,
      stockOutCount,
      containerReturnCount,
    ] = await Promise.all([
      this.getTodayStats(undefined, user),
      prisma.inventory.findMany({
        where: {
          isDeleted: false,
          goods: { isActive: true, isDeleted: false },
          warehouse: { isActive: true, isDeleted: false },
        },
        select: {
          id: true,
          quantity: true,
          lockedQuantity: true,
          availableQuantity: true,
          avgCost: true,
          goods: {
            select: {
              code: true,
              name: true,
              spec: true,
              unit: true,
              minStock: true,
            },
          },
          warehouse: { select: { name: true } },
        },
      }),
      prisma.inventoryLog.findMany({
        where: {
          createdAt: { gte: monthRange.start, lt: monthRange.endExclusive },
          inventory: { isDeleted: false },
        },
        select: { changeType: true, quantity: true, createdAt: true },
      }),
      prisma.inventoryLog.findMany({
        where: { inventory: { isDeleted: false } },
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          changeType: true,
          quantity: true,
          createdAt: true,
          inventory: {
            select: {
              warehouse: { select: { name: true } },
              goods: { select: { name: true, unit: true } },
            },
          },
        },
      }),
      prisma.order.count({
        where: { status: { in: ACTIONABLE_ORDER_STATUSES }, isDeleted: false },
      }),
      prisma.stockIn.count({
        where: { status: { in: ACTIVE_STOCK_STATUSES }, isDeleted: false },
      }),
      prisma.stockOut.count({
        where: { status: { in: ACTIVE_STOCK_STATUSES }, isDeleted: false },
      }),
      prisma.containerReturn.count({ where: { status: ContainerReturnStatus.PENDING } }),
    ])

    const lowStockItems = inventoryRows
      .map((item) => {
        const availableQuantity = Number(item.availableQuantity)
        const minStock = Number(item.goods.minStock)
        return {
          id: String(item.id),
          goodsCode: item.goods.code,
          goodsName: item.goods.name,
          goodsSpec: item.goods.spec,
          goodsUnit: item.goods.unit,
          warehouseName: item.warehouse.name,
          availableQuantity,
          minStock,
          shortageQuantity: Math.max(minStock - availableQuantity, 0),
        }
      })
      .filter((item) => item.shortageQuantity > 0)
      .sort((left, right) => right.shortageQuantity - left.shortageQuantity)

    const inventoryChanges = this.buildInventoryChanges(monthRange, movementLogs)

    return {
      todayStats,
      inventory: {
        totalQuantity: inventoryRows.reduce((sum, item) => sum + Number(item.quantity), 0),
        availableQuantity: inventoryRows.reduce(
          (sum, item) => sum + Number(item.availableQuantity),
          0
        ),
        lockedQuantity: inventoryRows.reduce((sum, item) => sum + Number(item.lockedQuantity), 0),
        totalValue: inventoryRows.reduce(
          (sum, item) => sum + Number(item.quantity) * Number(item.avgCost),
          0
        ),
        lowStockCount: lowStockItems.length,
        zeroStockCount: inventoryRows.filter((item) => Number(item.availableQuantity) <= 0).length,
        lowStockItems: lowStockItems.slice(0, 8),
      },
      inventoryChanges,
      recentInventoryChanges: recentLogs.map((log) => ({
        id: String(log.id),
        changeType: log.changeType,
        quantity: Math.abs(Number(log.quantity)),
        goodsName: log.inventory.goods.name,
        goodsUnit: log.inventory.goods.unit,
        warehouseName: log.inventory.warehouse.name,
        createdAt: log.createdAt,
      })),
      tasks: [
        {
          id: 'pending-orders',
          label: '待处理订单',
          count: pendingOrderCount,
          href: '/admin/orders?status=PENDING%2CAPPROVED%2CPROCESSING',
        },
        {
          id: 'stock-in',
          label: '待处理入库',
          count: stockInCount,
          href: '/admin/stock-in',
        },
        {
          id: 'stock-out',
          label: '待处理出库',
          count: stockOutCount,
          href: '/admin/stock-out',
        },
        {
          id: 'container-returns',
          label: '待审核包装物归还',
          count: containerReturnCount,
          href: '/admin/container-return',
        },
      ],
    }
  }

  private buildInventoryChanges(
    monthRange: { start: Date; endExclusive: Date },
    logs: Array<{ changeType: string; quantity: { toNumber(): number } | number; createdAt: Date }>
  ): DashboardInventoryChange[] {
    const today = getShanghaiDate()
    const changes = new Map<string, DashboardInventoryChange>()

    for (
      let cursor = new Date(monthRange.start);
      cursor < monthRange.endExclusive;
      cursor = new Date(cursor.getTime() + 24 * 60 * 60 * 1000)
    ) {
      const date = getShanghaiDate(cursor)
      if (date > today) break
      changes.set(date, { date, inbound: 0, outbound: 0, returned: 0, adjustment: 0, netChange: 0 })
    }

    for (const log of logs) {
      const change = changes.get(getShanghaiDate(log.createdAt))
      if (!change) continue

      const quantity = typeof log.quantity === 'number' ? log.quantity : log.quantity.toNumber()
      const amount = Math.abs(quantity)
      if (log.changeType === 'IN') change.inbound += amount
      if (log.changeType === 'OUT') change.outbound += amount
      if (log.changeType === 'RETURN') change.returned += amount
      if (log.changeType === 'ADJUSTMENT') change.adjustment += quantity
      change.netChange = change.inbound + change.returned + change.adjustment - change.outbound
    }

    return Array.from(changes.values())
  }

  async getTodoList(storeId?: string, user?: AuthUser): Promise<TodoList> {
    const storeScope = await this.getStoreScope(storeId, user)

    const pendingReceiptOrders = await prisma.order.count({
      where: {
        ...(storeScope !== undefined && { storeId: storeScope }),
        status: 'PROCESSING',
        isDeleted: false,
      },
    })

    const containerTrackings = await prisma.containerTracking.findMany({
      where: {
        ...(storeScope !== undefined && { storeId: storeScope }),
        currentBorrowed: { gt: 0 },
      },
      include: {
        container: true,
      },
    })

    return {
      pendingOrders: {
        id: 'pending-orders',
        type: 'order',
        title: '待收货订单',
        description: '有订单待收货处理',
        count: pendingReceiptOrders,
        link: '/mobile/orders?status=PROCESSING',
      },
      containersToReturn: {
        id: 'containers-return',
        type: 'container',
        title: '可归还包装物',
        description: '当前门店可申请归还的包装物数量',
        count: containerTrackings.reduce(
          (sum, tracking) => sum + tracking.currentBorrowed - tracking.pendingReturnQuantity,
          0
        ),
        link: '/mobile/container-return',
      },
    }
  }

  private async getStoreScope(
    storeId?: string,
    user?: AuthUser
  ): Promise<number | { in: number[] } | undefined> {
    if (storeId !== undefined) {
      const normalizedStoreId = Number.parseInt(storeId, 10)
      if (Number.isNaN(normalizedStoreId)) {
        throw new Error('门店ID无效')
      }

      if (user) {
        await assertCanReadStore(user, normalizedStoreId)
      }

      return normalizedStoreId
    }

    if (user && !canReadAllStores(user)) {
      const accessibleStoreIds = await getAccessibleStoreIds(user)
      return { in: accessibleStoreIds }
    }

    return undefined
  }

  async getOrderTrend(
    days: number = 7,
    storeId?: string
  ): Promise<
    Array<{
      date: string
      count: number
    }>
  > {
    const normalizedStoreId = storeId !== undefined ? Number.parseInt(storeId, 10) : undefined

    const endDate = new Date()
    endDate.setHours(23, 59, 59, 999)

    const startDate = new Date(endDate)
    startDate.setDate(startDate.getDate() - days + 1)
    startDate.setHours(0, 0, 0, 0)

    const orders = await prisma.order.findMany({
      where: {
        orderedAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
        isDeleted: false,
        ...(normalizedStoreId !== undefined && { storeId: normalizedStoreId }),
      },
      select: {
        orderedAt: true,
      },
      orderBy: {
        orderedAt: 'asc',
      },
    })

    const trendMap = new Map<string, { count: number }>()

    for (let i = 0; i < days; i++) {
      const date = new Date(startDate)
      date.setDate(date.getDate() + i)
      const dateStr = date.toISOString().split('T')[0] ?? ''
      trendMap.set(dateStr, { count: 0 })
    }

    for (const order of orders) {
      const dateStr = order.orderedAt.toISOString().split('T')[0] ?? ''
      const existing = trendMap.get(dateStr)
      if (existing !== undefined) {
        existing.count += 1
      }
    }

    const result: Array<{
      date: string
      count: number
    }> = []
    trendMap.forEach((data, date) => {
      result.push({
        date,
        count: data.count,
      })
    })

    return result
  }
}

export const dashboardService = new DashboardService()
