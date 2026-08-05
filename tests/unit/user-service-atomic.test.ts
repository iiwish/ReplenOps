import { afterEach, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { userService } from '@/services/user.service'

const username = `atomic-user-${process.pid}`

describe('atomic user and role writes', () => {
  afterEach(async () => {
    await prisma.userRole.deleteMany({ where: { user: { username } } })
    await prisma.user.deleteMany({ where: { username } })
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
})
