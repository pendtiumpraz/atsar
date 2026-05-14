// `/admin/battles` — index for AI-assisted battle ingest + manual edits.
//
// MVP scope: this page is the entry point for the "Tambah Perang (AI)" flow.
// An admin types a battle name (Latin or Arabic) plus an optional type / hints,
// hits Submit, and the page polls the resulting `research_jobs` row until
// the worker either finishes (and the admin is redirected to the draft edit
// page) or fails (showing the error).
//
// The page itself is a thin Server Component shell — the live state and
// polling logic live in the three client panels.

import { BattleBatchIngestPanel } from '@/components/admin/battles/battle-batch-ingest-panel'
import { BattleBulkList } from '@/components/admin/battles/battle-bulk-list'
import { BattleIngestPanel } from '@/components/admin/battles/battle-ingest-panel'

export const metadata = {
  title: 'Sirah Perang · Admin Atsar',
}

export default function AdminBattlesPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Sirah Perang
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Tambah ghazwah, sariyyah, dan futuhat menggunakan asisten riset AI.
          Asisten mengambil fakta dari domain whitelist saja dan menyusun draf
          bilingual untuk ditinjau.
        </p>
      </header>

      <BattleIngestPanel />
      <BattleBatchIngestPanel />
      <BattleBulkList />
    </div>
  )
}
