import { requireRoles } from '@/lib/rbac-server'
import { prisma } from '@/lib/prisma'
import MobileOrderClient from './MobileOrderClient'

export default async function MobileOrderPage() {
  // 验证用户权限，仅允许 store_admin 访问
  await requireRoles(['store_admin'])

  // 获取所有启用的分类
  const categories = await prisma.goodsCategory.findMany({
    where: {
      isDeleted: false,
      isActive: true,
    },
    orderBy: { sortOrder: 'asc' },
    select: {
      id: true,
      name: true,
      code: true,
    },
  })

  // 获取所有启用的商品及其库存
  const goodsList = await prisma.goods.findMany({
    where: {
      isDeleted: false,
      isActive: true,
    },
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
      inventories: {
        select: {
          availableQuantity: true,
          warehouseId: true,
        },
      },
    },
  })

  // 计算每个商品的可用库存（所有仓库库存之和）
  const goodsWithInventory = goodsList.map((goods) => {
    const totalAvailableQty = goods.inventories.reduce(
      (sum, inv) => sum + Number(inv.availableQuantity),
      0
    )

    return {
      id: goods.id,
      code: goods.code,
      name: goods.name,
      spec: goods.spec,
      unit: goods.unit,
      measureType: goods.measureType,
      partnerPrice: Number(goods.partnerPrice),
      imageUrl: goods.imageUrl,
      categoryId: goods.categoryId,
      availableQty: totalAvailableQty,
    }
  })

  // 按分类分组商品
  const categoriesWithGoods = categories.map((category) => ({
    id: category.id,
    name: category.name,
    code: category.code,
    goods: goodsWithInventory.filter((goods) => goods.categoryId === category.id),
  }))

  return <MobileOrderClient categories={categoriesWithGoods} />
}
