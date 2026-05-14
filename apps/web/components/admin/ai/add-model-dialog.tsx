'use client'

// Atsar — "Tambah Model" dialog (scoped to one provider).
//
// POSTs to /api/v1/admin/ai-providers/[providerId]/models. Capability slugs
// mirror the runtime AI registry (chat / agent / doc_analyzer / embedding /
// vision). The form intentionally keeps fields minimal — pricing / context
// window may be filled later.

import { Loader2 } from 'lucide-react'
import * as React from 'react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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

const CAPABILITIES = ['chat', 'agent', 'doc_analyzer', 'embedding', 'vision'] as const
type Capability = (typeof CAPABILITIES)[number]

interface FormState {
  modelId: string
  displayName: string
  contextWindow: string
  inputPricePer1m: string
  outputPricePer1m: string
  supportsTools: boolean
  supportsVision: boolean
  isActive: boolean
  capabilities: Capability[]
}

const EMPTY: FormState = {
  modelId: '',
  displayName: '',
  contextWindow: '',
  inputPricePer1m: '',
  outputPricePer1m: '',
  supportsTools: false,
  supportsVision: false,
  isActive: false,
  capabilities: ['chat'],
}

interface Props {
  providerId: string
  onCreated?: () => void
  children: React.ReactNode
}

export function AddModelDialog({ providerId, onCreated, children }: Props) {
  const [open, setOpen] = React.useState(false)
  const [form, setForm] = React.useState<FormState>(EMPTY)
  const [submitting, setSubmitting] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)

  function reset() {
    setForm(EMPTY)
    setError(null)
  }

  function toggleCapability(cap: Capability, on: boolean) {
    setForm((f) => ({
      ...f,
      capabilities: on ? [...f.capabilities, cap] : f.capabilities.filter((c) => c !== cap),
    }))
  }

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    const modelId = form.modelId.trim()
    if (!modelId) {
      setError('Model ID wajib diisi.')
      return
    }

    setSubmitting(true)
    try {
      const payload: Record<string, unknown> = {
        modelId,
        displayName: form.displayName.trim() || null,
        capabilities: form.capabilities.length > 0 ? form.capabilities : null,
        supportsTools: form.supportsTools,
        supportsVision: form.supportsVision,
        isActive: form.isActive,
      }
      const ctx = Number.parseInt(form.contextWindow, 10)
      if (Number.isFinite(ctx) && ctx > 0) payload.contextWindow = ctx
      if (form.inputPricePer1m.trim()) payload.inputPricePer1m = form.inputPricePer1m.trim()
      if (form.outputPricePer1m.trim()) payload.outputPricePer1m = form.outputPricePer1m.trim()

      const res = await fetch(`/api/v1/admin/ai-providers/${providerId}/models`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null
        throw new Error(body?.error?.message ?? 'Gagal menambah model')
      }
      toast.success(`Model ${modelId} berhasil ditambahkan`)
      reset()
      setOpen(false)
      onCreated?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menambah model'
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
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Tambah Model</DialogTitle>
          <DialogDescription>
            Daftarkan model baru pada provider ini. Capabilities menentukan
            role mana yang bisa memakai model ini.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="model-id">Model ID</Label>
              <Input
                id="model-id"
                placeholder="contoh: gpt-5.5-instant"
                value={form.modelId}
                onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                disabled={submitting}
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model-display">Display name</Label>
              <Input
                id="model-display"
                placeholder="contoh: GPT-5.5 Instant"
                value={form.displayName}
                onChange={(e) => setForm((f) => ({ ...f, displayName: e.target.value }))}
                disabled={submitting}
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="model-context">Context window</Label>
              <Input
                id="model-context"
                type="number"
                placeholder="200000"
                value={form.contextWindow}
                onChange={(e) => setForm((f) => ({ ...f, contextWindow: e.target.value }))}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model-input-price">Harga input / 1M ($)</Label>
              <Input
                id="model-input-price"
                placeholder="3.00"
                value={form.inputPricePer1m}
                onChange={(e) => setForm((f) => ({ ...f, inputPricePer1m: e.target.value }))}
                disabled={submitting}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="model-output-price">Harga output / 1M ($)</Label>
              <Input
                id="model-output-price"
                placeholder="15.00"
                value={form.outputPricePer1m}
                onChange={(e) => setForm((f) => ({ ...f, outputPricePer1m: e.target.value }))}
                disabled={submitting}
              />
            </div>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Capabilities</legend>
            <div className="flex flex-wrap gap-3">
              {CAPABILITIES.map((cap) => (
                <label key={cap} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.capabilities.includes(cap)}
                    onCheckedChange={(v) => toggleCapability(cap, Boolean(v))}
                    disabled={submitting}
                  />
                  <span className="font-mono text-xs">{cap}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.supportsTools}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, supportsTools: Boolean(v) }))
                }
                disabled={submitting}
              />
              <span>supports_tools</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.supportsVision}
                onCheckedChange={(v) =>
                  setForm((f) => ({ ...f, supportsVision: Boolean(v) }))
                }
                disabled={submitting}
              />
              <span>supports_vision</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.isActive}
                onCheckedChange={(v) => setForm((f) => ({ ...f, isActive: Boolean(v) }))}
                disabled={submitting}
              />
              <span>Langsung aktifkan</span>
            </label>
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
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Menyimpan…
                </>
              ) : (
                'Simpan'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
