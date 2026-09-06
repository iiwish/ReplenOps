import { prisma } from '@/lib/prisma'
import { brand, type BrandIdentity } from '@/config/brand'

const SYSTEM_CONFIG_ID = 1

export async function getSystemConfig(): Promise<BrandIdentity> {
  // The standalone image is built without runtime database credentials.
  if (!process.env.DATABASE_URL) {
    return { name: brand.name, logoPath: brand.logoPath }
  }

  try {
    const config = await prisma.systemConfig.findUnique({
      where: { id: SYSTEM_CONFIG_ID },
      select: { name: true, logoPath: true },
    })

    return {
      name: config?.name || brand.name,
      logoPath: config?.logoPath || brand.logoPath,
    }
  } catch {
    return { name: brand.name, logoPath: brand.logoPath }
  }
}

export async function updateSystemConfig(input: BrandIdentity): Promise<BrandIdentity> {
  const config = await prisma.systemConfig.upsert({
    where: { id: SYSTEM_CONFIG_ID },
    update: {
      name: input.name,
      logoPath: input.logoPath,
    },
    create: {
      id: SYSTEM_CONFIG_ID,
      name: input.name,
      logoPath: input.logoPath,
    },
    select: { name: true, logoPath: true },
  })

  return config
}

export const systemConfigService = {
  get: getSystemConfig,
  update: updateSystemConfig,
}
