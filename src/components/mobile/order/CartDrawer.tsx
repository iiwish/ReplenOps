'use client'

import { useRouter } from 'next/navigation'
import Image from 'next/image'
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

interface CartDrawerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CartDrawer({ open, onOpenChange }: CartDrawerProps) {
  const router = useRouter()
  const { items, removeItem, updateQuantity, getTotalAmount, getTotalQuantity, clear } = useCartStore()

  const handleCheckout = () => {
    onOpenChange(false)
    router.push('/mobile/order/cart' as never)
  }

  const totalAmount = getTotalAmount()
  const totalQuantity = getTotalQuantity()

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="h-[80vh] flex flex-col p-0">
        <SheetHeader className="px-4 py-3 border-b">
          <div className="flex items-center justify-between">
            <SheetTitle>购物车 ({items.length})</SheetTitle>
            {items.length > 0 && (
              <Button
                variant="ghost"
                size="sm"
                onClick={clear}
                className="text-destructive"
              >
                清空
              </Button>
            )}
          </div>
        </SheetHeader>

        {items.length === 0 ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            购物车是空的
          </div>
        ) : (
          <>
            <ScrollArea className="flex-1 px-4">
              <div className="space-y-3 py-4">
                {items.map((item) => (
                  <div key={item.goodsId} className="flex gap-3">
                    {/* 商品图片 */}
                    <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-md bg-gray-100">
                      {item.imageUrl ? (
                        <Image
                          src={item.imageUrl}
                          alt={item.name}
                          fill
                          className="object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-400">
                          无图
                        </div>
                      )}
                    </div>

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
