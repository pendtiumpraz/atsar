// Reviewer workspace — three-pane diff + editable form (WIREFRAMES §27).
//
// Replaces the older `ReviewSideBySide` for the figure/battle review surface
// while still using it as a fallback for read-only paths. The layout:
//
//   ┌────────────────┬──────────────────────┐
//   │ Draft (left)   │ Editable form (right)│
//   │ AI output      │ Reviewer can correct │
//   ├────────────────┴──────────────────────┤
//   │ Citations panel (bottom)              │
//   │ Each source URL · domain priority     │
//   └───────────────────────────────────────┘
//
// The component owns the form state for the bilingual narrative columns and
// hands the current edits up to the parent (DecisionBar) via React context.
// When the reviewer clicks "Setuju & Terbitkan", the parent reads the edits
// and posts them to /approve. A `revertToOriginal()` button restores the AI
// snapshot.
//
// Bilingual presentation uses Tabs (id / ar) so very long fields don't blow
// out the layout; reviewers can flip between languages with one click.

'use client'

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'

import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { cn } from '@/lib/utils'

/** Citation row with whitelist annotation passed from the server page. */
export interface WorkspaceCitation {
  id: string
  sourceUrl: string
  sourceDomain?: string | null
  sourceExcerptId?: string | null
  sourceExcerptAr?: string | null
  sourceLang?: string | null
  fieldPath?: string | null
  confidenceScore?: number | string | null
  /** Whitelist priority (null = not on whitelist). */
  whitelistPriority?: number | null
  /** Whether the source domain is on the active whitelist. */
  onWhitelist?: boolean
}

/**
 * Editable narrative fields. Keep this in lockstep with `editsSchema` in
 * `/api/v1/reviewer/assignments/[id]/approve/route.ts`.
 */
export interface WorkspaceEdits {
  // Figure fields
  nameFullId?: string | null
  nameFullAr?: string | null
  nameShortId?: string | null
  nameShortAr?: string | null
  summaryId?: string | null
  summaryAr?: string | null
  biographyId?: string | null
  biographyAr?: string | null
  // Battle fields
  nameId?: string | null
  nameAr?: string | null
  descriptionId?: string | null
  descriptionAr?: string | null
}

export interface WorkspaceProps {
  contentType: 'figure' | 'battle' | string
  /** Read-only snapshot of the current draft (post-AI). */
  draft: WorkspaceEdits
  /** Optional original AI snapshot for "revert" — usually `draft` initially. */
  original?: WorkspaceEdits | null
  citations: WorkspaceCitation[]
  /** Bubbled to the DecisionBar through the EditsContext. */
  onEditsChange?: (edits: WorkspaceEdits, isDirty: boolean) => void
}

// ── Edits context ─────────────────────────────────────────────────────
// We use context so `<DecisionBar />` can read the reviewer's current edits
// without us having to wire it through layout props. The provider lives at
// the same level as the bar (the review page).

interface EditsContextValue {
  edits: WorkspaceEdits
  isDirty: boolean
  /** Setter exposed so child panes can push updates into the shared store. */
  setEdits: (next: WorkspaceEdits) => void
  /** Original baseline — needed so panes can compute dirty-state locally. */
  baseline: WorkspaceEdits
}

const EditsContext = createContext<EditsContextValue | null>(null)

/**
 * Hook for DecisionBar (or any sibling) to read the current reviewer edits.
 * Returns `null` outside a provider — DecisionBar treats that as "no edits".
 */
export function useReviewerEdits(): EditsContextValue | null {
  return useContext(EditsContext)
}

// ── Field definitions (per content type) ───────────────────────────────

interface FieldDef {
  /** Which key in WorkspaceEdits. */
  key: keyof WorkspaceEdits
  /** Indonesian label rendered above the field. */
  label: string
  /** Render as multi-line textarea when true, single-line input otherwise. */
  multiline?: boolean
  /** RTL when the field is Arabic. */
  arabic?: boolean
}

const FIGURE_FIELDS_ID: FieldDef[] = [
  { key: 'nameFullId', label: 'Nama Lengkap (Indonesia)' },
  { key: 'nameShortId', label: 'Nama Singkat (Indonesia)' },
  { key: 'summaryId', label: 'Ringkasan (Indonesia)', multiline: true },
  { key: 'biographyId', label: 'Biografi (Indonesia)', multiline: true },
]
const FIGURE_FIELDS_AR: FieldDef[] = [
  { key: 'nameFullAr', label: 'الاسم الكامل (Arab)', arabic: true },
  { key: 'nameShortAr', label: 'الاسم المختصر (Arab)', arabic: true },
  { key: 'summaryAr', label: 'الملخص (Arab)', multiline: true, arabic: true },
  { key: 'biographyAr', label: 'السيرة (Arab)', multiline: true, arabic: true },
]
const BATTLE_FIELDS_ID: FieldDef[] = [
  { key: 'nameId', label: 'Nama Pertempuran (Indonesia)' },
  { key: 'summaryId', label: 'Ringkasan (Indonesia)', multiline: true },
  { key: 'descriptionId', label: 'Deskripsi (Indonesia)', multiline: true },
]
const BATTLE_FIELDS_AR: FieldDef[] = [
  { key: 'nameAr', label: 'اسم المعركة (Arab)', arabic: true },
  { key: 'summaryAr', label: 'الملخص (Arab)', multiline: true, arabic: true },
  { key: 'descriptionAr', label: 'الوصف (Arab)', multiline: true, arabic: true },
]

