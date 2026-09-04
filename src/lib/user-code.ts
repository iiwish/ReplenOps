const USER_CODE_PREFIX = 'U'
const USER_CODE_DIGITS = 6

export function formatUserCode(code: number): string {
  return `${USER_CODE_PREFIX}${String(code).padStart(USER_CODE_DIGITS, '0')}`
}
