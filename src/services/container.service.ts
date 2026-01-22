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
    return await prisma.container.findUnique({
      where: { id, isDeleted: false },
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

    return await prisma.container.update({
      where: { id },
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

    await prisma.container.update({
      where: { id },
      data: { isDeleted: true },
    })
  }
}

export const containerService = new ContainerService()
