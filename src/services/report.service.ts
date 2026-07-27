import { prisma } from '@/lib/prisma'

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

    const inventoryData = inventory.map((item) => ({
      id: String(item.id),
      goodsCode: item.goods.code,
      goodsName: item.goods.name,
      categoryName: item.goods.category.name,
      warehouseName: item.warehouse.name,
      quantity: Number(item.quantity),
      availableQuantity: Number(item.availableQuantity),
      avgCost: Number(item.avgCost),
      totalCost: Number(item.totalCost),
    }))

    const lowStockCount = inventory.filter(
      (item) => Number(item.availableQuantity) < Number(item.goods.minStock)
    ).length

    return {
      inventory: inventoryData,
      summary: {
        totalQty: inventoryData.reduce((sum, item) => sum + item.quantity, 0),
        totalAmount: inventoryData.reduce((sum, item) => sum + item.totalCost, 0),
        lowStockCount,
      },
    }
  }
}

export const reportService = new ReportService()
