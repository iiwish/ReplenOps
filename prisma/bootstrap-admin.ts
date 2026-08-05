import { PrismaClient } from '@prisma/client'
import { bootstrapAdmin } from './bootstrap-admin-core'

const prisma = new PrismaClient()

bootstrapAdmin(prisma, process.env)
  .then((result) => {
    console.info('Administrator bootstrap completed', {
      username: result.username,
      created: result.created,
    })
  })
  .catch((error: unknown) => {
    console.error('Administrator bootstrap failed', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
