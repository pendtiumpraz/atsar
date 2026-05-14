'use client'

// Atsar — provider detail card + nested models table.
//
// Fetches `GET /api/v1/admin/ai-providers/[id]`. Surface:
//   - Header: provider name + slug + adapter badge + back link.
//   - Settings card: rename, base URL, notes, isActive switch, rotate key,
//     soft delete.
//   - Models sub-table: list/add/edit/delete models scoped to this provider.

import { ArrowLeft, CheckCircle2, CircleDashed, Loader2, Plus, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import * as React from 'react'
import { toast } from 'sonner'

import { AddModelDialog } from '@/components/admin/ai/add-model-dialog'
import { ApiKeyInput } from '@/components/admin/ai/api-key-input'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Textarea } from '@/components/ui/textarea'
import { confirm } from '@/lib/swal'

interface ProviderModel {
  id: string
  providerId: string
  providerName: string
  providerSlug: string
  modelId: string
  displayName: string | null
  capabilities: string[] | null
  contextWindow: number | null
  maxOutputTokens: number | null
  supportsStreaming: boolean
  supportsTools: boolean
  supportsVision: boolean
  inputPricePer1m: string | null
  outputPricePer1m: string | null
  isActive: boolean
}

interface ProviderDetailDto {
  id: string
  slug: string
  name: string
  sdkAdapter: string
  baseUrl: string | null
  apiKeyLast4: string | null
  isActive: boolean
  notes: string | null
  models: ProviderModel[]
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

interface Props {
  providerId: string
}

export function ProviderDetail({ providerId }: Props) {
  const router = useRouter()
  const [provider, setProvider] = React.useState<ProviderDetailDto | null>(null)
  const [loading, setLoading] = React.useState(true)
  const [busy, setBusy] = React.useState<string | null>(null)
  const [form, setForm] = React.useState({ name: '', baseUrl: '', notes: '' })

  const refresh = React.useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${providerId}`, {
        credentials: 'include',
      })
      if (!res.ok) throw new Error('Gagal memuat provider')
      const body = (await res.json()) as { data?: ProviderDetailDto }
      const data = body.data ?? null
      setProvider(data)
      if (data) {
        setForm({
          name: data.name,
          baseUrl: data.baseUrl ?? '',
          notes: data.notes ?? '',
        })
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal memuat provider')
    } finally {
      setLoading(false)
    }
  }, [providerId])

  React.useEffect(() => {
    void refresh()
  }, [refresh])

  async function onSaveSettings() {
    if (!provider) return
    setBusy('save')
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${providerId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          baseUrl: form.baseUrl.trim() || null,
          notes: form.notes.trim() || null,
        }),
      })
      if (!res.ok) throw new Error('Gagal menyimpan provider')
      toast.success('Provider tersimpan')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan provider')
    } finally {
      setBusy(null)
    }
  }

  async function onToggleActive(next: boolean) {
    if (!provider) return
    setBusy('toggle')
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${providerId}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(body?.error?.message ?? 'Gagal mengubah status')
      }
      toast.success(`Provider ${next ? 'diaktifkan' : 'dinonaktifkan'}`)
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal mengubah status')
    } finally {
      setBusy(null)
    }
  }

  async function onRotate(newKey: string) {
    setBusy('rotate')
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${providerId}/rotate`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ apiKey: newKey }),
      })
      if (!res.ok) throw new Error('Gagal rotate API key')
      toast.success('API key berhasil di-rotate')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal rotate API key')
    } finally {
      setBusy(null)
    }
  }

  async function onDeleteProvider() {
    if (!provider) return
    const sure = await confirm({
      title: `Hapus provider ${provider.name}?`,
      text:
        'Provider akan disoft-delete bersama semua model di bawahnya. Role yang terikat ke model ini akan menolak penghapusan.',
      confirmText: 'Hapus',
      dangerous: true,
    })
    if (!sure) return
    setBusy('delete-provider')
    try {
      const res = await fetch(`/api/v1/admin/ai-providers/${providerId}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.status === 204) {
        toast.success(`${provider.name} dihapus`)
        router.push('/admin/ai-providers')
        return
      }
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null
      throw new Error(body?.error?.message ?? 'Gagal menghapus')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus')
    } finally {
      setBusy(null)
    }
  }

  async function onToggleModel(modelRow: ProviderModel, next: boolean) {
    setBusy(`model-${modelRow.id}`)
    try {
      const res = await fetch(`/api/v1/admin/ai-models/${modelRow.id}`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: next }),
      })
      if (!res.ok) throw new Error('Gagal toggle model')
      await refresh()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal toggle model')
    } finally {
      setBusy(null)
    }
  }

  async function onDeleteModel(modelRow: ProviderModel) {
    const sure = await confirm({
      title: `Hapus model ${modelRow.modelId}?`,
      text: 'Model akan disoft-delete dan tidak akan muncul lagi di role assignment.',
      confirmText: 'Hapus',
      dangerous: true,
    })
    if (!sure) return
    setBusy(`model-${modelRow.id}`)
    try {
      const res = await fetch(`/api/v1/admin/ai-models/${modelRow.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (res.status === 204) {
        toast.success('Model dihapus')
        await refresh()
        return
      }
      const body = (await res.json().catch(() => null)) as
        | { error?: { message?: string } }
        | null
      throw new Error(body?.error?.message ?? 'Gagal menghapus model')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus model')
    } finally {
      setBusy(null)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 text-sm text-[rgb(var(--text-muted))]">
        <Loader2 className="h-4 w-4 animate-spin" />
        Memuat provider…
      </div>
    )
  }

  if (!provider) {
    return (
      <div className="space-y-4">
        <BackLink />
        <p className="text-sm text-[rgb(var(--text-muted))]">Provider tidak ditemukan.</p>
      </div>
    )
  }

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="space-y-2">
        <BackLink />
        <div className="flex flex-wrap items-center gap-3">
          {provider.isActive ? (
            <CheckCircle2 className="h-5 w-5 text-[rgb(var(--success))]" aria-hidden />
          ) : (
            <CircleDashed className="h-5 w-5 text-[rgb(var(--text-muted))]" aria-hidden />
          )}
          <h1 className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl">
            {provider.name}
          </h1>
          <Badge variant="outline" className="font-mono text-[10px]">
            {provider.slug}
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            {provider.sdkAdapter}
          </Badge>
        </div>
      </header>

      {/* Settings card */}
      <Card>
        <CardHeader>
          <CardTitle>Pengaturan Provider</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="provider-name">Nama tampilan</Label>
              <Input
                id="provider-name"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={busy !== null}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provider-base-url">Base URL</Label>
              <Input
                id="provider-base-url"
                type="url"
                value={form.baseUrl}
                onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
                disabled={busy !== null}
                placeholder="https://api.example.com/v1"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-notes">Catatan</Label>
            <Textarea
              id="provider-notes"
              rows={2}
              value={form.notes}
              onChange={(e) => setForm((f) => ({ ...f, notes: e.target.value }))}
              disabled={busy !== null}
            />
          </div>

          <div className="space-y-1.5">
            <Label>API Key</Label>
            <ApiKeyInput
              value=""
              onChange={() => undefined}
              existingLast4={provider.apiKeyLast4}
              onRotate={onRotate}
              submitting={busy === 'rotate'}
            />
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Key disimpan terenkripsi (AES-256-GCM). Hanya 4 karakter terakhir
              yang ditampilkan.
            </p>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-3">
            <div>
              <Label htmlFor="provider-active" className="text-sm font-medium">
                Provider aktif
              </Label>
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Nonaktifkan untuk menjeda penggunaan provider ini tanpa menghapusnya.
              </p>
            </div>
            <Switch
              id="provider-active"
              checked={provider.isActive}
              onCheckedChange={onToggleActive}
              disabled={busy !== null}
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
            <Button
              variant="destructive"
              size="sm"
              onClick={onDeleteProvider}
              disabled={busy !== null}
            >
              <Trash2 className="h-3.5 w-3.5" />
              Hapus Provider
            </Button>
            <Button onClick={onSaveSettings} disabled={busy !== null}>
              {busy === 'save' ? 'Menyimpan…' : 'Simpan Perubahan'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Models sub-table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Models</CardTitle>
          <AddModelDialog providerId={providerId} onCreated={refresh}>
            <Button size="sm">
              <Plus className="h-3.5 w-3.5" />
              Tambah Model
            </Button>
          </AddModelDialog>
        </CardHeader>
        <CardContent>
          {provider.models.length === 0 ? (
            <p className="py-6 text-center text-sm text-[rgb(var(--text-muted))]">
              Belum ada model. Tambahkan model pertama dengan tombol di atas.
            </p>
          ) : (
            <div className="overflow-x-auto rounded-md border border-[rgb(var(--border))]">
              <table className="w-full min-w-[760px] text-sm">
                <thead className="bg-[rgb(var(--bg-elevated))] text-left text-xs uppercase tracking-wide text-[rgb(var(--text-muted))]">
                  <tr>
                    <th className="px-3 py-2 font-medium">Model ID</th>
                    <th className="px-3 py-2 font-medium">Display</th>
                    <th className="px-3 py-2 font-medium">Context</th>
                    <th className="px-3 py-2 font-medium">Input / Output / 1M</th>
                    <th className="px-3 py-2 font-medium">Aktif</th>
                    <th className="px-3 py-2 text-right font-medium">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {provider.models.map((m) => (
                    <tr
                      key={m.id}
                      className="border-t border-[rgb(var(--border))] hover:bg-[rgb(var(--bg-elevated))]"
                    >
                      <td className="px-3 py-2 font-mono text-xs">{m.modelId}</td>
                      <td className="px-3 py-2">{m.displayName ?? '—'}</td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {fmtContext(m.contextWindow)}
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">
                        {fmtPrice(m.inputPricePer1m)} / {fmtPrice(m.outputPricePer1m)}
                      </td>
                      <td className="px-3 py-2">
                        <Switch
                          checked={m.isActive}
                          onCheckedChange={(v) => onToggleModel(m, v)}
                          disabled={busy === `model-${m.id}`}
                          aria-label={`Aktifkan ${m.modelId}`}
                        />
                      </td>
                      <td className="px-3 py-2 text-right">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => onDeleteModel(m)}
                          disabled={busy === `model-${m.id}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function BackLink() {
  return (
    <Link
      href="/admin/ai-providers"
      className="inline-flex items-center gap-1 text-xs text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]"
    >
      <ArrowLeft className="h-3.5 w-3.5" />
      Kembali ke daftar provider
    </Link>
  )
}
