import { describe, expect, it } from 'vitest'
import { cn } from '@/lib/utils'

describe('Tailwind class merging', () => {
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

  it('resolves existing component spacing, colors and responsive overrides', () => {
    expect(cn('p-6 bg-card text-card-foreground', 'p-3 bg-muted/30')).toBe(
      'text-card-foreground p-3 bg-muted/30'
    )
    expect(cn('sm:p-6 p-4', 'sm:p-3')).toBe('p-4 sm:p-3')
    expect(cn('rounded-lg border-border', 'rounded-md border-blue-200')).toBe(
      'rounded-md border-blue-200'
    )
  })

  it('keeps animation, focus and state variants independent', () => {
    expect(cn('animate-in focus:ring-2 data-[state=open]:fade-in-0', 'focus:ring-4')).toBe(
      'animate-in data-[state=open]:fade-in-0 focus:ring-4'
    )
  })
})
