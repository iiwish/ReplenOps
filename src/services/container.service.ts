import { prisma } from '@/lib/prisma'

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

class ContainerService {
  async list(includeDeleted = false) {
    return await prisma.container.findMany({
      where: includeDeleted ? {} : { isDeleted: false },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string) {
    const numericId = Number.parseInt(id, 10)

    return await prisma.container.findFirst({
      where: { id: numericId, isDeleted: false },
    })
  }

  async create(data: CreateContainerDto) {
    return await prisma.container.create({
      data: {
        code: data.code,
        name: data.name,
        unit: data.unit,
        deposit: data.deposit,
        remark: data.remark,
      },
    })
  }

  async update(id: string, data: UpdateContainerDto) {
    const container = await this.findById(id)
    if (!container) {
      throw new Error('包装物不存在')
    }

    const numericId = Number.parseInt(id, 10)

    return await prisma.container.update({
      where: { id: numericId },
      data: {
        name: data.name,
        unit: data.unit,
        deposit: data.deposit,
        remark: data.remark,
        isActive: data.isActive,
      },
    })
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
