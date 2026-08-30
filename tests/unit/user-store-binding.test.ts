import { describe, expect, it } from 'vitest'
import { userCreateSchema, userUpdateSchema } from '@/types/user.types'

const baseCreateInput = {
  username: 'store-admin-test',
  password: 'test-only-password',
  name: '门店管理员测试',
  roles: ['STORE_ADMIN'],
}

describe('user store binding validation', () => {
  it('requires a store when assigning the store administrator role', () => {
    const result = userCreateSchema.safeParse({ ...baseCreateInput, storeIds: [] })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['storeIds'],
      message: '门店管理员必须至少绑定一家门店',
    })
  })

  it('accepts store bindings only for store administrators', () => {
    expect(userCreateSchema.safeParse({ ...baseCreateInput, storeIds: ['1', '2'] }).success).toBe(
      true
    )

    const result = userUpdateSchema.safeParse({
      name: '仓库管理员测试',
      roles: ['WAREHOUSE_MANAGER'],
      storeIds: ['1'],
    })

    expect(result.success).toBe(false)
    expect(result.error?.issues[0]).toMatchObject({
      path: ['storeIds'],
      message: '只有门店管理员可以绑定门店',
    })
  })
})
