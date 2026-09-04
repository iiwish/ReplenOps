import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const suffix = `${process.pid}`.slice(-6).padStart(6, '0')
const adminUsername = `e2e-user-management-${process.pid}`
const initialUsername = `e2e-member-initial-${process.pid}`
const lateUsername = `e2e-member-late-${process.pid}`
const auditedUsername = `e2e-member-audited-${process.pid}`
const password = 'e2e-only-password'
const storeCode = `UM${suffix}`

let storeId = 0
let initialUserId = ''
let initialUserCode = 0
let adminUserCode = 0
let adminUserId = ''

const formatUserCode = (code: number) => `U${String(code).padStart(6, '0')}`

test.beforeAll(async () => {
  const adminUser = await prisma.user.create({
    data: {
      username: adminUsername,
      password: await hash(password, 10),
      name: '用户管理测试管理员',
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
  const initialUser = await prisma.user.create({
    data: {
      username: initialUsername,
      password: await hash(password, 10),
      name: '初始成员',
    },
  })
  const store = await prisma.store.create({
    data: {
      code: storeCode,
      name: '成员刷新测试门店',
      storeAdmins: { create: { userId: initialUser.id } },
    },
  })

  storeId = store.id
  initialUserId = initialUser.id
  initialUserCode = initialUser.code
  adminUserCode = adminUser.code
  adminUserId = adminUser.id
})

test.afterAll(async () => {
  const usernames = [adminUsername, initialUsername, lateUsername, auditedUsername]
  await prisma.approvalLog.deleteMany({ where: { operatedBy: adminUserId } })
  await prisma.authSession.deleteMany({ where: { user: { username: { in: usernames } } } })
  await prisma.storeAdmin.deleteMany({ where: { store: { code: storeCode } } })
  await prisma.store.deleteMany({ where: { code: storeCode } })
  await prisma.userRole.deleteMany({ where: { user: { username: { in: usernames } } } })
  await prisma.user.deleteMany({ where: { username: { in: usernames } } })
  await prisma.$disconnect()
})

test.beforeEach(async ({ page }) => {
  const login = await page.request.post('/api/auth/login', {
    data: { identifier: adminUsername, password },
  })
  expect(login.ok()).toBe(true)
})

test('shows supported roles and human-readable user codes', async ({ page }) => {
  await page.goto('/admin/users')
  await expect(page.getByRole('cell', { name: formatUserCode(initialUserCode) })).toBeVisible()
  await expect(page.getByRole('button', { name: '搜索用户' })).toBeVisible()
  await expect(page.getByRole('button', { name: '收起侧栏' })).toBeVisible()

  await page.getByRole('button', { name: '新增用户' }).click()
  const dialog = page.getByRole('dialog', { name: '新增用户' })
  await dialog.getByRole('combobox', { name: '角色' }).click()

  await expect(
    page.locator('.ant-select-item-option').filter({ hasText: '超级管理员' })
  ).toBeVisible()
  await expect(
    page.locator('.ant-select-item-option').filter({ hasText: '仓库管理员' })
  ).toBeVisible()
  await expect(
    page.locator('.ant-select-item-option').filter({ hasText: '门店管理员' })
  ).toBeVisible()
  await expect(page.locator('.ant-select-item-option').filter({ hasText: '财务' })).toHaveCount(0)
  await expect(page.locator('.ant-select-item-option').filter({ hasText: '审批人' })).toHaveCount(0)

  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: /取\s*消/ }).click()

  await page.goto(`/admin/stores/${storeId}/admins`)
  await expect(page.getByRole('cell', { name: formatUserCode(initialUserCode) })).toBeVisible()
  await expect(page.getByText(initialUserId)).toHaveCount(0)

  await page.getByRole('button', { name: '添加管理员' }).click()
  const addAdminDialog = page.getByRole('dialog', { name: '添加管理员' })
  await addAdminDialog.getByRole('combobox').click()
  await expect(
    page.getByRole('option', {
      name: `${formatUserCode(adminUserCode)} · 用户管理测试管理员`,
    })
  ).toHaveCount(1)
})

test('reloads add-admin candidates on every dialog open', async ({ page }) => {
  await page.goto(`/admin/stores/${storeId}/admins`)

  await page.getByRole('button', { name: '添加管理员' }).click()
  let dialog = page.getByRole('dialog', { name: '添加管理员' })
  await dialog.getByRole('combobox').click()
  await expect(
    page.locator('.ant-select-item-option').filter({ hasText: '用户管理测试管理员' })
  ).toBeVisible()
  await page.keyboard.press('Escape')
  await dialog.getByRole('button', { name: /取\s*消/ }).click()

  const lateUser = await prisma.user.upsert({
    where: { username: lateUsername },
    update: { name: '后来新增成员' },
    create: {
      username: lateUsername,
      password: await hash(password, 10),
      name: '后来新增成员',
    },
  })

  await page.getByRole('button', { name: '添加管理员' }).click()
  dialog = page.getByRole('dialog', { name: '添加管理员' })
  await dialog.getByRole('combobox').click()
  await expect(
    page
      .locator('.ant-select-item-option')
      .filter({ hasText: `${formatUserCode(lateUser.code)} · 后来新增成员` })
  ).toBeVisible()
})

test('records user creation and store authorization in the audit log', async ({ page }) => {
  await page.setExtraHTTPHeaders({ 'x-forwarded-for': '203.0.113.30' })
  await page.goto('/admin/users')
  await page.getByRole('button', { name: '新增用户' }).click()

  const userDialog = page.getByRole('dialog', { name: '新增用户' })
  await userDialog.getByRole('textbox', { name: '登录名' }).fill(auditedUsername)
  await userDialog.getByLabel('密码').fill(password)
  await userDialog.getByRole('textbox', { name: '姓名' }).fill('权限审计成员')
  await userDialog.getByRole('combobox', { name: '角色' }).click()
  await page.locator('.ant-select-item-option').filter({ hasText: '仓库管理员' }).click()
  await page.keyboard.press('Escape')
  await userDialog.getByRole('button', { name: /确\s*定/ }).click()
  await expect(page.getByText('用户创建成功')).toBeVisible()

  const createdUser = await prisma.user.findUniqueOrThrow({
    where: { username: auditedUsername },
  })
  const createLog = await prisma.approvalLog.findFirst({
    where: { entityType: 'USER', entityId: createdUser.id, action: 'USER_CREATE' },
  })
  expect(createLog).toMatchObject({ operatedBy: adminUserId, operatorIp: '203.0.113.30' })

  await page.goto(`/admin/stores/${storeId}/admins`)
  await page.getByRole('button', { name: '添加管理员' }).click()
  const adminDialog = page.getByRole('dialog', { name: '添加管理员' })
  await adminDialog.getByRole('combobox').click()
  await page
    .locator('.ant-select-item-option')
    .filter({ hasText: `${formatUserCode(createdUser.code)} · 权限审计成员` })
    .click()
  await adminDialog.getByRole('button', { name: /确\s*定/ }).click()
  await expect(page.getByText('管理员添加成功')).toBeVisible()

  const addLog = await prisma.approvalLog.findFirst({
    where: {
      entityType: 'STORE',
      entityId: String(storeId),
      action: 'STORE_ADMIN_ADD',
    },
    orderBy: { createdAt: 'desc' },
  })
  expect(addLog).toMatchObject({ operatedBy: adminUserId, operatorIp: '203.0.113.30' })

  await page.goto('/admin/audit-logs')
  await expect(page.getByRole('cell', { name: '创建用户' }).first()).toBeVisible()
  await expect(page.getByRole('cell', { name: '添加门店管理员' }).first()).toBeVisible()
})
