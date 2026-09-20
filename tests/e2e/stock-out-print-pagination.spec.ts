import { hash } from 'bcryptjs'
import { PrismaClient } from '@prisma/client'
import { expect, test } from '@playwright/test'

const prisma = new PrismaClient()
const code = `PRINT-${process.pid}`
const username = `print-${process.pid}`
const password = 'print-e2e-only-password'
let stockOutId: number
let shortStockOutId: number

test.beforeAll(async () => {
  const user = await prisma.user.create({
    data: {
      username,
      password: await hash(password, 10),
      roles: { create: { role: 'SUPER_ADMIN' } },
    },
  })
  const store = await prisma.store.create({ data: { code, name: '打印测试门店' } })
  const warehouse = await prisma.warehouse.create({ data: { code, name: '打印测试仓库' } })
  const category = await prisma.goodsCategory.create({ data: { code, name: '打印测试分类' } })
  const items = []
  for (let index = 1; index <= 120; index += 1) {
    const goods = await prisma.goods.create({
      data: {
        code: `${code}-${index}`,
        name: index % 7 === 0 ? '长名称测试商品'.repeat(4) : `打印商品${index}`,
        categoryId: category.id,
        unit: '袋',
      },
    })
    items.push({
      goodsId: goods.id,
      goodsCodeSnapshot: `P${String(index).padStart(3, '0')}`,
      goodsNameSnapshot: goods.name,
      categoryNameSnapshot: index % 2 === 0 ? '饼干' : '饮料',
      goodsSpecSnapshot: index % 7 === 0 ? '1000克/袋，独立包装' : '/',
      goodsUnitSnapshot: '袋',
      quantity: 1,
      snapshotCost: 1,
      salePrice: 2,
      profit: 1,
    })
  }
  for (const count of [120, 18]) {
    const documentCode = count === 120 ? code : `${code}-short`
    const order = await prisma.order.create({
      data: {
        code: documentCode,
        storeId: store.id,
        createdBy: user.id,
        status: 'COMPLETED',
        totalAmount: count * 2,
        remark: '这是用于验证长备注自动换行与打印分页的测试订单。'.repeat(5),
      },
    })
    const stockOut = await prisma.stockOut.create({
      data: {
        code: documentCode,
        orderId: order.id,
        warehouseId: warehouse.id,
        createdBy: user.id,
        status: 'COMPLETED',
        completedAt: new Date(),
        items: { create: items.slice(0, count) },
      },
    })
    if (count === 120) stockOutId = stockOut.id
    else shortStockOutId = stockOut.id
  }
})

test.afterAll(async () => {
  await prisma.stockOut.deleteMany({ where: { code: { in: [code, `${code}-short`] } } })
  await prisma.order.deleteMany({ where: { code: { in: [code, `${code}-short`] } } })
  await prisma.goods.deleteMany({ where: { category: { code } } })
  await prisma.goodsCategory.deleteMany({ where: { code } })
  await prisma.store.deleteMany({ where: { code } })
  await prisma.warehouse.deleteMany({ where: { code } })
  await prisma.authSession.deleteMany({ where: { user: { username } } })
  await prisma.userRole.deleteMany({ where: { user: { username } } })
  await prisma.user.deleteMany({ where: { username } })
  await prisma.$disconnect()
})

