import { Prisma, StockStatus } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { resolveGoodsSnapshot } from '@/lib/goods-snapshot'
import { getShanghaiMonthRange } from '@/lib/shanghai-time'

export interface MonthlyStockOutReportFilters {
  month: string
  keyword?: string
  status?: 'COMPLETED' | 'CANCELLED'
  warehouseId?: string
  storeId?: string
}

export interface MonthlyStockOutReportRow {
  id: string
  stockOutCode: string
  orderId: string
  orderCode: string
  completedAt: Date
  orderedAt: Date
  storeName: string
  warehouseName: string
  status: string
  issueAmount: number
  orderAmount: number
  creatorName: string
  orderStatus: string
  remark: string | null
  revokedAt: Date | null
  revokeReason: string | null
  warnings: string[]
}

export interface MonthlyStockOutDetailRow {
  stockOutId: string
  stockOutCode: string
  orderCode: string
  completedAt: Date
  storeName: string
  warehouseName: string
  goodsCode: string
  goodsName: string
  goodsSpec: string | null
  goodsUnit: string
  quantity: number
  issueUnitPrice: number
  issueAmount: number
  status: string
}

export interface MonthlyStockOutReportData {
  period: {
    month: string
    start: Date
    endExclusive: Date
  }
  summary: {
    stockOutCount: number
    storeCount: number
    totalQuantity: number
    issueAmount: number
    revokedCount: number
    revokedAmount: number
    netIssueAmount: number
    warningCount: number
  }
  rows: MonthlyStockOutReportRow[]
  details: MonthlyStockOutDetailRow[]
}

export interface MonthlyStockOutReportOptions {
  warehouses: Array<{ id: string; name: string; isDeleted: boolean }>
  stores: Array<{ id: string; name: string; isDeleted: boolean }>
}

export class MonthlyStockOutReportService {
  async getOptions(): Promise<MonthlyStockOutReportOptions> {
    const [warehouses, stores] = await Promise.all([
      prisma.warehouse.findMany({
        select: { id: true, name: true, isDeleted: true },
        orderBy: { name: 'asc' },
      }),
      prisma.store.findMany({
        select: { id: true, name: true, isDeleted: true },
        orderBy: { name: 'asc' },
      }),
    ])

    return {
      warehouses: warehouses.map((item) => ({ ...item, id: String(item.id) })),
      stores: stores.map((item) => ({ ...item, id: String(item.id) })),
    }
  }

