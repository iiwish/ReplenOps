'use client'

import { useEffect } from 'react'
import { APP_NAVIGATION_REQUEST_EVENT } from '@/lib/unsaved-changes'

export function useUnsavedChangesWarning(isDirty: boolean, message: string) {
  useEffect(() => {
    if (!isDirty) return

    const confirmDiscard = () => window.confirm(message)
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    const handleAppNavigation = (event: Event) => {
      if (!confirmDiscard()) event.preventDefault()
    }
    const handleLinkClick = (event: MouseEvent) => {
      if (!(event.target instanceof Element)) return
      const anchor = event.target.closest<HTMLAnchorElement>('a[href]')
      if (!anchor || anchor.target === '_blank') return

      const destination = new URL(anchor.href, window.location.href)
      const currentLocation = `${window.location.pathname}${window.location.search}`
      if (
        destination.origin !== window.location.origin ||
        `${destination.pathname}${destination.search}` === currentLocation
      ) {
        return
      }

      if (!confirmDiscard()) {
        event.preventDefault()
        event.stopPropagation()
      }
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    window.addEventListener(APP_NAVIGATION_REQUEST_EVENT, handleAppNavigation)
    document.addEventListener('click', handleLinkClick, true)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
      window.removeEventListener(APP_NAVIGATION_REQUEST_EVENT, handleAppNavigation)
      document.removeEventListener('click', handleLinkClick, true)
    }
  }, [isDirty, message])
}
