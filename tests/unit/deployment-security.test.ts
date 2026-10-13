import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { beforeAll, describe, expect, it } from 'vitest'

let dockerfile: string

describe('deployment image security boundaries', () => {
  beforeAll(async () => {
    dockerfile = await readFile(path.resolve('deploy/Dockerfile'), 'utf8')
  })

  it('requests a targeted Perl upgrade after refreshing package metadata', () => {
    const base = dockerfile.split('\nFROM base AS dependencies\n')[0] ?? ''
    const install = base.match(/apt-get install[^\n]*/)?.[0] ?? ''

    expect(install.split(/\s+/)).toContain('perl-base')
    expect(base.indexOf('apt-get update')).toBeLessThan(base.indexOf(install))
    expect(base).not.toMatch(/apt(?:-get)?\s+(?:--?\S+\s+)*(?:dist-upgrade|full-upgrade|upgrade)\b/)
  })

  it('preserves the pinned Node 22 Bookworm image and non-root release stages', () => {
    expect(dockerfile).toMatch(/^FROM node:22-bookworm-slim@sha256:[a-f0-9]{64} AS base$/m)
    const releaseMigrator =
      dockerfile.split('FROM migrator AS release-migrator\n')[1]?.split('\nFROM ')[0] ?? ''
    const runner = dockerfile.split('FROM base AS runner\n')[1] ?? ''

    expect(releaseMigrator.trim()).toMatch(
      /USER replenops\nCMD \["node", "node_modules\/prisma\/build\/index\.js", "migrate", "deploy"\]$/
    )
    expect(runner.trim()).toMatch(/USER replenops\nEXPOSE 3000\nCMD \["node", "server\.js"\]$/)
  })
})
