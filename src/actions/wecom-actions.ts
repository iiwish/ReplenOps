'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { requireActionPermission } from '@/lib/action-permissions'
import { WecomError } from '@/lib/wecom/security'
import {
  listWecomBindings,
  prebindWecom,
  saveWecomConfig,
  testWecomConfig,
  unbindWecom,
} from '@/services/wecom-auth.service'

async function perform(operation: (actor: string) => Promise<unknown>) {
  try {
    const user = await requireActionPermission('system:manage')
    await operation(user.id)
    revalidatePath('/admin/system-config/wecom')
    return { success: true }
  } catch (error) {
    const message =
      error instanceof z.ZodError
        ? error.issues[0]?.message
        : error instanceof WecomError
          ? error.message
          : '操作失败，请确认管理员权限或稍后重试'
    return { success: false, error: message ?? '输入无效' }
  }
}

export async function saveWecomSettings(input: unknown) {
  return perform((actor) => saveWecomConfig(input, actor))
}
export async function checkWecomConnection() {
  return perform(() => testWecomConfig())
}
export async function createWecomBinding(input: unknown) {
  return perform((actor) => prebindWecom(input, actor))
}
export async function removeWecomBinding(id: string) {
  return perform((actor) => unbindWecom(z.string().min(1).max(128).parse(id), actor))
}
export async function searchWecomBindings(query: string, page: number) {
  await requireActionPermission('system:manage')
  return listWecomBindings(
    z.string().trim().max(128).parse(query),
    z.number().int().min(1).max(100000).parse(page)
  )
}
