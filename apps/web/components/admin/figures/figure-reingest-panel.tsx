// `<FigureReingestPanel />` — "Perbarui via AI" card on the figure edit page.
//
// Flow:
//
//   1. Admin picks a mode (`enrich` = isi field kosong saja, or `replace` =
//      timpa biografi & summary) + a list of focus fields + optional hints,
//      then POSTs to `/api/v1/admin/figures/[slug]/re-ingest`.
//   2. Endpoint returns `202 { jobId, status: 'pending', publishError? }`.
//   3. We poll `/api/v1/admin/figures/[slug]/re-ingest-jobs?jobId=…` every 5s
//      until status is `completed` or `failed`, with a 3-minute timeout.
//   4. On `completed`, the job row carries a `suggestions` object — a
//      field-by-field mapping of AI-proposed values. We render a diff dialog
//      where the admin accepts/rejects per row (Accept = PATCH the figure
//      with just that field; Reject = no-op).
//
// Constraints (from the task brief):
//   - Sits beside, not inside, `<FigureEditForm />`.
//   - All labels Indonesian.
//   - No new deps — uses `useState` + `setInterval` for polling rather than
//     pulling in @tanstack/react-query in this file (the rest of the admin
//     uses it but the polling shape here is one-shot per job submission).
//
// The backend job row shape is mirrored on
// `/api/v1/admin/figures/ingest-jobs/[jobId]`. If the parallel backend agent
// ends up with a slightly different field name we map it here in
// `normaliseJob()` so the UI keeps working.

'use client'

import * as React from 'react'
import dynamic from 'next/dynamic'
import {
  AlertCircle,
  Check,
  Loader2,
  RefreshCw,
  Sparkles,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiClientError } from '@/lib/api/client'

// Lazy-load the diff viewer so the heavy `react-diff-viewer-continued` chunk
// only enters the bundle once the admin opens the side-by-side comparison.
const DiffViewer = dynamic(
  () => import('@/components/reviewer/diff-viewer').then((m) => m.DiffViewer),
  { ssr: false },
)

/** Fields whose suggestion value is a long string — these get the
 *  `react-diff-viewer-continued` line-level highlight in side-by-side mode.
 *  Short / numeric / scalar fields just show plain text side by side. */
const TEXT_DIFF_FIELDS = new Set([
  'biographyId',
  'biographyAr',
  'summaryId',
  'summaryAr',
])

// ── Types ─────────────────────────────────────────────────────────────

type Mode = 'enrich' | 'replace'

type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

/** Snapshot of the figure's current values for the fields the AI may suggest.
 *
 * Kept loose (`Record<string, unknown>` style) on purpose — the suggestion
 * shape is "whatever the backend returns" and we only render values we know
 * how to display. */
export interface FigureReingestCurrentSnapshot {
  biographyId: string | null
  biographyAr: string | null
  summaryId: string | null
  summaryAr: string | null
  kunyahId: string | null
  kunyahAr: string | null
  laqabId: string | null
  laqabAr: string | null
  birthDateAh: number | null
  birthDateCe: number | null
  deathDateAh: number | null
  deathDateCe: number | null
  specialty: string[] | null
  madhab: string | null
  rijalGrade: string | null
  // Citation isn't a single column — it's an array of `citations` rows. We
  // treat it as a free-form display field; AI suggestions surface as an
  // array of URLs/labels and Accept calls a different endpoint shape. For
  // now we just render the count.
  [extra: string]: unknown
}

interface JobRow {
  id: string
  status: JobStatus
  payload?: {
    mode?: Mode
    focusFields?: string[]
    hints?: string
  } | null
  /** AI-suggested patch — only present once status === 'completed'. */
  suggestions?: Record<string, unknown> | null
  errorCode?: string | null
  errorMessage?: string | null
  publishError?: string | null
  createdAt?: string | null
  startedAt?: string | null
  finishedAt?: string | null
}

// ── Field catalog ─────────────────────────────────────────────────────
// Order here drives the checkbox order *and* the diff dialog row order.

interface FocusFieldGroup {
  /** Stable id for the focus-field multi-select (sent to backend). */
  id: string
  /** Indonesian label shown in the form. */
  label: string
  /** Columns on the figure row this group covers — also the keys we expect
   *  the AI to put in `suggestions`. */
  columns: (keyof FigureReingestCurrentSnapshot)[]
}

