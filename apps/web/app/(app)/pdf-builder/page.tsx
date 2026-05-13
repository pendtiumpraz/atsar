// `/pdf-builder` — entrypoint for the PDF book builder wizard.
//
// Server component. The `(app)` layout already enforces auth + active
// subscription, so we can assume `session.user` is present here. We pre-load
// the user's `pdf_download` quota and pass it down so the wizard can render an
// upgrade banner immediately (no client-side flash while polling).
//
// Wireframes: docs/WIREFRAMES.md §16 (Builder) + §17 (Templates).

import { headers } from 'next/headers'
import type { Metadata } from 'next'

import { Wizard } from '@/components/pdf-builder/wizard'
import { auth } from '@/lib/server/auth'
import { ensureQuota, type QuotaStatus } from '@/lib/server/services/quota.service'

export const metadata: Metadata = {
  title: 'Buat Buku PDF',
  description:
    'Susun koleksi tokoh menjadi buku PDF siap-cetak — pilih template, layout, dan cover.',
}

async function readPdfQuota(userId: string): Promise<QuotaStatus | null> {
  try {
    return await ensureQuota(userId, 'pdf_download')
  } catch {
    // QUOTA_EXCEEDED, no active sub, etc. — render the wizard in "blocked"
    // mode so the user sees an upgrade banner instead of a stack trace.
    return null
  }
}

export default async function PdfBuilderPage() {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  // Layout guarantees session; this is a typeguard.
  if (!session?.user?.id) return null

  const quota = await readPdfQuota(session.user.id)
  const remaining = quota?.remaining ?? 0
  const used = quota?.used ?? 0
  const limit = quota?.limit ?? 0

  return (
    <div className="mx-auto w-full max-w-5xl">
      <header className="mb-6 flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Buat Buku PDF
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">
            Pilih tokoh, susun judul, lalu generate buku Sirah pribadi Anda.
          </p>
        </div>
        <span className="rounded-full bg-[rgb(var(--bg-elevated))] px-3 py-1 text-xs text-[rgb(var(--text-muted))]">
          Sisa kuota: <strong className="text-[rgb(var(--text))]">{remaining}</strong>
          {limit > 0 ? <> / {limit}</> : null}
        </span>
      </header>

      <Wizard
        author={{
          name: session.user.name ?? '',
          email: session.user.email ?? '',
        }}
        quota={{ used, limit, remaining }}
      />
    </div>
  )
}
