// Tabbed shell for the `/admin/figures` index. Groups the four independent
// admin surfaces into a single horizontal navigation so the page doesn't
// scroll forever:
//
//   - Discover        — AI-guided list expansion (search for missing figures).
//   - Riwayat Riset   — single-figure AI ingest form + recent job history.
//   - Batch Tambah    — bulk paste-name flow.
//   - Daftar Tokoh    — main figures table (search, edit, soft-delete).
//
// Each tab content is mounted only when active (`forceMount` not set) so
// per-panel TanStack queries don't fire for tabs the admin isn't looking
// at. The Tambah-Tokoh dialog stays scoped to its tab.

'use client'

import * as React from 'react'

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { FigureBatchIngestPanel } from './figure-batch-ingest-panel'
import { FigureBulkList } from './figure-bulk-list'
import { FigureDiscoverPanel } from './figure-discover-panel'
import { FigureIngestPanel } from './figure-ingest-panel'

const STORAGE_KEY = 'admin-figures-active-tab'
type TabValue = 'discover' | 'history' | 'batch' | 'list'
const VALID_TABS: readonly TabValue[] = ['discover', 'history', 'batch', 'list']

function isTabValue(v: string | null): v is TabValue {
  return v !== null && (VALID_TABS as readonly string[]).includes(v)
}

export function FigureAdminTabs() {
  // Persist the last-active tab so admin doesn't lose context after a refresh.
  const [tab, setTab] = React.useState<TabValue>('list')
  React.useEffect(() => {
    if (typeof window === 'undefined') return
    const saved = window.localStorage.getItem(STORAGE_KEY)
    if (isTabValue(saved)) setTab(saved)
  }, [])

  const handleChange = (next: string) => {
    if (!isTabValue(next)) return
    setTab(next)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(STORAGE_KEY, next)
    }
  }

  return (
    <Tabs value={tab} onValueChange={handleChange} className="flex flex-col gap-6">
      <TabsList className="grid h-auto grid-cols-2 gap-1 sm:inline-flex sm:h-10 sm:w-fit">
        <TabsTrigger value="discover">Discover</TabsTrigger>
        <TabsTrigger value="history">Riwayat Riset</TabsTrigger>
        <TabsTrigger value="batch">Batch Tambah Tokoh</TabsTrigger>
        <TabsTrigger value="list">Daftar Tokoh</TabsTrigger>
      </TabsList>

      <TabsContent value="discover" className="m-0">
        <FigureDiscoverPanel />
      </TabsContent>
      <TabsContent value="history" className="m-0">
        <FigureIngestPanel />
      </TabsContent>
      <TabsContent value="batch" className="m-0">
        <FigureBatchIngestPanel />
      </TabsContent>
      <TabsContent value="list" className="m-0">
        <FigureBulkList />
      </TabsContent>
    </Tabs>
  )
}
