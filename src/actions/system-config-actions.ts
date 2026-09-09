'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { brand, type BrandIdentity } from '@/config/brand'
import { requireActionPermission } from '@/lib/action-permissions'
import { systemConfigService } from '@/services/system-config.service'

const MAX_LOGO_BYTES = 512 * 1024
const DATA_LOGO_PATTERN = /^data:image\/(?:png|jpeg|webp|gif);base64,([A-Za-z0-9+/]+={0,2})$/

function isAllowedLogoSource(value: string): boolean {
  if (value === brand.logoPath) return true

  const dataLogoMatch = DATA_LOGO_PATTERN.exec(value)
  if (!dataLogoMatch) return false

  const encoded = dataLogoMatch[1]
  if (!encoded) return false

  return Buffer.from(encoded, 'base64').byteLength <= MAX_LOGO_BYTES
}

const systemConfigSchema = z.object({
  name: z.string().trim().min(1, '系统名称不能为空').max(80, '系统名称最多80个字符'),
  logoPath: z
    .string()
    .min(1, '请上传系统 Logo')
    .refine(isAllowedLogoSource, 'Logo 仅支持 PNG、JPG、WEBP 或 GIF 图片，且大小不超过 512KB'),
})

export type SystemConfigInput = z.infer<typeof systemConfigSchema>

export async function updateSystemBrand(
  input: unknown
): Promise<{ success: boolean; data?: BrandIdentity; error?: string }> {
  try {
    await requireActionPermission('system:manage')
    const validated = systemConfigSchema.parse(input)
    const config = await systemConfigService.update(validated)

    revalidatePath('/', 'layout')
    return { success: true, data: config }
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, error: error.issues[0]?.message ?? '系统配置校验失败' }
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : '保存系统配置失败',
    }
  }
}
