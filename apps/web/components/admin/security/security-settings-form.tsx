// Client form for /admin/security — edits the singleton security_settings
// row via PATCH /api/v1/admin/security.

'use client'

import * as React from 'react'
import { Loader2, RotateCcw, ShieldCheck } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { api, ApiClientError } from '@/lib/api/client'

interface LockoutValues {
  loginLockoutTier1Threshold: number
  loginLockoutTier1DurationSec: number
  loginLockoutTier2Threshold: number
  loginLockoutTier2DurationSec: number
  loginLockoutTier3Threshold: number
  loginLockoutTier3DurationSec: number
  attemptWindowSec: number
}

export interface SecuritySettingsFormProps {
  initial: LockoutValues
  defaults: LockoutValues
}

function durationLabel(sec: number): string {
  if (sec < 60) return `${sec} detik`
  if (sec < 3600) return `${Math.round(sec / 60)} menit`
  return `${(sec / 3600).toFixed(1)} jam`
}

export function SecuritySettingsForm({ initial, defaults }: SecuritySettingsFormProps) {
  const [values, setValues] = React.useState<LockoutValues>(initial)
  const [saving, setSaving] = React.useState(false)

  const dirty = (Object.keys(values) as (keyof LockoutValues)[]).some(
    (k) => values[k] !== initial[k],
  )

  function setField<K extends keyof LockoutValues>(key: K, raw: string) {
    const n = Number(raw)
    if (!Number.isFinite(n) || n < 0) return
    setValues((prev) => ({ ...prev, [key]: Math.floor(n) }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Client-side sanity check — backend re-validates.
    if (
      values.loginLockoutTier1Threshold > values.loginLockoutTier2Threshold ||
      values.loginLockoutTier2Threshold > values.loginLockoutTier3Threshold
    ) {
      toast.error('Threshold harus menaik: tier1 ≤ tier2 ≤ tier3.')
      return
    }
    setSaving(true)
    try {
      await api.patch('/admin/security', values)
      toast.success('Pengaturan keamanan tersimpan.')
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal menyimpan.'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  function resetToDefaults() {
    setValues({ ...defaults })
    toast.info('Form direset ke default — klik Simpan untuk menerapkan.')
  }

  const tiers = [
    {
      label: 'Tier 1 (peringatan ringan)',
      thresholdKey: 'loginLockoutTier1Threshold' as const,
      durationKey: 'loginLockoutTier1DurationSec' as const,
      description: 'Lockout pendek untuk slip jari kesalahan input.',
    },
    {
      label: 'Tier 2 (eskalasi)',
      thresholdKey: 'loginLockoutTier2Threshold' as const,
      durationKey: 'loginLockoutTier2DurationSec' as const,
      description: 'Indikasi password tebak-tebakan — jeda lebih panjang.',
    },
    {
      label: 'Tier 3 (lockout berat)',
      thresholdKey: 'loginLockoutTier3Threshold' as const,
      durationKey: 'loginLockoutTier3DurationSec' as const,
      description: 'Pola brute-force yang jelas — lockout signifikan.',
    },
  ]

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <div className="flex items-start gap-3">
            <div className="rounded-md bg-[rgb(var(--accent))]/10 p-2 text-[rgb(var(--accent))]">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <CardTitle>Login lockout berjenjang</CardTitle>
              <CardDescription className="mt-1">
                Counter percobaan gagal disimpan per email dan per IP di Redis,
                dengan jendela bergeser. Bila salah satu bucket menembus
                ambang batas tier, lockout dipasang dengan durasi sesuai.
              </CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-2">
            <Label htmlFor="attemptWindowSec">Jendela hitung (detik)</Label>
            <Input
              id="attemptWindowSec"
              type="number"
              min={60}
              max={86_400}
              value={values.attemptWindowSec}
              onChange={(e) => setField('attemptWindowSec', e.target.value)}
            />
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Counter direset bila tidak ada percobaan dalam durasi ini.
              Default 1 jam ({durationLabel(values.attemptWindowSec)} saat ini).
            </p>
          </div>

          {tiers.map((t) => (
            <div
              key={t.label}
              className="grid gap-3 rounded-md border border-[rgb(var(--border))] p-4 sm:grid-cols-2"
            >
              <div className="sm:col-span-2">
                <h3 className="text-sm font-semibold text-[rgb(var(--text))]">
                  {t.label}
                </h3>
                <p className="text-xs text-[rgb(var(--text-muted))]">
                  {t.description}
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor={t.thresholdKey}>Threshold (jumlah gagal)</Label>
                <Input
                  id={t.thresholdKey}
                  type="number"
                  min={1}
                  max={100}
                  value={values[t.thresholdKey]}
                  onChange={(e) => setField(t.thresholdKey, e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor={t.durationKey}>Durasi lockout (detik)</Label>
                <Input
                  id={t.durationKey}
                  type="number"
                  min={10}
                  max={86_400}
                  value={values[t.durationKey]}
                  onChange={(e) => setField(t.durationKey, e.target.value)}
                />
                <p className="text-xs text-[rgb(var(--text-faint))]">
                  ≈ {durationLabel(values[t.durationKey])}
                </p>
              </div>
            </div>
          ))}

          <div className="flex flex-wrap items-center justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={resetToDefaults}
              disabled={saving}
            >
              <RotateCcw className="h-4 w-4" />
              Reset ke default
            </Button>
            <Button type="submit" disabled={!dirty || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Simpan
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