  async getReport(filters: MonthlyStockOutReportFilters): Promise<MonthlyStockOutReportData> {
    const period = getShanghaiMonthRange(filters.month)
    const orderWhere: Prisma.OrderWhereInput = {}

    if (filters.storeId) {
      orderWhere.storeId = Number.parseInt(filters.storeId, 10)
    }

    const where: Prisma.StockOutWhereInput = {
      isDeleted: false,
      completedAt: {
        gte: period.start,
        lt: period.endExclusive,
      },
      ...(filters.status ? { status: filters.status as StockStatus } : {}),
      ...(filters.warehouseId ? { warehouseId: Number.parseInt(filters.warehouseId, 10) } : {}),
      ...(filters.storeId ? { order: orderWhere } : {}),
    }

    if (filters.keyword) {
      where.OR = [
        { code: { contains: filters.keyword, mode: 'insensitive' } },
        { order: { code: { contains: filters.keyword, mode: 'insensitive' } } },
      ]
    }

    const stockOuts = await prisma.stockOut.findMany({
      where,
      include: {
        warehouse: {
          select: { name: true, isDeleted: true },
        },
        order: {
          select: {
            code: true,
            storeId: true,
            status: true,
            totalAmount: true,
            remark: true,
            createdBy: true,
            orderedAt: true,
            storeNameSnapshot: true,
            isDeleted: true,
            store: {
              select: { name: true, isDeleted: true },
            },
          },
        },
        items: {
          where: { isDeleted: false },
          include: {
            goods: {
              include: {
                category: { select: { name: true } },
              },
            },
          },
          orderBy: { id: 'asc' },
        },
      },
      orderBy: [{ completedAt: 'desc' }, { id: 'desc' }],
    })

    const creatorIds = Array.from(new Set(stockOuts.map((item) => item.order.createdBy)))
    const creators = await prisma.user.findMany({
      where: { id: { in: creatorIds } },
      select: { id: true, name: true, username: true },
    })
    const creatorNameById = new Map(
      creators.map((creator) => [creator.id, creator.name ?? creator.username])
    )

    let totalQuantity = new Prisma.Decimal(0)
    let issueAmount = new Prisma.Decimal(0)
    let revokedAmount = new Prisma.Decimal(0)
    let revokedCount = 0
    let warningCount = 0
    const storeIds = new Set<number>()
    const details: MonthlyStockOutDetailRow[] = []

    const rows = stockOuts.map((stockOut): MonthlyStockOutReportRow => {
      const storeName = stockOut.order.storeNameSnapshot ?? stockOut.order.store.name
      const warnings: string[] = []
      let rowIssueAmount = new Prisma.Decimal(0)

      if (stockOut.order.isDeleted) warnings.push('关联订单已删除')
      if (stockOut.order.store.isDeleted) warnings.push('关联门店已删除')
      if (stockOut.warehouse.isDeleted) warnings.push('关联仓库已删除')
      if (stockOut.items.length === 0) warnings.push('无出库明细')
      if (stockOut.status === 'CANCELLED') warnings.push('完成后已撤销')

      for (const item of stockOut.items) {
        const snapshot = resolveGoodsSnapshot(item, item.goods)
        const lineAmount = item.salePrice.mul(item.quantity)
        rowIssueAmount = rowIssueAmount.plus(lineAmount)
        totalQuantity = totalQuantity.plus(item.quantity)

        details.push({
          stockOutId: String(stockOut.id),
          stockOutCode: stockOut.code,
          orderCode: stockOut.order.code,
          completedAt: stockOut.completedAt!,
          storeName,
          warehouseName: stockOut.warehouse.name,
          goodsCode: snapshot.goodsCodeSnapshot,
          goodsName: snapshot.goodsNameSnapshot,
          goodsSpec: snapshot.goodsSpecSnapshot,
          goodsUnit: snapshot.goodsUnitSnapshot,
          quantity: item.quantity.toNumber(),
          issueUnitPrice: item.salePrice.toNumber(),
          issueAmount: lineAmount.toNumber(),
          status: stockOut.status,
        })
      }

      issueAmount = issueAmount.plus(rowIssueAmount)
      storeIds.add(stockOut.order.storeId)
      warningCount += warnings.length > 0 ? 1 : 0

      if (stockOut.status === 'CANCELLED') {
        revokedCount += 1
        revokedAmount = revokedAmount.plus(rowIssueAmount)
      }

      return {
        id: String(stockOut.id),
        stockOutCode: stockOut.code,
        orderId: String(stockOut.orderId),
        orderCode: stockOut.order.code,
        completedAt: stockOut.completedAt!,
        orderedAt: stockOut.order.orderedAt,
        storeName,
        warehouseName: stockOut.warehouse.name,
        status: stockOut.status,
        issueAmount: rowIssueAmount.toNumber(),
        orderAmount: stockOut.order.totalAmount.toNumber(),
        creatorName: creatorNameById.get(stockOut.order.createdBy) ?? stockOut.order.createdBy,
        orderStatus: stockOut.order.status,
        remark: stockOut.order.remark,
        revokedAt: stockOut.revokedAt,
        revokeReason: stockOut.revokeReason,
        warnings,
      }
    })

    return {
      period: {
        month: filters.month,
        start: period.start,
        endExclusive: period.endExclusive,
      },
      summary: {
        stockOutCount: rows.length,
        storeCount: storeIds.size,
        totalQuantity: totalQuantity.toNumber(),
        issueAmount: issueAmount.toNumber(),
        revokedCount,
        revokedAmount: revokedAmount.toNumber(),
        netIssueAmount: issueAmount.minus(revokedAmount).toNumber(),
        warningCount,
      },
      rows,
      details,
    }
  }
}

export const monthlyStockOutReportService = new MonthlyStockOutReportService()
