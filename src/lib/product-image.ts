const LEGACY_IMAGE_SIZE_SUFFIX = /(\.(?:avif|gif|jpe?g|png|webp))_\d+x\d+(?=$|\?)/i

export function isAllowedProductImageSource(source: string): boolean {
  if (source.startsWith('/')) {
    return source.startsWith('/images/')
  }

  try {
    const url = new URL(source)
    return (
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.username === '' &&
      url.password === ''
    )
  } catch {
    return false
  }
}

export function normalizeProductImageSource(source: string | null | undefined): string | null {
  const trimmedSource = source?.trim()

  if (!trimmedSource || !isAllowedProductImageSource(trimmedSource)) {
    return null
  }

  return trimmedSource.replace(LEGACY_IMAGE_SIZE_SUFFIX, '$1')
}

export function isRemoteProductImageSource(source: string): boolean {
  return source.startsWith('http://') || source.startsWith('https://')
}
