import { redis, DEFAULT_TTL } from './redis'

export class CacheService {
  async get<T>(key: string): Promise<T | null> {
    try {
      const data = await redis.get(key)
      return data ? (JSON.parse(data) as T) : null
    } catch (error) {
      console.error(`Cache get error for key ${key}:`, error)
      return null
    }
  }

  async set(key: string, value: unknown, ttl: number = DEFAULT_TTL): Promise<void> {
    try {
      await redis.setex(key, ttl, JSON.stringify(value))
    } catch (error) {
      console.error(`Cache set error for key ${key}:`, error)
    }
  }

  async del(key: string): Promise<void> {
    try {
      await redis.del(key)
    } catch (error) {
      console.error(`Cache del error for key ${key}:`, error)
    }
  }

  async delMultiple(keys: string[]): Promise<void> {
    if (keys.length === 0) return
    try {
      await redis.del(...keys)
    } catch (error) {
      console.error(`Cache delMultiple error for keys ${keys}:`, error)
    }
  }

  async flush(pattern: string): Promise<void> {
    try {
      const keys = await redis.keys(pattern)
      if (keys.length > 0) {
        await redis.del(...keys)
      }
    } catch (error) {
      console.error(`Cache flush error for pattern ${pattern}:`, error)
    }
  }

  async getOrSet<T>(key: string, factory: () => Promise<T>, ttl: number = DEFAULT_TTL): Promise<T> {
    const cached = await this.get<T>(key)
    if (cached !== null) {
      return cached
    }

    const value = await factory()
    await this.set(key, value, ttl)
    return value
  }

  async exists(key: string): Promise<boolean> {
    try {
      const result = await redis.exists(key)
      return result === 1
    } catch (error) {
      console.error(`Cache exists error for key ${key}:`, error)
      return false
    }
  }

  async expire(key: string, seconds: number): Promise<void> {
    try {
      await redis.expire(key, seconds)
    } catch (error) {
      console.error(`Cache expire error for key ${key}:`, error)
    }
  }

  async ttl(key: string): Promise<number> {
    try {
      const result = await redis.ttl(key)
      return result
    } catch (error) {
      console.error(`Cache ttl error for key ${key}:`, error)
      return -1
    }
  }

  async increment(key: string, delta: number = 1): Promise<number> {
    try {
      return await redis.incrby(key, delta)
    } catch (error) {
      console.error(`Cache increment error for key ${key}:`, error)
      return 0
    }
  }

  async decrement(key: string, delta: number = 1): Promise<number> {
    try {
      const newValue = await redis.decrby(key, delta)
      if (newValue < 0) {
        await redis.set(key, '0')
        return 0
      }
      return newValue
    } catch (error) {
      console.error(`Cache decrement error for key ${key}:`, error)
      return 0
    }
  }
}

export const cache = new CacheService()
