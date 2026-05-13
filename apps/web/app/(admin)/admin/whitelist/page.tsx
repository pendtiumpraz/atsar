// `/admin/whitelist` — manage the citation-source whitelist used by the
// AI research crawler.  Admins can add/edit/remove domains and toggle the
// `isActive` flag plus the per-domain crawl rate.
//
// This page is a thin Server Component: it renders the page chrome
// (heading + "Tambah Domain" trigger) and hands the live list off to the
// `<WhitelistTable />` client component, which owns the TanStack Query
// cache, inline edits, and CRUD round-trips against `/api/v1/admin/whitelist`.
//
// Auth: `(admin)/layout.tsx` already gates this route by the `admin` role —
// no need to re-check here.

import { WhitelistTable } from '@/components/admin/whitelist/whitelist-table'

export const metadata = {
  title: 'Whitelist Domain · Admin Atsar',
}

export default function WhitelistPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-col gap-1">
        <h1
          className="text-2xl font-semibold text-[rgb(var(--text))]"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Whitelist Domain
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Daftar sumber tepercaya yang boleh dikutip oleh asisten riset Atsar.
          Atur prioritas dan laju crawl per domain.
        </p>
      </header>

      <WhitelistTable />
    </div>
  )
}
