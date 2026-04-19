import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import dayjs from 'dayjs'

// 查询参数接口
export interface ProfitReportParams {
  startDate?: string
  endDate?: string
  storeId?: string
  goodsId?: string
  categoryId?: string
  goodsIds?: string[]
}

// 利润概览数据
export interface ProfitOverview {
  totalSales: number // 销售总额
  totalCost: number // 成本总额
  totalProfit: number // 利润总额
  profitRate: number // 利润率 %
  orderCount: number // 订单数
  averageProfitPerOrder: number // 平均每单利润
}

// 按仓库统计（实际出库按仓库维度）
export interface ProfitByStore {
  warehouseId: string
  warehouseName: string
  totalSales: number
  totalCost: number
  totalProfit: number
  profitRate: number
  orderCount: number
}

// 按商品统计
export interface ProfitByGoods {
  goodsId: string
  goodsCode: string
  goodsName: string
  goodsSpec: string | null
  categoryName: string
  totalQuantity: number
  totalSales: number
  totalCost: number
  totalProfit: number
  profitRate: number
}

// 按分类统计
export interface ProfitByCategory {
  categoryId: string
  categoryName: string
  totalSales: number
  totalCost: number
  totalProfit: number
  profitRate: number
  orderCount: number
  salesPercentage: number // 占总销售额百分比
}

// 趋势数据点
export interface ProfitTrendPoint {
  date: string // YYYY-MM-DD
  totalSales: number
  totalCost: number
  totalProfit: number
  profitRate: number
  orderCount: number
}

