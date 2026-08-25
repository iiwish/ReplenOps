import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('container return navigation', () => {
  it('keeps the return request action out of the warehouse acceptance list', () => {
    const returnList = readSource('src/components/admin/containers/ContainerReturnList.tsx')

    expect(returnList).not.toContain('/admin/container-return/new')
    expect(returnList).not.toContain('登记归还')
    expect(returnList).not.toContain('代门店提交')
    expect(returnList).toContain('确认验收')
  })
})
