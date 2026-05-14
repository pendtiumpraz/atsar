// Admin → Keamanan — `/admin/security`.
//
// Server component shell. Fetches the current security_settings row +
// defaults on the server so the client form mounts hydrated (no loading
// flash). The form itself is client-side (`SecuritySettingsForm`) and
// talks to PATCH /api/v1/admin/security.

import type { Metadata } from 'next'

import { SecuritySettingsForm } from '@/components/admin/security/security-settings-form'
import {
  getSettings,
  SECURITY_DEFAULTS,
} from '@/lib/server/services/security.service'

export const metadata: Metadata = {
  title: 'Keamanan · Admin Atsar',
}

export default async function AdminSecurityPage() {
  const settings = await getSettings()
  const initial = settings ?? {
    id: null,
    ...SECURITY_DEFAULTS,
    createdAt: null,
    updatedAt: null,
    updatedBy: null,
  }

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Keamanan
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Atur ambang batas (threshold) percobaan login gagal dan durasi
          lockout. Counter disimpan di Redis dengan jendela bergeser.
        </p>
      </header>

      <SecuritySettingsForm
        initial={{
          loginLockoutTier1Threshold: initial.loginLockoutTier1Threshold,
          loginLockoutTier1DurationSec: initial.loginLockoutTier1DurationSec,
          loginLockoutTier2Threshold: initial.loginLockoutTier2Threshold,
          loginLockoutTier2DurationSec: initial.loginLockoutTier2DurationSec,
          loginLockoutTier3Threshold: initial.loginLockoutTier3Threshold,
          loginLockoutTier3DurationSec: initial.loginLockoutTier3DurationSec,
          attemptWindowSec: initial.attemptWindowSec,
        }}
        defaults={SECURITY_DEFAULTS}
      />
    </div>
  )
}
