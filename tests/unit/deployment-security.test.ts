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
    const tokens = base.split(/\s+/)
    expect(tokens).not.toContain('dist-upgrade')
    expect(tokens).not.toContain('full-upgrade')
    expect(tokens).not.toContain('upgrade')
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

  it('removes unused package managers from the non-root direct-node demo seeder', () => {
    const demoSeeder =
      dockerfile.split('FROM migrator AS demo-seeder\n')[1]?.split('\nFROM ')[0] ?? ''

    expect(demoSeeder.trim()).toMatch(/^USER root\n/)
    expect(demoSeeder).toContain(
      'RUN rm -rf /usr/local/lib/node_modules/npm /usr/local/lib/node_modules/corepack \\\n  && rm -f /usr/local/bin/npm /usr/local/bin/npx /usr/local/bin/corepack'
    )
    expect(demoSeeder.trim()).toMatch(
      /USER replenops\nCMD \["node", "node_modules\/tsx\/dist\/cli\.mjs", "prisma\/demo-seed\.ts"\]$/
    )
  })
})
