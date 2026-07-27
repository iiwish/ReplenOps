import { prisma } from '@/lib/prisma'
import type { AuthUser } from '@/lib/auth'
import { assertCanReadStore, canReadAllStores, getAccessibleStoreIds } from '@/lib/store-access'

export interface TodayStats {
  orderCount: number
  pendingCount: number
  lowStockCount: number
  containerToReturnCount: number
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
  lowStockItems: TodoItem
}

export class DashboardService {
  async getTodayStats(storeId?: string, user?: AuthUser): Promise<TodayStats> {
    const storeScope = await this.getStoreScope(storeId, user)

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    const [
      orderCountResult,
      pendingCountResult,
      lowStockCountResult,
      containerToReturnCountResult,
    ] = await Promise.all([
      prisma.order.count({
        where: {
          ...(storeScope !== undefined && { storeId: storeScope }),
          createdAt: { gte: today, lt: tomorrow },
          isDeleted: false,
        },
      }),
      prisma.order.count({
        where: {
          ...(storeScope !== undefined && { storeId: storeScope }),
          status: { in: ['PENDING', 'APPROVED'] },
          isDeleted: false,
        },
      }),
      prisma.inventory.findMany({
        where: {
          quantity: { gt: 0 },
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
    }
  }

  async getTodoList(storeId?: string, user?: AuthUser): Promise<TodoList> {
    const storeScope = await this.getStoreScope(storeId, user)

    const pendingReceiptOrders = await prisma.order.count({
      where: {
        ...(storeScope !== undefined && { storeId: storeScope }),
        status: { in: ['APPROVED', 'PROCESSING'] },
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

    const lowStockItems = await prisma.inventory.findMany({
      where: {
        quantity: { gt: 0 },
      },
      include: {
        goods: true,
        warehouse: true,
      },
    })

    const filteredLowStockItems = lowStockItems.filter(
      (inv) => inv.availableQuantity < inv.goods.minStock
    )

    return {
      pendingOrders: {
        id: 'pending-orders',
        type: 'order',
        title: '待收货订单',
        description: '有订单待收货处理',
        count: pendingReceiptOrders,
        link: '/mobile/orders?status=APPROVED',
      },
      containersToReturn: {
        id: 'containers-return',
        type: 'container',
        title: '包装物待归还',
        description: '有包装物需归还',
        count: containerTrackings.length,
        link: '/mobile/containers',
      },
      lowStockItems: {
        id: 'low-stock',
        type: 'inventory',
        title: '库存预警',
        description: '部分商品库存不足',
        count: filteredLowStockItems.length,
        link: '/mobile/inventory',
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
        createdAt: { gte: startDate, lte: endDate },
        status: 'COMPLETED',
        isDeleted: false,
        ...(normalizedStoreId !== undefined && { storeId: normalizedStoreId }),
      },
      select: {
        createdAt: true,
      },
      orderBy: {
        createdAt: 'asc',
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
      const dateStr = order.createdAt.toISOString().split('T')[0] ?? ''
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