/** Expand group ids → flat list of DB column names the backend Zod
 *  schema accepts. Sending group ids verbatim 422s because the API
 *  enum is keyed by column. */
function expandFocusGroups(groupIds: Iterable<string>): string[] {
  const ids = new Set(groupIds)
  const out = new Set<string>()
  for (const group of FOCUS_FIELD_GROUPS) {
    if (ids.has(group.id)) for (const c of group.columns) out.add(c)
  }
  return Array.from(out)
}

const FOCUS_FIELD_GROUPS: FocusFieldGroup[] = [
  { id: 'biography', label: 'Biografi', columns: ['biographyId', 'biographyAr'] },
  { id: 'summary', label: 'Ringkasan', columns: ['summaryId', 'summaryAr'] },
  { id: 'kunyah', label: 'Kunyah / Laqab', columns: ['kunyahId', 'kunyahAr', 'laqabId', 'laqabAr'] },
  {
    id: 'dates',
    label: 'Tanggal lahir / wafat',
    columns: ['birthDateAh', 'birthDateCe', 'deathDateAh', 'deathDateCe'],
  },
  { id: 'specialty', label: 'Spesialisasi', columns: ['specialty'] },
  { id: 'madhab', label: 'Madhab', columns: ['madhab'] },
  { id: 'rijal', label: 'Rijal grade', columns: ['rijalGrade'] },
  // Citation has no flat column — handled as a free-form suggestion the
  // admin can review but we cannot one-click apply yet. The Accept button
  // is disabled with a tooltip-ish hint.
  { id: 'citation', label: 'Citation', columns: [] },
]

const FIELD_LABELS: Record<string, string> = {
  biographyId: 'Biografi (ID)',
  biographyAr: 'Biografi (AR)',
  summaryId: 'Ringkasan (ID)',
  summaryAr: 'Ringkasan (AR)',
  kunyahId: 'Kunyah (ID)',
  kunyahAr: 'Kunyah (AR)',
  laqabId: 'Laqab (ID)',
  laqabAr: 'Laqab (AR)',
  birthDateAh: 'Lahir (H)',
  birthDateCe: 'Lahir (M)',
  deathDateAh: 'Wafat (H)',
  deathDateCe: 'Wafat (M)',
  specialty: 'Spesialisasi',
  madhab: 'Madhab',
  rijalGrade: 'Rijal grade',
  citations: 'Citation',
}

const POLL_INTERVAL_MS = 5_000
const POLL_TIMEOUT_MS = 3 * 60 * 1_000 // 3 minutes

// ── Helpers ───────────────────────────────────────────────────────────

function isEmpty(v: unknown): boolean {
  if (v === null || v === undefined) return true
  if (typeof v === 'string') return v.trim().length === 0
  if (Array.isArray(v)) return v.length === 0
  return false
}

function previewValue(v: unknown): string {
  if (isEmpty(v)) return '(kosong)'
  if (Array.isArray(v)) return v.map(String).join(', ')
  if (typeof v === 'object') return JSON.stringify(v).slice(0, 200)
  const s = String(v)
  return s.length > 240 ? `${s.slice(0, 240)}…` : s
}

function fullValue(v: unknown): string {
  if (isEmpty(v)) return ''
  if (Array.isArray(v)) return v.map(String).join('\n')
  if (typeof v === 'object') return JSON.stringify(v, null, 2)
  return String(v)
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return ''
  const then = new Date(iso).getTime()
  if (!Number.isFinite(then)) return ''
  const diff = Date.now() - then
  if (diff < 60_000) return 'baru saja'
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} menit lalu`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} jam lalu`
  return `${Math.floor(diff / 86_400_000)} hari lalu`
}

