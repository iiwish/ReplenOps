import { prisma } from '@/lib/prisma'

export interface InventoryReportData {
  inventory: Array<{
    id: string
    goodsCode: string
    goodsName: string
    goodsSpec: string | null
    goodsUnit: string
    categoryName: string
    warehouseName: string
    quantity: number
    availableQuantity: number
    avgCost: number
    totalCost: number
    minStock: number
    shortageQuantity: number
  }>
  lowStockItems: InventoryReportData['inventory']
  summary: {
    totalQty: number
    totalAmount: number
    lowStockCount: number
  }
}

export class ReportService {
  async getInventoryReport(): Promise<InventoryReportData> {
    const inventory = await prisma.inventory.findMany({
      where: {
        isDeleted: false,
        goods: { isDeleted: false, isActive: true },
        warehouse: { isDeleted: false, isActive: true },
      },
      include: {
        goods: {
          include: { category: true },
        },
        warehouse: true,
      },
    })

    const inventoryData = inventory.map((item) => ({
      id: String(item.id),
      goodsCode: item.goods.code,
      goodsName: item.goods.name,
      goodsSpec: item.goods.spec,
      goodsUnit: item.goods.unit,
      categoryName: item.goods.category.name,
      warehouseName: item.warehouse.name,
      quantity: Number(item.quantity),
      availableQuantity: Number(item.availableQuantity),
      avgCost: Number(item.avgCost),
      totalCost: Number(item.totalCost),
      minStock: Number(item.goods.minStock),
      shortageQuantity: Math.max(Number(item.goods.minStock) - Number(item.availableQuantity), 0),
    }))

    const lowStockItems = inventoryData
      .filter((item) => item.availableQuantity < item.minStock)
      .sort((a, b) => b.shortageQuantity - a.shortageQuantity)

    return {
      inventory: inventoryData,
      lowStockItems,
      summary: {
        totalQty: inventoryData.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: inventoryData.reduce((sum, item) => sum + item.totalCost, 0),
        lowStockCount: lowStockItems.length,
      },
    }
  }
}

export const reportService = new ReportService()
