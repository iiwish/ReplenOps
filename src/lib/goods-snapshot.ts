import type { GoodsMeasureType } from '@prisma/client'

export interface GoodsSnapshotSource {
  code: string
  name: string
  spec: string | null
  unit: string
  measureType: GoodsMeasureType
  categoryId: number
  category: { name: string }
}

export interface GoodsSnapshotData {
  goodsCodeSnapshot: string
  goodsNameSnapshot: string
  goodsSpecSnapshot: string | null
  goodsUnitSnapshot: string
  measureTypeSnapshot: GoodsMeasureType
  categoryIdSnapshot: number
  categoryNameSnapshot: string
}

export interface NullableGoodsSnapshot {
  goodsCodeSnapshot: string | null
  goodsNameSnapshot: string | null
  goodsSpecSnapshot: string | null
  goodsUnitSnapshot: string | null
  measureTypeSnapshot: GoodsMeasureType | null
  categoryIdSnapshot: number | null
  categoryNameSnapshot: string | null
}

export function buildGoodsSnapshot(goods: GoodsSnapshotSource): GoodsSnapshotData {
  return {
    goodsCodeSnapshot: goods.code,
    goodsNameSnapshot: goods.name,
    goodsSpecSnapshot: goods.spec,
    goodsUnitSnapshot: goods.unit,
    measureTypeSnapshot: goods.measureType,
    categoryIdSnapshot: goods.categoryId,
    categoryNameSnapshot: goods.category.name,
  }
}

export function resolveGoodsSnapshot(
  snapshot: NullableGoodsSnapshot,
  goods: GoodsSnapshotSource
): GoodsSnapshotData {
  return {
    goodsCodeSnapshot: snapshot.goodsCodeSnapshot ?? goods.code,
    goodsNameSnapshot: snapshot.goodsNameSnapshot ?? goods.name,
    goodsSpecSnapshot: snapshot.goodsSpecSnapshot ?? goods.spec,
    goodsUnitSnapshot: snapshot.goodsUnitSnapshot ?? goods.unit,
    measureTypeSnapshot: snapshot.measureTypeSnapshot ?? goods.measureType,
    categoryIdSnapshot: snapshot.categoryIdSnapshot ?? goods.categoryId,
    categoryNameSnapshot: snapshot.categoryNameSnapshot ?? goods.category.name,
  }
}

export interface GoodsUsage {
  inventoryCount: number
  orderItemCount: number
  stockInItemCount: number
  stockOutItemCount: number
}

export function assertGoodsUnitChangeAllowed(
  existing: Pick<GoodsSnapshotSource, 'unit' | 'measureType'>,
  next: Pick<GoodsSnapshotSource, 'unit' | 'measureType'>,
  usage: GoodsUsage
): void {
  if (existing.unit === next.unit && existing.measureType === next.measureType) {
    return
  }

  if (
    usage.inventoryCount > 0 ||
    usage.orderItemCount > 0 ||
    usage.stockInItemCount > 0 ||
    usage.stockOutItemCount > 0
  ) {
    throw new Error(
      '商品已有库存或单据记录，不能直接修改单位或计量类型；请新建商品编码或执行库存换算'
    )
  }
}
