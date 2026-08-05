import { PrismaClient } from '@prisma/client'
import { hash } from 'bcryptjs'
import { resolveDefaultAdminConfig } from './seed-config'

const prisma = new PrismaClient()

async function main() {
  const admin = resolveDefaultAdminConfig(process.env)
  const passwordHash = await hash(admin.password, 12)
  const schedules = Array.from({ length: 7 }, (_, index) => ({
    dayOfWeek: index + 1,
    startTime: '07:30',
    endTime: '18:30',
    isActive: index < 6,
  }))

  await prisma.$transaction(async (tx) => {
    const user = await tx.user.upsert({
      where: { username: admin.username },
      update: {
        password: passwordHash,
        isActive: true,
        isDeleted: false,
      },
      create: {
        username: admin.username,
        password: passwordHash,
        name: '系统管理员',
      },
    })

    await tx.userRole.upsert({
      where: {
        userId_role: {
          userId: user.id,
          role: 'SUPER_ADMIN',
        },
      },
      update: {},
      create: {
        userId: user.id,
        role: 'SUPER_ADMIN',
      },
    })

    for (const schedule of schedules) {
      await tx.orderingSchedule.upsert({
        where: { dayOfWeek: schedule.dayOfWeek },
        update: schedule,
        create: schedule,
      })
    }
  })

  console.info('Seed completed', admin.logSafeSummary)
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
