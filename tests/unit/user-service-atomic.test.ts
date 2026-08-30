import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { userService } from '@/services/user.service'

const username = `atomic-user-${process.pid}`
const storeCode = `AU${String(process.pid).slice(-6).padStart(6, '0')}`

describe('atomic user and role writes', () => {
  afterEach(async () => {
    await prisma.storeAdmin.deleteMany({ where: { user: { username } } })
    await prisma.userRole.deleteMany({ where: { user: { username } } })
    await prisma.user.deleteMany({ where: { username } })
    await prisma.store.deleteMany({ where: { code: storeCode } })
  })

  it('creates the user and roles in one service operation', async () => {
    const user = await userService.create({ username, password: 'test-only-password' }, [
      'WAREHOUSE_MANAGER',
      'APPROVER',
    ])

    expect(user.roles.sort()).toEqual(['APPROVER', 'WAREHOUSE_MANAGER'])
  })

  it('rejects invalid roles before creating a user', async () => {
    await expect(
      userService.create({ username, password: 'test-only-password' }, ['UNKNOWN_ROLE'])
    ).rejects.toThrow('Invalid role')
    await expect(prisma.user.findUnique({ where: { username } })).resolves.toBeNull()
  })

  it('creates a store administrator and store binding in one transaction', async () => {
    const store = await prisma.store.create({
      data: { code: storeCode, name: '原子写入测试门店' },
    })

    const user = await userService.create(
      { username, password: 'test-only-password' },
      ['STORE_ADMIN'],
      [String(store.id)]
    )

    expect(user.roles).toEqual(['STORE_ADMIN'])
    expect(user.storeIds).toEqual([String(store.id)])
    await expect(
      prisma.storeAdmin.findUnique({
        where: { userId_storeId: { userId: user.id, storeId: store.id } },
      })
    ).resolves.toBeTruthy()
  })
})
