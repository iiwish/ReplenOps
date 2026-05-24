import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export interface StoreInfo {
  id: string
  code: string
  name: string
}

interface StoreSelectionStore {
  selectedStoreId: string | null
  availableStores: StoreInfo[]
  setSelectedStoreId: (storeId: string) => void
  setAvailableStores: (stores: StoreInfo[]) => void
  initializeStore: (stores: StoreInfo[]) => void
}

export const useStoreSelectionStore = create<StoreSelectionStore>()(
  persist(
    (set, get) => ({
      selectedStoreId: null,
      availableStores: [],

      setSelectedStoreId: (storeId: string) => {
        set({ selectedStoreId: storeId })
      },

      setAvailableStores: (stores: StoreInfo[]) => {
        set({ availableStores: stores })
      },

      initializeStore: (stores: StoreInfo[]) => {
        const currentStoreId = get().selectedStoreId

        // 更新可用门店列表
        set({ availableStores: stores })

        // 如果已经有选中的门店，且该门店在可用列表中，保持不变
        if (currentStoreId && stores.some(s => s.id === currentStoreId)) {
          return
        }

        // 否则选择第一个门店
        const firstStore = stores[0]
        if (firstStore) {
          set({ selectedStoreId: firstStore.id })
        } else {
          set({ selectedStoreId: null })
        }
      },
    }),
    {
      name: 'erp-store-selection',
    }
  )
)
