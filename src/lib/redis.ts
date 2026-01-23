import Redis from 'ioredis'

if (!process.env.REDIS_HOST) {
  throw new Error('REDIS_HOST is not defined')
}

export const redis = new Redis({
  host: process.env.REDIS_HOST,
  port: Number(process.env.REDIS_PORT) || 6379,
  password: process.env.REDIS_PASSWORD,
  maxRetriesPerRequest: 3,
  retryStrategy(times) {
    if (times > 2) {
      return undefined
    }
    const delay = Math.min(times * 100, 3000)
    return delay
  },
})

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
