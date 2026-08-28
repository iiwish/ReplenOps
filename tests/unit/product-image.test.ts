import { describe, expect, it } from 'vitest'
import {
  isAllowedProductImageSource,
  isRemoteProductImageSource,
  normalizeProductImageSource,
} from '@/lib/product-image'

describe('product image sources', () => {
  it('accepts repository assets and HTTP(S) image URLs', () => {
    expect(isAllowedProductImageSource('/images/products/example.jpg')).toBe(true)
    expect(isAllowedProductImageSource('https://cdn.example.com/products/example.jpg')).toBe(true)
    expect(isAllowedProductImageSource('http://localhost:3000/example.jpg')).toBe(true)
  })

  it('rejects protocol-relative, credentialed, and non-web sources', () => {
    expect(isAllowedProductImageSource('//cdn.example.com/example.jpg')).toBe(false)
    expect(isAllowedProductImageSource('/api/health')).toBe(false)
    expect(isAllowedProductImageSource('https://user:password@example.com/example.jpg')).toBe(false)
    expect(isAllowedProductImageSource('file:///etc/passwd')).toBe(false)
    expect(isAllowedProductImageSource('data:image/png;base64,abc')).toBe(false)
  })

  it('normalizes legacy thumbnail suffixes and empty values', () => {
    expect(normalizeProductImageSource(' https://cdn.example.com/item.jpg_200x200 ')).toBe(
      'https://cdn.example.com/item.jpg'
    )
    expect(normalizeProductImageSource('')).toBeNull()
    expect(normalizeProductImageSource('not-a-url')).toBeNull()
  })

  it('only marks absolute HTTP(S) URLs as remote', () => {
    expect(isRemoteProductImageSource('https://cdn.example.com/example.jpg')).toBe(true)
    expect(isRemoteProductImageSource('/images/products/example.jpg')).toBe(false)
  })
})
