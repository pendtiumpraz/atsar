'use client'

// Atsar — list of AI providers with toggle / edit / test / rotate.
//
// 8 providers are seeded (May 2026): deepseek (active), anthropic, openai,
// google, xai, mistral, qwen, meta-llama. Other than DeepSeek they ship
// inactive — the admin must enable them after pasting an API key.
//
// API surface (provided by sibling agents):
//   GET    /api/v1/admin/ai-providers
//   PATCH  /api/v1/admin/ai-providers/:id           { isActive?, name?, baseUrl? }
//   POST   /api/v1/admin/ai-providers/:id/test      → { ok: boolean, message?: string }
//   POST   /api/v1/admin/ai-providers/:id/rotate    { apiKey } → { apiKeyLast4 }
//
// Destructive flows go through SweetAlert (`confirm`), per project convention.

import { CheckCircle2, CircleDashed, Loader2, Pencil, Settings, Zap } from 'lucide-react'
import Link from 'next/link'
import * as React from 'react'
import { toast } from 'sonner'

import { ApiKeyInput, maskApiKey } from '@/components/admin/ai/api-key-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { confirm } from '@/lib/swal'

export interface ProviderModelSummary {
  id: string
  modelId: string
  displayName: string | null
  isActive: boolean
}

export interface ProviderRow {
  id: string
  slug: string
  name: string
  sdkAdapter: string
  baseUrl: string | null
  apiKeyLast4: string | null
  isActive: boolean
  notes: string | null
  models: ProviderModelSummary[]
}

interface Props {
  /** Filter to only enabled providers when true. */
  activeOnly?: boolean
}

export function ProviderList({ activeOnly = false }: Props) {
  const [providers, setProviders] = React.useState<ProviderRow[]>([])
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState<Record<string, string | null>>({})
  const [editing, setEditing] = React.useState<ProviderRow | null>(null)

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/v1/admin/ai-providers', { credentials: 'include' })
      if (!res.ok) throw new Error('Gagal memuat provider')
      const body = (await res.json()) as { data?: ProviderRow[] } | ProviderRow[]
      const rows = Array.isArray(body) ? body : (body.data ?? [])
      setProviders(rows)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat provider')
    } finally {
      setLoading(false)
    }
  }, [])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  function setBusyFor(id: string, action: string | null) {
    setBusy((prev) => ({ ...prev, [id]: action }))
  }

  async function onToggle(p: ProviderRow, next: boolean) {
    // Disabling an active provider can break role assignments — confirm.
    if (!next) {
      const ok = await confirm({
        title: `Nonaktifkan ${p.name}?`,
        text: 'Role yang menggunakan provider ini akan berhenti berfungsi sampai diganti.',
        confirmText: 'Nonaktifkan',
        dangerous: true,
      })
      if (!ok) return
    }
    setBusyFor(p.id, 'toggle')
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${p.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) throw new Error('Gagal mengubah status')
      setProviders((rows) =>
        rows.map((r) => (r.id === p.id ? { ...r, isActive: next } : r)),
      )
      toast.success(`${p.name} ${next ? 'diaktifkan' : 'dinonaktifkan'}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status')
    } finally {
      setBusyFor(p.id, null)
    }
  }

  async function onTest(p: ProviderRow) {
    setBusyFor(p.id, 'test')
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${p.id}/test`, {
        method: 'POST',
        credentials: 'include',
      })
      const body = (await res.json().catch(() => null)) as
        | { ok?: boolean; message?: string }
        | null
      if (!res.ok || body?.ok === false) {
        throw new Error(body?.message ?? 'Test gagal')
      }
      toast.success(`Koneksi ${p.name} OK`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Test gagal')
    } finally {
      setBusyFor(p.id, null)
    }
  }

  async function onRotate(p: ProviderRow, newKey: string) {
    setBusyFor(p.id, 'rotate')
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${p.id}/rotate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: newKey }),
      })
      if (!res.ok) throw new Error('Gagal rotate API key')
      const body = (await res.json().catch(() => null)) as { apiKeyLast4?: string } | null
      const apiKeyLast4 = body?.apiKeyLast4 ?? newKey.slice(-4)
      setProviders((rows) =>
        rows.map((r) => (r.id === p.id ? { ...r, apiKeyLast4 } : r)),
      )
      toast.success(`API key ${p.name} berhasil di-rotate`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal rotate API key')
    } finally {
      setBusyFor(p.id, null)
    }
  }

  const visible = activeOnly ? providers.filter((p) => p.isActive) : providers

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-8 text-sm text-[rgb(var(--text-muted))]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat provider…
      </div>
    )
  }

  if (visible.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[rgb(var(--text-muted))]">
        {activeOnly
          ? 'Belum ada provider yang aktif.'
          : 'Belum ada provider yang terdaftar.'}
      </p>
    )
  }

  return (
    <>
      <div className="space-y-3">
        {visible.map((p) => (
          <ProviderCard
            key={p.id}
            provider={p}
            busy={busy[p.id] ?? null}
            onToggle={(next) => onToggle(p, next)}
            onTest={() => onTest(p)}
            onRotate={(next) => onRotate(p, next)}
            onEdit={() => setEditing(p)}
          />
        ))}
      </div>

      <EditProviderDialog
        provider={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setProviders((rows) =>
            rows.map((r) => (r.id === updated.id ? { ...r, ...updated } : r)),
          )
          setEditing(null)
        }}
      />
    </>
  )
}

