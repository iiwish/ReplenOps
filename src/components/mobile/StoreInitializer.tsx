'use client'

import { useEffect } from 'react'
import { useStoreSelectionStore, StoreInfo } from '@/lib/stores/store-selection.store'

interface StoreInitializerProps {
  stores: StoreInfo[]
}

export function StoreInitializer({ stores }: StoreInitializerProps) {
  const { initializeStore } = useStoreSelectionStore()

  useEffect(() => {
    if (stores.length > 0) {
      initializeStore(stores)
    }
  }, [stores, initializeStore])

  return null
}