function fieldsFor(contentType: string): { id: FieldDef[]; ar: FieldDef[] } {
  if (contentType === 'battle') return { id: BATTLE_FIELDS_ID, ar: BATTLE_FIELDS_AR }
  return { id: FIGURE_FIELDS_ID, ar: FIGURE_FIELDS_AR }
}

// ── Helpers ────────────────────────────────────────────────────────────

/** True when at least one value in `edits` differs from `original`. */
function isEditsDirty(edits: WorkspaceEdits, original: WorkspaceEdits): boolean {
  for (const k of Object.keys(edits) as (keyof WorkspaceEdits)[]) {
    if ((edits[k] ?? '') !== (original[k] ?? '')) return true
  }
  for (const k of Object.keys(original) as (keyof WorkspaceEdits)[]) {
    if ((edits[k] ?? '') !== (original[k] ?? '')) return true
  }
  return false
}

/** Friendly relative URL host string. */
function urlHost(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}

/** Group citations by fieldPath so the panel highlights coverage gaps. */
function groupByField(rows: WorkspaceCitation[]): Map<string, WorkspaceCitation[]> {
  const out = new Map<string, WorkspaceCitation[]>()
  for (const c of rows) {
    const key = c.fieldPath || '(umum)'
    const existing = out.get(key)
    if (existing) existing.push(c)
    else out.set(key, [c])
  }
  return out
}

// ── Top-level component ────────────────────────────────────────────────

/**
 * Convenience wrapper that hosts the EditsContext provider so siblings (like
 * the DecisionBar) can read reviewer edits.
 *
 * Usage:
 *   <ReviewWorkspaceProvider contentType="figure" draft={...}>
 *     <ReviewWorkspace ... />     ← reads + writes edits via the context
 *     <DecisionBar ... />         ← reads edits and sends them with /approve
 *   </ReviewWorkspaceProvider>
 *
 * The provider is split from the workspace so the same context flows around
 * the entire review page, not just the workspace subtree.
 */
export function ReviewWorkspaceProvider({
  children,
  initialEdits,
  baseline,
}: {
  children: ReactNode
  initialEdits: WorkspaceEdits
  baseline: WorkspaceEdits
}) {
  const [edits, setEdits] = useState<WorkspaceEdits>(initialEdits)
  const isDirty = useMemo(() => isEditsDirty(edits, baseline), [edits, baseline])

  const setter = useCallback((next: WorkspaceEdits) => {
    setEdits(next)
  }, [])

  const ctxValue = useMemo<EditsContextValue>(
    () => ({ edits, isDirty, setEdits: setter, baseline }),
    [edits, isDirty, setter, baseline],
  )

  return <EditsContext.Provider value={ctxValue}>{children}</EditsContext.Provider>
}

