// Server-only kartu metrik untuk dashboard admin.
//
// Tanpa interaktivitas / state — sengaja dibuat sederhana agar bisa di-render
// di Server Component. Bila `href` diberikan, seluruh kartu dibungkus dengan
// Next `<Link>` sehingga seluruh permukaan kartu dapat diklik.
//
// `tone` hanya memengaruhi warna highlight angka — bukan border, supaya rapi
// di dark/light mode dan tidak bentrok dengan token tema (`--success`,
// `--warning`).

import Link from 'next/link'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type MetricTone = 'default' | 'warn' | 'success'

export interface MetricCardProps {
  label: string
  value: number | string
  icon?: LucideIcon
  hint?: string
  href?: string
  tone?: MetricTone
}

const TONE_VALUE_CLASS: Record<MetricTone, string> = {
  default: 'text-[rgb(var(--text))]',
  warn: 'text-[rgb(var(--warning))]',
  success: 'text-[rgb(var(--success))]',
}

const TONE_ICON_CLASS: Record<MetricTone, string> = {
  default: 'text-[rgb(var(--text-muted))]',
  warn: 'text-[rgb(var(--warning))]',
  success: 'text-[rgb(var(--success))]',
}

function formatValue(value: number | string): string {
  if (typeof value === 'number') {
    // Locale Indonesia menggunakan titik sebagai pemisah ribuan.
    return new Intl.NumberFormat('id-ID').format(value)
  }
  return value
}

export function MetricCard({
  label,
  value,
  icon: Icon,
  hint,
  href,
  tone = 'default',
}: MetricCardProps) {
  const body = (
    <Card
      className={cn(
        'transition-colors',
        href && 'hover:border-[rgb(var(--accent))] hover:bg-[rgb(var(--bg-elevated))]',
      )}
    >
      <CardContent className="flex flex-col gap-2 p-5 pt-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-[rgb(var(--text-muted))]">
            {label}
          </span>
          {Icon ? (
            <Icon className={cn('h-4 w-4 shrink-0', TONE_ICON_CLASS[tone])} aria-hidden />
          ) : null}
        </div>
        <div
          className={cn(
            'text-3xl font-semibold leading-tight tabular-nums',
            TONE_VALUE_CLASS[tone],
          )}
        >
          {formatValue(value)}
        </div>
        {hint ? (
          <div className="text-xs text-[rgb(var(--text-muted))]">{hint}</div>
        ) : null}
      </CardContent>
    </Card>
  )

  if (href) {
    return (
      <Link href={href} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))] rounded-lg">
        {body}
      </Link>
    )
  }
  return body
}

export default MetricCard
