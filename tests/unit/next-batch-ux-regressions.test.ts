import { readFileSync } from 'node:fs'
import { UserRoleEnum } from '@prisma/client'
import { describe, expect, it } from 'vitest'
import { formatGoodsQuantity } from '@/lib/quantity'
import { violatesActiveSuperAdminContinuity } from '@/services/user.service'
import {
  DEFAULT_ORDERING_SCHEDULES,
  orderingScheduleBatchSchema,
} from '@/types/ordering-schedule.types'

const readSource = (path: string) => readFileSync(new URL(`../../${path}`, import.meta.url), 'utf8')

describe('next-batch UX regression guards', () => {
  it('formats integer and decimal goods quantities without padded zeroes', () => {
    expect(formatGoodsQuantity(2, 'INT')).toBe('2')
    expect(formatGoodsQuantity(2, 'DECIMAL')).toBe('2')
    expect(formatGoodsQuantity(2.3456, 'DECIMAL')).toBe('2.346')
  })

  it('validates a complete weekly ordering schedule and rejects reversed windows', () => {
    expect(orderingScheduleBatchSchema.safeParse(DEFAULT_ORDERING_SCHEDULES).success).toBe(true)

    const invalidSchedules = DEFAULT_ORDERING_SCHEDULES.map((schedule) =>
      schedule.dayOfWeek === 1 ? { ...schedule, startTime: '18:30', endTime: '07:30' } : schedule
    )
    const result = orderingScheduleBatchSchema.safeParse(invalidSchedules)

    expect(result.success).toBe(false)
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe('结束时间必须晚于开始时间')
    }
  })

  it('protects the final active super administrator while allowing safe changes', () => {
    const base = {
      currentIsActive: true,
      currentIsDeleted: false,
      currentRoles: [UserRoleEnum.SUPER_ADMIN],
    }

    expect(
      violatesActiveSuperAdminContinuity({
        ...base,
        nextIsActive: false,
        alternativeActiveSuperAdmins: 0,
      })
    ).toBe(true)
    expect(
      violatesActiveSuperAdminContinuity({
        ...base,
        nextRoles: [UserRoleEnum.STORE_ADMIN],
        alternativeActiveSuperAdmins: 1,
      })
    ).toBe(false)
    expect(
      violatesActiveSuperAdminContinuity({
        ...base,
        nextIsActive: true,
        alternativeActiveSuperAdmins: 0,
      })
    ).toBe(false)
  })

  it('keeps mobile order navigation singular and exposes terminal status filters', () => {
    const detailPage = readSource('src/app/mobile/orders/[id]/page.tsx')
    const listPage = readSource('src/app/mobile/orders/OrdersClientPage.tsx')

    expect(detailPage).not.toContain('ArrowLeft')
    expect(detailPage).toContain('formatGoodsQuantity')
    expect(detailPage).toContain('fixed bottom-[var(--mobile-tab-bar-height)]')
    expect(listPage).toContain('placeholder="更多状态"')
    expect(listPage).toContain('待出库')
    expect(listPage).not.toContain('待发货')
  })

  it('counts rejected orders in the mobile pending-order metric', () => {
    const dashboardService = readSource('src/services/dashboard.service.ts')

    expect(dashboardService).toContain(
      "const PENDING_ORDER_STATUSES: OrderStatus[] = ['PENDING', 'APPROVED', 'PROCESSING', 'REJECTED']"
    )
    expect(dashboardService).toContain('status: { in: PENDING_ORDER_STATUSES }')
  })

  it('saves schedules as one batch and warns about unsaved navigation', () => {
    const editor = readSource('src/components/admin/ScheduleEditor.tsx')
    const unsavedChangesHook = readSource('src/hooks/use-unsaved-changes-warning.ts')
    const service = readSource('src/services/ordering-schedule.service.ts')

    expect(editor).toContain('saveOrderingSchedule(validationResult.data)')
    expect(editor).toContain('useUnsavedChangesWarning(isDirty')
    expect(unsavedChangesHook).toContain("window.addEventListener('beforeunload'")
    expect(editor).toContain("title: '恢复默认报货时间？'")
    expect(service).toContain('return prisma.$transaction(')
    expect(service).toContain('schedules.map((schedule) =>')
  })

  it('keeps system branding and ordering schedule as sibling settings', () => {
    const menu = readSource('src/config/menuConfig.tsx')
    const systemPage = readSource('src/app/admin/system-config/page.tsx')
    const schedulePage = readSource('src/app/admin/system-config/ordering-schedule/page.tsx')
    const brandEditor = readSource('src/components/admin/SystemBrandEditor.tsx')
    const action = readSource('src/actions/system-config-actions.ts')

    expect(menu).toContain("label: '系统配置'")
    expect(menu).toContain("label: '报货时间'")
    expect(menu).not.toContain("key: 'system-general'")
    expect(systemPage).toContain('SystemBrandEditor')
    expect(schedulePage).toContain("requirePageAccess('/admin/system-config/ordering-schedule')")
    expect(brandEditor).toContain('系统名称')
    expect(brandEditor).toContain('系统 Logo')
    expect(brandEditor).toContain('更换 Logo')
    expect(action).toContain("requireActionPermission('system:manage')")
  })

  it('blocks self-disable and keeps destructive user operations in a menu', () => {
    const actions = readSource('src/actions/user-actions.ts')
    const userList = readSource('src/app/admin/users/UserListClient.tsx')

    expect(actions).toContain("return { success: false, error: '不能禁用自己的账号' }")
    expect(userList).toContain('<Dropdown menu={{ items: menuItems }}')
    expect(userList).toContain("title: '确认禁用用户？'")
    expect(userList).toContain('disabled: loading || isCurrentUser')
  })

  it('keeps order outbound actions and mobile refresh/input behavior aligned', () => {
    const orderList = readSource('src/app/admin/orders/OrderListClient.tsx')
    const adminLayout = readSource('src/components/admin/AdminLayoutClient.tsx')
    const orderService = readSource('src/services/order.service.ts')
    const stockOutService = readSource('src/services/stock-out.service.ts')
    const mobileLayout = readSource('src/components/mobile/MobileLayoutClient.tsx')
    const mobileReturnForm = readSource('src/components/mobile/ContainerReturnForm.tsx')

    expect(orderList).toContain('tooltip="确认出库"')
    expect(orderList).toContain('OrderStockOutModal')
    expect(orderList).toContain('AdminOrderCreateModal')
    expect(orderList).toContain('新建订单')
    expect(orderList).not.toContain('月度出库报表')
    expect(orderList).toContain('min-h-0 min-w-0 flex-1 overflow-auto')
    expect(orderList).toContain('pagination={false}')
    expect(orderList).toContain('<Pagination')
    expect(orderList).toContain('showSizeChanger')
    expect(orderList).toContain("pageSizeOptions={['10', '20', '50', '100']}")
    expect(adminLayout).toContain("const isOrdersPage = targetPathname === '/admin/orders'")
    expect(adminLayout).toContain("padding: '12px 24px 8px'")
    expect(orderList).not.toContain('deleteOrder')
    expect(orderService).toContain("if (order.status !== 'REJECTED')")
    expect(orderService).toContain('只能删除已拒绝的订单')
    expect(adminLayout).not.toContain('Layout.Footer')
    expect(stockOutService).toContain("status: { in: ['PENDING', 'PROCESSING'] }")
    expect(stockOutService).toContain("status: 'APPROVED'")
    expect(mobileLayout).toContain('onTouchStart={handleTouchStart}')
    expect(mobileLayout).toContain('window.location.reload()')
    expect(mobileReturnForm).toContain('selectedContainerIds')
    expect(mobileReturnForm).toContain('value={isSelected && quantity > 0 ? quantity : undefined}')
  })
})
