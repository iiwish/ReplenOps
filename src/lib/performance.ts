export interface PerformanceMetric {
  name: string
  duration: number
  timestamp: Date
  metadata?: Record<string, unknown>
}

export interface SlowQueryLog {
  query: string
  duration: number
  threshold: number
  timestamp: Date
  params?: unknown
}

export class PerformanceMonitor {
  private metrics: Map<string, PerformanceMetric[]> = new Map()
  private slowQueries: SlowQueryLog[] = []
  private slowQueryThreshold: number = 1000

  constructor(slowQueryThreshold: number = 1000) {
    this.slowQueryThreshold = slowQueryThreshold
  }

  startTimer(name: string): () => void {
    const startTime = Date.now()

    return () => {
      const duration = Date.now() - startTime
      this.recordMetric(name, duration)

      if (duration > this.slowQueryThreshold) {
        console.warn(`⚠️ Slow operation detected: ${name} took ${duration}ms`)
      }
    }
  }

  recordMetric(name: string, duration: number, metadata?: Record<string, unknown>): void {
    if (!this.metrics.has(name)) {
      this.metrics.set(name, [])
    }

    const metric: PerformanceMetric = {
      name,
      duration,
      timestamp: new Date(),
      metadata,
    }

    this.metrics.get(name)!.push(metric)

    if (this.metrics.get(name)!.length > 100) {
      this.metrics.get(name)!.shift()
    }
  }

  recordSlowQuery(query: string, duration: number, params?: unknown): void {
    if (duration > this.slowQueryThreshold) {
      const log: SlowQueryLog = {
        query,
        duration,
        threshold: this.slowQueryThreshold,
        timestamp: new Date(),
        params,
      }

      this.slowQueries.push(log)

      if (this.slowQueries.length > 50) {
        this.slowQueries.shift()
      }
    }
  }

  getMetrics(name: string): PerformanceMetric[] {
    return this.metrics.get(name) || []
  }

  getAverageDuration(name: string): number {
    const metrics = this.getMetrics(name)
    if (metrics.length === 0) return 0

    const sum = metrics.reduce((acc, m) => acc + m.duration, 0)
    return Math.round(sum / metrics.length)
  }

  getMetricsSummary(): Record<string, { count: number; avg: number; max: number; min: number }> {
    const summary: Record<string, { count: number; avg: number; max: number; min: number }> = {}

    this.metrics.forEach((metrics, name) => {
      if (metrics.length === 0) return

      const durations = metrics.map((m) => m.duration)
      const count = metrics.length
      const avg = Math.round(durations.reduce((a, b) => a + b, 0) / count)
      const max = Math.max(...durations)
      const min = Math.min(...durations)

      summary[name] = { count, avg, max, min }
    })

    return summary
  }

  getSlowQueries(): SlowQueryLog[] {
    return [...this.slowQueries]
  }

  clearMetrics(name?: string): void {
    if (name) {
      this.metrics.delete(name)
    } else {
      this.metrics.clear()
    }
  }

  clearSlowQueries(): void {
    this.slowQueries = []
  }
}

export const perfMonitor = new PerformanceMonitor(1000)

export function measurePerformance<T>(name: string, fn: () => Promise<T> | T): Promise<T> {
  const endTimer = perfMonitor.startTimer(name)

  if (typeof fn === 'function') {
    const result = fn()

    if (result instanceof Promise) {
      return result.finally(() => endTimer())
    } else {
      endTimer()
      return Promise.resolve(result) as Promise<T>
    }
  }

  return Promise.reject(new Error('Invalid function passed to measurePerformance'))
}

export function reportWebVital(metric: { name?: string; value?: number }): void {
  if (metric.name && metric.value !== undefined) {
    console.log(`Web Vital: ${metric.name} - ${metric.value}ms`)
  }
}
