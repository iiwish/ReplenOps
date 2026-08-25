import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { storeService } from '@/services/store.service'

const suffix = `${process.pid}`.slice(-6).padStart(6, '0')
const username = `store-list-admin-${process.pid}`
const storeCode = `LS${suffix}`

describe('store list administrators', () => {
  beforeAll(async () => {
    const user = await prisma.user.create({
      data: {
        username,
        password: 'test-only-password',
        name: '列表管理员',
      },
    })
    await prisma.store.create({
      data: {
        code: storeCode,
        name: '管理员列表测试门店',
        storeAdmins: { create: { userId: user.id } },
      },
    })
  })

  afterAll(async () => {
    await prisma.storeAdmin.deleteMany({ where: { store: { code: storeCode } } })
    await prisma.store.deleteMany({ where: { code: storeCode } })
    await prisma.user.deleteMany({ where: { username } })
  })

  it('returns administrator names and supports searching stores by administrator', async () => {
    const result = await storeService.list({ keyword: '列表管理员' })

    expect(result.data).toHaveLength(1)
    expect(result.data[0]?.admins).toEqual([
      {
        userId: expect.any(String),
        displayName: '列表管理员',
      },
    ])
  })
})
