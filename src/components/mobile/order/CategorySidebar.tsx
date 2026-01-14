'use client'

import { cn } from '@/lib/utils'
import { ScrollArea } from '@/components/ui/scroll-area'

interface Category {
  id: string
  name: string
}

interface CategorySidebarProps {
  categories: Category[]
  activeCategory: string | null
  onCategoryClick: (categoryId: string) => void
}

export function CategorySidebar({
  categories,
  activeCategory,
  onCategoryClick,
}: CategorySidebarProps) {
  const handleCategoryClick = (categoryId: string) => {
    onCategoryClick(categoryId)

    // 滚动到对应商品区域
    const element = document.getElementById(`category-${categoryId}`)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  return (
    <div className="w-24 border-r bg-muted/30">
      <ScrollArea className="h-full">
        <div className="py-2">
          {categories.map((category) => {
            const isActive = category.id === activeCategory

            return (
              <button
                key={category.id}
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  'w-full px-3 py-3 text-sm text-center transition-colors min-h-[44px]',
                  'border-l-2 hover:bg-muted',
                  isActive
                    ? 'border-primary bg-background text-primary font-medium'
                    : 'border-transparent text-muted-foreground'
                )}
              >
                <div className="line-clamp-2 break-all">{category.name}</div>
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </div>
  )
}
