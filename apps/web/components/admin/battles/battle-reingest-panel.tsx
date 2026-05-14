// `<BattleReingestPanel />` — "Perbarui via AI" card for battles.
//
// Used both on:
//   - `/admin/battles/[slug]/edit` (passed as a sibling card)
//   - `/battles/[slug]` public detail page, via <BattleReingestDialog />
//
// Flow:
//   1. Admin picks a mode (`enrich` = isi field kosong saja, or `replace` =
//      timpa narasi & strategi) + a list of focus fields + optional hints,
//      then POSTs to `/api/v1/admin/battles/[slug]/re-ingest`.
//   2. Endpoint returns `202 { jobId, status: 'pending', publishError? }`.
//   3. We poll `/api/v1/admin/battles/[slug]/re-ingest-jobs?jobId=…` every 5s
//      until status is `completed` or `failed`, with a 3-minute timeout.
//   4. On `completed`, the job row carries a `suggestions` object — a
//      field-by-field mapping of AI-proposed values. We render a diff dialog
//      where the admin accepts/rejects per row.
//        - "Terima" → `PATCH /api/v1/battles/[slug]` with just that field.
//        - "Tolak" → no-op (row marked rejected, won't fire again).
//        - "Terima semua" / "Tolak semua" act on the remaining rows.
//      Citations are append-only: in replace mode old citations stay.
//
// The diff dialog has two visual modes:
//   - Table view (default): one row per field, action buttons in the right
//     column. Compact.
//   - Side-by-side comparison: each field becomes a card with "Sekarang" on
//     the left and "Saran AI" on the right, with line-level diff highlighting
//     via `react-diff-viewer-continued` for textual fields.
//
// Mirrors `<FigureReingestPanel />` exactly.

'use client'

import * as React from 'react'
import { useRouter } from 'next/navigation'
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
// only enters the bundle once the admin actually opens the side-by-side view.
const DiffViewer = dynamic(
  () => import('@/components/reviewer/diff-viewer').then((m) => m.DiffViewer),
  { ssr: false },
)

// ── Types ─────────────────────────────────────────────────────────────

type Mode = 'enrich' | 'replace'
type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

/** Snapshot of the battle's current values for the fields the AI may suggest.
 *  Used as the "Sekarang" column in the diff dialog. */
export interface BattleReingestCurrentSnapshot {
  narrativeId?: string | null
  narrativeAr?: string | null
  strategyId?: string | null
  strategyAr?: string | null
  significanceId?: string | null
  significanceAr?: string | null
  eventDateAh?: number | null
  eventDateCe?: number | null
  opponentForce?: string | null
  muslimCount?: number | null
  opponentCount?: number | null
  outcome?: string | null
  casualtiesMuslim?: number | null
  casualtiesOpponent?: number | null
  commanderId?: string | null
  locationId?: string | null
  [extra: string]: unknown
}

