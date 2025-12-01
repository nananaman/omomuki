import type { Context, MiddlewareHandler } from 'hono'
import { getConnInfo } from '@hono/node-server/conninfo'

type RateLimitOptions = {
  windowMs: number
  max: number
  message?: string
  keyGenerator?: (c: Context) => string
}

type RateLimitEntry = {
  count: number
  resetTime: number
}

export const rateLimit = (options: RateLimitOptions): MiddlewareHandler => {
  const {
    windowMs,
    max,
    message = 'Too many requests, please try again later.',
    keyGenerator
  } = options

  const store = new Map<string, RateLimitEntry>()

  const getKey = (c: Context): string => {
    if (keyGenerator) {
      return keyGenerator(c)
    }
    const forwarded = c.req.header('x-forwarded-for')
    if (forwarded) {
      return forwarded.split(',')[0].trim()
    }
    const connInfo = getConnInfo(c)
    return connInfo.remote.address ?? 'unknown'
  }

  const cleanup = (now: number) => {
    for (const [key, entry] of store) {
      if (now >= entry.resetTime) {
        store.delete(key)
      }
    }
  }

  return async (c, next) => {
    const now = Date.now()
    const key = getKey(c)

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
