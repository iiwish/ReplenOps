'use client'

import { useState } from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Plus } from 'lucide-react'
import { QuantityInput } from './QuantityInput'
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
  const [quantity, setQuantity] = useState(0)
  const { addItem, items } = useCartStore()

  const cartItem = items.find((item) => item.goodsId === goods.id)
  const currentQuantity = cartItem?.quantity || 0

  const handleAddToCart = () => {
    if (quantity === 0) {
      // 首次添加，默认添加最小单位
      const defaultQty = goods.measureType === 'INT' ? 1 : 0.1
      setQuantity(defaultQty)
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
    } else {
      // 更新购物车数量
      addItem({
        goodsId: goods.id,
        code: goods.code,
        name: goods.name,
        spec: goods.spec,
        unit: goods.unit,
        measureType: goods.measureType,
        price: goods.partnerPrice,
        quantity: quantity - currentQuantity,
        availableQty: goods.availableQty,
        imageUrl: goods.imageUrl,
      })
    }
  }

  const handleQuantityChange = (newQuantity: number) => {
    setQuantity(newQuantity)
  }

  const isOutOfStock = goods.availableQty <= 0

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-3">
        <div className="flex gap-3">
          {/* 商品图片 */}
          <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100">
            {goods.imageUrl ? (
              <Image
                src={goods.imageUrl}
                alt={goods.name}
                fill
                className="object-cover"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                暂无图片
              </div>
            )}
          </div>

          {/* 商品信息 */}
          <div className="flex flex-1 flex-col justify-between">
            <div>
              <h3 className="font-medium text-sm line-clamp-1">{goods.name}</h3>
              {goods.spec && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  {goods.spec}
                </p>
              )}
              <div className="flex items-center gap-2 mt-1">
                <span className="text-lg font-bold text-primary">
                  ¥{goods.partnerPrice.toFixed(2)}
                </span>
                <span className="text-xs text-muted-foreground">
                  / {goods.unit}
                </span>
              </div>
            </div>

            {/* 库存和操作 */}
            <div className="flex items-center justify-between mt-1">
              <div className="text-xs text-muted-foreground">
                {isOutOfStock ? (
                  <Badge variant="destructive">缺货</Badge>
                ) : (
                  <span>库存: {goods.availableQty} {goods.unit}</span>
                )}
              </div>

              {currentQuantity > 0 ? (
                <QuantityInput
                  value={currentQuantity}
                  measureType={goods.measureType}
                  max={goods.availableQty}
                  onChange={handleQuantityChange}
                />
              ) : (
                <Button
                  size="sm"
                  className="min-h-[44px]"
                  onClick={handleAddToCart}
                  disabled={isOutOfStock}
                >
                  <Plus className="w-4 h-4 mr-1" />
                  加购
                </Button>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
