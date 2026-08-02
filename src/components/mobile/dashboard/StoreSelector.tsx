'use client'

import { useState } from 'react'
import { Check, ChevronDown, Store } from 'lucide-react'
import { useStoreSelectionStore } from '@/lib/stores/store-selection.store'

interface StoreSelectorProps {
  className?: string
}

export function StoreSelector({ className = '' }: StoreSelectorProps) {
  const [isOpen, setIsOpen] = useState(false)
  const { selectedStoreId, availableStores, setSelectedStoreId } = useStoreSelectionStore()

  const selectedStore = availableStores.find((s) => s.id === selectedStoreId)

  const handleStoreChange = (storeId: string) => {
    setSelectedStoreId(storeId)
    setIsOpen(false)
  }

  return (
    <div className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="flex max-w-full items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-gray-600 ring-1 ring-inset ring-gray-200 transition-colors hover:bg-gray-100"
        aria-expanded={availableStores.length > 1 ? isOpen : undefined}
        aria-label={`当前门店：${selectedStore?.name || '请选择门店'}`}
      >
        <Store className="h-3.5 w-3.5 shrink-0 text-gray-400" />
        <span className="truncate text-xs font-medium">{selectedStore?.name || '请选择门店'}</span>
        {availableStores.length > 1 && (
          <ChevronDown
            className={`h-3.5 w-3.5 shrink-0 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        )}
      </button>

      {isOpen && availableStores.length > 1 && (
        <>
          <button
            type="button"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setIsOpen(false)}
            aria-label="关闭门店选择"
          />
          <div className="absolute left-0 top-full z-50 mt-2 min-w-[220px] max-w-[calc(100vw-2rem)] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-1">
              {availableStores.map((store) => (
                <button
                  type="button"
                  key={store.id}
                  onClick={() => handleStoreChange(store.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    store.id === selectedStoreId
                      ? 'bg-blue-50 font-medium text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Store className="h-4 w-4" />
                  <span className="truncate">{store.name}</span>
                  {store.id === selectedStoreId && (
                    <Check className="ml-auto h-4 w-4 shrink-0 text-blue-600" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
