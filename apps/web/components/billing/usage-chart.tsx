'use client'

// UsageChart — Recharts BarChart of AI credits per role grouped by month.
//
// Input: a flat list of usage rows from `aiApi.usage`. We bucket them by
// month (YYYY-MM) and produce one bar per role. Theme-aware colors come
// from a tiny palette tied to our token system; we read the resolved theme
// from `useTheme` so the bars contrast with both light + dark surfaces.

import * as React from 'react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'

import { useTheme } from '@/hooks/use-theme'

export type UsageRole = 'chat' | 'agent' | 'doc_analyzer' | 'avatar' | 'embedding'

export interface UsageRow {
  createdAt?: string | Date | null
  role?: string | null
  credits?: number | null
  /** Some endpoints expose `creditsUsed` instead; we accept both. */
  creditsUsed?: number | null
}

interface UsageChartProps {
  rows: UsageRow[]
  /** Roles to chart. Defaults to the common trio (chat / agent / doc_analyzer). */
  roles?: UsageRole[]
}

const DEFAULT_ROLES: UsageRole[] = ['chat', 'agent', 'doc_analyzer']

const ROLE_LABEL: Record<string, string> = {
  chat: 'Chat',
  agent: 'Agent',
  doc_analyzer: 'Doc Analyzer',
  avatar: 'Avatar',
  embedding: 'Embedding',
}

// Light + dark theme color tuples. Order matches DEFAULT_ROLES + extras.
const PALETTE_LIGHT = ['#0F4C3A', '#B89968', '#9A6F3F', '#5E8E72', '#6B5E4D']
const PALETTE_DARK = ['#4ABC95', '#D4B783', '#E2A878', '#82C5A6', '#C9BFAB']

function monthKey(value: UsageRow['createdAt']): string {
  if (!value) return 'unknown'
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return 'unknown'
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(key: string): string {
  if (key === 'unknown') return '—'
  const [y, m] = key.split('-').map(Number)
  if (!y || !m) return key
  return new Intl.DateTimeFormat('id-ID', { month: 'short', year: '2-digit' }).format(
    new Date(y, m - 1, 1),
  )
}

interface MonthBucket {
  month: string
  label: string
  [role: string]: number | string
}

export function UsageChart({ rows, roles = DEFAULT_ROLES }: UsageChartProps) {
  const { resolvedTheme } = useTheme()
  const palette = resolvedTheme === 'dark' ? PALETTE_DARK : PALETTE_LIGHT

  const data: MonthBucket[] = React.useMemo(() => {
    const buckets = new Map<string, MonthBucket>()
    for (const row of rows) {
      const key = monthKey(row.createdAt)
      if (!buckets.has(key)) {
        const seed: MonthBucket = { month: key, label: monthLabel(key) }
        for (const role of roles) seed[role] = 0
        buckets.set(key, seed)
      }
      const bucket = buckets.get(key)!
      const role = (row.role ?? '') as string
      if (!roles.includes(role as UsageRole)) continue
      const credits = Number(row.credits ?? row.creditsUsed ?? 0)
      if (!Number.isFinite(credits)) continue
      bucket[role] = (bucket[role] as number) + credits
    }
    return Array.from(buckets.values()).sort((a, b) => a.month.localeCompare(b.month))
  }, [rows, roles])

  if (data.length === 0) {
    return (
      <div className="flex h-72 items-center justify-center rounded-md border border-dashed border-[rgb(var(--border))] text-sm text-[rgb(var(--text-muted))]">
        Belum ada data penggunaan untuk periode ini.
      </div>
    )
  }

  const gridColor = resolvedTheme === 'dark' ? '#3A2F22' : '#E6DCC4'
  const tickColor = resolvedTheme === 'dark' ? '#C9BFAB' : '#6B5E4D'
  const tooltipBg = resolvedTheme === 'dark' ? '#2A2218' : '#FAF5EB'

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 16, bottom: 0, left: 0 }}>
          <CartesianGrid stroke={gridColor} strokeDasharray="3 3" vertical={false} />
          <XAxis dataKey="label" stroke={tickColor} fontSize={12} tickLine={false} />
          <YAxis stroke={tickColor} fontSize={12} tickLine={false} allowDecimals={false} />
          <Tooltip
            cursor={{ fill: gridColor, opacity: 0.4 }}
            contentStyle={{
              backgroundColor: tooltipBg,
              border: `1px solid ${gridColor}`,
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: tickColor }}
          />
          <Legend wrapperStyle={{ fontSize: 12, color: tickColor }} />
          {roles.map((role, idx) => (
            <Bar
              key={role}
              dataKey={role}
              name={ROLE_LABEL[role] ?? role}
              fill={palette[idx % palette.length]}
              radius={[4, 4, 0, 0]}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export default UsageChart
