import { getNextSequentialCode } from './sequential-code'

export const CONTAINER_CODE_PATTERN = /^C\d{6}$/

export function getNextContainerCode(existingCodes: Iterable<string>): string {
  return getNextSequentialCode(existingCodes, {
    prefix: 'C',
    digits: 6,
    label: '包装物',
  })
}
