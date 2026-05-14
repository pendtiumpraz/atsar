// Upstash Redis client (REST) — used for permission caches, rate limits, etc.
// Reads `KV_REST_API_URL` and `KV_REST_API_TOKEN` from the environment via
// `Redis.fromEnv()` (which also accepts the `UPSTASH_REDIS_REST_*` aliases).
//
// Resilience: every method call is proxied through a try/catch wrapper.
// When the upstream returns an error (quota exceeded, network blip,
// misconfig) the call resolves to `null` for reads, `null` for writes,
// `0` for incr/decr, and `[]` for list/scan-style ops. Call sites are
// expected to treat these as cache-miss / no-op outcomes — Redis is a
// perf optimization here, not a correctness gate. Without this wrapper
// every API route 500s the moment Upstash returns an error.

import { Redis } from '@upstash/redis'

const realRedis = Redis.fromEnv()

// Methods whose graceful-failure return value differs from `null`.
const NUMERIC_OPS = new Set([
  'incr', 'incrby', 'incrbyfloat', 'decr', 'decrby',
  'expire', 'pexpire', 'expireat', 'pexpireat',
  'exists', 'del', 'unlink', 'persist', 'ttl', 'pttl',
  'sadd', 'srem', 'hdel', 'hset', 'hsetnx', 'hincrby',
  'lpush', 'rpush', 'zadd', 'zrem', 'publish',
])
const ARRAY_OPS = new Set([
  'mget', 'keys', 'smembers', 'sinter', 'sdiff', 'sunion',
  'lrange', 'zrange', 'zrevrange', 'zrangebyscore',
  'hkeys', 'hvals', 'hgetall', 'scan', 'sscan', 'hscan', 'zscan',
])

function fallbackFor(prop: string): unknown {
  if (NUMERIC_OPS.has(prop)) return 0
  if (ARRAY_OPS.has(prop)) return []
  return null
}

/**
 * Proxied Redis client — every method is wrapped so quota exhaustion or
 * transient failures degrade to cache-miss instead of a 500. Reads return
 * `null` / `[]` / `0`; writes silently swallow.
 */
export const redis = new Proxy(realRedis, {
  get(target, prop, receiver) {
    const value = Reflect.get(target, prop, receiver)
    if (typeof value !== 'function') return value
    const propName = typeof prop === 'string' ? prop : ''
    return new Proxy(value, {
      apply(fn, thisArg, args: unknown[]) {
        try {
          const result = Reflect.apply(fn, thisArg === receiver ? target : thisArg, args)
          if (result && typeof (result as Promise<unknown>).then === 'function') {
            return (result as Promise<unknown>).catch((err: unknown) => {
              console.warn(`[redis] ${propName} failed, falling back:`, err)
              return fallbackFor(propName)
            })
          }
          return result
        } catch (err) {
          console.warn(`[redis] ${propName} threw synchronously, falling back:`, err)
          return fallbackFor(propName)
        }
      },
    })
  },
}) as Redis
