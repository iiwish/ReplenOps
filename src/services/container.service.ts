import { prisma } from '@/lib/prisma'
import { Prisma } from '@prisma/client'

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

  async delete(id: string) {
    const container = await this.findById(id)
    if (!container) {
      throw new Error('包装物不存在')
    }

    const numericId = Number.parseInt(id, 10)

    await prisma.container.update({
      where: { id: numericId },
      data: { isDeleted: true },
    })
  }
}

export const containerService = new ContainerService()
