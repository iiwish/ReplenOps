'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { QuantityInput } from './QuantityInput'
import { ProductImage } from './ProductImage'
import { useCartStore } from '@/lib/stores/cart.store'

interface GoodsCardProps {
  goods: {
    id: string
    code: string
    name: string
    spec: string | null
    unit: string
    measureType: 'INT' | 'DECIMAL'
    partnerPrice: number
    imageUrl: string | null
    availableQty: number
  }
}

export function GoodsCard({ goods }: GoodsCardProps) {
  const { addItem, updateQuantity, items } = useCartStore()

  const cartItem = items.find((item) => item.goodsId === goods.id)
  const currentQuantity = cartItem?.quantity || 0

  const handleAddToCart = () => {
    // 移动端下单统一按 1 个单位起加购
    const defaultQty = 1
    addItem({
      goodsId: goods.id,
      code: goods.code,
      name: goods.name,
      spec: goods.spec,
      unit: goods.unit,
      measureType: goods.measureType,
      price: goods.partnerPrice,
      quantity: defaultQty,
      availableQty: goods.availableQty,
      imageUrl: goods.imageUrl,
    })
  }

  const handleQuantityChange = (newQuantity: number) => {
    updateQuantity(goods.id, newQuantity)
  }

  const isOutOfStock = goods.availableQty <= 0
  const displaySpec = goods.spec?.trim()
  const hasSpec = Boolean(displaySpec && displaySpec !== '/')

  return (
    <Card className="overflow-hidden rounded-md border-gray-200/80">
      <CardContent className="p-2.5">
        <div className="flex gap-2.5">
          {/* 商品图片 */}
          <ProductImage
            src={goods.imageUrl}
            alt={goods.name}
            sizes="64px"
            className="h-16 w-16 shrink-0"
          />

          {/* 商品信息 */}
          <div className="flex flex-1 flex-col justify-between">
            <div>
              <h3 className="line-clamp-1 text-sm font-medium leading-5">{goods.name}</h3>
              {hasSpec && (
                <p className="mt-0.5 line-clamp-1 text-xs leading-4 text-muted-foreground">
                  {displaySpec}
                </p>
              )}
            </div>

            {/* 库存优先展示，价格作为辅助信息 */}
            <div className="mt-1 flex items-center justify-between gap-2">
              <div
                className={`min-w-0 truncate text-xs font-medium leading-4 ${
                  isOutOfStock ? 'text-red-600' : 'text-foreground'
                }`}
              >
                {isOutOfStock ? (
                  <Badge variant="destructive" className="px-1.5 py-0 text-[11px] leading-4">
                    缺货
                  </Badge>
                ) : (
                  <span>
                    库存 {goods.availableQty} {goods.unit}
                  </span>
                )}
              </div>

              {currentQuantity > 0 ? (
                <QuantityInput
                  value={currentQuantity}
                  measureType={goods.measureType}
                  max={goods.availableQty}
                  onChange={handleQuantityChange}
                  size="sm"
                />
              ) : (
                <Button
                  type="button"
                  size="icon"
                  className="h-8 min-h-8 w-8 shrink-0 rounded-full"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                  aria-label={`加购 ${goods.name}`}
                  title="加购"
                >
                  <Plus className="h-4 w-4" />
                </Button>
              )}
            </div>
            <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
              ¥{goods.partnerPrice.toFixed(2)} / {goods.unit}
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
