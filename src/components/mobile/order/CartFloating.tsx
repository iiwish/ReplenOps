'use client'

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/lib/stores/cart.store'
import { cn } from '@/lib/utils'

interface CartFloatingProps {
  onClick: () => void
}

export function CartFloating({ onClick }: CartFloatingProps) {
  const { items, getTotalAmount, getTotalQuantity } = useCartStore()

  const totalAmount = getTotalAmount()
  const totalQuantity = getTotalQuantity()
  const hasItems = items.length > 0

  return (
    <div className="fixed bottom-20 left-0 right-0 z-20 px-4 pb-4">
      <div
        className={cn(
          'relative flex items-center justify-between gap-4 rounded-full border bg-background p-3 shadow-lg transition-all',
          hasItems && 'border-primary bg-primary/5'
        )}
      >
        {/* 购物车图标和信息 */}
        <button
          onClick={onClick}
          className="flex flex-1 items-center gap-3 min-h-[44px]"
        >
          <div className="relative">
            <ShoppingCart
              className={cn(
                'h-6 w-6 transition-colors',
                hasItems ? 'text-primary' : 'text-muted-foreground'
              )}
            />
            {hasItems && (
              <Badge
                variant="destructive"
                className="absolute -right-2 -top-2 h-5 min-w-[20px] px-1 text-xs"
              >
                {totalQuantity > 99 ? '99+' : totalQuantity}
              </Badge>
            )}
          </div>

          <div className="flex-1 text-left">
            <div className="text-xs text-muted-foreground">
              {hasItems ? `共 ${items.length} 件商品` : '购物车是空的'}
            </div>
            <div
              className={cn(
                'text-lg font-bold',
                hasItems ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              ¥{totalAmount.toFixed(2)}
            </div>
          </div>
        </button>

        {/* 查看购物车按钮 */}
        <Button
          size="lg"
          onClick={onClick}
          disabled={!hasItems}
          className="min-h-[48px] rounded-full px-6"
        >
          查看购物车
        </Button>
      </div>
    </div>
  )
}
