import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'

export interface SalesReportParams {
  startDate: Date
  endDate: Date
  storeIds?: string[]
  categoryId?: string
}

export interface ProfitReportParams {
  startDate: Date
  endDate: Date
  storeId?: string
}

export interface SalesReportData {
  dailySales: Array<{
    date: string
    orderCount: number
    totalAmount: number
  }>
  storeSales: Array<{
    storeId: string
    storeName: string
    orderCount: number
    totalAmount: number
  }>
  goodsSales: Array<{
    goodsId: string
    goodsCode: string
    goodsName: string
    quantity: number
    totalAmount: number
  }>
}

export interface ProfitReportData {
  stockOuts: Array<{
    id: string
    orderCode: string
    storeName: string
    completedAt: Date
    revenue: number
    cost: number
    profit: number
    profitRate: number
  }>
  summary: {
    totalRevenue: number
    totalCost: number
    totalProfit: number
    avgProfitRate: number
  }
}

export interface InventoryReportData {
  inventory: Array<{
    id: string
    goodsCode: string
    goodsName: string
    categoryName: string
    warehouseName: string
    quantity: number
    availableQuantity: number
    avgCost: number
    totalCost: number
  }>
  summary: {
    totalQty: number
    totalAmount: number
    lowStockCount: number
  }
}

export class ReportService {
  async getSalesReport(params: SalesReportParams): Promise<SalesReportData> {
    const { startDate, endDate, storeIds, categoryId } = params
    const storeIdInts = storeIds?.map((storeId) => Number.parseInt(storeId, 10))

    const whereClause: Prisma.OrderWhereInput = {
      createdAt: { gte: startDate, lte: endDate },
      status: 'COMPLETED',
      isDeleted: false,
    }

    if (storeIdInts && storeIdInts.length > 0) {
      whereClause.storeId = { in: storeIdInts }
    }

    const dailySales = await prisma.$queryRaw<
      Array<{
        date: Date | null
        order_count: bigint
        total_amount: number
      }>
    >`
      SELECT
        DATE(created_at) as date,
        COUNT(*) as order_count,
        COALESCE(SUM(total_amount), 0) as total_amount
      FROM erp_orders
      WHERE created_at >= ${startDate}
        AND created_at <= ${endDate}
        AND status = 'COMPLETED'
        AND is_deleted = false
        ${
          storeIdInts && storeIdInts.length > 0
            ? Prisma.sql`AND store_id IN (${Prisma.join(storeIdInts)})`
            : Prisma.empty
        }
      GROUP BY DATE(created_at)
      ORDER BY date
    `

    const storeSales = await prisma.order.groupBy({
      by: ['storeId'],
      where: whereClause,
      _count: { id: true },
      _sum: { totalAmount: true },
      orderBy: { _sum: { totalAmount: 'desc' } },
    })

    const stores = await prisma.store.findMany({
      where: storeIdInts && storeIdInts.length > 0 ? { id: { in: storeIdInts } } : undefined,
      select: { id: true, name: true },
    })

    const storeMap = new Map(stores.map((s) => [s.id, s.name]))

    const storeSalesData = storeSales.map((s) => ({
      storeId: String(s.storeId),
      storeName: storeMap.get(s.storeId) ?? 'Unknown',
      orderCount: s._count.id,
      totalAmount: Number(s._sum.totalAmount ?? 0),
    }))

    let goodsSalesWhere: Prisma.OrderItemWhereInput = {
      order: whereClause,
    }

    if (categoryId) {
      const parsedCategoryId = Number.parseInt(categoryId, 10)
      goodsSalesWhere = {
        order: whereClause,
        OR: [
          { categoryIdSnapshot: parsedCategoryId },
          {
            categoryIdSnapshot: null,
            goods: { categoryId: parsedCategoryId },
          },
        ],
      }
    }

    const goodsSales = await prisma.orderItem.groupBy({
      by: ['goodsId'],
      where: goodsSalesWhere,
      _sum: { quantity: true, totalPrice: true },
      orderBy: { _sum: { totalPrice: 'desc' } },
      take: 50,
    })

    const goodsIdsList = goodsSales.map((g) => g.goodsId)
    const goods = await prisma.goods.findMany({
      where: { id: { in: goodsIdsList } },
      select: { id: true, code: true, name: true },
    })

    const goodsMap = new Map(goods.map((g) => [g.id, g]))

    const goodsSalesData = goodsSales.map((g) => {
      const goodsInfo = goodsMap.get(g.goodsId)
      return {
        goodsId: String(g.goodsId),
        goodsCode: goodsInfo?.code ?? 'Unknown',
        goodsName: goodsInfo?.name ?? 'Unknown',
        quantity: Number(g._sum.quantity ?? 0),
        totalAmount: Number(g._sum.totalPrice ?? 0),
      }
    })

    const dailySalesResult: Array<{
      date: string
      orderCount: number
      totalAmount: number
    }> = []

    dailySales
      .filter((d) => d.date !== null && d.date !== undefined)
      .forEach((d) => {
        if (d.date !== null && d.date !== undefined) {
          dailySalesResult.push({
            date: d.date.toISOString().split('T')[0] ?? '',
            orderCount: Number(d.order_count),
            totalAmount: Number(d.total_amount),
          })
        }
      })

    return {
      dailySales: dailySalesResult,
      storeSales: storeSalesData,
      goodsSales: goodsSalesData,
    }
  }

