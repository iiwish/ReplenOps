import { beforeEach, describe, expect, it, vi } from 'vitest'

const userMocks = vi.hoisted(() => ({
  findMany: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: { user: userMocks },
}))

import { getUserDisplayNameMap, resolveUserDisplayName } from '@/services/user-display.service'

describe('user display names', () => {
  beforeEach(() => {
    userMocks.findMany.mockReset()
  })

  it('maps both user ids and usernames to the configured name', async () => {
    userMocks.findMany.mockResolvedValue([
      { id: 'user-id', username: 'operator-code', name: '张三' },
      { id: 'fallback-id', username: 'lisi', name: null },
    ])

    const names = await getUserDisplayNameMap(['user-id', 'operator-code', 'fallback-id'])

    expect(names.get('user-id')).toBe('张三')
    expect(names.get('operator-code')).toBe('张三')
    expect(names.get('fallback-id')).toBe('lisi')
  })

  it('uses readable system labels and preserves unknown historical identifiers', () => {
    const names = new Map<string, string>()

    expect(resolveUserDisplayName('system', names)).toBe('系统')
    expect(resolveUserDisplayName('migration', names)).toBe('数据迁移')
    expect(resolveUserDisplayName('legacy-operator', names)).toBe('legacy-operator')
    expect(resolveUserDisplayName(null, names)).toBeNull()
  })
})
