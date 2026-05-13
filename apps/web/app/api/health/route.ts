// GET /api/health — liveness probe.
// Fast, no I/O. For Vercel/uptime monitors. See docs/BACKEND.md §18.

import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export function GET(): NextResponse {
  return NextResponse.json({
    ok: true,
    service: 'athar',
    uptime: process.uptime(),
    version: process.env['npm_package_version'] ?? '0.0.0',
    timestamp: new Date().toISOString(),
  })
}
