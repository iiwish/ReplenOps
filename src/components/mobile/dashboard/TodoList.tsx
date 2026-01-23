'use client'

import Link from 'next/link'
import { Card } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { AlertTriangle, Package, ShoppingBag } from 'lucide-react'
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
    return <Card className="p-6 text-center text-gray-500">暂无待办事项</Card>
  }

  return (
    <Card className="space-y-3 p-4">
      {items.map(({ key, todo }) => (
        <Link key={key} href={todo.link as any}>
          <div className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-gray-50">
            <div className="flex items-center space-x-3">
              {iconMap[todo.type] || <AlertTriangle className="h-5 w-5 text-gray-600" />}
              <div>
                <div className="font-medium">{todo.title}</div>
                <div className="text-sm text-gray-500">{todo.description}</div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="text-sm font-semibold text-blue-600">{todo.count}</span>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                →
              </Button>
            </div>
          </div>
        </Link>
      ))}
    </Card>
  )
}
