import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const suffix = `${process.pid}`.slice(-6).padStart(6, '0')
const password = 'e2e-only-password'
const financeUsername = `e2e-pack-finance-${process.pid}`
const storeUsername = `e2e-pack-store-${process.pid}`
const warehouseUsername = `e2e-pack-warehouse-${process.pid}`
const usernames = [financeUsername, storeUsername, warehouseUsername]
const storeCode = `PW${suffix}`
const containerCodes = [`PC${suffix}A`, `PC${suffix}B`]

test.beforeAll(async () => {
  const passwordHash = await hash(password, 10)
  const [financeUser, storeUser] = await prisma.$transaction([
    prisma.user.create({
      data: {
        username: financeUsername,
        password: passwordHash,
        name: '包装物财务测试员',
        roles: { create: { role: 'FINANCE' } },
      },
    }),
    prisma.user.create({
      data: {
        username: storeUsername,
        password: passwordHash,
        name: '包装物门店测试员',
        roles: { create: { role: 'STORE_ADMIN' } },
      },
    }),
  ])
  void financeUser
  await prisma.user.create({
    data: {
      username: warehouseUsername,
      password: passwordHash,
      name: '包装物仓库测试员',
      roles: { create: { role: 'WAREHOUSE_MANAGER' } },
    },
  })

  const store = await prisma.store.create({
    data: {
      code: storeCode,
      name: '包装物流转测试门店',
      storeAdmins: { create: { userId: storeUser.id } },
    },
  })
  const [crate, pallet] = await prisma.$transaction([
    prisma.container.create({
      data: { code: containerCodes[0]!, name: '冷链周转箱', unit: '只', deposit: 20 },
    }),
    prisma.container.create({
      data: { code: containerCodes[1]!, name: '配送托盘', unit: '套', deposit: 30 },
    }),
  ])
  await prisma.containerTracking.createMany({
    data: [
      {
        storeId: store.id,
        containerId: crate.id,
        totalBorrowed: 7,
        currentBorrowed: 7,
        pendingReturnQuantity: 2,
      },
      {
        storeId: store.id,
        containerId: pallet.id,
        totalBorrowed: 3,
        currentBorrowed: 3,
      },
    ],
  })
  const tracking = await prisma.containerTracking.findUniqueOrThrow({
    where: { storeId_containerId: { storeId: store.id, containerId: crate.id } },
  })
  for (const [index, status] of ['PENDING', 'PENDING', 'COMPLETED'].entries()) {
    await prisma.containerReturn.create({
      data: {
        code: `E2E-CR-${suffix}-${index}`,
        storeId: store.id,
        submittedBy: storeUser.id,
        status: status === 'COMPLETED' ? 'COMPLETED' : 'PENDING',
        items: {
          create: {
            containerTrackingId: tracking.id,
            containerId: crate.id,
            requestedQuantity: 1,
            receivedQuantity: status === 'COMPLETED' ? 1 : null,
          },
        },
      },
    })
  }
})

test.afterAll(async () => {
  await prisma.authSession.deleteMany({
    where: { user: { username: { in: usernames } } },
  })
  await prisma.containerLog.deleteMany({ where: { tracking: { store: { code: storeCode } } } })
  await prisma.containerReturn.deleteMany({ where: { store: { code: storeCode } } })
  await prisma.containerTracking.deleteMany({
    where: { container: { code: { in: containerCodes } } },
  })
  await prisma.container.deleteMany({ where: { code: { in: containerCodes } } })
  await prisma.storeAdmin.deleteMany({ where: { store: { code: storeCode } } })
  await prisma.store.deleteMany({ where: { code: storeCode } })
  await prisma.userRole.deleteMany({
    where: { user: { username: { in: usernames } } },
  })
  await prisma.user.deleteMany({
    where: { username: { in: usernames } },
  })
  await prisma.$disconnect()
})

test('shows a single packaging workspace and read-only actions for finance', async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: financeUsername, password },
  })
  expect(login.ok()).toBe(true)

  await page.goto('/admin/dashboard')
  await expect(page.getByRole('menuitem', { name: '包装物' })).toBeVisible()
  await expect(page.getByRole('menuitem', { name: '系统设置' })).toHaveCount(0)

  await page.getByRole('menuitem', { name: '基础资料' }).click()
  await page.getByRole('menuitem', { name: '商品档案' }).click()
  await expect(page.getByRole('columnheader', { name: '商品编码' })).toBeVisible()
  await expect(page.getByRole('button', { name: /新增商品/ })).toHaveCount(0)

  await page.getByRole('menuitem', { name: '包装物' }).click()
  await expect(page).toHaveURL(/\/admin\/containers(?:\?view=outstanding)?$/)
  await expect(page.getByRole('heading', { name: '包装物', exact: true })).toHaveCount(0)
  await expect(page.getByRole('tab', { name: '在外包装物' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '归还日志' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '门店台账' })).toBeVisible()
  await expect(page.getByRole('tab', { name: '包装物设置' })).toHaveCount(0)
  const crateRow = page.getByRole('row').filter({ hasText: containerCodes[0]! })
  await expect(crateRow.getByRole('button', { name: '查看日志' })).toBeVisible()
  await expect(crateRow.getByRole('button', { name: '查看日志' })).toHaveText('查看日志')
  await expect(crateRow.getByRole('button', { name: '验收', exact: true })).toHaveCount(0)
  await expect(crateRow.getByRole('button', { name: '驳回', exact: true })).toHaveCount(0)
  await page.getByRole('tab', { name: '归还日志' }).click()
  await expect(page.getByRole('row').filter({ hasText: `E2E-CR-${suffix}-2` })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: `E2E-CR-${suffix}-0` })).toBeVisible()
  await page.locator('#status').click()
  await page.getByTitle('待验收', { exact: true }).click()
  await page.getByRole('button', { name: '查 询' }).click()
  await expect(page.getByRole('row').filter({ hasText: `E2E-CR-${suffix}-2` })).toHaveCount(0)
  await page.getByRole('button', { name: '重 置' }).click()
  await expect(page.getByRole('row').filter({ hasText: `E2E-CR-${suffix}-2` })).toBeVisible()
})

