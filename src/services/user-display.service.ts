import { prisma } from '@/lib/prisma'

const SYSTEM_DISPLAY_NAMES: Readonly<Record<string, string>> = {
  system: '系统',
  migration: '数据迁移',
}

export type UserDisplayNameMap = ReadonlyMap<string, string>

export function resolveUserDisplayName(
  identifier: string | null | undefined,
  displayNameByIdentifier: UserDisplayNameMap
): string | null {
  if (!identifier) return null

  return (
    displayNameByIdentifier.get(identifier) ??
    SYSTEM_DISPLAY_NAMES[identifier.toLowerCase()] ??
    identifier
  )
}

export async function getUserDisplayNameMap(
  identifiers: Array<string | null | undefined>
): Promise<Map<string, string>> {
  const uniqueIdentifiers = Array.from(
    new Set(identifiers.filter((identifier): identifier is string => Boolean(identifier)))
  )

  if (uniqueIdentifiers.length === 0) return new Map()

  const users = await prisma.user.findMany({
    where: {
      OR: [{ id: { in: uniqueIdentifiers } }, { username: { in: uniqueIdentifiers } }],
    },
    select: { id: true, username: true, name: true },
  })

  return new Map(
    users.flatMap((user) => {
      const displayName = user.name || user.username
      return [[user.id, displayName] as const, [user.username, displayName] as const]
    })
  )
}
