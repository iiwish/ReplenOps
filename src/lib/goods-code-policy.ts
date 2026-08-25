import { getNextSequentialCode } from './sequential-code'

export const GOODS_CODE_PATTERN = /^G\d{6}$/

export function getNextGoodsCode(existingCodes: Iterable<string>): string {
  return getNextSequentialCode(existingCodes, {
    prefix: 'G',
    digits: 6,
    label: '商品',
  })
}

export function shouldValidateGoodsCode(mode: 'create' | 'edit'): boolean {
  return mode === 'create'
}
