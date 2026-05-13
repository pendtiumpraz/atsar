// Upstash Redis client (REST) — used for permission caches, rate limits, etc.
// Reads `KV_REST_API_URL` and `KV_REST_API_TOKEN` from the environment via
// `Redis.fromEnv()` (which also accepts the `UPSTASH_REDIS_REST_*` aliases).

import { Redis } from '@upstash/redis'

/** Shared Upstash Redis client. Lazily initialized at module load. */
export const redis: Redis = Redis.fromEnv()
