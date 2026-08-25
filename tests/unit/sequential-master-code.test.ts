import { describe, expect, it } from 'vitest'
import { getNextContainerCode } from '@/lib/container-code-policy'
import { getNextGoodsCode } from '@/lib/goods-code-policy'

describe('sequential master-data codes', () => {
  it('increments the greatest standard goods code and ignores legacy formats', () => {
    expect(getNextGoodsCode(['G000007', 'GLE00143', 'G000099', 'G-STAGE2'])).toBe('G000100')
  })

  it('increments the greatest standard container code', () => {
    expect(getNextContainerCode(['C000002', 'C000019', 'C-CW-1'])).toBe('C000020')
  })

  it('starts each code series at one when no standard code exists', () => {
    expect(getNextGoodsCode([])).toBe('G000001')
    expect(getNextContainerCode(['legacy-container'])).toBe('C000001')
  })

  it('does not roll over after the six-digit range is exhausted', () => {
    expect(() => getNextGoodsCode(['G999999'])).toThrow('商品编码已达到上限')
    expect(() => getNextContainerCode(['C999999'])).toThrow('包装物编码已达到上限')
  })
})
