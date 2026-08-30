export const APP_NAVIGATION_REQUEST_EVENT = 'replenops:app-navigation-request'

export function requestAppNavigation(): boolean {
  if (typeof window === 'undefined') return true

  return window.dispatchEvent(new Event(APP_NAVIGATION_REQUEST_EVENT, { cancelable: true }))
}
