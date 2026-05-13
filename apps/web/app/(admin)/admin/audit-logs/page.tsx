// `/admin/audit-logs` — Audit log explorer (WIREFRAMES §25).
//
// Server component shell: renders the page header plus the URL-driven
// `<AuditFilters />` and `<AuditTable />` client components. All filter
// state lives in the URL query string so deep-links + back/forward
// navigation work naturally.
//
// Access control is handled by the parent `(admin)/layout.tsx` — by the
// time this page renders we already know the viewer is an admin. The API
// (`GET /api/v1/admin/audit-logs`) re-validates `audit_log.view` so we
// don't repeat that check here.

import type { Metadata } from 'next'

import { AuditFilters } from '@/components/admin/audit/audit-filters'
import { AuditTable } from '@/components/admin/audit/audit-table'

export const metadata: Metadata = {
  title: 'Audit Log',
  description:
    'Riwayat perubahan, login, dan aktivitas sistem pada platform Atsar.',
}

// `searchParams` in App Router is now async-by-default (Next 15+). We accept
// the loose `Record<string, string | string[] | undefined>` shape — actual
// parsing happens client-side in `<AuditFilters>` via `useSearchParams`.
type SearchParams = Record<string, string | string[] | undefined>

interface AuditLogsPageProps {
  searchParams: Promise<SearchParams> | SearchParams
}

export default async function AuditLogsPage({ searchParams }: AuditLogsPageProps) {
  // We await so Next's typed-routes happy path validates — but we don't
  // actually need the values on the server; the client components read
  // them straight from `useSearchParams`.
  await searchParams

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <header className="flex flex-wrap items-baseline justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Audit Log
          </h1>
          <p className="mt-1 text-sm text-[rgb(var(--text-muted))]">
            Jejak seluruh perubahan, login, dan aktivitas sistem Atsar.
            Klik baris untuk melihat diff lengkap.
          </p>
        </div>
      </header>

      <AuditFilters />
      <AuditTable />
    </div>
  )
}
