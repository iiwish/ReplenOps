'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Image from 'next/image'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { ScrollArea } from '@/components/ui/scroll-area'
import { ArrowLeft, Trash2, Loader2 } from 'lucide-react'
import { useCartStore } from '@/lib/stores/cart.store'
import { QuantityInput } from '@/components/mobile/order/QuantityInput'
import { toast } from '@/hooks/use-toast'
import { createOrder } from '@/actions/order-actions'

interface CartConfirmClientProps {
  storeId: string
}

export default function CartConfirmClient({ storeId }: CartConfirmClientProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const { items, removeItem, updateQuantity, getTotalAmount, getTotalQuantity, clear } = useCartStore()

  const totalAmount = getTotalAmount()
  const totalQuantity = getTotalQuantity()

  const handleSubmitOrder = async () => {
    if (items.length === 0) {
      toast({
        title: '购物车为空',
        description: '请先添加商品到购物车',
        variant: 'destructive',
      })
      return
    }

    setIsSubmitting(true)

    try {
      // 检查所有商品库存是否充足（防超卖）
      const insufficientStock = items.find(
        (item) => item.quantity > item.availableQty
      )

      if (insufficientStock) {
        toast({
          title: '库存不足',
          description: `${insufficientStock.name} 库存不足，当前可用: ${insufficientStock.availableQty} ${insufficientStock.unit}`,
          variant: 'destructive',
        })
        setIsSubmitting(false)
        return
      }

      // 调用创建订单 API
      const result = await createOrder({
        storeId,
        items: items.map((item) => ({
          goodsId: item.goodsId,
          quantity: item.quantity,
          unitPrice: item.price,
        })),
        remark: undefined,
      })

      if (result.success) {
        // 清空购物车
        clear()

        const orderData = result.data as { id: string; code: string } | undefined
        toast({
          title: '订单提交成功',
          description: `订单号: ${orderData?.code}，等待审批`,
        })

        // 跳转到订单详情页
        if (orderData?.id) {
          router.push(`/mobile/orders/${orderData.id}`)
        } else {
          router.push('/mobile/orders')
        }
      } else {
        toast({
          title: '订单提交失败',
          description: result.message || '请稍后重试',
          variant: 'destructive',
        })
      }
    } catch (error) {
      console.error('提交订单失败:', error)
      toast({
        title: '订单提交失败',
        description: error instanceof Error ? error.message : '网络错误，请稍后重试',
        variant: 'destructive',
      })
    } finally {
      setIsSubmitting(false)
    }
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col h-full">
        {/* 顶部导航栏 */}
        <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => router.back()}
            className="h-9 w-9"
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-lg font-semibold">确认订单</h1>
        </div>

        {/* 空状态 */}
        <div className="flex-1 flex flex-col items-center justify-center text-muted-foreground space-y-4">
          <div className="text-center">
            <p className="text-lg mb-2">购物车是空的</p>
            <p className="text-sm">请先添加商品</p>
          </div>
          <Button onClick={() => router.push('/mobile/order')}>
            去选购
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* 顶部导航栏 */}
      <div className="sticky top-0 z-10 flex items-center gap-3 border-b bg-background px-4 py-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => router.back()}
          className="h-9 w-9"
        >
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h1 className="text-lg font-semibold">确认订单</h1>
        <div className="flex-1" />
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

      {/* 商品列表 */}
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          {/* 商品清单 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">商品清单</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.map((item, index) => (
                <div key={item.goodsId}>
                  {index > 0 && <Separator className="my-3" />}

                  <div className="flex gap-3">
                    {/* 商品图片 */}
                    <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-md bg-gray-100">
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
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {item.spec}
                          </p>
                        )}
                        <div className="flex items-center gap-2 mt-1">
                          <span className="text-base font-bold text-primary">
                            ¥{item.price.toFixed(2)}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            / {item.unit}
                          </span>
                        </div>
                      </div>

                      {/* 数量和操作 */}
                      <div className="flex items-center justify-between">
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

                      {/* 小计 */}
                      <div className="text-right text-sm text-muted-foreground">
                        小计: ¥{(item.price * item.quantity).toFixed(2)}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* 订单统计 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">订单统计</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">商品总数</span>
                <span className="font-medium">{totalQuantity} 件</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">商品种类</span>
                <span className="font-medium">{items.length} 种</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="font-medium">订单总额</span>
                <span className="text-xl font-bold text-primary">
                  ¥{totalAmount.toFixed(2)}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* 底部间距 */}
          <div className="h-20" />
        </div>
      </ScrollArea>

      {/* 底部提交按钮 */}
      <div className="sticky bottom-16 left-0 right-0 border-t bg-background p-4">
        <div className="flex items-center justify-between gap-4">
          <div className="flex flex-col">
            <span className="text-xs text-muted-foreground">
              共 {items.length} 件商品
            </span>
            <span className="text-xl font-bold text-primary">
              ¥{totalAmount.toFixed(2)}
            </span>
          </div>
          <Button
            size="lg"
            className="min-h-[48px] px-12"
            onClick={handleSubmitOrder}
            disabled={isSubmitting}
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isSubmitting ? '提交中...' : '提交订单'}
          </Button>
        </div>
      </div>
    </div>
  )
}
