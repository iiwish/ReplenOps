import { afterEach, describe, expect, it } from 'vitest'
import { hash } from 'bcryptjs'
import { softDeletionData } from '@/lib/master-data-lifecycle'
import { prisma } from '@/lib/prisma'
import { bootstrapAdmin } from '../../prisma/bootstrap-admin-core'

const username = `bootstrap-test-${process.pid}`

describe('administrator bootstrap', () => {
  afterEach(async () => {
    await prisma.userRole.deleteMany({ where: { user: { username } } })
    await prisma.user.deleteMany({ where: { username } })
  })

  it('creates once and never resets an existing account', async () => {
    const first = await bootstrapAdmin(prisma, {
      APP_ENV: 'local',
      ADMIN_USERNAME: username,
      ADMIN_INITIAL_PASSWORD: 'first-bootstrap-password',
    })
    expect(first.created).toBe(true)

    const retainedPassword = await hash('operator-managed-password', 10)
    await prisma.user.update({
      where: { username },
      data: {
        password: retainedPassword,
        ...softDeletionData('bootstrap-test', '测试归档'),
        roles: { deleteMany: {} },
      },
    })

    const second = await bootstrapAdmin(prisma, {
      APP_ENV: 'local',
      ADMIN_USERNAME: username,
      ADMIN_INITIAL_PASSWORD: 'different-bootstrap-password',
    })
    const stored = await prisma.user.findUniqueOrThrow({
      where: { username },
      include: { roles: true },
    })

    expect(second.created).toBe(false)
    expect(stored.password).toBe(retainedPassword)
    expect(stored.isActive).toBe(false)
    expect(stored.isDeleted).toBe(true)
    expect(stored.roles).toHaveLength(0)
  })
})
