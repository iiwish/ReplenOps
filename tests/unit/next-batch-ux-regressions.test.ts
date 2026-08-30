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
    expect(detailPage).toContain('bottom-[calc(4rem+env(safe-area-inset-bottom))]')
    expect(listPage).toContain('placeholder="更多状态"')
    expect(listPage).toContain('待出库')
    expect(listPage).not.toContain('待发货')
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

  it('blocks self-disable and keeps destructive user operations in a menu', () => {
    const actions = readSource('src/actions/user-actions.ts')
    const userList = readSource('src/app/admin/users/UserListClient.tsx')

    expect(actions).toContain("return { success: false, error: '不能禁用自己的账号' }")
    expect(userList).toContain('<Dropdown menu={{ items: menuItems }}')
    expect(userList).toContain("title: '确认禁用用户？'")
    expect(userList).toContain('disabled: loading || isCurrentUser')
  })
})
