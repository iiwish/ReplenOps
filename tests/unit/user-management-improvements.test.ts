import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { formatUserCode } from '@/lib/user-code'
import { ROLE_OPTIONS, userCreateSchema } from '@/types/user.types'

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('user management improvements', () => {
  it('offers only supported roles when creating users', () => {
    expect(ROLE_OPTIONS.map((option) => option.value)).toEqual([
      'SUPER_ADMIN',
      'WAREHOUSE_MANAGER',
      'STORE_ADMIN',
    ])

    for (const role of ['FINANCE', 'APPROVER']) {
      expect(
        userCreateSchema.safeParse({
          username: `unsupported-${role.toLowerCase()}`,
          password: 'test-only-password',
          name: '不支持角色测试',
          roles: [role],
          storeIds: [],
        }).success
      ).toBe(false)
    }
  })

  it('reloads the user candidates whenever the add-admin dialog opens', () => {
    const storeAdmins = readSource('src/app/admin/stores/[id]/admins/StoreAdminsClient.tsx')

    expect(storeAdmins).toContain('if (addModalVisible)')
    expect(storeAdmins).toContain('setUsers([])')
    expect(storeAdmins).toContain("fetch('/api/users?take=100', { cache: 'no-store' })")
    expect(storeAdmins).not.toContain('addModalVisible && users.length === 0')
  })

  it('does not expose internal user ids in administrator tables', () => {
    const storeAdmins = readSource('src/app/admin/stores/[id]/admins/StoreAdminsClient.tsx')

    expect(storeAdmins).toContain("title: '用户编码'")
    expect(storeAdmins).not.toContain("title: '用户ID'")
    expect(storeAdmins).not.toContain("dataIndex: 'userId'")
    expect(storeAdmins).toContain(
      'aria-label={`${formatUserCode(user.code)} · ${user.displayName}`}'
    )
  })

  it('provides localized accessible names for icon-only controls', () => {
    const users = readSource('src/app/admin/users/UserListClient.tsx')
    const header = readSource('src/components/admin/AppHeader.tsx')

    expect(users).toContain('<SearchOutlined aria-label="搜索用户" />')
    expect(header).toContain("aria-label={collapsed ? '展开侧栏' : '收起侧栏'}")
  })

  it('formats numeric user codes for display', () => {
    expect(formatUserCode(1)).toBe('U000001')
    expect(formatUserCode(1_000_000)).toBe('U1000000')
  })
})