for (const mode of ['page', 'modal'] as const) {
  test(`prints all rows with one final total from ${mode}`, async ({ page }, info) => {
    test.setTimeout(60000)
    expect(
      (
        await page.request.post('/api/auth/login', { data: { identifier: username, password } })
      ).ok()
    ).toBe(true)
    await page.goto(`/admin/stock-out/${stockOutId}${mode === 'page' ? '/print' : ''}`)
    if (mode === 'modal') await page.getByRole('button', { name: /打印出库单/ }).click()
    const content = page.locator('.stock-out-print-page')
    await expect(content.getByText('P120', { exact: true })).toBeVisible()
    await expect(content.getByRole('columnheader', { name: '分类', exact: true })).toBeVisible()
    const rows = content.locator('tbody tr:not(.stock-out-print-total)')
    await expect(rows.first().locator('td').nth(2)).toHaveText('P002')
    expect(await rows.locator('td:nth-child(2)').allTextContents()).toEqual([
      ...Array<string>(60).fill('饼干'),
      ...Array<string>(60).fill('饮料'),
    ])
    expect(await rows.locator('td:nth-child(3)').allTextContents()).toEqual(
      expect.arrayContaining(['P002', 'P010', 'P120'])
    )
    await expect(content.locator('.stock-out-print-total td').first()).toHaveAttribute(
      'colspan',
      '6'
    )
    await page.setViewportSize({ width: 600, height: 900 })
    // Translation extensions can append an empty inline popup outside body.
    await page.evaluate(() => {
      const popup = document.createElement('div')
      popup.id = 'print-extension-popup'
      popup.style.display = 'inline'
      document.documentElement.append(popup)
    })
    await page.emulateMedia({ media: 'print' })
    await expect(page.locator('#print-extension-popup')).toHaveCSS('display', 'none')
    await page.evaluate(() => document.fonts.ready)
    await expect(page.locator('body')).toHaveCSS('page', 'stock-out')
    const printRules = await page.evaluate(() =>
      Array.from(document.styleSheets)
        .flatMap((sheet) => Array.from(sheet.cssRules, (rule) => rule.cssText))
        .join('\n')
    )
    expect(printRules).toContain('@page stock-out')
    expect(printRules).toContain('@bottom-center')
    expect(printRules).toContain('counter(page)')
    expect(printRules).toContain('counter(pages)')
    await expect(content.locator('.stock-out-print-heading')).toHaveCSS('display', 'none')
    await expect(content.locator('.stock-out-print-heading')).toContainText(code)
    // Ant Layout's flex-child width must not collapse after switching to print blocks.
    expect((await content.boundingBox())!.width).toBeGreaterThan(700)
    expect((await content.boundingBox())!.width).toBeLessThan(705)
    expect((await content.locator('tbody tr').first().boundingBox())!.height).toBeLessThanOrEqual(
      26
    )
    await expect(content.locator('.stock-out-print-info')).not.toContainText('出库备注：-')
    if (mode === 'modal') {
      await expect(page.locator('.stock-out-print-modal')).toHaveCSS('opacity', '1')
      await expect(page.locator('.stock-out-print-modal .ant-modal-container')).toHaveCSS(
        'padding',
        '0px'
      )
      await expect(page.locator('.stock-out-print-modal .ant-modal-body')).toHaveCSS(
        'max-height',
        'none'
      )
    }
    await page.pdf({
      path: info.outputPath(`${mode}.pdf`),
      preferCSSPageSize: true,
      printBackground: true,
    })
    // The last section must leave room for both the total and the signature area.
    const finalPageHeight = await content.evaluate((element) => {
      const outerHeight = (node: Element | null) => {
        if (!node) return 0
        const style = getComputedStyle(node)
        return (
          node.getBoundingClientRect().height +
          (Number.parseFloat(style.marginTop) || 0) +
          (Number.parseFloat(style.marginBottom) || 0)
        )
      }
      const sections = element.querySelectorAll('tbody')
      return (
        outerHeight(sections[sections.length - 1] ?? null) +
        outerHeight(element.querySelector('thead')) +
        outerHeight(element.querySelector('.stock-out-print-signatures')) +
        (sections.length === 1 ? outerHeight(element.querySelector('.stock-out-print-info')) : 0)
      )
    })
    expect(finalPageHeight).toBeLessThanOrEqual((262 * 96) / 25.4)
    await expect(content.locator('tfoot')).toHaveCount(0)
    await expect(content.getByText('合计', { exact: true })).toHaveCount(1)
    await expect(content.locator('tbody tr')).toHaveCount(121)
    expect(await content.locator('thead').evaluate((el) => getComputedStyle(el).display)).toBe(
      'table-header-group'
    )
    await page.emulateMedia({ media: 'screen' })
    await expect(page.locator('#print-extension-popup')).toHaveCSS('display', 'inline')
    await page.goto(`/admin/stock-out/${shortStockOutId}${mode === 'page' ? '/print' : ''}`)
    if (mode === 'modal') await page.getByRole('button', { name: /打印出库单/ }).click()
    await expect(content.locator('tbody tr')).toHaveCount(19)
    await expect(page.locator('html')).toHaveAttribute('data-print-margin-boxes', 'true')
    await page.emulateMedia({ media: 'print' })
    await expect(content.locator('.stock-out-print-heading')).toHaveCSS('display', 'none')
    await page.pdf({
      path: info.outputPath(`${mode}-short.pdf`),
      preferCSSPageSize: true,
      printBackground: true,
    })
    await expect(content.locator('tbody')).toHaveCount(1)
    // Browsers without margin boxes must retain the original first-page heading.
    await page.evaluate(() => {
      document.documentElement.dataset.printMarginBoxes = 'false'
    })
    await expect(content.locator('.stock-out-print-heading')).toBeVisible()
    await page.emulateMedia({ media: 'screen' })
  })
}
