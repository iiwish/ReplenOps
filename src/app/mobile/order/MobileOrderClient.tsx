'use client'

import { useState } from 'react'
import { CategorySidebar } from '@/components/mobile/order/CategorySidebar'
import { GoodsGrid } from '@/components/mobile/order/GoodsGrid'
import { CartFloating } from '@/components/mobile/order/CartFloating'
import { CartDrawer } from '@/components/mobile/order/CartDrawer'

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
  const [activeCategory, setActiveCategory] = useState<string | null>(
    categories.length > 0 ? categories[0]?.id || null : null
  )
  const [cartOpen, setCartOpen] = useState(false)

  const handleCategoryVisible = (categoryId: string) => {
    setActiveCategory(categoryId)
  }

  const handleCategoryClick = (categoryId: string) => {
    setActiveCategory(categoryId)
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
        <CartFloating onClick={() => setCartOpen(true)} />
      </div>

      {/* 购物车抽屉 */}
      <CartDrawer open={cartOpen} onOpenChange={setCartOpen} />
    </div>
  )
}
