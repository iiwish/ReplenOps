import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Make jest globals available for tests that use jest.* syntax
global.jest = {
  mock: vi.mock,
  fn: vi.fn,
  spyOn: vi.spyOn,
  clearAllMocks: () => {},
  resetAllMocks: () => {},
  restoreAllMocks: () => {},
}

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    refresh: vi.fn()
  }),
  usePathname: () => '/',
  redirect: vi.fn()
}))

// Mock next/cache
vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn()
}))

// Mock @prisma/client
vi.mock('@/lib/prisma', () => ({
  prisma: {
    $transaction: vi.fn((fn) => fn(prisma)),
    order: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn()
    },
    goods: {
      findMany: vi.fn(),
      findUnique: vi.fn()
    },
    inventory: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn()
    }
  }
}))
