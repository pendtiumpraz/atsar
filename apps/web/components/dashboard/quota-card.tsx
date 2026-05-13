// Quota card — single metered-feature meter for the dashboard.
//
// Server-renderable: no client state. Shows a label, the `used / limit`
// counter, and a progress bar. Special cases:
//   - `limit === -1`           → unlimited (Premium PDF, Pro AI chat, …)
//   - `limit === 0`            → not available on this tier
//   - `kind === 'trial'`       → renders the remaining trial days instead.
//
// Color tracks usage state:
//   - < 60%  → emerald primary
//   - 60–90% → warning gold
//   - ≥ 90%  → danger red
//
// See WIREFRAMES §5 (Dashboard) and docs/IDEAS.md §6.4 (Quota).

import { cn } from '@/lib/utils'

type QuotaKind = 'pdf' | 'ai_chat' | 'trial'

interface QuotaCardProps {
  kind: QuotaKind
  label: string
  /** For pdf/ai_chat: used count. For trial: days elapsed (or 0 if not in trial). */
  used: number
  /** For pdf/ai_chat: tier limit (-1 unlimited). For trial: total trial days (3). */
  limit: number
  /** Optional sub-label (e.g. "Reset 7 Jun 2026"). */
  footer?: string
}

function percent(used: number, limit: number): number {
  if (limit <= 0) return 0
  return Math.min(100, Math.round((used / limit) * 100))
}

function barColor(pct: number): string {
  if (pct >= 90) return 'bg-[rgb(var(--danger))]'
  if (pct >= 60) return 'bg-[rgb(var(--warning))]'
  return 'bg-[rgb(var(--primary))]'
}

export function QuotaCard({ kind, label, used, limit, footer }: QuotaCardProps) {
  // Trial gets a distinct render — no fraction bar, just remaining days.
  if (kind === 'trial') {
    const remaining = Math.max(0, limit - used)
    const isTrialing = limit > 0 && remaining > 0
    return (
      <article
        className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
        aria-label={label}
      >
        <header className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">
          {label}
        </header>
        <p
          className="mt-2 text-3xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          {isTrialing ? `${remaining} hari` : '—'}
        </p>
        <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
          {isTrialing ? `Sisa dari ${limit} hari trial` : 'Tidak dalam masa trial'}
        </p>
        {footer ? (
          <p className="mt-3 text-xs text-[rgb(var(--text-faint))]">{footer}</p>
        ) : null}
      </article>
    )
  }

  const unlimited = limit === -1
  const unavailable = limit === 0
  const pct = percent(used, limit)

  return (
    <article
      className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4"
      aria-label={label}
    >
      <header className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">
        {label}
      </header>

      <p
        className="mt-2 text-2xl font-semibold text-[rgb(var(--text))]"
        style={{ fontFamily: 'var(--font-display-latin)' }}
      >
        {unavailable ? '—' : unlimited ? `${used}` : `${used} / ${limit}`}
      </p>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[rgb(var(--bg-elevated))]"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={unlimited ? 100 : Math.max(limit, 1)}
        aria-valuenow={unlimited ? used : Math.min(used, limit)}
        aria-label={`${label} usage`}
      >
        <div
          className={cn(
            'h-full rounded-full transition-[width]',
            unlimited ? 'bg-[rgb(var(--accent))]' : barColor(pct),
          )}
          style={{ width: unavailable ? '0%' : unlimited ? '100%' : `${pct}%` }}
        />
      </div>

      <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
        {unavailable
          ? 'Tidak tersedia di tier ini'
          : unlimited
            ? 'Tanpa batas'
            : `${pct}% terpakai`}
      </p>

      {footer ? (
        <p className="mt-3 text-xs text-[rgb(var(--text-faint))]">{footer}</p>
      ) : null}
    </article>
  )
}
