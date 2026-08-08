import type { Prisma } from '@prisma/client'

export interface MasterDataLifecycleUpdate {
  isDeleted: boolean
  isActive: boolean
  deletedAt: Date | null
  deletedBy: string | null
  deleteReason: string | null
}

export function softDeletionData(
  operatedBy: string,
  reason = '管理员删除',
  deletedAt = new Date()
): MasterDataLifecycleUpdate {
  return {
    isDeleted: true,
    isActive: false,
    deletedAt,
    deletedBy: operatedBy,
    deleteReason: reason,
  }
}

export function restorationData(): MasterDataLifecycleUpdate {
  return {
    isDeleted: false,
    isActive: false,
    deletedAt: null,
    deletedBy: null,
    deleteReason: null,
  }
}

export function archivedCodeError(entityName: string, isDeleted: boolean): string {
  return isDeleted ? `${entityName}编码已归档，请恢复原记录` : `${entityName}编码已存在`
}

export function masterAuditSnapshot(record: {
  id: number | string
  code: string
  name: string
  isActive: boolean
  isDeleted: boolean
  deletedAt?: Date | null
  deletedBy?: string | null
  deleteReason?: string | null
}): Prisma.InputJsonObject {
  return {
    id: record.id,
    code: record.code,
    name: record.name,
    isActive: record.isActive,
    isDeleted: record.isDeleted,
    deletedAt: record.deletedAt?.toISOString() ?? null,
    deletedBy: record.deletedBy ?? null,
    deleteReason: record.deleteReason ?? null,
  }
}