// ────────────────────────────────────────────────────────────────
// Single provider card
// ────────────────────────────────────────────────────────────────

interface CardProps {
  provider: ProviderRow
  busy: string | null
  onToggle: (next: boolean) => void
  onTest: () => void
  onRotate: (newKey: string) => Promise<void>
  onEdit: () => void
}

function ProviderCard({ provider, busy, onToggle, onTest, onRotate, onEdit }: CardProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            {provider.isActive ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 text-[rgb(var(--success))]" aria-hidden />
            ) : (
              <CircleDashed className="mt-0.5 h-5 w-5 text-[rgb(var(--text-muted))]" aria-hidden />
            )}
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-base font-semibold">{provider.name}</h3>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {provider.slug}
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  {provider.sdkAdapter}
                </Badge>
              </div>
              {provider.notes ? (
                <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">{provider.notes}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Label htmlFor={`toggle-${provider.id}`} className="text-xs">
              {provider.isActive ? 'Aktif' : 'Nonaktif'}
            </Label>
            <Switch
              id={`toggle-${provider.id}`}
              checked={provider.isActive}
              onCheckedChange={onToggle}
              disabled={busy === 'toggle'}
              aria-label={`Aktifkan ${provider.name}`}
            />
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-[1fr_auto]">
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
              API Key
            </div>
            {provider.apiKeyLast4 ? (
              <ApiKeyInput
                value=""
                onChange={() => undefined}
                existingLast4={provider.apiKeyLast4}
                onRotate={onRotate}
                submitting={busy === 'rotate'}
              />
            ) : (
              <p className="text-sm text-[rgb(var(--warning))]">
                Belum ada API key — set via "Edit" atau Rotate.
              </p>
            )}
          </div>

          <div className="flex items-end gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={onTest}
              disabled={busy !== null || !provider.apiKeyLast4}
            >
              {busy === 'test' ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <Zap className="h-3.5 w-3.5" />
              )}
              Test
            </Button>
            <Button size="sm" variant="outline" onClick={onEdit} disabled={busy !== null}>
              <Pencil className="h-3.5 w-3.5" />
              Edit
            </Button>
            <Button asChild size="sm" variant="outline" disabled={busy !== null}>
              <Link href={`/admin/ai-providers/${provider.id}`}>
                <Settings className="h-3.5 w-3.5" />
                Detail
              </Link>
            </Button>
          </div>
        </div>

        <div className="mt-3 text-xs text-[rgb(var(--text-muted))]">
          Models:&nbsp;
          {provider.models.length === 0 ? (
            <span>—</span>
          ) : (
            provider.models.map((m, i) => (
              <span key={m.id}>
                {i > 0 ? ', ' : ''}
                <span className={m.isActive ? 'text-[rgb(var(--text))]' : ''}>{m.modelId}</span>
                {m.isActive ? <span className="text-[rgb(var(--success))]"> (aktif)</span> : null}
              </span>
            ))
          )}
        </div>

        {/* Masked preview for screen-reader users */}
        <span className="sr-only">
          API key tersimpan: {maskApiKey(provider.apiKeyLast4)}
        </span>
      </CardContent>
    </Card>
  )
}