  async getProfitReport(params: ProfitReportParams): Promise<ProfitReportData> {
    const { startDate, endDate, storeId } = params
    const storeIdInt = storeId ? Number.parseInt(storeId, 10) : undefined

    const whereClause: Prisma.StockOutWhereInput = {
      completedAt: { gte: startDate, lte: endDate },
      status: 'COMPLETED',
    }

    if (storeIdInt !== undefined) {
      whereClause.order = {
        storeId: storeIdInt,
      }
    }

    const stockOuts = await prisma.stockOut.findMany({
      where: whereClause,
      include: {
        items: true,
        order: {
          include: {
            store: true,
          },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 1000,
    })

    const stockOutMap = new Map(
      stockOuts.map((so) => [
        so.id,
        {
          id: String(so.id),
          orderCode: so.order?.code ?? 'N/A',
          storeName: so.order?.store?.name ?? 'Unknown',
          completedAt: so.completedAt ?? new Date(),
          revenue: Number(so.order?.totalAmount ?? 0),
          cost: 0,
          profit: 0,
          profitRate: 0,
        },
      ])
    )

    for (const so of stockOuts) {
      const item = stockOutMap.get(so.id)
      if (!item) continue

      const cost = so.items.reduce((sum, i) => sum + Number(i.snapshotCost) * Number(i.quantity), 0)

      item.cost = cost
      item.profit = item.revenue - cost
      item.profitRate = item.revenue > 0 ? (item.profit / item.revenue) * 100 : 0
    }

    const stockOutsData = Array.from(stockOutMap.values())

    const summary = stockOutsData.reduce(
      (acc, item) => ({
        totalRevenue: acc.totalRevenue + item.revenue,
        totalCost: acc.totalCost + item.cost,
        totalProfit: acc.totalProfit + item.profit,
        avgProfitRate: acc.totalRevenue > 0 ? (acc.totalProfit / acc.totalRevenue) * 100 : 0,
      }),
      { totalRevenue: 0, totalCost: 0, totalProfit: 0, avgProfitRate: 0 }
    )

    return {
      stockOuts: stockOutsData,
      summary,
    }
  }

  async getInventoryReport(): Promise<InventoryReportData> {
    const inventory = await prisma.inventory.findMany({
      where: { quantity: { gt: 0 } },
      include: {
        goods: {
          include: { category: true },
        },
        warehouse: true,
      },
    })

    const inventoryData = inventory.map((inv) => ({
      id: String(inv.id),
      goodsCode: inv.goods.code,
      goodsName: inv.goods.name,
      categoryName: inv.goods.category.name,
      warehouseName: inv.warehouse.name,
      quantity: Number(inv.quantity),
      availableQuantity: Number(inv.availableQuantity),
      avgCost: Number(inv.avgCost),
      totalCost: Number(inv.totalCost),
    }))

    const lowStockItems = inventory.filter(
      (inv) => Number(inv.availableQuantity) < Number(inv.goods.minStock)
    )

    const summary = {
      totalQty: inventoryData.reduce((sum, i) => sum + i.quantity, 0),
      totalAmount: inventoryData.reduce((sum, i) => sum + i.totalCost, 0),
      lowStockCount: lowStockItems.length,
    }

    return {
      inventory: inventoryData,
      summary,
    }
  }
}

export const reportService = new ReportService()
