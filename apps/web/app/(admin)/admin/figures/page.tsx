// `/admin/figures` — index for AI-assisted figure ingest + manual edits.
//
// MVP scope: this page is the entry point for the "Tambah Tokoh (AI)" flow
// described in docs/IDEAS.md. An admin types a figure name (Latin or Arabic)
// plus an optional category/gender/hints, hits Submit, and the page polls
// the resulting `research_jobs` row until the worker either finishes (and
// the admin is redirected to the draft edit page) or fails (showing the
// error).
//
// The page itself is a thin Server Component shell — the live state and
// polling logic live in `<FigureIngestPanel />`.

import { FigureBatchIngestPanel } from '@/components/admin/figures/figure-batch-ingest-panel'
import { FigureIngestPanel } from '@/components/admin/figures/figure-ingest-panel'

export const metadata = {
  title: 'Tokoh · Admin Atsar',
}

export default function AdminFiguresPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Tokoh
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Tambah tokoh baru menggunakan asisten riset AI. Asisten mengambil
          fakta dari domain whitelist saja dan menyusun draf bilingual untuk
          ditinjau.
        </p>
      </header>

      <FigureIngestPanel />
      <FigureBatchIngestPanel />
    </div>
  )
}
