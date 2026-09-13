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
  matchingCategoryIds?: string[]
  onCategoryClick: (categoryId: string) => void
}

export function CategorySidebar({
  categories,
  activeCategory,
  matchingCategoryIds,
  onCategoryClick,
}: CategorySidebarProps) {
  const handleCategoryClick = (categoryId: string) => {
    onCategoryClick(categoryId)
  }

  return (
    <aside aria-label="商品分类" className="h-full w-[72px] shrink-0 border-r bg-muted/30">
      <ScrollArea className="h-full">
        <div className="py-2">
          {categories.map((category) => {
            const isActive = category.id === activeCategory
            const hasMatch =
              matchingCategoryIds === undefined || matchingCategoryIds.includes(category.id)

            return (
              <button
                key={category.id}
                type="button"
                disabled={!hasMatch}
                aria-label={category.name}
                aria-current={isActive && hasMatch ? 'true' : undefined}
                title={hasMatch ? category.name : `${category.name}：无匹配商品`}
                onClick={() => handleCategoryClick(category.id)}
                className={cn(
                  'min-h-[44px] w-full px-1.5 py-2 text-center text-sm transition-colors',
                  'border-l-2 enabled:hover:bg-muted disabled:cursor-default disabled:text-muted-foreground/60',
                  isActive
                    ? 'border-primary bg-background font-medium text-primary'
                    : 'border-transparent text-muted-foreground'
                )}
              >
                <div className="break-all">{category.name}</div>
                {!hasMatch && <div className="mt-0.5 text-[10px] leading-3">无匹配</div>}
              </button>
            )
          })}
        </div>
      </ScrollArea>
    </aside>
  )
}
