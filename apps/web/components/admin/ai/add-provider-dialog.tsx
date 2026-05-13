'use client'

// Atsar — "Tambah Provider" dialog.
//
// POSTs to /api/v1/admin/ai-providers. The server encrypts `apiKey`
// with AES-256-GCM before persisting and only returns metadata
// (no plaintext key) back to the client.
//
// SDK adapters mirror `aiSdkAdapterEnum` in packages/db/schema/enums.ts:
//   openai-compatible | anthropic | google | deepseek | custom

import { Plus } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { ApiKeyInput } from '@/components/admin/ai/api-key-input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export type SdkAdapter =
  | 'openai-compatible'
  | 'anthropic'
  | 'google'
  | 'deepseek'
  | 'custom'

const ADAPTERS: ReadonlyArray<{ value: SdkAdapter; label: string }> = [
  { value: 'openai-compatible', label: 'OpenAI-compatible' },
  { value: 'anthropic', label: 'Anthropic' },
  { value: 'google', label: 'Google Gemini' },
  { value: 'deepseek', label: 'DeepSeek' },
  { value: 'custom', label: 'Custom' },
]

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/

interface FormState {
  slug: string
  name: string
  sdkAdapter: SdkAdapter
  baseUrl: string
  apiKey: string
}

const EMPTY: FormState = {
  slug: '',
  name: '',
  sdkAdapter: 'openai-compatible',
  baseUrl: '',
  apiKey: '',
}

export interface AddProviderDialogProps {
  onCreated?: () => void
}

export function AddProviderDialog({ onCreated }: AddProviderDialogProps) {
  const [open, setOpen] = React.useState(false)
  const [submitting, setSubmitting] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [error, setError] = React.useState<string | null>(null)

  function reset() {
    setForm(EMPTY)
    setError(null)
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const slug = form.slug.trim().toLowerCase()
    const name = form.name.trim()
    if (!SLUG_RE.test(slug)) {
      setError('Slug harus huruf kecil, angka, atau tanda hubung.')
      return
    }
    if (!name) {
      setError('Nama provider wajib diisi.')
      return
    }
    if (!form.apiKey.trim()) {
      setError('API Key wajib diisi.')
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/v1/admin/ai-providers', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug,
          name,
          sdkAdapter: form.sdkAdapter,
          baseUrl: form.baseUrl.trim() || null,
          apiKey: form.apiKey,
        }),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { message?: string } | null
        throw new Error(body?.message ?? 'Gagal menambah provider')
      }
      toast.success(`Provider ${name} berhasil ditambahkan`)
      reset()
      setOpen(false)
      onCreated?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menambah provider'
      setError(msg)
      toast.error(msg)
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next)
        if (!next) reset()
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="h-4 w-4" />
          Tambah Provider
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah AI Provider</DialogTitle>
          <DialogDescription>
            Tambahkan provider baru. API key akan dienkripsi server-side
            (AES-256-GCM) dan tidak akan ditampilkan kembali setelah disimpan.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="provider-slug">Slug</Label>
              <Input
                id="provider-slug"
                placeholder="contoh: openai"
                value={form.slug}
                onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value }))}
                disabled={submitting}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="provider-name">Nama</Label>
              <Input
                id="provider-name"
                placeholder="contoh: OpenAI"
                value={form.name}
                onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-adapter">SDK Adapter</Label>
            <Select
              value={form.sdkAdapter}
              onValueChange={(v) => setForm((f) => ({ ...f, sdkAdapter: v as SdkAdapter }))}
              disabled={submitting}
            >
              <SelectTrigger id="provider-adapter">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADAPTERS.map((a) => (
                  <SelectItem key={a.value} value={a.value}>
                    {a.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-base-url">Base URL (opsional)</Label>
            <Input
              id="provider-base-url"
              type="url"
              placeholder="https://api.example.com/v1"
              value={form.baseUrl}
              onChange={(e) => setForm((f) => ({ ...f, baseUrl: e.target.value }))}
              disabled={submitting}
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="provider-api-key">API Key</Label>
            <ApiKeyInput
              id="provider-api-key"
              value={form.apiKey}
              onChange={(v) => setForm((f) => ({ ...f, apiKey: v }))}
              submitting={submitting}
            />
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Key disimpan terenkripsi. Setelah disimpan, hanya 4 karakter
              terakhir yang ditampilkan.
            </p>
          </div>

          {error ? (
            <p className="text-sm text-[rgb(var(--danger))]" role="alert">
              {error}
            </p>
          ) : null}

          <DialogFooter>
            <Button
              type="button"
              variant="ghost"
              onClick={() => setOpen(false)}
              disabled={submitting}
            >
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
