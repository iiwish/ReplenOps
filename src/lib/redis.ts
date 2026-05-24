import Redis from 'ioredis'

type RedisLike = {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<'OK'>
  setex(key: string, seconds: number, value: string): Promise<'OK'>
  del(...keys: string[]): Promise<number>
  keys(pattern: string): Promise<string[]>
  exists(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<number>
  ttl(key: string): Promise<number>
  incrby(key: string, delta: number): Promise<number>
  decrby(key: string, delta: number): Promise<number>
}

class InMemoryRedisFallback implements RedisLike {
  private readonly store = new Map<string, string>()

  async get(key: string): Promise<string | null> {
    return this.store.get(key) ?? null
  }

  async set(key: string, value: string): Promise<'OK'> {
    this.store.set(key, value)
    return 'OK'
  }

  async setex(key: string, _seconds: number, value: string): Promise<'OK'> {
    this.store.set(key, value)
    return 'OK'
  }

  async del(...keys: string[]): Promise<number> {
    let deleted = 0
    for (const key of keys) {
      if (this.store.delete(key)) {
        deleted += 1
      }
    }
    return deleted
  }

  async keys(pattern: string): Promise<string[]> {
    if (pattern === '*') {
      return [...this.store.keys()]
    }

    const normalizedPattern = pattern.replace(/\*/g, '.*')
    const regex = new RegExp(`^${normalizedPattern}$`)
    return [...this.store.keys()].filter((key) => regex.test(key))
  }

  async exists(key: string): Promise<number> {
    return this.store.has(key) ? 1 : 0
  }

  async expire(_key: string, _seconds: number): Promise<number> {
    return 1
  }

  async ttl(key: string): Promise<number> {
    return this.store.has(key) ? DEFAULT_TTL : -1
  }

  async incrby(key: string, delta: number): Promise<number> {
    const current = Number(this.store.get(key) ?? '0')
    const next = current + delta
    this.store.set(key, next.toString())
    return next
  }

  async decrby(key: string, delta: number): Promise<number> {
    const current = Number(this.store.get(key) ?? '0')
    const next = current - delta
    this.store.set(key, next.toString())
    return next
  }
}

function createRedisClient(): RedisLike {
  if (process.env.REDIS_URL) {
    return new Redis(process.env.REDIS_URL, {
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 2) {
          return undefined
        }
        return Math.min(times * 100, 3000)
      },
    })
  }

  if (process.env.REDIS_HOST) {
    return new Redis({
      host: process.env.REDIS_HOST,
      port: Number(process.env.REDIS_PORT) || 6379,
      password: process.env.REDIS_PASSWORD,
      maxRetriesPerRequest: 3,
      retryStrategy(times) {
        if (times > 2) {
          return undefined
        }
        return Math.min(times * 100, 3000)
      },
    })
  }

  console.warn(
    'Redis is not configured; falling back to in-memory cache. This is acceptable for low-traffic deployments, but cached data will not be shared across instances.'
  )
  return new InMemoryRedisFallback()
}

export const redis = createRedisClient()

export class CacheKeys {
  static GOODS_LIST(categoryId?: string) {
    return categoryId ? `goods:list:${categoryId}` : 'goods:list:all'
  }

  static GOODS_DETAIL(id: string) {
    return `goods:detail:${id}`
  }

  static INVENTORY(warehouseId: string, goodsId: string) {
    return `inventory:${warehouseId}:${goodsId}`
  }

  static INVENTORY_WAREHOUSE(warehouseId: string) {
    return `inventory:warehouse:${warehouseId}`
  }

  static STORE_LIST() {
    return 'stores:list'
  }

  static CATEGORIES_LIST() {
    return 'categories:list'
  }

  static ORDERS_LIST(storeId?: string) {
    return storeId ? `orders:list:${storeId}` : 'orders:list:all'
  }
}

export const DEFAULT_TTL = 3600

export const SHORT_TTL = 300

export const LONG_TTL = 86400
