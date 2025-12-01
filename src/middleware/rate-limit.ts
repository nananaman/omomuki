import type { MiddlewareHandler } from 'hono'

type RateLimitOptions = {
  windowMs: number
  max: number
  message?: string
}

type RateLimitEntry = {
  count: number
  resetTime: number
}

export const rateLimit = (options: RateLimitOptions): MiddlewareHandler => {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.'
  } = options

  const store = new Map<string, RateLimitEntry>()

  const cleanup = (now: number) => {
    for (const [key, entry] of store) {
      if (now >= entry.resetTime) {
        store.delete(key)
      }
    }
  }

  return async (c, next) => {
    const now = Date.now()
    const key = 'global'

    if (Math.random() < 0.1) {
      cleanup(now)
    }

    let entry = store.get(key)

    if (!entry || now >= entry.resetTime) {
      entry = {
        count: 0,
        resetTime: now + windowMs
      }
    }

    entry.count++
    store.set(key, entry)

    c.header('X-RateLimit-Limit', max.toString())
    c.header('X-RateLimit-Remaining', Math.max(0, max - entry.count).toString())
    c.header('X-RateLimit-Reset', Math.ceil(entry.resetTime / 1000).toString())

    if (entry.count > max) {
      return c.json({ error: message }, 429)
    }

    await next()
  }
}
