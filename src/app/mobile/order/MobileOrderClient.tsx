'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CategorySidebar } from '@/components/mobile/order/CategorySidebar'
import { GoodsGrid } from '@/components/mobile/order/GoodsGrid'
import { CartFloating } from '@/components/mobile/order/CartFloating'
import { CartDrawer } from '@/components/mobile/order/CartDrawer'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'
import { useCartStore } from '@/lib/stores/cart.store'
import { createOrder } from '@/actions/order-actions'
import { toast } from '@/hooks/use-toast'

interface Goods {
  id: string
  code: string
  name: string
  spec: string | null
  unit: string
  measureType: 'INT' | 'DECIMAL'
  partnerPrice: number
  imageUrl: string | null
  availableQty: number
  categoryId: string
}

interface Category {
  id: string
  name: string
  code: string
  goods: Goods[]
}

interface MobileOrderClientProps {
  categories: Category[]
}

export default function MobileOrderClient({ categories }: MobileOrderClientProps) {
  const router = useRouter()
  const [activeCategory, setActiveCategory] = useState<string | null>(
    categories.length > 0 ? categories[0]?.id || null : null
  )
  const [cartOpen, setCartOpen] = useState(false)

  const { selectedStoreId } = useStoreSelectionStore()
  const { items, clear } = useCartStore()

  const handleCategoryVisible = (categoryId: string) => {
    setActiveCategory(categoryId)
  }

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId)
  }

  const handleCheckout = async () => {
    if (!selectedStoreId) {
      toast({
        title: '请先选择门店',
        description: '请在首页选择要下单的门店',
        variant: 'destructive',
      })
      return
    }

    if (items.length === 0) {
      toast({
        title: '购物车为空',
        description: '请先添加商品到购物车',
        variant: 'destructive',
      })
      return
    }


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
        return
      }

      // 调用创建订单 API
      const result = await createOrder({
        storeId: selectedStoreId,
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
    }
  }

  return (
    <div className="flex h-full">
      {/* 左侧分类 */}
      <CategorySidebar
        categories={categories}
        activeCategory={activeCategory}
        onCategoryClick={handleCategoryClick}
      />

      {/* 右侧商品列表 */}
      <div className="flex-1 flex flex-col relative">
        <GoodsGrid
          categories={categories}
          onCategoryVisible={handleCategoryVisible}
        />

        {/* 悬浮购物车 */}
        <CartFloating
          onClick={() => setCartOpen(true)}
          onCheckout={handleCheckout}
        />
      </div>

      {/* 购物车抽屉 */}
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} onCheckout={handleCheckout} />
    </div>
  )
}