/** Map whatever shape the backend returns into our canonical `JobRow`. */
function normaliseJob(raw: unknown): JobRow | null {
  if (!raw || typeof raw !== 'object') return null
  const r = raw as Record<string, unknown>
  const status = (r['status'] as JobStatus) ?? 'pending'
  // Some backends nest suggestions under `result.suggestions` — accept both.
  let suggestions: Record<string, unknown> | null = null
  if (r['suggestions'] && typeof r['suggestions'] === 'object') {
    suggestions = r['suggestions'] as Record<string, unknown>
  } else if (
    r['result'] &&
    typeof r['result'] === 'object' &&
    (r['result'] as Record<string, unknown>)['suggestions']
  ) {
    suggestions = (r['result'] as Record<string, unknown>)['suggestions'] as Record<string, unknown>
  }
  return {
    id: String(r['id'] ?? r['jobId'] ?? ''),
    status,
    payload: (r['payload'] ?? null) as JobRow['payload'],
    suggestions,
    errorCode: (r['errorCode'] as string | null) ?? null,
    errorMessage: (r['errorMessage'] as string | null) ?? null,
    publishError: (r['publishError'] as string | null) ?? null,
    createdAt: (r['createdAt'] as string | null) ?? null,
    startedAt: (r['startedAt'] as string | null) ?? null,
    finishedAt: (r['finishedAt'] as string | null) ?? null,
  }
}

// ── Component ─────────────────────────────────────────────────────────

export interface FigureReingestPanelProps {
  slug: string
  current: FigureReingestCurrentSnapshot
}