// 分页结果
export interface PaginatedProfitResult<T> {
  data: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

class ProfitReportService {
  /**
   * 获取利润概览数据
   */
  async getOverview(params: ProfitReportParams): Promise<ProfitOverview> {
    const where = this.buildWhereClause(params)

    // 查询已完成的出库单
    const stockOuts = await prisma.stockOut.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
      },
      include: {
        order: {
          select: {
            totalAmount: true,
          },
        },
      },
    })

    const totalSales = stockOuts.reduce(
      (sum, so) => sum + (so.order?.totalAmount?.toNumber() || 0),
      0
    )
    const totalCost = stockOuts.reduce((sum, so) => sum + so.totalCost.toNumber(), 0)
    const totalProfit = stockOuts.reduce((sum, so) => sum + so.totalProfit.toNumber(), 0)
    const orderCount = stockOuts.length
    const profitRate = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0
    const averageProfitPerOrder = orderCount > 0 ? totalProfit / orderCount : 0

    return {
      totalSales,
      totalCost,
      totalProfit,
      profitRate: Number(profitRate.toFixed(2)),
      orderCount,
      averageProfitPerOrder,
    }
  }

  /**
   * 按门店统计利润
   */
  async getByStore(params: ProfitReportParams): Promise<ProfitByStore[]> {
    const where = this.buildWhereClause(params)

    const result = await prisma.stockOut.groupBy({
      by: ['warehouseId'],
      where: {
        ...where,
        status: 'COMPLETED',
      },
      _sum: {
        totalCost: true,
        totalProfit: true,
      },
      _count: true,
    })

    // 获取仓库名称
    const warehouseIds = result.map((r) => r.warehouseId)
    const warehouses = await prisma.warehouse.findMany({
      where: { id: { in: warehouseIds } },
      select: { id: true, name: true },
    })
    const warehouseMap = new Map(warehouses.map((w) => [w.id, w]))

    // 计算销售额（需要从order表获取）
    const stockOutsWithOrders = await prisma.stockOut.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
        warehouseId: { in: warehouseIds },
      },
      include: {
        order: {
          select: {
            totalAmount: true,
          },
        },
      },
    })

    const salesByWarehouse = new Map<number, number>()
    stockOutsWithOrders.forEach((so) => {
      const current = salesByWarehouse.get(so.warehouseId) || 0
      salesByWarehouse.set(so.warehouseId, current + (so.order?.totalAmount?.toNumber() || 0))
    })

    return result
      .map((item) => {
        const warehouse = warehouseMap.get(item.warehouseId)
        const totalSales = salesByWarehouse.get(item.warehouseId) || 0
        const totalCost = item._sum.totalCost?.toNumber() || 0
        const totalProfit = item._sum.totalProfit?.toNumber() || 0
        const profitRate = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

        return {
          warehouseId: String(item.warehouseId),
          warehouseName: warehouse?.name || '未知仓库',
          totalSales,
          totalCost,
          totalProfit,
          profitRate: Number(profitRate.toFixed(2)),
          orderCount: item._count,
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit) // 按利润降序
  }

  /**
   * 按商品统计利润
   */
  async getByGoods(
    params: ProfitReportParams,
    page = 1,
    pageSize = 20
  ): Promise<PaginatedProfitResult<ProfitByGoods>> {
    const where = this.buildWhereClause(params)

    // 如果按分类筛选，先获取分类下的所有商品
    if (params.categoryId) {
      const categoryGoods = await prisma.goods.findMany({
        where: { categoryId: Number.parseInt(params.categoryId, 10) },
        select: { id: true },
      })
      params.goodsIds = categoryGoods.map((g) => String(g.id))
    }

    // 查询出库单明细
    const stockOutIds = await prisma.stockOut
      .findMany({
        where: {
          ...where,
          status: 'COMPLETED',
        },
        select: { id: true },
      })
      .then((items) => items.map((i) => i.id))

    // 按商品汇总
    const result = await prisma.stockOutItem.groupBy({
      by: ['goodsId'],
      where: {
        stockOutId: { in: stockOutIds },
      },
      _sum: {
        quantity: true,
        profit: true,
      },
    })

    // 获取商品详细信息
    const goodsIds = result.map((r) => r.goodsId)
    const goodsList = await prisma.goods.findMany({
      where: { id: { in: goodsIds } },
      include: {
        category: {
          select: { id: true, name: true },
        },
      },
    })
    const goodsMap = new Map(goodsList.map((g) => [g.id, g]))

    // 计算销售总额和成本总额
    const items = await prisma.stockOutItem.findMany({
      where: { stockOutId: { in: stockOutIds }, goodsId: { in: goodsIds } },
      select: {
        goodsId: true,
        quantity: true,
        snapshotCost: true,
        salePrice: true,
        profit: true,
      },
    })

    const salesCostByGoods = new Map<number, { sales: number; cost: number; profit: number }>()
    items.forEach((item) => {
      const existing = salesCostByGoods.get(item.goodsId) || {
        sales: 0,
        cost: 0,
        profit: 0,
      }
      const qty = item.quantity.toNumber()
      const sales = item.salePrice.toNumber() * qty
      const cost = item.snapshotCost.toNumber() * qty
      const profit = item.profit.toNumber()

      salesCostByGoods.set(item.goodsId, {
        sales: existing.sales + sales,
        cost: existing.cost + cost,
        profit: existing.profit + profit,
      })
    })

    const data = result
      .map((item) => {
        const goods = goodsMap.get(item.goodsId)
        const salesCost = salesCostByGoods.get(item.goodsId)
        const totalSales = salesCost?.sales || 0
        const totalCost = salesCost?.cost || 0
        const totalProfit = salesCost?.profit || 0
        const profitRate = totalSales > 0 ? (totalProfit / totalSales) * 100 : 0

        return {
          goodsId: String(item.goodsId),
          goodsCode: goods?.code || '',
          goodsName: goods?.name || '',
          goodsSpec: goods?.spec || null,
          categoryName: goods?.category?.name || '',
          totalQuantity: item._sum.quantity?.toNumber() || 0,
          totalSales,
          totalCost,
          totalProfit,
          profitRate: Number(profitRate.toFixed(2)),
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)

    const total = data.length
    const totalPages = Math.ceil(total / pageSize)
    const paginatedData = data.slice((page - 1) * pageSize, page * pageSize)

    return {
      data: paginatedData,
      total,
      page,
      pageSize,
      totalPages,
    }
  }

  /**
   * 按分类统计利润
   */
  async getByCategory(params: ProfitReportParams): Promise<ProfitByCategory[]> {
    const where = this.buildWhereClause(params)

    // 查询所有符合条件的商品
    const goodsIds = await prisma.stockOutItem
      .findMany({
        where: {
          stockOut: {
            ...where,
            status: 'COMPLETED',
          },
        },
        select: { goodsId: true },
        distinct: ['goodsId'],
      })
      .then((items) => items.map((i) => i.goodsId))

    const goods = await prisma.goods.findMany({
      where: { id: { in: goodsIds } },
      select: { id: true, categoryId: true },
    })

    const categoryGoodsMap = new Map<number, number[]>()
    goods.forEach((g) => {
      const existing = categoryGoodsMap.get(g.categoryId) || []
      existing.push(g.id)
      categoryGoodsMap.set(g.categoryId, existing)
    })

    // 查询出库单明细
    const items = await prisma.stockOutItem.findMany({
      where: {
        stockOut: {
          ...where,
          status: 'COMPLETED',
        },
        goodsId: { in: goodsIds },
      },
      include: {
        stockOut: {
          select: { order: { select: { totalAmount: true } } },
        },
      },
    })

    // 按分类汇总
    const categoryMap = new Map<
      number,
      { sales: number; cost: number; profit: number; orderCount: number }
    >()
    const totalSalesMap = new Map<number, number>()

    items.forEach((item) => {
      const goodsInfo = goods.find((g) => g.id === item.goodsId)
      if (!goodsInfo) return

      const categoryId = goodsInfo.categoryId
      const existing = categoryMap.get(categoryId) || {
        sales: 0,
        cost: 0,
        profit: 0,
        orderCount: 0,
      }
      const qty = item.quantity.toNumber()
      const sales = item.salePrice.toNumber() * qty
      const cost = item.snapshotCost.toNumber() * qty
      const profit = item.profit.toNumber()
      const orderSales = item.stockOut.order?.totalAmount?.toNumber() || 0

      categoryMap.set(categoryId, {
        sales: existing.sales + sales,
        cost: existing.cost + cost,
        profit: existing.profit + profit,
        orderCount: existing.orderCount + 1,
      })

      // 记录总销售额（避免重复计算）
      if (!totalSalesMap.has(item.stockOutId)) {
        totalSalesMap.set(item.stockOutId, orderSales)
      }
    })

    const totalSales = Array.from(totalSalesMap.values()).reduce((sum, v) => sum + v, 0)

    // 获取分类名称
    const categoryIds = Array.from(categoryMap.keys())
    const categories = await prisma.goodsCategory.findMany({
      where: { id: { in: categoryIds } },
      select: { id: true, name: true },
    })
    const categoryNameMap = new Map(categories.map((c) => [c.id, c.name]))

    return Array.from(categoryMap.entries())
      .map(([categoryId, data]) => {
        const profitRate = data.sales > 0 ? (data.profit / data.sales) * 100 : 0
        const salesPercentage = totalSales > 0 ? (data.sales / totalSales) * 100 : 0

        return {
          categoryId: String(categoryId),
          categoryName: categoryNameMap.get(categoryId) || '未知分类',
          totalSales: data.sales,
          totalCost: data.cost,
          totalProfit: data.profit,
          profitRate: Number(profitRate.toFixed(2)),
          orderCount: data.orderCount,
          salesPercentage: Number(salesPercentage.toFixed(2)),
        }
      })
      .sort((a, b) => b.totalProfit - a.totalProfit)
  }

  /**
   * 获取利润趋势数据
   */
  async getTrend(
    params: ProfitReportParams,
    groupBy: 'day' | 'week' | 'month' = 'day'
  ): Promise<ProfitTrendPoint[]> {
    const where = this.buildWhereClause(params)

    const stockOuts = await prisma.stockOut.findMany({
      where: {
        ...where,
        status: 'COMPLETED',
      },
      include: {
        order: {
          select: {
            totalAmount: true,
          },
        },
      },
      orderBy: {
        completedAt: 'asc',
      },
    })

    // 按日期分组
    const trendMap = new Map<string, ProfitTrendPoint>()

    stockOuts.forEach((so) => {
      const completedAt = so.completedAt || so.createdAt
      let date: string

      if (groupBy === 'day') {
        date = dayjs(completedAt).format('YYYY-MM-DD')
      } else if (groupBy === 'week') {
        date = dayjs(completedAt).startOf('week').format('YYYY-MM-DD')
      } else {
        date = dayjs(completedAt).format('YYYY-MM')
      }

      const existing = trendMap.get(date) || {
        date,
        totalSales: 0,
        totalCost: 0,
        totalProfit: 0,
        profitRate: 0,
        orderCount: 0,
      }

      const sales = so.order?.totalAmount?.toNumber() || 0
      existing.totalSales += sales
      existing.totalCost += so.totalCost.toNumber()
      existing.totalProfit += so.totalProfit.toNumber()
      existing.orderCount += 1

      trendMap.set(date, existing)
    })

    // 计算利润率并排序
    return Array.from(trendMap.values())
      .map((item) => ({
        ...item,
        profitRate:
          item.totalSales > 0 ? Number(((item.totalProfit / item.totalSales) * 100).toFixed(2)) : 0,
      }))
      .sort((a, b) => a.date.localeCompare(b.date))
  }

  /**
   * 构建查询条件
   */
  private buildWhereClause(params: ProfitReportParams): Prisma.StockOutWhereInput {
    const where: Prisma.StockOutWhereInput = {
      isDeleted: false,
    }

    const dateConditions: { gte?: Date; lte?: Date } = {}

    if (params.startDate) {
      dateConditions.gte = new Date(params.startDate)
    }

    if (params.endDate) {
      dateConditions.lte = dayjs(params.endDate).endOf('day').toDate()
    }

    if (Object.keys(dateConditions).length > 0) {
      where.completedAt = dateConditions
    }

    if (params.storeId) {
      where.order = {
        storeId: Number.parseInt(params.storeId, 10),
      }
    }

    if (params.goodsId) {
      where.items = {
        some: {
          goodsId: Number.parseInt(params.goodsId, 10),
        },
      }
    }

    if (params.goodsIds) {
      where.items = {
        some: {
          goodsId: {
            in: params.goodsIds.map((goodsId) => Number.parseInt(goodsId, 10)),
          },
        },
      }
    }

    return where
  }
}

export const profitReportService = new ProfitReportService()
