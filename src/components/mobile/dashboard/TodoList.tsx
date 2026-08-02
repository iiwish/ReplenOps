'use client'

import Link from 'next/link'
import type { Route } from 'next'
import { Card } from '@/components/ui/card'
import { AlertTriangle, ChevronRight, Package, ShoppingBag } from 'lucide-react'
import type { TodoItem } from '@/services/dashboard.service'

interface TodoListProps {
  items: Array<{
    key: string
    todo: TodoItem
  }>
}

export function TodoList({ items }: TodoListProps) {
  const iconMap: Record<string, React.ReactNode> = {
    order: <ShoppingBag className="h-5 w-5 text-orange-600" />,
    container: <Package className="h-5 w-5 text-blue-600" />,
    inventory: <AlertTriangle className="h-5 w-5 text-red-600" />,
  }

  if (items.length === 0) {
    return (
      <section aria-labelledby="mobile-todo-heading">
        <div className="mb-2.5 flex items-center justify-between">
          <h2 id="mobile-todo-heading" className="text-base font-semibold text-gray-950">
            待办事项
          </h2>
          <span className="text-xs text-gray-400">0 项</span>
        </div>
        <div className="rounded-lg border border-dashed border-gray-200 bg-white/70 px-4 py-5 text-center text-sm text-gray-400">
          暂无待办事项
        </div>
      </section>
    )
  }

  return (
    <section aria-labelledby="mobile-todo-heading">
      <div className="mb-2.5 flex items-center justify-between">
        <h2 id="mobile-todo-heading" className="text-base font-semibold text-gray-950">
          待办事项
        </h2>
        <span className="text-xs text-gray-400">{items.length} 项</span>
      </div>
      <div className="space-y-2">
        {items.map(({ key, todo }) => (
          <Link
            key={key}
            href={todo.link as Route}
            className="block rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
          >
            <Card className="flex min-h-[72px] items-center gap-3 rounded-lg border-gray-200/80 px-3.5 py-3 shadow-[0_1px_2px_rgba(15,23,42,0.04)] transition-colors active:bg-gray-50">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gray-50 ring-1 ring-gray-100">
                {iconMap[todo.type] || <AlertTriangle className="h-5 w-5 text-gray-600" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold text-gray-950">{todo.title}</div>
                <div className="mt-0.5 truncate text-xs text-gray-500">{todo.description}</div>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="min-w-5 text-right text-sm font-semibold text-blue-600">
                  {todo.count}
                </span>
                <ChevronRight className="h-4 w-4 text-gray-400" />
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </section>
  )
}