export function ReviewWorkspace({
  contentType,
  draft,
  original,
  citations,
  onEditsChange,
}: WorkspaceProps) {
  // If a parent `<ReviewWorkspaceProvider>` is in scope we use its state;
  // otherwise we maintain our own (useful for standalone tests).
  const parentCtx = useContext(EditsContext)

  const [localEdits, setLocalEdits] = useState<WorkspaceEdits>(draft)
  const baseline = parentCtx?.baseline ?? original ?? draft

  const edits = parentCtx?.edits ?? localEdits
  const setEdits = parentCtx?.setEdits ?? setLocalEdits
  const isDirty = parentCtx?.isDirty ?? isEditsDirty(edits, baseline)

  const updateField = useCallback(
    (key: keyof WorkspaceEdits, value: string) => {
      const next = { ...edits, [key]: value }
      setEdits(next)
      onEditsChange?.(next, isEditsDirty(next, baseline))
    },
    [edits, setEdits, baseline, onEditsChange],
  )

  const revert = useCallback(() => {
    setEdits(baseline)
    onEditsChange?.(baseline, false)
  }, [baseline, setEdits, onEditsChange])

  const { id: idFields, ar: arFields } = fieldsFor(contentType)

  return (
    <div className="flex flex-col gap-4">
      {/* ─── Two-pane diff ──────────────────────────────────────── */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DraftPane contentType={contentType} draft={baseline} />
        <EditPane
          edits={edits}
          idFields={idFields}
          arFields={arFields}
          onChange={updateField}
          isDirty={isDirty}
          onRevert={revert}
        />
      </div>

      {/* ─── Citations panel (bottom) ───────────────────────────── */}
      <CitationsPanel citations={citations} />
    </div>
  )
}

// ── Draft (left pane) ─────────────────────────────────────────────────

interface DraftPaneProps {
  contentType: string
  draft: WorkspaceEdits
}

function DraftPane({ contentType, draft }: DraftPaneProps) {
  const { id: idFields, ar: arFields } = fieldsFor(contentType)

  return (
    <section className="flex min-h-[60vh] flex-col gap-2">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
          Draf AI (asli)
        </h2>
        <Badge variant="secondary" className="text-[10px]">
          read-only
        </Badge>
      </div>
      <div className="flex-1 overflow-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-4">
        <Tabs defaultValue="id" className="w-full">
          <TabsList>
            <TabsTrigger value="id">Indonesia</TabsTrigger>
            <TabsTrigger value="ar">Arab</TabsTrigger>
          </TabsList>
          <TabsContent value="id" className="mt-3 flex flex-col gap-3">
            {idFields.map((f) => (
              <ReadOnlyField key={String(f.key)} field={f} value={draft[f.key]} />
            ))}
          </TabsContent>
          <TabsContent value="ar" className="mt-3 flex flex-col gap-3">
            {arFields.map((f) => (
              <ReadOnlyField key={String(f.key)} field={f} value={draft[f.key]} />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}

function ReadOnlyField({
  field,
  value,
}: {
  field: FieldDef
  value: string | null | undefined
}) {
  const text = value ?? ''
  return (
    <div>
      <div className="mb-1 text-xs font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">
        {field.label}
      </div>
      <div
        dir={field.arabic ? 'rtl' : 'ltr'}
        lang={field.arabic ? 'ar' : 'id'}
        className={cn(
          'whitespace-pre-wrap rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2 text-sm leading-relaxed',
          field.arabic && 'text-base',
          text.length === 0 && 'italic text-[rgb(var(--text-faint))]',
        )}
        style={field.arabic ? { fontFamily: 'var(--font-body-arab)' } : undefined}
      >
        {text.length > 0 ? text : '(kosong)'}
      </div>
    </div>
  )
}

// ── Edit pane (right) ─────────────────────────────────────────────────

interface EditPaneProps {
  edits: WorkspaceEdits
  idFields: FieldDef[]
  arFields: FieldDef[]
  onChange: (key: keyof WorkspaceEdits, value: string) => void
  isDirty: boolean
  onRevert: () => void
}

function EditPane({ edits, idFields, arFields, onChange, isDirty, onRevert }: EditPaneProps) {
  return (
    <section className="flex min-h-[60vh] flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
          Koreksi Reviewer
        </h2>
        <div className="flex items-center gap-2">
          {isDirty ? (
            <Badge variant="warning" className="text-[10px]">
              ada perubahan
            </Badge>
          ) : (
            <Badge variant="secondary" className="text-[10px]">
              belum diubah
            </Badge>
          )}
          <button
            type="button"
            onClick={onRevert}
            disabled={!isDirty}
            className="rounded-md border border-[rgb(var(--border))] px-2 py-1 text-xs text-[rgb(var(--text-muted))] hover:border-[rgb(var(--accent))] hover:text-[rgb(var(--text))] disabled:cursor-not-allowed disabled:opacity-50"
          >
            ↺ Kembalikan ke draf AI
          </button>
        </div>
      </div>
      <div className="flex-1 overflow-auto rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
        <Tabs defaultValue="id" className="w-full">
          <TabsList>
            <TabsTrigger value="id">Indonesia</TabsTrigger>
            <TabsTrigger value="ar">Arab</TabsTrigger>
          </TabsList>
          <TabsContent value="id" className="mt-3 flex flex-col gap-3">
            {idFields.map((f) => (
              <EditableField
                key={String(f.key)}
                field={f}
                value={edits[f.key]}
                onChange={(v) => onChange(f.key, v)}
              />
            ))}
          </TabsContent>
          <TabsContent value="ar" className="mt-3 flex flex-col gap-3">
            {arFields.map((f) => (
              <EditableField
                key={String(f.key)}
                field={f}
                value={edits[f.key]}
                onChange={(v) => onChange(f.key, v)}
              />
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </section>
  )
}

function EditableField({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string | null | undefined
  onChange: (next: string) => void
}) {
  const current = value ?? ''
  const inputProps = {
    dir: field.arabic ? ('rtl' as const) : ('ltr' as const),
    lang: field.arabic ? 'ar' : 'id',
    value: current,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(e.target.value),
    className: cn(
      'w-full rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-2 py-1.5 text-sm leading-relaxed',
      'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
      field.arabic && 'text-base',
    ),
    style: field.arabic ? { fontFamily: 'var(--font-body-arab)' } : undefined,
  }

  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">
        {field.label}
      </label>
      {field.multiline ? (
        <textarea rows={8} {...inputProps} />
      ) : (
        <input type="text" {...inputProps} />
      )}
    </div>
  )
}

// ── Citations panel (bottom) ──────────────────────────────────────────

interface CitationsPanelProps {
  citations: WorkspaceCitation[]
}

function CitationsPanel({ citations }: CitationsPanelProps) {
  const grouped = useMemo(() => groupByField(citations), [citations])
  const totalOffWhitelist = citations.filter((c) => c.onWhitelist === false).length

  if (citations.length === 0) {
    return (
      <section className="rounded-lg border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-6 text-center text-sm text-[rgb(var(--text-muted))]">
        Konten ini belum memiliki citation sumber.
      </section>
    )
  }

  return (
    <section className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4">
      <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
          Sumber & Citation ({citations.length})
        </h2>
        {totalOffWhitelist > 0 ? (
          <Badge variant="destructive" className="text-[10px]">
            ⚠ {totalOffWhitelist} sumber di luar whitelist
          </Badge>
        ) : (
          <Badge variant="success" className="text-[10px]">
            ✓ semua sumber di whitelist
          </Badge>
        )}
      </header>
      <div className="flex flex-col gap-3">
        {Array.from(grouped.entries()).map(([fieldKey, rows]) => (
          <CitationGroup key={fieldKey} fieldKey={fieldKey} rows={rows} />
        ))}
      </div>
    </section>
  )
}

function CitationGroup({
  fieldKey,
  rows,
}: {
  fieldKey: string
  rows: WorkspaceCitation[]
}) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">
        {fieldKey === '(umum)' ? 'Sumber umum' : `Mendukung: ${fieldKey}`}
      </div>
      <ul className="flex flex-col gap-2" role="list">
        {rows.map((c, idx) => (
          <CitationRow key={c.id} citation={c} index={idx} />
        ))}
      </ul>
    </div>
  )
}

function CitationRow({
  citation,
  index,
}: {
  citation: WorkspaceCitation
  index: number
}) {
  const host = citation.sourceDomain || urlHost(citation.sourceUrl)
  const confidencePct =
    citation.confidenceScore != null
      ? Math.round(Number(citation.confidenceScore) * 100)
      : null
  const tone =
    citation.onWhitelist === false
      ? 'border-rose-400 bg-rose-50 dark:border-rose-500/60 dark:bg-rose-950/30'
      : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]'

  return (
    <li className={cn('rounded-md border p-2 text-xs', tone)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex min-w-0 items-center gap-2">
          <span className="font-mono text-[10px] text-[rgb(var(--text-faint))]">
            [{index + 1}]
          </span>
          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="truncate text-[rgb(var(--accent))] underline-offset-2 hover:underline"
            title={citation.sourceUrl}
          >
            {host}
          </a>
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {citation.onWhitelist === false ? (
            <Badge variant="destructive" className="text-[10px]">
              ⚠ di luar whitelist
            </Badge>
          ) : citation.whitelistPriority != null ? (
            <Badge variant="secondary" className="text-[10px]">
              priority {citation.whitelistPriority}
            </Badge>
          ) : null}
          {confidencePct != null ? (
            <Badge
              variant={
                confidencePct >= 85
                  ? 'success'
                  : confidencePct >= 60
                    ? 'warning'
                    : 'destructive'
              }
              className="text-[10px]"
            >
              AI {confidencePct}%
            </Badge>
          ) : null}
          <a
            href={citation.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded border border-[rgb(var(--border))] px-1.5 py-0.5 text-[10px] text-[rgb(var(--text-muted))] hover:border-[rgb(var(--accent))]"
          >
            ↗ buka
          </a>
        </div>
      </div>
      {citation.sourceExcerptId || citation.sourceExcerptAr ? (
        <div className="mt-1 text-[rgb(var(--text-muted))]">
          {citation.sourceExcerptId ? (
            <p className="line-clamp-2 whitespace-pre-wrap">{citation.sourceExcerptId}</p>
          ) : null}
          {citation.sourceExcerptAr ? (
            <p
              lang="ar"
              dir="rtl"
              className="mt-1 line-clamp-2 whitespace-pre-wrap text-sm"
              style={{ fontFamily: 'var(--font-body-arab)' }}
            >
              {citation.sourceExcerptAr}
            </p>
          ) : null}
        </div>
      ) : null}
    </li>
  )
}
