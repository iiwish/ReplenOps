import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function main() {
  const schedules = Array.from({ length: 7 }, (_, index) => ({
    dayOfWeek: index + 1,
    startTime: '07:30',
    endTime: '18:30',
    isActive: index < 6,
  }))

  await prisma.$transaction(
    schedules.map((schedule) =>
      prisma.orderingSchedule.upsert({
        where: { dayOfWeek: schedule.dayOfWeek },
        update: schedule,
        create: schedule,
      })
    )
  )

  console.info('Reference data seed completed')
}

main()
  .catch((error: unknown) => {
    console.error('Reference data seed failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
