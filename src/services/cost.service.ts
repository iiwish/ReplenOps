import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import { getShanghaiDateRange } from '@/lib/shanghai-time'

// 成本历史列表参数接口
export interface ListCostHistoryParams {
  page?: number
  pageSize?: number
  warehouseId?: string
  goodsId?: string
  startDate?: string
  endDate?: string
}

// 成本历史列表项接口
export interface CostHistoryListItem {
  id: string
  warehouseId: string
  warehouseName: string
  goodsId: string
  goodsCode: string
  goodsName: string
  goodsUnit: string
  beforeCost: number
  afterCost: number
  costChange: number // 成本变动金额
  costChangePercent: number // 成本变动百分比
  beforeQty: number
  afterQty: number
  inQty: number
  inPrice: number
  referenceType: string
  referenceId: string
  createdAt: Date
}

// 分页返回结果
export interface PaginatedCostHistoryResult {
  data: CostHistoryListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// 成本趋势数据点
export interface CostTrendPoint {
  date: Date
  cost: number
}

export class CostService {
  /**
   * 获取成本历史列表（分页）
   */
  async listHistory(params: ListCostHistoryParams = {}): Promise<PaginatedCostHistoryResult> {
    const { page = 1, pageSize = 20, warehouseId, goodsId, startDate, endDate } = params

    // 构建查询条件
    const where: Prisma.CostHistoryWhereInput = {}

    // 仓库筛选
    if (warehouseId) {
      where.warehouseId = Number.parseInt(warehouseId, 10)
    }

    // 商品筛选
    if (goodsId) {
      where.goodsId = Number.parseInt(goodsId, 10)
    }

    // 日期范围筛选
    if (startDate || endDate) {
      const range = getShanghaiDateRange(startDate, endDate)
      where.createdAt = {
        ...(range.start ? { gte: range.start } : {}),
        ...(range.endExclusive ? { lt: range.endExclusive } : {}),
      }
    }

    // 查询总数
    const total = await prisma.costHistory.count({ where })

    // 查询数据
    const data = await prisma.costHistory.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        warehouseId: true,
        goodsId: true,
        beforeCost: true,
        afterCost: true,
        beforeQty: true,
        afterQty: true,
        inQty: true,
        inPrice: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
        warehouse: {
          select: {
            name: true,
          },
        },
        goods: {
          select: {
            code: true,
            name: true,
            unit: true,
          },
        },
      },
    })

    // 转换数据格式
    const formattedData: CostHistoryListItem[] = data.map((item) => {
      const beforeCost = Number(item.beforeCost)
      const afterCost = Number(item.afterCost)
      const costChange = afterCost - beforeCost
      const costChangePercent = beforeCost > 0 ? (costChange / beforeCost) * 100 : 0

      return {
        id: String(item.id),
        warehouseId: String(item.warehouseId),
        warehouseName: item.warehouse.name,
        goodsId: String(item.goodsId),
        goodsCode: item.goods.code,
        goodsName: item.goods.name,
        goodsUnit: item.goods.unit,
        beforeCost,
        afterCost,
        costChange: Math.round(costChange * 100) / 100,
        costChangePercent: Math.round(costChangePercent * 100) / 100,
        beforeQty: Number(item.beforeQty),
        afterQty: Number(item.afterQty),
        inQty: Number(item.inQty),
        inPrice: Number(item.inPrice),
        referenceType: item.referenceType,
        referenceId: item.referenceId,
        createdAt: item.createdAt,
      }
    })

    return {
      data: formattedData,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    }
  }

  /**
   * 获取成本趋势数据
   * @param warehouseId 仓库ID
   * @param goodsId 商品ID
   * @param days 最近N天（默认30天）
   * @returns 成本趋势数据点数组
   */
  async getTrend(
    warehouseId: string,
    goodsId: string,
    days: number = 30
  ): Promise<CostTrendPoint[]> {
    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const history = await prisma.costHistory.findMany({
      where: {
        warehouseId: Number.parseInt(warehouseId, 10),
        goodsId: Number.parseInt(goodsId, 10),
        createdAt: {
          gte: startDate,
        },
      },
      orderBy: { createdAt: 'asc' },
      select: {
        afterCost: true,
        createdAt: true,
      },
    })

    return history.map((h) => ({
      date: h.createdAt,
      cost: Number(h.afterCost),
    }))
  }

  /**
   * 获取商品的最新成本
   * @param warehouseId 仓库ID
   * @param goodsId 商品ID
   * @returns 最新成本记录，如果不存在返回null
   */
  async getLatestCost(warehouseId: string, goodsId: string): Promise<CostHistoryListItem | null> {
    const latest = await prisma.costHistory.findFirst({
      where: {
        warehouseId: Number.parseInt(warehouseId, 10),
        goodsId: Number.parseInt(goodsId, 10),
      },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        warehouseId: true,
        goodsId: true,
        beforeCost: true,
        afterCost: true,
        beforeQty: true,
        afterQty: true,
        inQty: true,
        inPrice: true,
        referenceType: true,
        referenceId: true,
        createdAt: true,
        warehouse: {
          select: {
            name: true,
          },
        },
        goods: {
          select: {
            code: true,
            name: true,
            unit: true,
          },
        },
      },
    })

    if (!latest) {
      return null
    }

    const beforeCost = Number(latest.beforeCost)
    const afterCost = Number(latest.afterCost)
    const costChange = afterCost - beforeCost
    const costChangePercent = beforeCost > 0 ? (costChange / beforeCost) * 100 : 0

    return {
      id: String(latest.id),
      warehouseId: String(latest.warehouseId),
      warehouseName: latest.warehouse.name,
      goodsId: String(latest.goodsId),
      goodsCode: latest.goods.code,
      goodsName: latest.goods.name,
      goodsUnit: latest.goods.unit,
      beforeCost,
      afterCost,
      costChange: Math.round(costChange * 100) / 100,
      costChangePercent: Math.round(costChangePercent * 100) / 100,
      beforeQty: Number(latest.beforeQty),
      afterQty: Number(latest.afterQty),
      inQty: Number(latest.inQty),
      inPrice: Number(latest.inPrice),
      referenceType: latest.referenceType,
      referenceId: latest.referenceId,
      createdAt: latest.createdAt,
    }
  }
}

// 导出单例
export const costService = new CostService()
