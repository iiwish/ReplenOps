export function safeReturnPath(value: string | null | undefined): string {
  if (
    !value ||
    /[\\\s\u0000-\u001f]/.test(value) ||
    !value.startsWith('/') ||
    value.startsWith('//')
  )
    return '/'
  try {
    const url = new URL(value, 'https://local.invalid')
    if (
      url.origin !== 'https://local.invalid' ||
      !/^\/(admin|mobile)(\/|$)/.test(url.pathname) ||
      /%2f|%5c/i.test(url.pathname)
    )
      return '/'
    return url.pathname + url.search
  } catch {
    return '/'
  }
}