// ────────────────────────────────────────────────────────────────
// Edit dialog (name / base URL / notes)
// ────────────────────────────────────────────────────────────────

interface EditProps {
  provider: ProviderRow | null
  onClose: () => void
  onSaved: (updated: ProviderRow) => void
}

function EditProviderDialog({ provider, onClose, onSaved }: EditProps) {
  const [form, setForm] = React.useState({ name: '', baseUrl: '', notes: '', apiKey: '' })
  const [submitting, setSubmitting] = React.useState(false)

  React.useEffect(() => {
    if (provider) {
      setForm({
        name: provider.name,
        baseUrl: provider.baseUrl ?? '',
        notes: provider.notes ?? '',
        apiKey: '',
      })
    }
  }, [provider])

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    if (!provider) return
    setSubmitting(true)
    try {
      // PATCH metadata first.
      const res = await fetch(`/api/v1/admin/ai-providers/${provider.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan perubahan')

      // If the admin pasted a new API key in this dialog, rotate it via the
      // dedicated endpoint (separate POST so the encryption + audit-log
      // path stays unified with the standalone Rotate button).
      let nextLast4 = provider.apiKeyLast4
      const newKey = form.apiKey.trim()
      if (newKey.length > 0) {
        const rot = await fetch(
          `/api/v1/admin/ai-providers/${provider.id}/rotate`,
          {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ apiKey: newKey }),
          },
        )
        if (!rot.ok) throw new Error('Gagal menyimpan API key baru')
        nextLast4 = newKey.slice(-4)
      }

      toast.success(`${form.name} berhasil diperbarui`)
      onSaved({
        ...provider,
        name: form.name.trim(),
        baseUrl: form.baseUrl.trim() || null,
        notes: form.notes.trim() || null,
        apiKeyLast4: nextLast4,
      })
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan perubahan')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog open={provider !== null} onOpenChange={(o) => (o ? null : onClose())}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Provider</DialogTitle>
          <DialogDescription>
            {provider ? `Ubah metadata untuk ${provider.name}.` : ''}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="edit-name">Nama</Label>
            <Input
              id="edit-name"
              value={form.name}
              onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-base-url">Base URL</Label>
            <Input
              id="edit-base-url"
              type="url"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              disabled={submitting}
              placeholder="https://api.example.com/v1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-notes">Catatan</Label>
            <Input
              id="edit-notes"
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={submitting}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="edit-api-key">
              API Key {provider?.apiKeyLast4 ? '(opsional — kosongkan untuk tetap pakai yang lama)' : '(wajib jika belum diset)'}
            </Label>
            <Input
              id="edit-api-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={form.apiKey}
              onChange={(e) => setForm((f) => ({ ...f, apiKey: e.target.value }))}
              placeholder={provider?.apiKeyLast4 ? `sk-•••••${provider.apiKeyLast4}` : 'sk-...'}
              disabled={submitting}
              className="font-mono"
            />
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Key disimpan terenkripsi (AES-256-GCM). Hanya 4 karakter terakhir yang ditampilkan setelah disimpan.
            </p>
          </div>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Batal
            </Button>
            <Button type="submit" disabled={submitting}>
              {submitting ? 'Menyimpan…' : 'Simpan'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
