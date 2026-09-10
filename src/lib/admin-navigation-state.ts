'use client'

import { useSyncExternalStore } from 'react'

interface AdminNavigationState {
  sourcePathname: string
  targetPathname: string
}

let state: AdminNavigationState | null = null
const listeners = new Set<() => void>()

function emit() {
  listeners.forEach((listener) => listener())
}

export function beginAdminNavigation(sourcePathname: string, targetPathname: string) {
  state = { sourcePathname, targetPathname }
  emit()
}

export function finishAdminNavigation() {
  if (state === null) return
  state = null
  emit()
}

export function useAdminNavigation() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener)
      return () => listeners.delete(listener)
    },
    () => state,
    () => null
  )
}
