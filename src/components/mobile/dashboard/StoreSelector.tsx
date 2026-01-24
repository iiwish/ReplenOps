'use client'

import { useState } from 'react'
import { ChevronDown, Store } from 'lucide-react'
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
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 rounded-lg bg-white/20 px-3 py-2 transition-colors hover:bg-white/30"
      >
        <Store className="h-4 w-4" />
        <span className="text-sm font-medium">{selectedStore?.name || '请选择门店'}</span>
        {availableStores.length > 1 && (
          <ChevronDown className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        )}
      </button>

      {isOpen && availableStores.length > 1 && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setIsOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 min-w-[200px] overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
            <div className="p-1">
              {availableStores.map((store) => (
                <button
                  key={store.id}
                  onClick={() => handleStoreChange(store.id)}
                  className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
                    store.id === selectedStoreId
                      ? 'bg-blue-50 font-medium text-blue-600'
                      : 'text-gray-700 hover:bg-gray-100'
                  }`}
                >
                  <Store className="h-4 w-4" />
                  <span>{store.name}</span>
                  {store.id === selectedStoreId && <span className="ml-auto text-blue-600">✓</span>}
                </button>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  )
}
