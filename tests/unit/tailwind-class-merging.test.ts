import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('Tailwind 3 class merging', () => {
  it.each([
    ['shadow-md shadow', 'shadow'],
    ['ring-2 ring', 'ring'],
    ['rounded-lg rounded', 'rounded'],
    ['px-2 py-1 p-4', 'p-4'],
    ['text-sm text-lg', 'text-lg'],
    ['bg-muted bg-background', 'bg-background'],
    [
      'data-[state=active]:bg-muted data-[state=active]:bg-background',
      'data-[state=active]:bg-background',
    ],
    ['focus:ring-2 focus:ring', 'focus:ring'],
    ['w-full w-[220px]', 'w-[220px]'],
  ])('resolves %s to %s', (input, expected) => {
    expect(cn(input)).toBe(expected)
  })

  it('preserves independent responsive and state variants', () => {
    expect(cn('p-2 md:p-4 hover:bg-muted', { 'p-3': true }, false)).toBe(
      'md:p-4 hover:bg-muted p-3'
    )
  })
})
