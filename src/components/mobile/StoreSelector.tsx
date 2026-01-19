'use client'

import { useStoreSelectionStore, StoreInfo } from '@/lib/stores/store-selection.store'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Store } from 'lucide-react'

export function StoreSelector() {
  const { selectedStoreId, availableStores, setSelectedStoreId } = useStoreSelectionStore()

  if (availableStores.length === 0) {
    return (
      <div className="text-sm text-muted-foreground">
        暂无可用门店
      </div>
    )
  }

  // 如果只有一个门店，显示为静态文本
  if (availableStores.length === 1) {
    return (
      <div className="flex items-center gap-2 px-3 py-2 text-sm">
        <Store className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{availableStores[0]!.name}</span>
      </div>
    )
  }

  return (
    <Select
      value={selectedStoreId || undefined}
      onValueChange={setSelectedStoreId}
    >
      <SelectTrigger className="w-full h-10">
        <div className="flex items-center gap-2">
          <Store className="h-4 w-4 text-muted-foreground" />
          <SelectValue placeholder="选择门店" />
        </div>
      </SelectTrigger>
      <SelectContent>
        {availableStores.map((store) => (
          <SelectItem key={store.id} value={store.id}>
            <div className="flex flex-col">
              <span className="font-medium">{store.name}</span>
              <span className="text-xs text-muted-foreground">{store.code}</span>
            </div>
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  )
}
