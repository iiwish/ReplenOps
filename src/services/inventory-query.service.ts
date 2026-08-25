import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

export interface InventoryQueryParams {
  page: number
  pageSize: number
  warehouseIds?: string[]
  categoryId?: string
  goodsId?: string
  keyword?: string
  stockStatus?: 'all' | 'has_stock' | 'zero_stock' | 'low_stock'
}

export interface InventoryListItem {
  id: string
  warehouseId: string
  warehouseName: string
  goodsId: string
  goodsCode: string
  goodsName: string
  goodsSpec: string | null
  goodsUnit: string
  quantity: number
  lockedQuantity: number
  availableQuantity: number
  avgCost: number
  stockAmount: number
  isLowStock: boolean
  minStock: number
  updatedAt: Date
}

export interface InventoryQueryResult {
  data: InventoryListItem[]
  total: number
  page: number
  pageSize: number
  totalPages: number
  summary: {
    totalStockAmount: number
    totalQuantity: number
  }
}

export interface WarehouseInventory {
  warehouseId: string
  warehouseName: string
  quantity: number
  lockedQuantity: number
  availableQuantity: number
}

export interface GoodsInventoryResult {
  goods: {
    id: string
    code: string
    name: string
    spec: string | null
    unit: string
    imageUrl: string | null
  }
  inventories: WarehouseInventory[]
}

type InventoryWithRelations = Prisma.InventoryGetPayload<{
  include: {
    warehouse: true
    goods: true
  }
}>

export class InventoryQueryService {
  async query(params: InventoryQueryParams): Promise<InventoryQueryResult> {
    const {
      page = 1,
      pageSize = 20,
      warehouseIds,
      categoryId,
      goodsId,
      keyword,
      stockStatus,
    } = params

    const where: Prisma.InventoryWhereInput = {}

    if (warehouseIds && warehouseIds.length > 0) {
      where.warehouseId = { in: warehouseIds.map((id) => Number.parseInt(id, 10)) }
    }

    if (goodsId) {
      where.goodsId = Number.parseInt(goodsId, 10)
    } else if (categoryId) {
      where.goods = {
        categoryId: Number.parseInt(categoryId, 10),
      }
    }

    if (keyword) {
      where.goods = {
        ...((where.goods as Prisma.GoodsWhereInput) || {}),
        OR: [
          { code: { contains: keyword, mode: 'insensitive' } },
          { name: { contains: keyword, mode: 'insensitive' } },
        ],
      }
    }

    if (stockStatus === 'has_stock') {
      where.quantity = { gt: 0 }
    } else if (stockStatus === 'zero_stock') {
      where.quantity = 0
    } else if (stockStatus === 'low_stock') {
      where.quantity = { gt: 0 }
    }

    let total: number
    let data: InventoryWithRelations[]

    if (stockStatus === 'low_stock') {
      const candidates = await prisma.inventory.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        include: {
          warehouse: true,
          goods: true,
        },
      })
      const lowStockItems = candidates.filter(
        (item) => Number(item.availableQuantity) < Number(item.goods.minStock)
      )
      total = lowStockItems.length
      data = lowStockItems.slice((page - 1) * pageSize, page * pageSize)
    } else {
      const [resultTotal, resultData] = await Promise.all([
        prisma.inventory.count({ where }),
        prisma.inventory.findMany({
          where,
          orderBy: { updatedAt: 'desc' },
          skip: (page - 1) * pageSize,
          take: pageSize,
          include: {
            warehouse: true,
            goods: true,
          },
        }),
      ])
      total = resultTotal
      data = resultData
    }

    const items: InventoryListItem[] = data.map((item) => {
      const quantity = Number(item.quantity)
      const lockedQuantity = Number(item.lockedQuantity)
      const availableQuantity = Number(item.availableQuantity)
      const avgCost = Number(item.avgCost)
      const minStock = Number(item.goods.minStock)

      return {
        id: String(item.id),
        warehouseId: String(item.warehouseId),
        warehouseName: item.warehouse.name,
        goodsId: String(item.goodsId),
        goodsCode: item.goods.code,
        goodsName: item.goods.name,
        goodsSpec: item.goods.spec,
        goodsUnit: item.goods.unit,
        quantity,
        lockedQuantity,
        availableQuantity,
        avgCost,
        stockAmount: quantity * avgCost,
        isLowStock: quantity > 0 && availableQuantity < minStock,
        minStock,
        updatedAt: item.updatedAt,
      }
    })

    const summary = {
      totalStockAmount: items.reduce((sum, item) => sum + item.stockAmount, 0),
      totalQuantity: items.reduce((sum, item) => sum + item.quantity, 0),
    }

    return {
      data: items,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
      summary,
    }
  }

  async queryByGoodsCode(code: string): Promise<GoodsInventoryResult> {
    const goods = await prisma.goods.findFirst({
      where: {
        code: { equals: code, mode: 'insensitive' },
        isActive: true,
        isDeleted: false,
      },
      select: {
        id: true,
        code: true,
        name: true,
        spec: true,
        unit: true,
        imageUrl: true,
      },
    })

    if (!goods) {
      throw new Error('商品不存在')
    }

    const inventories = await prisma.inventory.findMany({
      where: {
        goodsId: goods.id,
        warehouse: {
          isActive: true,
          isDeleted: false,
        },
      },
      include: {
        warehouse: {
          select: {
            name: true,
          },
        },
      },
      orderBy: {
        warehouse: {
          code: 'asc',
        },
      },
    })

    const inventoryList: WarehouseInventory[] = inventories.map((inv) => ({
      warehouseId: String(inv.warehouseId),
      warehouseName: inv.warehouse.name,
      quantity: Number(inv.quantity),
      lockedQuantity: Number(inv.lockedQuantity),
      availableQuantity: Number(inv.availableQuantity),
    }))

    return {
      goods: {
        ...goods,
        id: String(goods.id),
      },
      inventories: inventoryList,
    }
  }
}

export const inventoryQueryService = new InventoryQueryService()
