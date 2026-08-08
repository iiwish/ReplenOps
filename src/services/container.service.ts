import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'
import {
  archivedCodeError,
  masterAuditSnapshot,
  restorationData,
  softDeletionData,
} from '@/lib/master-data-lifecycle'

export interface CreateContainerDto {
  code: string
  name: string
  unit: string
  deposit: number
  remark?: string
}

export interface UpdateContainerDto {
  name?: string
  unit?: string
  deposit?: number
  remark?: string
  isActive?: boolean
}

export interface ContainerRecord {
  id: string
  code: string
  name: string
  unit: string
  deposit: number
  remark: string | null
  isActive: boolean
  isDeleted: boolean
  createdAt: string
  updatedAt: string
}

type ContainerModel = {
  id: number
  code: string
  name: string
  unit: string
  deposit: Prisma.Decimal | number
  remark: string | null
  isActive: boolean
  isDeleted: boolean
  createdAt: Date
  updatedAt: Date
}

class ContainerService {
  private toContainerRecord(container: ContainerModel): ContainerRecord {
    return {
      id: String(container.id),
      code: container.code,
      name: container.name,
      unit: container.unit,
      deposit: Number(container.deposit),
      remark: container.remark,
      isActive: container.isActive,
      isDeleted: container.isDeleted,
      createdAt: container.createdAt.toISOString(),
      updatedAt: container.updatedAt.toISOString(),
    }
  }

  async list(includeDeleted = false): Promise<ContainerRecord[]> {
    const containers = await prisma.container.findMany({
      where: includeDeleted ? {} : { isDeleted: false },
      orderBy: { createdAt: 'desc' },
    })

    return containers.map((container) => this.toContainerRecord(container))
  }

  async findById(id: string): Promise<ContainerRecord | null> {
    const numericId = Number.parseInt(id, 10)

    const container = await prisma.container.findFirst({
      where: { id: numericId, isDeleted: false },
    })

    return container ? this.toContainerRecord(container) : null
  }

  async create(data: CreateContainerDto): Promise<ContainerRecord> {
    const existing = await prisma.container.findUnique({ where: { code: data.code } })
    if (existing) {
      throw new Error(archivedCodeError('包装物', existing.isDeleted))
    }

    const container = await prisma.container.create({
      data: {
        code: data.code,
        name: data.name,
        unit: data.unit,
        deposit: data.deposit,
        remark: data.remark,
      },
    })

    return this.toContainerRecord(container)
  }

  async update(id: string, data: UpdateContainerDto): Promise<ContainerRecord> {
    const container = await this.findById(id)
    if (!container) {
      throw new Error('包装物不存在')
    }

    const numericId = Number.parseInt(id, 10)

    const updatedContainer = await prisma.container.update({
      where: { id: numericId },
      data: {
        name: data.name,
        unit: data.unit,
        deposit: data.deposit,
        remark: data.remark,
        isActive: data.isActive,
      },
    })

    return this.toContainerRecord(updatedContainer)
  }

  async delete(id: string, operatedBy = 'system', reason = '管理员删除') {
    const container = await this.findById(id)
    if (!container) {
      throw new Error('包装物不存在')
    }

    const numericId = Number.parseInt(id, 10)

    const [goodsCount, borrowedTrackingCount] = await prisma.$transaction([
      prisma.goods.count({ where: { containerId: numericId, isDeleted: false } }),
      prisma.containerTracking.count({
        where: { containerId: numericId, isDeleted: false, currentBorrowed: { not: 0 } },
      }),
    ])

    if (goodsCount > 0) {
      throw new Error('该包装物仍被活动商品使用，无法删除')
    }
    if (borrowedTrackingCount > 0) {
      throw new Error('该包装物仍有未归还余额，无法删除')
    }

    await prisma.$transaction(async (tx) => {
      const deleted = await tx.container.update({
        where: { id: numericId },
        data: softDeletionData(operatedBy, reason),
      })
      await tx.containerTracking.updateMany({
        where: { containerId: numericId, isDeleted: false },
        data: { isDeleted: true },
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'CONTAINER',
          entityId: String(numericId),
          action: 'CONTAINER_DELETE',
          reason,
          beforeJson: masterAuditSnapshot(container),
          afterJson: masterAuditSnapshot(deleted),
          operatedBy,
        },
      })
    })
  }

  async restore(id: string, operatedBy = 'system', reason = '恢复归档包装物') {
    const numericId = Number.parseInt(id, 10)
    const existing = await prisma.container.findUnique({ where: { id: numericId } })
    if (!existing || !existing.isDeleted) {
      throw new Error('归档包装物不存在')
    }

    const restored = await prisma.$transaction(async (tx) => {
      const updated = await tx.container.update({
        where: { id: numericId },
        data: restorationData(),
      })
      await tx.approvalLog.create({
        data: {
          entityType: 'CONTAINER',
          entityId: String(numericId),
          action: 'CONTAINER_RESTORE',
          reason,
          beforeJson: masterAuditSnapshot(existing),
          afterJson: masterAuditSnapshot(updated),
          operatedBy,
        },
      })
      return updated
    })

    return this.toContainerRecord(restored)
  }
}

export const containerService = new ContainerService()
