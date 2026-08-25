export interface SequentialCodePolicy {
  prefix: string
  digits: number
  label: string
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

export function getNextSequentialCode(
  existingCodes: Iterable<string>,
  { prefix, digits, label }: SequentialCodePolicy
): string {
  const pattern = new RegExp(`^${escapeRegExp(prefix)}(\\d{${digits}})$`)
  let greatestValue = 0

  for (const code of existingCodes) {
    const match = pattern.exec(code)
    if (!match) continue

    const value = Number.parseInt(match[1]!, 10)
    if (value > greatestValue) greatestValue = value
  }

  const nextValue = greatestValue + 1
  if (nextValue >= 10 ** digits) {
    throw new Error(`${label}编码已达到上限`)
  }

  return `${prefix}${String(nextValue).padStart(digits, '0')}`
}
