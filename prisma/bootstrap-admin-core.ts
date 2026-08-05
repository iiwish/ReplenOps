import { hash } from 'bcryptjs'
import { Prisma, type PrismaClient } from '@prisma/client'
import { resolveDefaultAdminConfig, type SeedEnvironment } from './seed-config'

export interface AdminBootstrapResult {
  created: boolean
  userId: string
  username: string
}

export async function bootstrapAdmin(
  prisma: PrismaClient,
  env: SeedEnvironment
): Promise<AdminBootstrapResult> {
  const admin = resolveDefaultAdminConfig(env)
  const existing = await prisma.user.findUnique({
    where: { username: admin.username },
    select: { id: true, username: true },
  })

  if (existing) {
    return { created: false, userId: existing.id, username: existing.username }
  }

  try {
    const user = await prisma.user.create({
      data: {
        username: admin.username,
        password: await hash(admin.password, 12),
        name: '系统管理员',
        roles: { create: { role: 'SUPER_ADMIN' } },
      },
      select: { id: true, username: true },
    })

    return { created: true, userId: user.id, username: user.username }
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const user = await prisma.user.findUniqueOrThrow({
        where: { username: admin.username },
        select: { id: true, username: true },
      })
      return { created: false, userId: user.id, username: user.username }
    }

    throw error
  }
}