test('supports multi-item mobile returns with one title and real units', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: storeUsername, password },
  })
  expect(login.ok()).toBe(true)

  await page.goto('/mobile/container-return')
  await expect(page.getByRole('heading', { name: '包装物归还' })).toHaveCount(1)
  await expect(page.getByText('包装物流转测试门店', { exact: true }).first()).toBeVisible()
  await expect(page.getByText('可归还 5 只')).toBeVisible()
  await expect(page.getByText('可归还 3 套')).toBeVisible()

  const selections = page.getByRole('checkbox', { name: '加入本次归还' })
  await expect(selections).toHaveCount(2)
  await selections.nth(0).check()
  await selections.nth(1).check()
  await page.getByRole('button', { name: /提交 2 种包装物/ }).click()

  const dialog = page.getByRole('dialog', { name: '确认归还申请' })
  await expect(dialog.getByText('冷链周转箱')).toBeVisible()
  await expect(dialog.getByText('5 只')).toBeVisible()
  await expect(dialog.getByText('配送托盘')).toBeVisible()
  await expect(dialog.getByText('3 套')).toBeVisible()
})

test('reviews specific pending returns from outstanding rows and refreshes the ledger', async ({
  page,
}, testInfo) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  expect(
    (
      await page.request.post('/api/auth/login', {
        data: { identifier: warehouseUsername, password },
      })
    ).ok()
  ).toBe(true)
  await page.goto('/admin/containers')
  const crateRow = page.getByRole('row').filter({ hasText: containerCodes[0]! })
  const palletRow = page.getByRole('row').filter({ hasText: containerCodes[1]! })
  await expect(crateRow.getByRole('button', { name: '验收', exact: true })).toBeVisible()
  await expect(palletRow.getByRole('button', { name: '验收', exact: true })).toHaveCount(0)
  await page.screenshot({ path: testInfo.outputPath('packaging-outstanding.png') })
  await crateRow.getByRole('button', { name: '验收', exact: true }).click()
  const selection = page.getByRole('dialog', { name: /待验收归还单/ })
  await expect(selection.getByRole('row').filter({ hasText: `E2E-CR-${suffix}-2` })).toHaveCount(0)
  await expect(selection.getByRole('button', { name: /验收$/ })).toHaveCount(2)
  await selection
    .getByRole('row')
    .filter({ hasText: `E2E-CR-${suffix}-0` })
    .getByRole('button', { name: /验收$/ })
    .click()
  const accept = page.getByRole('dialog', { name: `验收归还单 E2E-CR-${suffix}-0` })
  await expect(accept.getByText('冷链周转箱')).toBeVisible()
  await expect(accept.getByRole('spinbutton')).toHaveValue('1')
  await accept.getByRole('button', { name: '确认验收' }).click()
  await expect(accept).not.toBeVisible()
  await expect(selection.getByRole('button', { name: /验收$/ })).toHaveCount(1)
  await selection.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(crateRow.getByRole('cell').nth(3)).toHaveText('6')
  await expect(crateRow.getByRole('cell').nth(4)).toHaveText('1')
  await crateRow.getByRole('button', { name: '驳回', exact: true }).click()
  await selection.getByRole('button', { name: /驳回$/ }).click()
  const reject = page.getByRole('dialog', { name: `驳回归还单 E2E-CR-${suffix}-1` })
  await reject.getByRole('button', { name: '确认驳回' }).click()
  await expect(reject).toBeVisible()
  await reject.getByPlaceholder('请输入驳回原因').fill('数量需要核实')
  await reject.getByRole('button', { name: '确认驳回' }).click()
  await expect(reject).not.toBeVisible()
  await expect(selection.getByText('当前没有符合条件的归还申请')).toBeVisible()
  await selection.getByRole('button', { name: 'Close', exact: true }).click()
  await expect(crateRow.getByRole('button', { name: '验收', exact: true })).toHaveCount(0)
  await expect(crateRow.getByRole('cell').nth(3)).toHaveText('6')
  await expect(crateRow.getByRole('cell').nth(4)).toHaveText('0')
  await crateRow.getByRole('button', { name: '查看日志' }).click()
  await expect(
    page
      .getByRole('dialog', { name: '包装物变动日志' })
      .getByRole('cell', { name: '归还', exact: true })
  ).toBeVisible()
})
