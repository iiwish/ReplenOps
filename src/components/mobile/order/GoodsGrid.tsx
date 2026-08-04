'use client'

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react'
import { Search, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
  searchTerm: string
  onSearchTermChange: (value: string) => void
}

export interface GoodsGridHandle {
  scrollToCategory: (categoryId: string) => void
}

export const GoodsGrid = forwardRef<GoodsGridHandle, GoodsGridProps>(function GoodsGrid(
  { categories, onCategoryVisible, searchTerm, onSearchTermChange },
  ref
) {
  const categoryRefs = useRef<Map<string, HTMLDivElement>>(new Map())
  const scrollContainerRef = useRef<HTMLDivElement>(null)

  useImperativeHandle(ref, () => ({
    scrollToCategory(categoryId: string) {
      const categoryElement = categoryRefs.current.get(categoryId)
      const scrollContainer = scrollContainerRef.current

      if (!categoryElement || !scrollContainer) {
        return
      }

      const targetTop =
        categoryElement.getBoundingClientRect().top -
        scrollContainer.getBoundingClientRect().top +
        scrollContainer.scrollTop

      scrollContainer.scrollTo({ top: targetTop, behavior: 'smooth' })
    },
  }))

  useEffect(() => {
    const scrollContainer = scrollContainerRef.current

    if (!scrollContainer || !onCategoryVisible) {
      return
    }

    // 以滚动容器顶部附近的最后一个分类为准，避免多个分类同时可见时回调顺序导致左右状态错位。
    const updateActiveCategory = () => {
      const containerTop = scrollContainer.getBoundingClientRect().top
      const activationOffset = 28
      let activeCategoryId: string | null = categories[0]?.id ?? null
      let closestTop = Number.NEGATIVE_INFINITY

      categoryRefs.current.forEach((categoryElement, categoryId) => {
        const relativeTop = categoryElement.getBoundingClientRect().top - containerTop

        if (relativeTop <= activationOffset && relativeTop > closestTop) {
          activeCategoryId = categoryId
          closestTop = relativeTop
        }
      })

      if (activeCategoryId) {
        onCategoryVisible(activeCategoryId)
      }
    }

    let frameId: number | null = null
    const handleScroll = () => {
      if (frameId !== null) {
        return
      }

      frameId = window.requestAnimationFrame(() => {
        frameId = null
        updateActiveCategory()
      })
    }

    updateActiveCategory()
    scrollContainer.addEventListener('scroll', handleScroll, { passive: true })

    return () => {
      scrollContainer.removeEventListener('scroll', handleScroll)
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId)
      }
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
    <section className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="shrink-0 border-b bg-background px-3 py-2">
        <div className="flex h-10 items-center gap-2 rounded-md border bg-muted/30 px-3 focus-within:ring-2 focus-within:ring-ring">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={searchTerm}
            onChange={(event) => onSearchTermChange(event.target.value)}
            placeholder="搜索商品名称、编码或规格"
            aria-label="搜索商品"
            className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground"
          />
          {searchTerm && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => onSearchTermChange('')}
              className="h-8 w-8 shrink-0"
              aria-label="清除搜索"
              title="清除搜索"
            >
              <X className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      <div
        ref={scrollContainerRef}
        className="mobile-scroll min-h-0 flex-1 overflow-y-auto overscroll-contain"
      >
        {categories.map((category) => (
          <div
            key={category.id}
            id={`category-${category.id}`}
            data-category-id={category.id}
            ref={(el) => setCategoryRef(category.id, el)}
            className="mb-4 scroll-mt-2"
          >
            <div className="sticky top-0 z-10 border-b bg-background/95 px-4 py-2 backdrop-blur supports-[backdrop-filter]:bg-background/60">
              <h2 className="text-base font-semibold">{category.name}</h2>
            </div>

            <div className="space-y-2 px-4 py-2">
              {category.goods.map((goods) => (
                <GoodsCard key={goods.id} goods={goods} />
              ))}
            </div>
          </div>
        ))}

        {categories.length === 0 && (
          <div className="flex h-full items-center justify-center px-4 text-center text-sm text-muted-foreground">
            {searchTerm ? '未找到匹配商品' : '暂无商品数据'}
          </div>
        )}

        <div className="h-28" aria-hidden="true" />
      </div>
    </section>
  )
})
