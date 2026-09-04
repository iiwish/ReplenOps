import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { prisma } from '@/lib/prisma'
import { storeService } from '@/services/store.service'
import { userService } from '@/services/user.service'

const token = `permission-audit-${process.pid}-${Date.now()}`
const operatedBy = `${token}-operator`
const operatorIp = '203.0.113.10'
const createdUsername = `${token}-created`
const storeAdminUsername = `${token}-store-admin`
const storeCode = `PA${String(process.pid).slice(-6).padStart(6, '0')}`

let storeId = 0

beforeAll(async () => {
  const store = await prisma.store.create({
    data: { code: storeCode, name: '权限审计测试门店' },
  })
  storeId = store.id
})

afterAll(async () => {
  await prisma.approvalLog.deleteMany({ where: { operatedBy } })
  await prisma.storeAdmin.deleteMany({ where: { storeId } })
  await prisma.userRole.deleteMany({
    where: { user: { username: { in: [createdUsername, storeAdminUsername] } } },
  })
  await prisma.user.deleteMany({
    where: { username: { in: [createdUsername, storeAdminUsername] } },
  })
  await prisma.store.deleteMany({ where: { id: storeId } })
})

describe('permission mutation audit trail', () => {
  it('records user creation and role/store changes with before and after snapshots', async () => {
    const user = await userService.create(
      { username: createdUsername, password: 'test-only-password', name: '权限审计用户' },
      ['WAREHOUSE_MANAGER'],
      [],
      operatedBy,
      operatorIp
    )

    const createLog = await prisma.approvalLog.findFirst({
      where: { entityType: 'USER', entityId: user.id, action: 'USER_CREATE' },
    })
    expect(createLog).toMatchObject({ operatedBy, operatorIp })
    expect(createLog?.afterJson).toMatchObject({
      code: user.code,
      username: createdUsername,
      roles: ['WAREHOUSE_MANAGER'],
      storeIds: [],
    })

    await userService.update(
      user.id,
      {},
      ['STORE_ADMIN'],
      [String(storeId)],
      operatedBy,
      operatorIp
    )

    const updateLog = await prisma.approvalLog.findFirst({
      where: { entityType: 'USER', entityId: user.id, action: 'USER_UPDATE' },
    })
    expect(updateLog).toMatchObject({ operatedBy, operatorIp })
    expect(updateLog?.beforeJson).toMatchObject({
      roles: ['WAREHOUSE_MANAGER'],
      storeIds: [],
    })
    expect(updateLog?.afterJson).toMatchObject({
      roles: ['STORE_ADMIN'],
      storeIds: [storeId],
    })
  })

  it('records store administrator assignment and removal', async () => {
    const user = await prisma.user.create({
      data: {
        username: storeAdminUsername,
        password: 'test-only-password',
        name: '门店授权审计用户',
      },
    })

    await storeService.addAdmin(String(storeId), user.id, operatedBy, operatorIp)
    const addLog = await prisma.approvalLog.findFirst({
      where: {
        entityType: 'STORE',
        entityId: String(storeId),
        action: 'STORE_ADMIN_ADD',
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(addLog).toMatchObject({ operatedBy, operatorIp })
    expect(addLog?.afterJson).toMatchObject({
      storeId,
      userId: user.id,
      assigned: true,
    })

    await storeService.removeAdmin(String(storeId), user.id, operatedBy, operatorIp)
    const removeLog = await prisma.approvalLog.findFirst({
      where: {
        entityType: 'STORE',
        entityId: String(storeId),
        action: 'STORE_ADMIN_REMOVE',
      },
      orderBy: { createdAt: 'desc' },
    })
    expect(removeLog).toMatchObject({ operatedBy, operatorIp })
    expect(removeLog?.beforeJson).toMatchObject({
      storeId,
      userId: user.id,
      assigned: true,
    })
    expect(removeLog?.afterJson).toMatchObject({
      storeId,
      userId: user.id,
      assigned: false,
    })
  })
})
