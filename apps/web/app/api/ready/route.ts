// GET /api/ready — readiness probe.
// Verifies that DB and Redis are reachable. Returns 200 when both are up,
// 503 if any dependency is down. See docs/BACKEND.md §18.

import { NextResponse } from 'next/server'
import { sql } from 'drizzle-orm'

import { db } from '@athar/db'

import { logger } from '@/lib/server/logger'
import { redis } from '@/lib/server/upstash'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

type Status = 'up' | 'down'

async function checkDb(): Promise<Status> {
  try {
    await db.execute(sql`SELECT 1`)
    return 'up'
  } catch (err) {
    logger.warn({ err }, '[ready] db check failed')
    return 'down'
  }
}

async function checkRedis(): Promise<Status> {
  try {
    const pong = await redis.ping()
    return pong === 'PONG' || pong === 'pong' ? 'up' : 'down'
  } catch (err) {
    logger.warn({ err }, '[ready] redis check failed')
    return 'down'
  }
}

export async function GET(): Promise<NextResponse> {
  const [dbStatus, redisStatus] = await Promise.all([checkDb(), checkRedis()])
  const ok = dbStatus === 'up' && redisStatus === 'up'

  return NextResponse.json(
    {
      ok,
      checks: { db: dbStatus, redis: redisStatus },
      timestamp: new Date().toISOString(),
    },
    { status: ok ? 200 : 503 },
  )
}