export function FigureReingestPanel({ slug, current }: FigureReingestPanelProps) {
  // Form state
  const [mode, setMode] = React.useState<Mode>('enrich')
  const [focus, setFocus] = React.useState<Set<string>>(
    () => new Set(['biography', 'summary']),
  )
  const [hints, setHints] = React.useState('')

  // Job state
  const [submitting, setSubmitting] = React.useState(false)
  const [job, setJob] = React.useState<JobRow | null>(null)
  const [polling, setPolling] = React.useState(false)
  const [pollTimedOut, setPollTimedOut] = React.useState(false)
  const [diffOpen, setDiffOpen] = React.useState(false)
  /** Field keys the admin already accepted (or rejected) in this session, so
   *  the row hides its buttons + shows a state badge. */
  const [resolved, setResolved] = React.useState<Record<string, 'accepted' | 'rejected'>>({})
  /** Toggle between compact table layout and side-by-side comparison cards. */
  const [compareView, setCompareView] = React.useState<'table' | 'side'>('table')

  // History: last AI ingest job (independent of the current submission).
  const [recent, setRecent] = React.useState<JobRow | null>(null)

  // Refs to manage polling lifecycle without re-triggering effects on every
  // job tick.
  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const pollDeadlineRef = React.useRef<number>(0)
  const activeJobIdRef = React.useRef<string | null>(null)

  const stopPolling = React.useCallback(() => {
    if (pollTimerRef.current) {
      clearInterval(pollTimerRef.current)
      pollTimerRef.current = null
    }
    setPolling(false)
  }, [])

  React.useEffect(() => {
    return () => {
      if (pollTimerRef.current) clearInterval(pollTimerRef.current)
    }
  }, [])

  // ── Load most recent job on mount (for the "Terakhir diperbarui" line) ──
  React.useEffect(() => {
    let cancelled = false
    async function loadRecent() {
      try {
        const raw = await api.get<unknown>(
          `/admin/figures/${encodeURIComponent(slug)}/re-ingest-jobs`,
        )
        if (cancelled) return
        // Endpoint may return an array (recent jobs) or a single object.
        const list = Array.isArray(raw)
          ? raw
          : raw && typeof raw === 'object' && Array.isArray((raw as Record<string, unknown>)['rows'])
            ? ((raw as Record<string, unknown>)['rows'] as unknown[])
            : null
        if (list && list.length > 0) {
          const parsed = normaliseJob(list[0])
          if (parsed) setRecent(parsed)
        } else {
          const single = normaliseJob(raw)
          if (single?.id) setRecent(single)
        }
      } catch {
        // 404 (no history) is expected on figures that have never been
        // re-ingested. Silent.
      }
    }
    void loadRecent()
    return () => {
      cancelled = true
    }
  }, [slug])

  // ── Submit ────────────────────────────────────────────────────────────
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    if (focus.size === 0) {
      toast.error('Pilih minimal satu field untuk difokuskan AI.')
      return
    }
    setSubmitting(true)
    setPollTimedOut(false)
    setResolved({})
    try {
      const body = {
        mode,
        focusFields: expandFocusGroups(focus),
        ...(hints.trim().length > 0 ? { hints: hints.trim() } : {}),
      }
      const res = await api.post<{
        jobId: string
        status: JobStatus
        publishError?: string
      }>(`/admin/figures/${encodeURIComponent(slug)}/re-ingest`, body)

      activeJobIdRef.current = res.jobId
      setJob({
        id: res.jobId,
        status: res.status ?? 'pending',
        publishError: res.publishError ?? null,
      })

      if (res.publishError) {
        toast.warning(
          'QStash gagal publish — job tercatat sebagai pending, klik "Coba lagi" jika worker tidak terpicu.',
        )
      } else {
        toast.success('Crawl ulang dimulai. Hasil ~30–60 detik.')
      }

      startPolling(res.jobId)
    } catch (err) {
      if (err instanceof ApiClientError) {
        if (err.status === 404) {
          toast.error('Endpoint re-ingest belum tersedia.')
        } else {
          toast.error(err.message || 'Gagal memulai crawl ulang.')
        }
      } else {
        toast.error('Gagal memulai crawl ulang. Coba lagi.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  // ── Polling ───────────────────────────────────────────────────────────
  function startPolling(jobId: string) {
    stopPolling()
    pollDeadlineRef.current = Date.now() + POLL_TIMEOUT_MS
    setPolling(true)
    setPollTimedOut(false)

    const tick = async () => {
      if (Date.now() > pollDeadlineRef.current) {
        stopPolling()
        setPollTimedOut(true)
        toast.info('Crawl masih berjalan, refresh nanti.')
        return
      }
      try {
        const raw = await api.get<unknown>(
          `/admin/figures/${encodeURIComponent(slug)}/re-ingest-jobs?jobId=${encodeURIComponent(jobId)}`,
        )
        // Endpoint may return single object or `{ rows: [...] }` — pick the
        // matching jobId.
        let parsed: JobRow | null = null
        if (Array.isArray(raw)) {
          parsed = normaliseJob(raw.find((r) => (r as Record<string, unknown>)?.['id'] === jobId))
        } else if (
          raw &&
          typeof raw === 'object' &&
          Array.isArray((raw as Record<string, unknown>)['rows'])
        ) {
          const rows = (raw as Record<string, unknown>)['rows'] as unknown[]
          parsed = normaliseJob(rows.find((r) => (r as Record<string, unknown>)?.['id'] === jobId))
        } else {
          parsed = normaliseJob(raw)
        }
        if (!parsed) return

        setJob(parsed)
        if (parsed.status === 'completed') {
          stopPolling()
          setRecent(parsed)
          if (parsed.suggestions && Object.keys(parsed.suggestions).length > 0) {
            toast.success('Saran AI siap. Tinjau diff di bawah.')
            setDiffOpen(true)
          } else {
            toast.info('AI selesai tapi tidak ada saran perubahan.')
          }
        } else if (parsed.status === 'failed') {
          stopPolling()
          toast.error(parsed.errorMessage ?? 'Crawl ulang gagal.')
        }
      } catch (err) {
        // Transient errors during polling are OK — we'll retry on the next
        // tick. Surface a soft warning only on persistent 404 (job missing).
        if (err instanceof ApiClientError && err.status === 404) {
          stopPolling()
          toast.error('Job tidak ditemukan saat polling.')
        }
      }
    }

    // Kick once immediately so the UI doesn't sit at "pending" for 5s.
    void tick()
    pollTimerRef.current = setInterval(tick, POLL_INTERVAL_MS)
  }

  // ── Retry (after publishError) ────────────────────────────────────────
  async function handleRetryPublish() {
    if (!job?.id) return
    setSubmitting(true)
    try {
      await api.post(`/admin/figures/${encodeURIComponent(slug)}/re-ingest`, {
        mode,
        focusFields: expandFocusGroups(focus),
        ...(hints.trim().length > 0 ? { hints: hints.trim() } : {}),
        retryJobId: job.id,
      })
      toast.success('Re-trigger dikirim.')
      startPolling(job.id)
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal retry'
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  // ── Accept / Reject ───────────────────────────────────────────────────
  async function acceptField(key: string, value: unknown) {
    try {
      await api.patch(`/figures/${encodeURIComponent(slug)}`, { [key]: value })
      setResolved((r) => ({ ...r, [key]: 'accepted' }))
      toast.success(`Diterima: ${FIELD_LABELS[key] ?? key}`)
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal menerapkan saran'
      toast.error(msg)
    }
  }

  function rejectField(key: string) {
    setResolved((r) => ({ ...r, [key]: 'rejected' }))
  }

  async function acceptAll() {
    if (!job?.suggestions) return
    const entries = Object.entries(job.suggestions).filter(
      ([k]) => !resolved[k] && k in FIELD_LABELS,
    )
    if (entries.length === 0) return
    const patch: Record<string, unknown> = {}
    for (const [k, v] of entries) patch[k] = v
    try {
      await api.patch(`/figures/${encodeURIComponent(slug)}`, patch)
      const next: typeof resolved = { ...resolved }
      for (const [k] of entries) next[k] = 'accepted'
      setResolved(next)
      toast.success(`Diterima ${entries.length} saran.`)
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal menerapkan semua saran'
      toast.error(msg)
    }
  }

  function rejectAll() {
    if (!job?.suggestions) return
    const next: typeof resolved = { ...resolved }
    for (const k of Object.keys(job.suggestions)) {
      if (!resolved[k]) next[k] = 'rejected'
    }
    setResolved(next)
  }

  // ── Render ────────────────────────────────────────────────────────────
  const status = job?.status
  const isRunning = polling || status === 'pending' || status === 'running'

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <div className="rounded-md bg-[rgb(var(--accent))]/10 p-2 text-[rgb(var(--accent))]">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <CardTitle>Perbarui via AI</CardTitle>
                <CardDescription className="mt-1">
                  AI akan crawl ulang 30 domain whitelist dan menyarankan
                  perbaikan untuk biografi, citation, dan field yang masih
                  kosong.
                </CardDescription>
              </div>
            </div>
            {recent ? (
              <div className="hidden text-right text-xs text-[rgb(var(--text-muted))] sm:block">
                Terakhir diperbarui oleh AI:{' '}
                <span className="font-medium text-[rgb(var(--text))]">
                  {formatRelative(recent.finishedAt ?? recent.createdAt)}
                </span>
              </div>
            ) : null}
          </div>
        </CardHeader>

        <CardContent>
          <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
            {/* ── Mode ──────────────────────────────────────────── */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-[rgb(var(--text))]">Mode</legend>
              <RadioGroup
                value={mode}
                onValueChange={(v) => setMode(v as Mode)}
                className="grid gap-2 sm:grid-cols-2"
              >
                <label
                  htmlFor="reingest-mode-enrich"
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-[rgb(var(--border))] p-3 hover:bg-[rgb(var(--bg-elevated))]"
                >
                  <RadioGroupItem value="enrich" id="reingest-mode-enrich" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Enrich</div>
                    <p className="text-xs text-[rgb(var(--text-muted))]">
                      Isi field yang masih kosong saja. Aman.
                    </p>
                  </div>
                </label>
                <label
                  htmlFor="reingest-mode-replace"
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-[rgb(var(--border))] p-3 hover:bg-[rgb(var(--bg-elevated))]"
                >
                  <RadioGroupItem value="replace" id="reingest-mode-replace" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Replace</div>
                    <p className="text-xs text-[rgb(var(--text-muted))]">
                      Timpa biografi &amp; ringkasan yang sudah ada.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </fieldset>

            {/* ── Focus fields ──────────────────────────────────── */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-[rgb(var(--text))]">
                Fokus field
              </legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FOCUS_FIELD_GROUPS.map((g) => {
                  const id = `reingest-focus-${g.id}`
                  const checked = focus.has(g.id)
                  return (
                    <label
                      key={g.id}
                      htmlFor={id}
                      className="flex cursor-pointer items-center gap-2 rounded-md border border-[rgb(var(--border))] p-2 text-sm hover:bg-[rgb(var(--bg-elevated))]"
                    >
                      <Checkbox
                        id={id}
                        checked={checked}
                        onCheckedChange={(v) => {
                          setFocus((prev) => {
                            const next = new Set(prev)
                            if (v) next.add(g.id)
                            else next.delete(g.id)
                            return next
                          })
                        }}
                      />
                      <span>{g.label}</span>
                    </label>
                  )
                })}
              </div>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                AI hanya akan fokus pada field yang dicentang. Tidak dicentang =
                tidak diutak-atik.
              </p>
            </fieldset>

            {/* ── Hints ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label htmlFor="reingest-hints">Petunjuk tambahan (opsional)</Label>
              <Textarea
                id="reingest-hints"
                rows={3}
                value={hints}
                onChange={(e) => setHints(e.target.value)}
                placeholder="Misal: fokus pada tahun wafat dari Tahdzib at-Tahdzib. Jangan ambil dari Wikipedia."
              />
            </div>

            {/* ── Status row ───────────────────────────────────── */}
            {job ? (
              <div className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {isRunning ? (
                      <Loader2 className="h-4 w-4 animate-spin text-[rgb(var(--text-muted))]" />
                    ) : status === 'completed' ? (
                      <Check className="h-4 w-4 text-[rgb(var(--success,16_185_129))]" />
                    ) : status === 'failed' ? (
                      <AlertCircle className="h-4 w-4 text-[rgb(var(--danger))]" />
                    ) : null}
                    <span className="font-medium">
                      {status === 'pending' && 'Antri…'}
                      {status === 'running' && 'AI sedang crawl…'}
                      {status === 'completed' && 'Selesai. Diff siap ditinjau.'}
                      {status === 'failed' && (job.errorMessage ?? 'Gagal')}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    {status === 'completed' &&
                    job.suggestions &&
                    Object.keys(job.suggestions).length > 0 ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => setDiffOpen(true)}
                      >
                        Tinjau diff
                      </Button>
                    ) : null}
                    {job.publishError ? (
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={handleRetryPublish}
                        disabled={submitting}
                      >
                        <RefreshCw className="h-4 w-4" />
                        Coba lagi
                      </Button>
                    ) : null}
                  </div>
                </div>
                {pollTimedOut ? (
                  <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
                    Crawl masih berjalan, refresh nanti.
                  </p>
                ) : null}
                {job.publishError ? (
                  <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
                    QStash publish gagal: <code>{job.publishError}</code>
                  </p>
                ) : null}
              </div>
            ) : null}

            {/* ── Submit ───────────────────────────────────────── */}
            <div className="flex items-center justify-between gap-3">
              <p className="text-xs text-[rgb(var(--text-muted))] sm:hidden">
                {recent
                  ? `Terakhir oleh AI: ${formatRelative(recent.finishedAt ?? recent.createdAt)}`
                  : null}
              </p>
              <Button type="submit" disabled={submitting || isRunning}>
                {submitting || isRunning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                Mulai Crawl Ulang
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      {/* ── Diff dialog ────────────────────────────────────────── */}
      <Dialog open={diffOpen} onOpenChange={setDiffOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>Saran AI</DialogTitle>
            <DialogDescription>
              Bandingkan nilai sekarang dengan saran AI. Terima per field, atau
              gunakan tombol massal di bawah.
            </DialogDescription>
          </DialogHeader>

          <div className="flex items-center justify-end pb-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                setCompareView((v) => (v === 'table' ? 'side' : 'table'))
              }
            >
              {compareView === 'table'
                ? 'Tampilkan sebagai perbandingan'
                : 'Tampilkan sebagai tabel'}
            </Button>
          </div>

          {compareView === 'table' ? (
            <div className="max-h-[60vh] overflow-auto rounded-md border border-[rgb(var(--border))]">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-[rgb(var(--bg-elevated))] text-xs uppercase text-[rgb(var(--text-muted))]">
                  <tr>
                    <th className="px-3 py-2">Field</th>
                    <th className="px-3 py-2">Sekarang</th>
                    <th className="px-3 py-2">Saran AI</th>
                    <th className="px-3 py-2 text-right">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {job?.suggestions && Object.keys(job.suggestions).length > 0 ? (
                    Object.entries(job.suggestions).map(([key, suggested]) => {
                      const label = FIELD_LABELS[key] ?? key
                      const currentVal = (current as Record<string, unknown>)[key]
                      const state = resolved[key]
                      const applyable = key in FIELD_LABELS && key !== 'citations'
                      return (
                        <tr
                          key={key}
                          className="border-t border-[rgb(var(--border))] align-top"
                        >
                          <td className="px-3 py-2 font-medium">{label}</td>
                          <td className="px-3 py-2 text-[rgb(var(--text-muted))]">
                            <div className="max-w-[18rem] whitespace-pre-wrap break-words">
                              {previewValue(currentVal)}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            <div className="max-w-[20rem] whitespace-pre-wrap break-words">
                              {previewValue(suggested)}
                            </div>
                          </td>
                          <td className="px-3 py-2">
                            {state === 'accepted' ? (
                              <span className="text-xs font-medium text-[rgb(var(--success,16_185_129))]">
                                Diterima
                              </span>
                            ) : state === 'rejected' ? (
                              <span className="text-xs text-[rgb(var(--text-muted))]">
                                Ditolak
                              </span>
                            ) : (
                              <div className="flex justify-end gap-1">
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="outline"
                                  onClick={() => acceptField(key, suggested)}
                                  disabled={!applyable}
                                  title={
                                    applyable
                                      ? 'Terapkan saran ini'
                                      : 'Field ini perlu disunting manual'
                                  }
                                >
                                  <Check className="h-3.5 w-3.5" />
                                  Terima
                                </Button>
                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => rejectField(key)}
                                >
                                  <X className="h-3.5 w-3.5" />
                                  Tolak
                                </Button>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })
                  ) : (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-[rgb(var(--text-muted))]">
                        Tidak ada saran perubahan.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-auto pr-1">
              {job?.suggestions && Object.keys(job.suggestions).length > 0 ? (
                Object.entries(job.suggestions).map(([key, suggested]) => {
                  const label = FIELD_LABELS[key] ?? key
                  const currentVal = (current as Record<string, unknown>)[key]
                  const state = resolved[key]
                  const applyable = key in FIELD_LABELS && key !== 'citations'
                  const useTextDiff = TEXT_DIFF_FIELDS.has(key)
                  return (
                    <div
                      key={key}
                      className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3"
                    >
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <div className="text-sm font-semibold text-[rgb(var(--text))]">
                          {label}
                        </div>
                        {state === 'accepted' ? (
                          <span className="text-xs font-medium text-[rgb(var(--success,16_185_129))]">
                            Diterima
                          </span>
                        ) : state === 'rejected' ? (
                          <span className="text-xs text-[rgb(var(--text-muted))]">
                            Ditolak
                          </span>
                        ) : null}
                      </div>

                      {useTextDiff ? (
                        <DiffViewer
                          oldValue={fullValue(currentVal)}
                          newValue={fullValue(suggested)}
                          leftTitle="Sekarang"
                          rightTitle="Saran AI"
                          splitView
                        />
                      ) : (
                        <div className="grid gap-3 lg:grid-cols-2">
                          <div className="rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3">
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-[rgb(var(--text-faint))]">
                              Sekarang
                            </div>
                            <div className="whitespace-pre-wrap break-words text-sm text-[rgb(var(--text-muted))]">
                              {previewValue(currentVal)}
                            </div>
                          </div>
                          <div className="rounded-md border border-emerald-500/30 bg-emerald-500/5 p-3">
                            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-300">
                              Saran AI
                            </div>
                            <div className="whitespace-pre-wrap break-words text-sm text-[rgb(var(--text))]">
                              {previewValue(suggested)}
                            </div>
                          </div>
                        </div>
                      )}

                      {!state ? (
                        <div className="mt-3 flex justify-end gap-1">
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={() => acceptField(key, suggested)}
                            disabled={!applyable}
                            title={
                              applyable
                                ? 'Terapkan saran ini'
                                : 'Field ini perlu disunting manual'
                            }
                          >
                            <Check className="h-3.5 w-3.5" />
                            Terima
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            onClick={() => rejectField(key)}
                          >
                            <X className="h-3.5 w-3.5" />
                            Tolak
                          </Button>
                        </div>
                      ) : null}
                    </div>
                  )
                })
              ) : (
                <div className="rounded-md border border-[rgb(var(--border))] px-3 py-6 text-center text-sm text-[rgb(var(--text-muted))]">
                  Tidak ada saran perubahan.
                </div>
              )}
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-2">
            <Button type="button" variant="ghost" onClick={rejectAll}>
              Tolak semua
            </Button>
            <Button type="button" onClick={acceptAll}>
              Terima semua
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
