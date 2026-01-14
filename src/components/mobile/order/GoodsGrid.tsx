'use client'

import { useEffect, useRef } from 'react'
import { GoodsCard } from './GoodsCard'

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
  goods: Goods[]
}

interface GoodsGridProps {
  categories: Category[]
  onCategoryVisible?: (categoryId: string) => void
}

export function GoodsGrid({ categories, onCategoryVisible }: GoodsGridProps) {
  const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map())

  useEffect(() => {
    // 使用 Intersection Observer 监听分类区域的可见性
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && entry.intersectionRatio >= 0.3) {
            const categoryId = entry.target.getAttribute('data-category-id')
            if (categoryId && onCategoryVisible) {
              onCategoryVisible(categoryId)
            }
          }
        })
      },
      {
        threshold: [0.3],
        rootMargin: '-100px 0px -50% 0px', // 顶部偏移，中心位置触发
      }
    )

    categoryRefs.current.forEach((ref) => {
      if (ref) observer.observe(ref)
    })

    return () => {
      observer.disconnect()
    }
  }, [categories, onCategoryVisible])

  const setCategoryRef = (categoryId: string, element: HTMLDivElement | null) => {
    if (element) {
      categoryRefs.current.set(categoryId, element)
    } else {
      categoryRefs.current.delete(categoryId)
    }
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {categories.map((category) => (
        <div
          key={category.id}
          id={`category-${category.id}`}
          data-category-id={category.id}
          ref={(el) => setCategoryRef(category.id, el)}
          className="mb-4"
        >
          {/* 分类标题 */}
          <div className="sticky top-0 z-10 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 px-4 py-2 border-b">
            <h2 className="font-semibold text-base">{category.name}</h2>
          </div>

          {/* 商品列表 */}
          <div className="space-y-2 px-4 py-2">
            {category.goods.length > 0 ? (
              category.goods.map((goods) => (
                <GoodsCard key={goods.id} goods={goods} />
              ))
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                该分类暂无商品
              </div>
            )}
          </div>
        </div>
      ))}

      {categories.length === 0 && (
        <div className="flex items-center justify-center h-full text-muted-foreground">
          暂无商品数据
        </div>
      )}

      {/* 底部间距，避免被购物车遮挡 */}
      <div className="h-24" />
    </div>
  )
}
