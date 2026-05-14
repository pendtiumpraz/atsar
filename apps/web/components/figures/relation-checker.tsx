// Relation checker widget — sits on the Hubungan tab and lets the user
// pick any other figure to see how it relates to the current one.
//
// Resolution happens server-side at /api/v1/figures/relation. Behaviour:
//   - Debounced search (300 ms) hits /api/v1/figures?q=… and lists 8
//     suggestions.
//   - Pick + click "Cek" → fetch the resolved relation.
//   - Render headline + path breadcrumb + source badge + confidence pill.
//   - Recent lookups stored in component state (last 10) so the user can
//     replay without re-typing.

'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import { ApiClientError } from '@/lib/api/client'
import { figuresApi, type Paginated } from '@/lib/api/endpoints'

// ─── Types (mirrored from the route handler) ───────────────────────────
interface RelationPathStep {
  figureId: string | null
  slug: string | null
  name: string
  edgeType: string
  edgeLabel: string
}

interface RelationApiResponse {
  from: { slug: string; nameFullId: string; nameShortId: string | null }
  to: { slug: string; nameFullId: string; nameShortId: string | null }
  relationshipExists: boolean
  resolutionSource: 'db_graph' | 'ai_websearch' | 'none'
  descriptionId: string
  descriptionAr: string | null
  path: RelationPathStep[]
  depth: number
  citationUrl: string | null
  citationDomain: string | null
  confidence: 'high' | 'medium' | 'low'
  cached: boolean
  cachedAt: string | null
}

interface FigureSuggestion {
  id: string
  slug: string
  nameFullId?: string | null
  nameShortId?: string | null
  nameFullAr?: string | null
}

export interface RelationCheckerProps {
  fromSlug: string
  /** Display name for the headline copy. */
  fromName: string
}

interface HistoryEntry {
  toSlug: string
  result: RelationApiResponse
  at: number
}

const HISTORY_MAX = 10
const DEBOUNCE_MS = 300

