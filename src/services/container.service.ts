import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import {
  archivedCodeError,
  masterAuditSnapshot,
  restorationData,
  softDeletionData,
} from '@/lib/master-data-lifecycle'
import { getNextContainerCode } from '@/lib/container-code-policy'

export interface ContainerGoodsBindingInput {
  goodsId: string
  goodsQuantityPerContainer: number
}

export interface CreateContainerDto {
  code: string
  name: string
  unit: string
  deposit: number
  remark?: string
  goodsBindings?: ContainerGoodsBindingInput[]
}

export interface UpdateContainerDto {
  name?: string
  unit?: string
  deposit?: number
  remark?: string
  isActive?: boolean
  goodsBindings?: ContainerGoodsBindingInput[]
}

export interface ContainerGoodsBindingRecord {
  goodsId: string
  goodsCode: string
  goodsName: string
  goodsUnit: string
  goodsQuantityPerContainer: number
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
  goodsBindings: ContainerGoodsBindingRecord[]
  createdAt: string
  updatedAt: string
}

export interface BindableGoodsRecord {
  id: string
  code: string
  name: string
  unit: string
}

const containerInclude = {
  goodsBindings: {
    include: {
      goods: { select: { id: true, code: true, name: true, unit: true } },
    },
    orderBy: { id: 'asc' as const },
  },
}

type ContainerModel = Prisma.ContainerGetPayload<{ include: typeof containerInclude }>

class ContainerService {
  async getNextCode(): Promise<string> {
    const containerCodes = await prisma.container.findMany({ select: { code: true } })
    return getNextContainerCode(containerCodes.map((container) => container.code))
  }

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
      goodsBindings: container.goodsBindings.map((binding) => ({
        goodsId: String(binding.goodsId),
        goodsCode: binding.goods.code,
        goodsName: binding.goods.name,
        goodsUnit: binding.goods.unit,
        goodsQuantityPerContainer: Number(binding.goodsQuantityPerContainer),
      })),
      createdAt: container.createdAt.toISOString(),
      updatedAt: container.updatedAt.toISOString(),
    }
  }

  private async validateBindings(
    bindings: ContainerGoodsBindingInput[],
    client: Prisma.TransactionClient | typeof prisma
  ): Promise<Array<{ goodsId: number; goodsQuantityPerContainer: number }>> {
    const parsed = bindings.map((binding) => ({
      goodsId: Number.parseInt(binding.goodsId, 10),
      goodsQuantityPerContainer: binding.goodsQuantityPerContainer,
    }))

    if (parsed.some((binding) => !Number.isInteger(binding.goodsId))) {
      throw new Error('关联商品不存在')
    }
    if (
      parsed.some(
        (binding) =>
          !Number.isFinite(binding.goodsQuantityPerContainer) ||
          binding.goodsQuantityPerContainer <= 0 ||
          Math.abs(
            Math.round(binding.goodsQuantityPerContainer * 1000) -
              binding.goodsQuantityPerContainer * 1000
          ) > 1e-9
      )
    ) {
      throw new Error('每个包装物的商品数量必须大于0，且最多保留3位小数')
    }

    const goodsIds = parsed.map((binding) => binding.goodsId)
    if (new Set(goodsIds).size !== goodsIds.length) {
      throw new Error('同一包装物不能重复关联同一商品')
    }

    if (goodsIds.length > 0) {
      const activeGoodsCount = await client.goods.count({
        where: { id: { in: goodsIds }, isActive: true, isDeleted: false },
      })
      if (activeGoodsCount !== goodsIds.length) {
        throw new Error('关联商品不存在或已停用')
      }
    }

    return parsed
  }

  async list(includeDeleted = false): Promise<ContainerRecord[]> {
    const containers = await prisma.container.findMany({
      where: includeDeleted ? {} : { isDeleted: false },
      include: containerInclude,
      orderBy: { createdAt: 'desc' },
    })

    return containers.map((container) => this.toContainerRecord(container))
  }

  async listBindableGoods(): Promise<BindableGoodsRecord[]> {
    const goods = await prisma.goods.findMany({
      where: { isActive: true, isDeleted: false },
      select: { id: true, code: true, name: true, unit: true },
      orderBy: [{ code: 'asc' }, { id: 'asc' }],
    })

    return goods.map((item) => ({ ...item, id: String(item.id) }))
  }

  async findById(id: string): Promise<ContainerRecord | null> {
    const numericId = Number.parseInt(id, 10)
    const container = await prisma.container.findFirst({
      where: { id: numericId, isDeleted: false },
      include: containerInclude,
    })

    return container ? this.toContainerRecord(container) : null
  }

  async create(data: CreateContainerDto): Promise<ContainerRecord> {
    const existing = await prisma.container.findUnique({ where: { code: data.code } })
    if (existing) {
      throw new Error(archivedCodeError('包装物', existing.isDeleted))
    }

    return prisma.$transaction(async (tx) => {
      const bindings = await this.validateBindings(data.goodsBindings ?? [], tx)
      const container = await tx.container.create({
        data: {
          code: data.code,
          name: data.name,
          unit: data.unit,
          deposit: data.deposit,
          remark: data.remark,
          goodsBindings: { create: bindings },
        },
        include: containerInclude,
      })

      return this.toContainerRecord(container)
    })
  }

  async update(id: string, data: UpdateContainerDto): Promise<ContainerRecord> {
    const container = await this.findById(id)
    if (!container) {
      throw new Error('包装物不存在')
    }

    const numericId = Number.parseInt(id, 10)
    return prisma.$transaction(async (tx) => {
      const bindings =
        data.goodsBindings === undefined
          ? undefined
          : await this.validateBindings(data.goodsBindings, tx)

      if (bindings !== undefined) {
        await tx.containerGoodsBinding.deleteMany({ where: { containerId: numericId } })
      }

      const updatedContainer = await tx.container.update({
        where: { id: numericId },
        data: {
          name: data.name,
          unit: data.unit,
          deposit: data.deposit,
          remark: data.remark,
          isActive: data.isActive,
          ...(bindings === undefined ? {} : { goodsBindings: { create: bindings } }),
        },
        include: containerInclude,
      })

      return this.toContainerRecord(updatedContainer)
    })
  }

  async delete(id: string, operatedBy = 'system', reason = '管理员删除') {
    const container = await this.findById(id)
    if (!container) {
      throw new Error('包装物不存在')
    }

    const numericId = Number.parseInt(id, 10)
    const [goodsCount, borrowedTrackingCount] = await prisma.$transaction([
      prisma.containerGoodsBinding.count({
        where: { containerId: numericId, goods: { isDeleted: false } },
      }),
      prisma.containerTracking.count({
        where: {
          containerId: numericId,
          isDeleted: false,
          OR: [{ currentBorrowed: { not: 0 } }, { pendingReturnQuantity: { not: 0 } }],
        },
      }),
    ])

    if (goodsCount > 0) {
      throw new Error('该包装物仍有关联商品，无法删除')
    }
    if (borrowedTrackingCount > 0) {
      throw new Error('该包装物仍有在外或待验收数量，无法删除')
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
        include: containerInclude,
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
