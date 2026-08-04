'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Separator } from '@/components/ui/separator'
import { Trash2 } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart.store'
import { QuantityInput } from './QuantityInput'
import { ProductImage } from './ProductImage'

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onCheckout: () => void
  isSubmitting: boolean
}

export function CartDrawer({ open, onOpenChange, onCheckout, isSubmitting }: CartDrawerProps) {
  const {
    items,
    hasHydrated,
    removeItem,
    updateQuantity,
    getTotalAmount,
    getTotalQuantity,
    clear,
  } = useCartStore()

  const visibleItems = hasHydrated ? items : []

  const handleCheckout = () => {
    onCheckout()
  }

  const totalAmount = hasHydrated ? getTotalAmount() : 0
  const totalQuantity = hasHydrated ? getTotalQuantity() : 0

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
        <SheetHeader className="border-b px-4 py-3 pr-14">
          <div className="flex min-w-0 items-center justify-between gap-3">
            <SheetTitle className="min-w-0">购物车 ({visibleItems.length})</SheetTitle>
            {visibleItems.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                className="shrink-0 text-destructive"
              >
                清空
              </Button>
            )}
          </div>
        </SheetHeader>

        {visibleItems.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            购物车是空的
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-3 py-4">
                {visibleItems.map((item) => (
                  <div key={item.goodsId} className="flex gap-3">
                    {/* 商品图片 */}
                    <ProductImage
                      src={item.imageUrl}
                      alt={item.name}
                      sizes="64px"
                      className="h-16 w-16 shrink-0"
                    />

                    {/* 商品信息 */}
                    <div className="flex-1 flex flex-col justify-between">
                      <div>
                        <h4 className="font-medium text-sm line-clamp-1">
                          {item.name}
                        </h4>
                        {item.spec && (
                          <p className="text-xs text-muted-foreground">
                            {item.spec}
                          </p>
                        )}
                      </div>

                      <div className="flex items-center justify-between">
                        <span className="text-primary font-bold">
                          ¥{item.price.toFixed(2)}
                        </span>
                        <div className="flex items-center gap-2">
                          <QuantityInput
                            value={item.quantity}
                            measureType={item.measureType}
                            max={item.availableQty}
                            onChange={(qty) => updateQuantity(item.goodsId, qty)}
                          />
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-8 w-8 text-destructive"
                            onClick={() => removeItem(item.goodsId)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>

            <Separator />

            <SheetFooter className="px-4 py-3">
              <div className="w-full space-y-3">
                {/* 金额统计 */}
                <div className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      共 {totalQuantity} 件商品
                    </span>
                    <span className="font-medium">
                      小计: ¥{totalAmount.toFixed(2)}
                    </span>
                  </div>
                </div>

                {/* 结算按钮 */}
                <Button
                  className="w-full min-h-[48px]"
                  size="lg"
                  onClick={handleCheckout}
                  disabled={isSubmitting}
                >
                  去结算 ¥{totalAmount.toFixed(2)}
                </Button>
              </div>
            </SheetFooter>
          </>
        )}
      </SheetContent>
    </Sheet>
  )
}