export function RelationChecker({ fromSlug, fromName }: RelationCheckerProps) {
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [suggestions, setSuggestions] = useState<FigureSuggestion[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [picked, setPicked] = useState<FigureSuggestion | null>(null)
  const [loading, setLoading] = useState(false)
  const [searching, setSearching] = useState(false)
  const [result, setResult] = useState<RelationApiResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [history, setHistory] = useState<HistoryEntry[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  // ── Debounce the search query ─────────────────────────────────────────
  useEffect(() => {
    const handle = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS)
    return () => clearTimeout(handle)
  }, [query])

  // ── Fetch suggestions when debounced query changes ────────────────────
  useEffect(() => {
    if (debouncedQuery.length < 2) {
      setSuggestions([])
      return
    }
    let cancelled = false
    setSearching(true)
    figuresApi
      .list({ q: debouncedQuery, perPage: 8 })
      .then((res) => {
        if (cancelled) return
        const rows = ((res as Paginated<FigureSuggestion>).rows ?? []).filter(
          (r) => r.slug !== fromSlug,
        )
        setSuggestions(rows)
      })
      .catch(() => {
        if (!cancelled) setSuggestions([])
      })
      .finally(() => {
        if (!cancelled) setSearching(false)
      })
    return () => {
      cancelled = true
    }
  }, [debouncedQuery, fromSlug])

  function handlePick(s: FigureSuggestion) {
    setPicked(s)
    setQuery(s.nameShortId || s.nameFullId || s.slug)
    setSearchOpen(false)
  }

  async function handleCheck() {
    if (!picked) return
    setLoading(true)
    setError(null)
    setResult(null)
    try {
      const res = (await figuresApi.relation.check(
        fromSlug,
        picked.slug,
      )) as RelationApiResponse
      setResult(res)
      setHistory((prev) => {
        const next = [
          { toSlug: picked.slug, result: res, at: Date.now() },
          ...prev.filter((h) => h.toSlug !== picked.slug),
        ]
        return next.slice(0, HISTORY_MAX)
      })
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Gagal memeriksa hubungan.'
      setError(message)
    } finally {
      setLoading(false)
    }
  }

  function handleReset() {
    setPicked(null)
    setQuery('')
    setResult(null)
    setError(null)
    inputRef.current?.focus()
  }

  return (
    <section className="flex flex-col gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-4">
      <header className="flex flex-col gap-0.5">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
          Cek Hubungan dengan Tokoh Lain
        </h3>
        <p className="text-xs text-[rgb(var(--text-faint))]">
          Pilih tokoh lain untuk melihat hubungannya dengan {fromName}.
        </p>
      </header>

      <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
        <div className="relative flex-1">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setPicked(null)
              setSearchOpen(true)
            }}
            onFocus={() => setSearchOpen(true)}
            onBlur={() => {
              // Delay closing so click events on suggestions still fire.
              window.setTimeout(() => setSearchOpen(false), 150)
            }}
            placeholder="Ketik nama tokoh, mis. Aisyah RA"
            className="w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--text))] placeholder:text-[rgb(var(--text-faint))] focus:border-[rgb(var(--primary))] focus:outline-none"
            aria-autocomplete="list"
            aria-expanded={searchOpen && suggestions.length > 0}
          />
          {searchOpen && (suggestions.length > 0 || searching) ? (
            <ul
              role="listbox"
              className="absolute z-10 mt-1 max-h-64 w-full overflow-auto rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] py-1 shadow-lg"
            >
              {searching ? (
                <li className="px-3 py-2 text-xs text-[rgb(var(--text-muted))]">
                  Mencari…
                </li>
              ) : null}
              {suggestions.map((s) => (
                <li key={s.id}>
                  <button
                    type="button"
                    onMouseDown={(e) => {
                      // Prevent input onBlur from closing before we register the click.
                      e.preventDefault()
                    }}
                    onClick={() => handlePick(s)}
                    className="flex w-full flex-col items-start gap-0 px-3 py-2 text-left hover:bg-[rgb(var(--bg-elevated))]"
                  >
                    <span className="text-sm font-medium text-[rgb(var(--text))]">
                      {s.nameShortId || s.nameFullId || s.slug}
                    </span>
                    {s.nameFullAr ? (
                      <span
                        dir="rtl"
                        lang="ar"
                        className="text-xs text-[rgb(var(--text-muted))]"
                        style={{ fontFamily: 'var(--font-body-arab)' }}
                      >
                        {s.nameFullAr}
                      </span>
                    ) : null}
                  </button>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleCheck}
            disabled={!picked || loading}
            className="rounded-md bg-[rgb(var(--primary))] px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-[rgb(var(--primary))]/90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {loading ? 'Memeriksa…' : 'Cek'}
          </button>
          {result || error ? (
            <button
              type="button"
              onClick={handleReset}
              className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-3 py-2 text-sm text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
            >
              Reset
            </button>
          ) : null}
        </div>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-md border border-[rgb(var(--danger))]/40 bg-[rgb(var(--danger))]/5 p-3 text-sm text-[rgb(var(--danger))]"
        >
          {error}
        </div>
      ) : null}

      {result ? <ResultCard result={result} /> : null}

      {history.length > 0 ? (
        <details className="text-xs text-[rgb(var(--text-muted))]">
          <summary className="cursor-pointer select-none py-1">
            Riwayat pengecekan ({history.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-1">
            {history.map((h) => (
              <li
                key={`${h.toSlug}-${h.at}`}
                className="rounded border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 py-1"
              >
                <span className="font-medium text-[rgb(var(--text))]">
                  {h.result.to.nameShortId || h.result.to.nameFullId}
                </span>
                <span className="ml-2 text-[rgb(var(--text-faint))]">
                  {h.result.descriptionId.length > 80
                    ? h.result.descriptionId.slice(0, 80) + '…'
                    : h.result.descriptionId}
                </span>
              </li>
            ))}
          </ul>
        </details>
      ) : null}
    </section>
  )
}

// ─── Result card ────────────────────────────────────────────────────────
function ResultCard({ result }: { result: RelationApiResponse }) {
  const found = result.relationshipExists
  return (
    <div
      className={
        'flex flex-col gap-3 rounded-md border p-4 ' +
        (found
          ? 'border-[rgb(var(--primary))]/40 bg-[rgb(var(--primary))]/5'
          : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))]')
      }
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className={
            'flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xl ' +
            (found
              ? 'bg-[rgb(var(--primary))]/15 text-[rgb(var(--primary))]'
              : 'bg-[rgb(var(--text-faint))]/15 text-[rgb(var(--text-faint))]')
          }
        >
          {found ? 'LINK' : 'X'}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-1">
          <p className="text-sm font-medium text-[rgb(var(--text))]">
            {result.descriptionId}
          </p>
          {result.descriptionAr ? (
            <p
              dir="rtl"
              lang="ar"
              className="text-sm text-[rgb(var(--text-muted))]"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {result.descriptionAr}
            </p>
          ) : null}
        </div>
      </div>

      {result.path.length > 1 ? <PathBreadcrumb path={result.path} /> : null}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        <SourceBadge result={result} />
        <ConfidencePill confidence={result.confidence} />
        {result.cached ? (
          <span className="rounded-full bg-[rgb(var(--text-faint))]/15 px-2 py-0.5 text-[rgb(var(--text-muted))]">
            Dari cache
          </span>
        ) : null}
      </div>
    </div>
  )
}

function PathBreadcrumb({ path }: { path: RelationPathStep[] }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-xs text-[rgb(var(--text-muted))]">
      {path.map((step, idx) => (
        <span key={`${step.figureId ?? 'x'}-${idx}`} className="flex items-center gap-1">
          {idx > 0 ? (
            <span className="text-[rgb(var(--text-faint))]">
              ── {step.edgeLabel} ──
            </span>
          ) : null}
          {step.slug ? (
            <Link
              href={`/figures/${step.slug}`}
              className="rounded bg-[rgb(var(--surface))] px-1.5 py-0.5 text-[rgb(var(--text))] hover:text-[rgb(var(--primary))]"
            >
              {step.name}
            </Link>
          ) : (
            <span className="rounded bg-[rgb(var(--surface))] px-1.5 py-0.5 text-[rgb(var(--text))]">
              {step.name}
            </span>
          )}
        </span>
      ))}
    </div>
  )
}

