// `/battles` — list view for Sirah Perang (WIREFRAMES §12).
//
// Pure server component. Reads `searchParams` for filters (type / fromAh /
// toAh / locationId / q / page), calls `battleService.list()` directly on
// the server, and renders a grid of `<BattleCard />`. Pagination + filter
// state lives in the URL (single source of truth) — no client cache needed
// for the list because navigation is server-rendered.
//
// Auth + subscription are already gated by `(app)/layout.tsx`. The HTTP
// `/api/v1/battles` route enforces `battles.view`; per WIREFRAMES §20 every
// authenticated subscriber has it, so direct service access is safe.

import type { Metadata } from 'next'
import Link from 'next/link'

import { BattleCard, type BattleCardData } from '@/components/battles/battle-card'
import { battleService } from '@/lib/server/services/battle.service'

export const metadata: Metadata = {
  title: 'Sirah Perang',
  description:
    'Kompilasi ghazwah, sariyyah, dan futuhat — narasi, peta strategi, dan para sahabat yang terlibat.',
}

interface BattlesPageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>
}

function pick(value: string | string[] | undefined): string | undefined {
  if (Array.isArray(value)) return value[0]
  return value
}

const BATTLE_TYPES = ['ghazwah', 'sariyyah', 'futuhat'] as const
type BattleType = (typeof BATTLE_TYPES)[number]
const BATTLE_TYPE_SET = new Set<string>(BATTLE_TYPES)

const TYPE_LABEL: Record<BattleType, string> = {
  ghazwah: 'Ghazwah',
  sariyyah: 'Sariyyah',
  futuhat: 'Futuhat',
}

const PER_PAGE = 20

export default async function BattlesPage({ searchParams }: BattlesPageProps) {
  const sp = await searchParams

  const q = pick(sp.q)
  const typeRaw = pick(sp.type)
  const type = typeRaw && BATTLE_TYPE_SET.has(typeRaw) ? (typeRaw as BattleType) : undefined
  const locationId = pick(sp.locationId)

  const fromAhRaw = pick(sp.fromAh)
  const toAhRaw = pick(sp.toAh)
  const fromAh = parseIntOrUndefined(fromAhRaw)
  const toAh = parseIntOrUndefined(toAhRaw)

  const pageRaw = pick(sp.page)
  const page = pageRaw ? Math.max(1, Number(pageRaw) || 1) : 1

  // Direct service call — bypasses HTTP layer to avoid an extra round-trip
  // when SSR-rendering. The same gating that protects the route is already
  // applied at the layout level.
  const result = await battleService.list({
    q,
    type,
    locationId,
    fromAh,
    toAh,
    page,
    perPage: PER_PAGE,
  })

  const rows = (result.rows ?? []) as BattleCardData[]
  const totalPages = Math.max(1, Math.ceil((result.total ?? 0) / PER_PAGE))
  const hasFilters = Boolean(q || type || locationId || fromAh !== undefined || toAh !== undefined)

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Sirah Perang
        </h1>
        <span className="text-xs text-[rgb(var(--text-faint))]">
          {result.total ?? 0} pertempuran
        </span>
      </div>

      <BattlesFilterBar
        q={q ?? ''}
        type={type ?? ''}
        fromAh={fromAhRaw ?? ''}
        toAh={toAhRaw ?? ''}
        locationId={locationId ?? ''}
      />

      {rows.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center text-sm text-[rgb(var(--text-muted))]">
          Tidak ada pertempuran ditemukan.
          {hasFilters ? (
            <div className="mt-1 text-xs text-[rgb(var(--text-faint))]">
              Coba ubah filter atau kata kunci pencarian.
            </div>
          ) : null}
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {rows.map((battle) => (
            <li key={battle.id ?? battle.slug}>
              <BattleCard battle={battle} href={buildDetailHref(battle.slug, sp)} />
            </li>
          ))}
        </ul>
      )}

      <Pagination current={page} total={totalPages} searchParams={sp} />
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────

