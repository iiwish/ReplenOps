export const GOODS_CODE_PATTERN = /^G\d{6}$/

export function shouldValidateGoodsCode(mode: 'create' | 'edit'): boolean {
  return mode === 'create'
}