interface JobRow {
  id: string
  status: JobStatus
  payload?: {
    mode?: Mode
    focusFields?: string[]
    hints?: string
    metadata?: {
      fieldsChanged?: string[]
      sourcesUsed?: number
      citationsInserted?: number
      locationFilled?: boolean
      commanderFilled?: boolean
      // Phase 7.5.6 — participants / phases sub-pipeline summary.
      participantsAdded?: number
      participantsUpdated?: number
      participantsSkipped?: number
      participants?: {
        added?: {
          figureId: string
          nameId: string
          nameAr: string
          role: string
        }[]
        updated?: { figureId: string; nameId: string }[]
        skipped?: { nameId: string; nameAr: string }[]
      }
      phasesInserted?: number
      phasesSoftDeleted?: number
      phases?: {
        inserted?: number
        softDeleted?: number
        titlesId?: string[]
      }
    }
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

interface FocusFieldGroup {
  /** Stable id for the focus-field multi-select (sent to backend). */
  id: string
  /** Indonesian label shown in the form. */
  label: string
}

const FOCUS_FIELD_GROUPS: FocusFieldGroup[] = [
  { id: 'narrativeId', label: 'Narasi' },
  { id: 'strategyId', label: 'Strategi' },
  { id: 'significanceId', label: 'Signifikansi' },
  { id: 'commanderId', label: 'Komandan' },
  { id: 'locationId', label: 'Lokasi' },
  { id: 'eventDateAh', label: 'Tahun (H)' },
  { id: 'eventDateCe', label: 'Tahun (M)' },
  { id: 'opponentForce', label: 'Pasukan musuh' },
  { id: 'muslimCount', label: 'Jumlah muslim' },
  { id: 'opponentCount', label: 'Jumlah musuh' },
  { id: 'outcome', label: 'Hasil' },
  { id: 'casualtiesMuslim', label: 'Korban muslim' },
  { id: 'casualtiesOpponent', label: 'Korban musuh' },
  // Phase 7.5.6 — virtual focus fields driving the worker's
  // battle_participants / battle_phases sub-pipelines.
  { id: 'participants', label: 'Tokoh peserta' },
  { id: 'phases', label: 'Fase pertempuran' },
  { id: 'citations', label: 'Sitasi' },
]

const FIELD_LABELS: Record<string, string> = {
  narrativeId: 'Narasi (ID)',
  narrativeAr: 'Narasi (AR)',
  strategyId: 'Strategi (ID)',
  strategyAr: 'Strategi (AR)',
  significanceId: 'Signifikansi (ID)',
  significanceAr: 'Signifikansi (AR)',
  eventDateAh: 'Tahun (H)',
  eventDateCe: 'Tahun (M)',
  opponentForce: 'Pasukan musuh',
  muslimCount: 'Jumlah muslim',
  opponentCount: 'Jumlah musuh',
  outcome: 'Hasil',
  casualtiesMuslim: 'Korban muslim',
  casualtiesOpponent: 'Korban musuh',
  commanderId: 'Komandan',
  locationId: 'Lokasi',
  citations: 'Sitasi',
  participants: 'Tokoh peserta',
  phases: 'Fase pertempuran',
}

/** Fields that should never be patched directly by the diff dialog. Citations
 *  are append-only on the backend; commander/location are FK pickers, not
 *  free-text. Participants and phases are virtual focus fields — the worker
 *  has already written the rows by the time the dialog opens, so "Terima"
 *  is a no-op and we only expose "Tinjau" / "Tolak" via custom rendering.
 *  The "Terima" button is disabled for all of these. */
const NON_PATCHABLE_FIELDS = new Set([
  'citations',
  'commanderId',
  'locationId',
  'participants',
  'phases',
])

/** Fields whose suggestion value is a long string — these get the
 *  `react-diff-viewer-continued` line-level highlight in side-by-side mode.
 *  Short / numeric / scalar fields just show plain text side by side. */
const TEXT_DIFF_FIELDS = new Set([
  'narrativeId',
  'narrativeAr',
  'strategyId',
  'strategyAr',
  'significanceId',
  'significanceAr',
  'opponentForce',
])

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

/**
 * Human-readable summary for the virtual participants/phases rows in the diff
 * dialog. Falls back to the generic `previewValue` for every other key. */
function previewForKey(key: string, v: unknown): string {
  if (key === 'participants' && v && typeof v === 'object') {
    const m = v as {
      added?: unknown[]
      updated?: unknown[]
      skipped?: unknown[]
    }
    const parts = [
      `${m.added?.length ?? 0} baru`,
      `${m.updated?.length ?? 0} diperbarui`,
      `${m.skipped?.length ?? 0} dilewati`,
    ]
    return parts.join(', ')
  }
  if (key === 'phases' && v && typeof v === 'object') {
    const m = v as { inserted?: number; softDeleted?: number; titlesId?: string[] }
    const parts: string[] = []
    parts.push(`${m.inserted ?? 0} urutan baru`)
    if (m.softDeleted) parts.push(`${m.softDeleted} fase lama disimpan`)
    return parts.join(', ')
  }
  return previewValue(v)
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

export interface BattleReingestPanelProps {
  slug: string
  /** Snapshot of current battle values used as the "Sekarang" column in the
   *  diff dialog. Optional for backwards-compat with the admin edit page,
   *  which passes only `slug`; in that case the dialog still shows "(kosong)"
   *  on the left until the admin opens it from a page that has the snapshot. */
  current?: BattleReingestCurrentSnapshot
}

export function BattleReingestPanel({ slug, current }: BattleReingestPanelProps) {
  const router = useRouter()

  // Form state
  const [mode, setMode] = React.useState<Mode>('enrich')
  const [focus, setFocus] = React.useState<Set<string>>(
    () => new Set(['narrativeId', 'strategyId', 'significanceId']),
  )
  const [hints, setHints] = React.useState('')

  // Job state
  const [submitting, setSubmitting] = React.useState(false)
  const [job, setJob] = React.useState<JobRow | null>(null)
  const [polling, setPolling] = React.useState(false)
  const [pollTimedOut, setPollTimedOut] = React.useState(false)
  const [diffOpen, setDiffOpen] = React.useState(false)
  /** Field keys the admin already accepted (or rejected) in this session. */
  const [resolved, setResolved] = React.useState<Record<string, 'accepted' | 'rejected'>>({})
  /** Toggle between table layout and side-by-side comparison cards. */
  const [compareView, setCompareView] = React.useState<'table' | 'side'>('table')

  // History
  const [recent, setRecent] = React.useState<JobRow | null>(null)

  const pollTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const pollDeadlineRef = React.useRef<number>(0)

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

  // Load most recent job on mount.
  React.useEffect(() => {
    let cancelled = false
    async function loadRecent() {
      try {
        const raw = await api.get<unknown>(
          `/admin/battles/${encodeURIComponent(slug)}/re-ingest-jobs`,
        )
        if (cancelled) return
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
        // 404 on first refresh is expected; silent.
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
        focusFields: Array.from(focus),
        ...(hints.trim().length > 0 ? { hints: hints.trim() } : {}),
      }
      const res = await api.post<{
        jobId: string
        status: JobStatus
        publishError?: string
      }>(`/admin/battles/${encodeURIComponent(slug)}/re-ingest`, body)

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
          `/admin/battles/${encodeURIComponent(slug)}/re-ingest-jobs?jobId=${encodeURIComponent(jobId)}`,
        )
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
          const m = parsed.payload?.metadata
          const hasParticipantChanges =
            (m?.participantsAdded ?? 0) > 0 ||
            (m?.participantsUpdated ?? 0) > 0 ||
            (m?.participantsSkipped ?? 0) > 0
          const hasPhaseChanges =
            (m?.phasesInserted ?? 0) > 0 || (m?.phasesSoftDeleted ?? 0) > 0
          if (
            (parsed.suggestions && Object.keys(parsed.suggestions).length > 0) ||
            hasParticipantChanges ||
            hasPhaseChanges
          ) {
            toast.success('Saran AI siap. Tinjau diff di bawah.')
            setDiffOpen(true)
            // Tokoh + Fase are written eagerly by the worker — refresh so the
            // public detail page reflects the new rows when the dialog closes.
            if (hasParticipantChanges || hasPhaseChanges) router.refresh()
          } else {
            // Worker may have already applied the patch directly (older
            // contract). Trigger a hard refresh so the page reflects new
            // values, but still surface a status toast.
            const changed = m?.fieldsChanged ?? []
            if (changed.length > 0) {
              toast.success(`AI selesai. ${changed.length} field diperbarui.`)
              router.refresh()
            } else {
              toast.info('AI selesai tapi tidak ada saran perubahan.')
            }
          }
        } else if (parsed.status === 'failed') {
          stopPolling()
          toast.error(parsed.errorMessage ?? 'Crawl ulang gagal.')
        }
      } catch (err) {
        if (err instanceof ApiClientError && err.status === 404) {
          stopPolling()
          toast.error('Job tidak ditemukan saat polling.')
        }
      }
    }

    void tick()
    pollTimerRef.current = setInterval(tick, POLL_INTERVAL_MS)
  }

  // ── Retry (after publishError) ────────────────────────────────────────
  async function handleRetryPublish() {
    if (!job?.id) return
    setSubmitting(true)
    try {
      await api.post(`/admin/battles/${encodeURIComponent(slug)}/re-ingest`, {
        mode,
        focusFields: Array.from(focus),
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
    if (NON_PATCHABLE_FIELDS.has(key)) {
      toast.info('Field ini perlu disunting manual di form edit.')
      return
    }
    try {
      await api.patch(`/battles/${encodeURIComponent(slug)}`, { [key]: value })
      setResolved((r) => ({ ...r, [key]: 'accepted' }))
      toast.success(`Diterima: ${FIELD_LABELS[key] ?? key}`)
      router.refresh()
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
      ([k]) =>
        !resolved[k] && k in FIELD_LABELS && !NON_PATCHABLE_FIELDS.has(k),
    )
    if (entries.length === 0) return
    const patch: Record<string, unknown> = {}
    for (const [k, v] of entries) patch[k] = v
    try {
      await api.patch(`/battles/${encodeURIComponent(slug)}`, patch)
      const next: typeof resolved = { ...resolved }
      for (const [k] of entries) next[k] = 'accepted'
      setResolved(next)
      toast.success(`Diterima ${entries.length} saran.`)
      router.refresh()
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

  // ── Derived ───────────────────────────────────────────────────────────
  const status = job?.status
  const isRunning = polling || status === 'pending' || status === 'running'
  const meta = job?.payload?.metadata ?? recent?.payload?.metadata

  /** Stable ordered list of suggestion entries — used by both views.
   *  Phase 7.5.6: when the worker writes `metadata.participants` /
   *  `metadata.phases`, we synthesise virtual rows so admins can review them
   *  in the diff dialog even though the data is already in the database. */
  const suggestionEntries = React.useMemo(() => {
    const base: [string, unknown][] = job?.suggestions
      ? Object.entries(job.suggestions)
      : []
    const m = job?.payload?.metadata
    if (m?.participants && !base.some(([k]) => k === 'participants')) {
      base.push(['participants', m.participants])
    }
    if (m?.phases && !base.some(([k]) => k === 'phases')) {
      base.push(['phases', m.phases])
    }
    return base
  }, [job?.suggestions, job?.payload?.metadata])

  const currentRecord = (current ?? {}) as Record<string, unknown>

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
                  perbaikan untuk narasi, strategi, signifikansi, dan field
                  pertempuran yang masih kosong.
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
                  htmlFor="battle-reingest-mode-enrich"
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-[rgb(var(--border))] p-3 hover:bg-[rgb(var(--bg-elevated))]"
                >
                  <RadioGroupItem value="enrich" id="battle-reingest-mode-enrich" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Enrich</div>
                    <p className="text-xs text-[rgb(var(--text-muted))]">
                      Isi field yang masih kosong saja. Aman.
                    </p>
                  </div>
                </label>
                <label
                  htmlFor="battle-reingest-mode-replace"
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-[rgb(var(--border))] p-3 hover:bg-[rgb(var(--bg-elevated))]"
                >
                  <RadioGroupItem value="replace" id="battle-reingest-mode-replace" className="mt-1" />
                  <div>
                    <div className="text-sm font-medium">Replace</div>
                    <p className="text-xs text-[rgb(var(--text-muted))]">
                      Timpa field terpilih dengan hasil AI yang baru.
                    </p>
                  </div>
                </label>
              </RadioGroup>
            </fieldset>

            {/* ── Focus fields ──────────────────────────────────── */}
            <fieldset className="space-y-3">
              <legend className="text-sm font-medium text-[rgb(var(--text))]">Fokus field</legend>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {FOCUS_FIELD_GROUPS.map((g) => {
                  const id = `battle-reingest-focus-${g.id}`
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
                Mode Replace hanya akan menimpa field yang dicentang. Mode
                Enrich mengabaikan field yang sudah ada isinya. Sitasi selalu
                ditambah (append-only) — tidak pernah dihapus.
              </p>
            </fieldset>

            {/* ── Hints ─────────────────────────────────────────── */}
            <div className="space-y-2">
              <Label htmlFor="battle-reingest-hints">Petunjuk tambahan (opsional)</Label>
              <Textarea
                id="battle-reingest-hints"
                rows={3}
                value={hints}
                onChange={(e) => setHints(e.target.value)}
                placeholder="Misal: fokus pada strategi pasukan menurut Sirah Ibnu Hisyam. Jangan ambil dari Wikipedia."
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
                {meta?.fieldsChanged && meta.fieldsChanged.length > 0 ? (
                  <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
                    Field diperbarui worker:{' '}
                    <span className="font-medium text-[rgb(var(--text))]">
                      {meta.fieldsChanged.join(', ')}
                    </span>
                  </p>
                ) : null}
                {meta?.citationsInserted ? (
                  <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">
                    {meta.citationsInserted} sitasi baru disisipkan.
                  </p>
                ) : null}
                {(meta?.participantsAdded ?? 0) > 0 ||
                (meta?.participantsUpdated ?? 0) > 0 ||
                (meta?.participantsSkipped ?? 0) > 0 ? (
                  <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">
                    Tokoh:{' '}
                    <span className="font-medium text-[rgb(var(--text))]">
                      {meta?.participantsAdded ?? 0} baru
                    </span>
                    {meta?.participantsUpdated ? `, ${meta.participantsUpdated} diperbarui` : ''}
                    {meta?.participantsSkipped ? `, ${meta.participantsSkipped} dilewati` : ''}.
                  </p>
                ) : null}
                {(meta?.phasesInserted ?? 0) > 0 || (meta?.phasesSoftDeleted ?? 0) > 0 ? (
                  <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">
                    Fase:{' '}
                    <span className="font-medium text-[rgb(var(--text))]">
                      {meta?.phasesInserted ?? 0} urutan baru
                    </span>
                    {meta?.phasesSoftDeleted
                      ? `, ${meta.phasesSoftDeleted} fase lama disimpan (soft-delete)`
                      : ''}
                    .
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
            <DiffTable
              suggestionEntries={suggestionEntries}
              currentRecord={currentRecord}
              resolved={resolved}
              acceptField={acceptField}
              rejectField={rejectField}
            />
          ) : (
            <DiffSideBySide
              suggestionEntries={suggestionEntries}
              currentRecord={currentRecord}
              resolved={resolved}
              acceptField={acceptField}
              rejectField={rejectField}
            />
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

// ── Sub-views ─────────────────────────────────────────────────────────

interface DiffSubProps {
  suggestionEntries: [string, unknown][]
  currentRecord: Record<string, unknown>
  resolved: Record<string, 'accepted' | 'rejected'>
  acceptField: (key: string, value: unknown) => void | Promise<void>
  rejectField: (key: string) => void
}

function DiffTable({
  suggestionEntries,
  currentRecord,
  resolved,
  acceptField,
  rejectField,
}: DiffSubProps) {
  if (suggestionEntries.length === 0) {
    return (
      <div className="rounded-md border border-[rgb(var(--border))] px-3 py-6 text-center text-sm text-[rgb(var(--text-muted))]">
        Tidak ada saran perubahan.
      </div>
    )
  }
  return (
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
          {suggestionEntries.map(([key, suggested]) => {
            const label = FIELD_LABELS[key] ?? key
            const currentVal = currentRecord[key]
            const state = resolved[key]
            const applyable = key in FIELD_LABELS && !NON_PATCHABLE_FIELDS.has(key)
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
                    {previewForKey(key, suggested)}
                  </div>
                  {key === 'participants' || key === 'phases' ? (
                    <ParticipantsPhasesDetail keyName={key} value={suggested} />
                  ) : null}
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
          })}
        </tbody>
      </table>
    </div>
  )
}

function DiffSideBySide({
  suggestionEntries,
  currentRecord,
  resolved,
  acceptField,
  rejectField,
}: DiffSubProps) {
  if (suggestionEntries.length === 0) {
    return (
      <div className="rounded-md border border-[rgb(var(--border))] px-3 py-6 text-center text-sm text-[rgb(var(--text-muted))]">
        Tidak ada saran perubahan.
      </div>
    )
  }
  return (
    <div className="flex max-h-[60vh] flex-col gap-4 overflow-auto pr-1">
      {suggestionEntries.map(([key, suggested]) => {
        const label = FIELD_LABELS[key] ?? key
        const currentVal = currentRecord[key]
        const state = resolved[key]
        const applyable = key in FIELD_LABELS && !NON_PATCHABLE_FIELDS.has(key)
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
                    {previewForKey(key, suggested)}
                  </div>
                  {key === 'participants' || key === 'phases' ? (
                    <ParticipantsPhasesDetail keyName={key} value={suggested} />
                  ) : null}
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
      })}
    </div>
  )
}

// ── Participants / Phases expandable detail ──────────────────────────
//
// Rendered inline inside both the table and side-by-side views. Defaults to
// collapsed so the row stays compact; "Lihat" toggles it open.

interface ParticipantsPhasesDetailProps {
  keyName: 'participants' | 'phases'
  value: unknown
}

function ParticipantsPhasesDetail({ keyName, value }: ParticipantsPhasesDetailProps) {
  const [open, setOpen] = React.useState(false)
  if (!value || typeof value !== 'object') return null

  if (keyName === 'participants') {
    const m = value as {
      added?: { figureId: string; nameId: string; nameAr: string; role: string }[]
      updated?: { figureId: string; nameId: string }[]
      skipped?: { nameId: string; nameAr: string }[]
    }
    const total =
      (m.added?.length ?? 0) + (m.updated?.length ?? 0) + (m.skipped?.length ?? 0)
    if (total === 0) return null
    return (
      <div className="mt-2">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setOpen((v) => !v)}
        >
          {open ? 'Sembunyikan' : 'Lihat daftar'}
        </Button>
        {open ? (
          <div className="mt-2 space-y-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-2 text-xs">
            {m.added && m.added.length > 0 ? (
              <div>
                <div className="mb-1 font-semibold text-[rgb(var(--text))]">
                  Baru ({m.added.length})
                </div>
                <ul className="ml-4 list-disc text-[rgb(var(--text-muted))]">
                  {m.added.map((p) => (
                    <li key={p.figureId}>
                      {p.nameId}
                      <span className="text-[rgb(var(--text-faint))]"> · {p.role}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {m.updated && m.updated.length > 0 ? (
              <div>
                <div className="mb-1 font-semibold text-[rgb(var(--text))]">
                  Diperbarui ({m.updated.length})
                </div>
                <ul className="ml-4 list-disc text-[rgb(var(--text-muted))]">
                  {m.updated.map((p) => (
                    <li key={p.figureId}>{p.nameId}</li>
                  ))}
                </ul>
              </div>
            ) : null}
            {m.skipped && m.skipped.length > 0 ? (
              <div>
                <div className="mb-1 font-semibold text-[rgb(var(--text))]">
                  Dilewati ({m.skipped.length}) — figure belum ada di DB
                </div>
                <ul className="ml-4 list-disc text-[rgb(var(--text-muted))]">
                  {m.skipped.map((p, idx) => (
                    <li key={`${p.nameId}-${idx}`}>
                      {p.nameId} <span className="text-[rgb(var(--text-faint))]">/ {p.nameAr}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        ) : null}
      </div>
    )
  }

  // phases
  const m = value as {
    inserted?: number
    softDeleted?: number
    titlesId?: string[]
  }
  const titles = m.titlesId ?? []
  if ((m.inserted ?? 0) === 0 && (m.softDeleted ?? 0) === 0) return null
  return (
    <div className="mt-2">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Sembunyikan' : 'Lihat daftar'}
      </Button>
      {open ? (
        <div className="mt-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-2 text-xs">
          {titles.length > 0 ? (
            <ol className="ml-4 list-decimal text-[rgb(var(--text-muted))]">
              {titles.map((t, idx) => (
                <li key={`${t}-${idx}`}>{t}</li>
              ))}
            </ol>
          ) : (
            <p className="text-[rgb(var(--text-muted))]">
              {m.inserted ?? 0} fase baru tersimpan.
            </p>
          )}
          {(m.softDeleted ?? 0) > 0 ? (
            <p className="mt-2 text-[rgb(var(--text-faint))]">
              {m.softDeleted} fase lama disoft-delete (tersimpan di
              originalSnapshot untuk dipulihkan).
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
