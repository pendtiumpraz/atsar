// Diff modal opened from `<AuditTable />` rows.
//
// Loads the full audit entry from `/admin/audit-logs/[id]` (the row in the
// list response is already complete, but re-fetching guarantees the modal
// shows the canonical record — including any server-side enrichment we add
// later, e.g. a `users` join — without changing the call site).
//
// The `diff` column in `auditLogs` is a free-form `jsonb`. We support two
// common shapes:
//
//   1. `{ before: <value>, after: <value> }` — the standard create/update
//      shape emitted by the audit service.
//   2. Anything else — rendered as raw JSON on the "after" side with the
//      "before" left empty. (e.g. login events, crawl_complete summaries.)
//
// Visual diff: `react-diff-viewer-continued`, configured for JSON content
// (monospace, line-level compare). We also surface the raw JSON below the
// diff so admins can copy it for support tickets.

'use client'

import { useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import ReactDiffViewer, { DiffMethod } from 'react-diff-viewer-continued'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { adminApi } from '@/lib/api/endpoints'

import type { AuditLogRow } from './audit-table'

export interface DiffModalProps {
  id: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

const FULL_DATETIME = new Intl.DateTimeFormat('id-ID', {
  day: 'numeric',
  month: 'long',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  timeZoneName: 'short',
})

function formatFull(iso: string | null | undefined): string {
  if (!iso) return '—'
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  return `${FULL_DATETIME.format(d)} (${iso})`
}

/**
 * Extract `{ before, after }` from a free-form diff payload. We accept the
 * common shape directly and fall back to "all on the after side" for
 * anything we don't recognise — keeping the modal useful even for
 * non-update events like `login`.
 */
function extractBeforeAfter(
  diff: unknown,
): { before: string; after: string } {
  // Standard shape — `{ before, after }`.
  if (diff && typeof diff === 'object' && !Array.isArray(diff)) {
    const obj = diff as Record<string, unknown>
    if ('before' in obj || 'after' in obj) {
      return {
        before: stringifyJson(obj.before ?? null),
        after: stringifyJson(obj.after ?? null),
      }
    }
  }

  // Fallback — render the entire payload as the "after" state. Most
  // audit events that don't carry a before/after still benefit from
  // syntax-highlighted JSON view.
  return {
    before: '',
    after: stringifyJson(diff ?? null),
  }
}

function stringifyJson(value: unknown): string {
  if (value === null || value === undefined) return ''
  if (typeof value === 'string') return value
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

export function DiffModal({ id, open, onOpenChange }: DiffModalProps) {
  const { data, isPending, isError, error } = useQuery<AuditLogRow>({
    queryKey: ['admin', 'audit-logs', 'detail', id],
    queryFn: () =>
      adminApi.auditLogs.get(id as string) as Promise<AuditLogRow>,
    // Only fetch once the modal actually opens with a target id.
    enabled: open && id !== null,
    staleTime: 60_000,
  })

  const { before, after } = useMemo(
    () => extractBeforeAfter(data?.diff),
    [data?.diff],
  )

  // Theme tokens for the diff viewer — match `components/reviewer/diff-viewer.tsx`.
  const diffStyles = useMemo(
    () => ({
      variables: {
        light: {
          diffViewerBackground: 'rgb(var(--surface))',
          diffViewerColor: 'rgb(var(--text))',
          addedBackground: 'rgba(16, 185, 129, 0.12)',
          addedColor: 'rgb(var(--text))',
          removedBackground: 'rgba(244, 63, 94, 0.12)',
          removedColor: 'rgb(var(--text))',
          wordAddedBackground: 'rgba(16, 185, 129, 0.32)',
          wordRemovedBackground: 'rgba(244, 63, 94, 0.32)',
          addedGutterBackground: 'rgba(16, 185, 129, 0.18)',
          removedGutterBackground: 'rgba(244, 63, 94, 0.18)',
          gutterBackground: 'rgb(var(--bg-elevated))',
          gutterBackgroundDark: 'rgb(var(--bg-elevated))',
          highlightBackground: 'rgba(245, 158, 11, 0.18)',
          highlightGutterBackground: 'rgba(245, 158, 11, 0.24)',
          codeFoldGutterBackground: 'rgb(var(--bg-elevated))',
          codeFoldBackground: 'rgb(var(--bg-elevated))',
          emptyLineBackground: 'rgb(var(--surface))',
          gutterColor: 'rgb(var(--text-faint))',
          addedGutterColor: 'rgb(var(--text))',
          removedGutterColor: 'rgb(var(--text))',
          codeFoldContentColor: 'rgb(var(--text-muted))',
          diffViewerTitleBackground: 'rgb(var(--bg-elevated))',
          diffViewerTitleColor: 'rgb(var(--text))',
          diffViewerTitleBorderColor: 'rgb(var(--border))',
        },
      },
      contentText: {
        fontFamily:
          'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
        fontSize: '0.8rem',
        lineHeight: '1.45',
      },
    }),
    [],
  )

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] w-full max-w-5xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Detail Audit Log</DialogTitle>
          <DialogDescription>
            {data
              ? `${data.action} · ${data.resourceType ?? 'unknown resource'}`
              : 'Memuat entri audit…'}
          </DialogDescription>
        </DialogHeader>

        {isPending ? (
          <div className="space-y-3" aria-hidden>
            <div className="h-6 w-2/3 animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
            <div className="h-64 w-full animate-pulse rounded bg-[rgb(var(--bg-elevated))]" />
          </div>
        ) : isError || !data ? (
          <div role="alert" className="text-sm text-[rgb(var(--danger))]">
            Gagal memuat detail audit
            {error instanceof Error ? `: ${error.message}` : '.'}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Meta */}
            <dl className="grid grid-cols-1 gap-x-6 gap-y-2 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-sm sm:grid-cols-2">
              <Meta label="Waktu">{formatFull(data.createdAt)}</Meta>
              <Meta label="Action">
                <code className="font-mono">{data.action}</code>
              </Meta>
              <Meta label="Aktor">
                <code className="font-mono text-xs">
                  {data.actorId ?? 'system'}
                </code>
                {data.actorRole ? (
                  <span className="ml-2 text-xs text-[rgb(var(--text-muted))]">
                    ({data.actorRole})
                  </span>
                ) : null}
              </Meta>
              <Meta label="Resource">
                <span>{data.resourceType ?? '—'}</span>
                {data.resourceId ? (
                  <code className="ml-2 font-mono text-xs text-[rgb(var(--text-muted))]">
                    {data.resourceId}
                  </code>
                ) : null}
              </Meta>
              <Meta label="IP Address">
                <code className="font-mono text-xs">
                  {data.ipAddress ?? '—'}
                </code>
              </Meta>
              <Meta label="User Agent">
                <span
                  className="break-all text-xs text-[rgb(var(--text-muted))]"
                  title={data.userAgent ?? ''}
                >
                  {data.userAgent ?? '—'}
                </span>
              </Meta>
            </dl>

            {/* Diff */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[rgb(var(--text))]">
                Perubahan
              </h3>
              {before === '' && after === '' ? (
                <div className="rounded-md border border-dashed border-[rgb(var(--border))] p-4 text-sm text-[rgb(var(--text-muted))]">
                  Tidak ada payload diff pada entri ini.
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-[rgb(var(--border))]">
                  <ReactDiffViewer
                    oldValue={before}
                    newValue={after}
                    splitView
                    compareMethod={DiffMethod.LINES}
                    leftTitle="Sebelum"
                    rightTitle="Sesudah"
                    useDarkTheme={false}
                    styles={diffStyles}
                  />
                </div>
              )}
            </section>

            {/* Raw JSON */}
            <section className="space-y-2">
              <h3 className="text-sm font-semibold text-[rgb(var(--text))]">
                Raw JSON
              </h3>
              <pre className="max-h-72 overflow-auto rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3 text-xs leading-relaxed text-[rgb(var(--text))]">
                {stringifyJson(data.diff) || '—'}
              </pre>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function Meta({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div className="min-w-0">
      <dt className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
        {label}
      </dt>
      <dd className="mt-0.5 break-words text-[rgb(var(--text))]">{children}</dd>
    </div>
  )
}
