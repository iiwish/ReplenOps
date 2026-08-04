'use client'

import { ShoppingCart } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useCartStore } from '@/lib/stores/cart.store'
import { cn } from '@/lib/utils'

interface CartFloatingProps {
  onClick: () => void
  onCheckout: () => void
  isSubmitting: boolean
}

export function CartFloating({ onClick, onCheckout, isSubmitting }: CartFloatingProps) {
  const { items, hasHydrated, getTotalAmount, getTotalQuantity } = useCartStore()

  const visibleItems = hasHydrated ? items : []
  const totalAmount = hasHydrated ? getTotalAmount() : 0
  const totalQuantity = hasHydrated ? getTotalQuantity() : 0
  const hasItems = visibleItems.length > 0

  return (
    <div className="fixed bottom-16 left-0 right-0 z-20 px-3 pb-2">
      <div
        className={cn(
          'relative flex items-center justify-between gap-2 rounded-lg border bg-background p-2 shadow-[0_-6px_18px_rgba(15,23,42,0.12)] transition-all',
          hasItems && 'border-primary'
        )}
      >
        {/* 购物车图标和信息 */}
        <button onClick={onClick} className="flex min-h-[40px] min-w-0 flex-1 items-center gap-2">
          <div className="relative">
            <ShoppingCart
              className={cn(
                'h-5 w-5 transition-colors',
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
              {hasItems ? `共 ${visibleItems.length} 件商品` : '购物车是空的'}
            </div>
            <div
              className={cn(
                'text-base font-bold',
                hasItems ? 'text-primary' : 'text-muted-foreground'
              )}
            >
              ¥{totalAmount.toFixed(2)}
            </div>
          </div>
        </button>

        {/* 按钮组 */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onClick}
            disabled={!hasItems}
            className="min-h-[40px] px-3"
          >
            查看
          </Button>
          <Button
            size="lg"
            onClick={onCheckout}
            disabled={!hasItems || isSubmitting}
            className="min-h-[40px] px-4"
          >
            结算
          </Button>
        </div>
      </div>
    </div>
  )
}
