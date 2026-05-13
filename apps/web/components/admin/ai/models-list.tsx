'use client'

// Atsar — table of all AI models, grouped by provider.
//
// 20 models seeded (May 2026, verified — see REFERENCES.md §A):
//   DeepSeek    : deepseek-v4-flash (aktif), deepseek-v4-pro
//   Anthropic   : claude-opus-4-7, claude-sonnet-4-6, claude-haiku-4-5
//   OpenAI      : gpt-5.5-instant, gpt-5, text-embedding-3-large
//   Google      : gemini-3.1-pro, gemini-3.1-flash, gemini-3.1-flash-lite
//   xAI         : grok-4.3-beta, grok-4.20
//   Mistral     : mistral-large-3, mistral-small-4
//   Qwen        : qwen3.5-omni, qwen3.6-plus, qwen3.6-27b
//   Meta Llama  : llama-4-scout, llama-4-maverick
//
// API surface:
//   GET   /api/v1/admin/ai-models
//   PATCH /api/v1/admin/ai-models/:id  { isActive }

import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Switch } from '@/components/ui/switch'

export interface ModelRow {
  id: string
  providerId: string
  providerName: string
  providerSlug: string
  modelId: string
  displayName: string | null
  capabilities: string[] | null
  contextWindow: number | null
  maxOutputTokens: number | null
  inputPricePer1m: string | null
  outputPricePer1m: string | null
  releaseDate: string | null
  isActive: boolean
}

const CAPABILITY_VARIANT: Record<
  string,
  'default' | 'secondary' | 'accent' | 'outline' | 'success' | 'warning'
> = {
  chat: 'default',
  agent: 'accent',
  doc_analyzer: 'success',
  embedding: 'warning',
  vision: 'secondary',
}

function fmtPrice(v: string | null): string {
  if (!v) return '—'
  const n = Number(v)
  if (Number.isNaN(n)) return '—'
  return `$${n.toFixed(2)}`
}

function fmtContext(n: number | null): string {
  if (!n) return '—'
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`
  return String(n)
}

function fmtDate(d: string | null): string {
  if (!d) return '—'
  try {
    return new Date(d).toLocaleDateString('id-ID', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  } catch {
    return d
  }
}

export function ModelsList() {
  const [rows, setRows] = React.useState<ModelRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [pendingId, setPendingId] = React.useState<string | null>(null)

  React.useEffect(() => {
    let cancel = false
    ;(async () => {
      setLoading(true)
      try {
        const res = await fetch('/api/v1/admin/ai-models', { credentials: 'include' })
        if (!res.ok) throw new Error('Gagal memuat models')
        const body = (await res.json()) as { data?: ModelRow[] } | ModelRow[]
        const data = Array.isArray(body) ? body : (body.data ?? [])
        if (!cancel) setRows(data)
      } catch (err) {
        if (!cancel) toast.error(err instanceof Error ? err.message : 'Gagal memuat models')
      } finally {
        if (!cancel) setLoading(false)
      }
    })()
    return () => {
      cancel = true
    }
  }, [])

  async function onToggle(row: ModelRow, next: boolean) {
    setPendingId(row.id)
    try {
      const res = await fetch(`/api/v1/admin/ai-models/${row.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) throw new Error('Gagal mengubah status model')
      setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, isActive: next } : r)))
      toast.success(`${row.displayName ?? row.modelId} ${next ? 'diaktifkan' : 'dinonaktifkan'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status model')
    } finally {
      setPendingId(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[rgb(var(--text-muted))]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat models…
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[rgb(var(--text-muted))]">
        Belum ada model terdaftar.
      </p>
    )
  }

  // Group by provider for visual separation.
  const grouped = new Map<string, { providerName: string; items: ModelRow[] }>()
  for (const r of rows) {
    const bucket = grouped.get(r.providerId)
    if (bucket) {
      bucket.items.push(r)
    } else {
      grouped.set(r.providerId, { providerName: r.providerName, items: [r] })
    }
  }

  return (
    <div className="space-y-6">
      {Array.from(grouped.entries()).map(([providerId, group]) => (
        <section key={providerId}>
          <h3 className="mb-2 text-sm font-semibold text-[rgb(var(--text))]">
            {group.providerName}
            <span className="ml-2 text-xs font-normal text-[rgb(var(--text-muted))]">
              {group.items.length} model
            </span>
          </h3>
          <div className="overflow-x-auto rounded-md border border-[rgb(var(--border))]">
            <table className="w-full min-w-[920px] text-sm">
              <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
                <tr>
                  <th className="px-3 py-2 font-medium">Model ID</th>
                  <th className="px-3 py-2 font-medium">Display Name</th>
                  <th className="px-3 py-2 font-medium">Capabilities</th>
                  <th className="px-3 py-2 font-medium">Context</th>
                  <th className="px-3 py-2 font-medium">Input / Output</th>
                  <th className="px-3 py-2 font-medium">Release</th>
                  <th className="px-3 py-2 text-right font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((m) => (
                  <tr
                    key={m.id}
                    className="border-t border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-elevated))]"
                  >
                    <td className="px-3 py-2 font-mono text-xs">{m.modelId}</td>
                    <td className="px-3 py-2">{m.displayName ?? '—'}</td>
                    <td className="px-3 py-2">
                      <div className="flex flex-wrap gap-1">
                        {(m.capabilities ?? []).map((c) => (
                          <Badge
                            key={c}
                            variant={CAPABILITY_VARIANT[c] ?? 'outline'}
                            className="text-[10px]"
                          >
                            {c}
                          </Badge>
                        ))}
                      </div>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{fmtContext(m.contextWindow)}</td>
                    <td className="px-3 py-2 font-mono text-xs">
                      {fmtPrice(m.inputPricePer1m)} / {fmtPrice(m.outputPricePer1m)}
                      <span className="ml-1 text-[rgb(var(--text-muted))]">/1M</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-[rgb(var(--text-muted))]">
                      {fmtDate(m.releaseDate)}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <Switch
                        checked={m.isActive}
                        onCheckedChange={(next) => onToggle(m, next)}
                        disabled={pendingId === m.id}
                        aria-label={`Aktifkan ${m.modelId}`}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </div>
  )
}
