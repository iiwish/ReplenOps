import { prisma } from '@/lib/prisma'
import { getSingleWarehouseAvailableQty, orderingInventoryWhere } from './ordering-stock-policy'

export async function getOrderingCatalog() {
  const categories = await prisma.goodsCategory.findMany({
    where: { isDeleted: false, isActive: true },
    orderBy: { sortOrder: 'asc' },
    select: { id: true, name: true, code: true },
  })
  const goods = await prisma.goods.findMany({
    where: { isDeleted: false, isActive: true },
    // 门店端按分类浏览订货，分类内保持名称序以稳定商品位置；
    // 不随建档顺序变动，避免新增商品打乱门店员工的视觉记忆。
    orderBy: { name: 'asc' },
    select: {
      id: true,
      code: true,
      name: true,
      spec: true,
      unit: true,
      measureType: true,
      partnerPrice: true,
      imageUrl: true,
      categoryId: true,
      inventories: { where: orderingInventoryWhere, select: { availableQuantity: true } },
    },
  })
  return categories.map((category) => ({
    id: String(category.id),
    name: category.name,
    code: category.code,
    goods: goods
      .filter((item) => item.categoryId === category.id)
      .map((item) => ({
        id: String(item.id),
        code: item.code,
        name: item.name,
        spec: item.spec,
        unit: item.unit,
        measureType: item.measureType,
        partnerPrice: item.partnerPrice.toNumber(),
        imageUrl: item.imageUrl,
        categoryId: String(item.categoryId),
        availableQty: getSingleWarehouseAvailableQty(item.inventories),
      })),
  }))
}
