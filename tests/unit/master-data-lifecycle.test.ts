import { describe, expect, it } from 'vitest'

import { archivedCodeError, restorationData, softDeletionData } from '@/lib/master-data-lifecycle'

describe('master data lifecycle', () => {
  it('records who deleted a master record and why', () => {
    const deletedAt = new Date('2026-08-08T10:00:00.000Z')

    expect(softDeletionData('user-1', '重复商品', deletedAt)).toEqual({
      isDeleted: true,
      isActive: false,
      deletedAt,
      deletedBy: 'user-1',
      deleteReason: '重复商品',
    })
  })

  it('restores the same identity in a disabled state', () => {
    expect(restorationData()).toEqual({
      isDeleted: false,
      isActive: false,
      deletedAt: null,
      deletedBy: null,
      deleteReason: null,
    })
  })

  it('distinguishes an archived code from an active duplicate', () => {
    expect(archivedCodeError('商品', true)).toBe('商品编码已归档，请恢复原记录')
    expect(archivedCodeError('商品', false)).toBe('商品编码已存在')
  })
})