function parseIntOrUndefined(value: string | undefined): number | undefined {
  if (!value) return undefined
  const n = Number(value)
  return Number.isFinite(n) ? Math.trunc(n) : undefined
}

function buildQs(params: Record<string, string | string[] | undefined>, overrides: Record<string, string | undefined>): string {
  const next = new URLSearchParams()
  for (const [key, val] of Object.entries(params)) {
    const v = Array.isArray(val) ? val[0] : val
    if (v) next.set(key, v)
  }
  for (const [key, val] of Object.entries(overrides)) {
    if (val === undefined) next.delete(key)
    else next.set(key, val)
  }
  const qs = next.toString()
  return qs ? `?${qs}` : ''
}

function buildDetailHref(slug: string, sp: Record<string, string | string[] | undefined>): string {
  return `/battles/${encodeURIComponent(slug)}${buildQs(sp, {})}`
}

// ── Inline filter bar (server-rendered <form>, no client JS needed) ──

function BattlesFilterBar({
  q,
  type,
  fromAh,
  toAh,
  locationId,
}: {
  q: string
  type: string
  fromAh: string
  toAh: string
  locationId: string
}) {
  return (
    <form
      action="/battles"
      method="get"
      className="flex flex-col gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 sm:flex-row sm:flex-wrap sm:items-center"
    >
      <input
        type="search"
        name="q"
        defaultValue={q}
        placeholder="Cari nama pertempuran…"
        aria-label="Pencarian pertempuran"
        className="h-10 flex-1 min-w-[12rem] rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 text-sm text-[rgb(var(--text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
      />
      <select
        name="type"
        defaultValue={type}
        aria-label="Filter jenis"
        className="h-10 min-w-[10rem] rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm text-[rgb(var(--text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
      >
        <option value="">Semua Jenis</option>
        {BATTLE_TYPES.map((t) => (
          <option key={t} value={t}>
            {TYPE_LABEL[t]}
          </option>
        ))}
      </select>
      <div className="flex items-center gap-1">
        <input
          type="number"
          name="fromAh"
          defaultValue={fromAh}
          placeholder="Dari (H)"
          aria-label="Tahun Hijriah dari"
          className="h-10 w-24 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm text-[rgb(var(--text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
        />
        <span className="text-xs text-[rgb(var(--text-faint))]">–</span>
        <input
          type="number"
          name="toAh"
          defaultValue={toAh}
          placeholder="Sampai (H)"
          aria-label="Tahun Hijriah sampai"
          className="h-10 w-24 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm text-[rgb(var(--text))] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
        />
      </div>
      {locationId ? (
        <input type="hidden" name="locationId" value={locationId} />
      ) : null}
      <button
        type="submit"
        className="h-10 rounded-md bg-[rgb(var(--accent))] px-4 text-sm font-medium text-white hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]"
      >
        Terapkan
      </button>
    </form>
  )
}

// ── Pagination ────────────────────────────────────────────────────────

function Pagination({
  current,
  total,
  searchParams,
}: {
  current: number
  total: number
  searchParams: Record<string, string | string[] | undefined>
}) {
  if (total <= 1) return null
  const prev = current > 1 ? current - 1 : null
  const next = current < total ? current + 1 : null
  return (
    <nav
      aria-label="Navigasi halaman"
      className="flex items-center justify-between gap-2 pt-2 text-sm"
    >
      {prev ? (
        <Link
          href={`/battles${buildQs(searchParams, { page: String(prev) })}`}
          className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 hover:border-[rgb(var(--accent))]"
        >
          ← Sebelumnya
        </Link>
      ) : (
        <span />
      )}
      <span className="text-xs text-[rgb(var(--text-muted))]">
        Halaman {current} / {total}
      </span>
      {next ? (
        <Link
          href={`/battles${buildQs(searchParams, { page: String(next) })}`}
          className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-1.5 hover:border-[rgb(var(--accent))]"
        >
          Berikutnya →
        </Link>
      ) : (
        <span />
      )}
    </nav>
  )
}
