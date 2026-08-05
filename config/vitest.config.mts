import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const configDirectory = path.dirname(fileURLToPath(import.meta.url))
const projectRoot = path.resolve(configDirectory, '..')

export default defineConfig({
  root: projectRoot,
  test: {
    globals: true,
    environment: 'node',
    fileParallelism: false,
    setupFiles: ['./tests/setup.ts'],
    include: ['__tests__/**/*.test.ts', 'tests/unit/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/**/*.d.ts'],
      thresholds: {
        branches: 12,
        functions: 13,
        lines: 13,
        statements: 13,
        'src/lib/auth-token.ts': {
          branches: 80,
          functions: 100,
          lines: 90,
          statements: 90,
        },
        'src/lib/auth.ts': {
          branches: 70,
          functions: 100,
          lines: 80,
          statements: 75,
        },
        'src/services/auth-rate-limit.service.ts': {
          branches: 75,
          functions: 100,
          lines: 85,
          statements: 85,
        },
        'src/app/api/auth/login/route.ts': {
          branches: 65,
          functions: 100,
          lines: 80,
          statements: 80,
        },
        'src/app/api/users/route.ts': {
          branches: 50,
          functions: 100,
          lines: 50,
          statements: 50,
        },
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(projectRoot, 'src'),
    },
  },
})
