import { cpSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

const root = process.cwd()
const standaloneRoot = resolve(root, '.next/standalone')

mkdirSync(resolve(standaloneRoot, '.next'), { recursive: true })
cpSync(resolve(root, '.next/static'), resolve(standaloneRoot, '.next/static'), {
  recursive: true,
})
cpSync(resolve(root, 'public'), resolve(standaloneRoot, 'public'), { recursive: true })