function SourceBadge({ result }: { result: RelationApiResponse }) {
  if (result.resolutionSource === 'db_graph') {
    return (
      <span className="rounded-full bg-[rgb(var(--primary))]/15 px-2 py-0.5 text-[rgb(var(--primary))]">
        Sumber: DB Atsar
      </span>
    )
  }
  if (result.resolutionSource === 'ai_websearch') {
    const domain = result.citationDomain ?? 'whitelist salafi'
    const inner = `Sumber: AI websearch (${domain})`
    return result.citationUrl ? (
      <a
        href={result.citationUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 hover:underline dark:text-amber-300"
      >
        {inner}
      </a>
    ) : (
      <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-amber-700 dark:text-amber-300">
        {inner}
      </span>
    )
  }
  return (
    <span className="rounded-full bg-[rgb(var(--text-faint))]/15 px-2 py-0.5 text-[rgb(var(--text-muted))]">
      Sumber: Tidak ditemukan
    </span>
  )
}

function ConfidencePill({
  confidence,
}: {
  confidence: 'high' | 'medium' | 'low'
}) {
  const label =
    confidence === 'high'
      ? 'Keyakinan tinggi'
      : confidence === 'medium'
        ? 'Keyakinan sedang'
        : 'Keyakinan rendah'
  const cls =
    confidence === 'high'
      ? 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
      : confidence === 'medium'
        ? 'bg-sky-500/15 text-sky-700 dark:text-sky-300'
        : 'bg-rose-500/15 text-rose-700 dark:text-rose-300'
  return <span className={`rounded-full px-2 py-0.5 ${cls}`}>{label}</span>
}

