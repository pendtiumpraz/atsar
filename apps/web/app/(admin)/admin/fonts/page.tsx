// Admin → Font Management — `/fonts` (inside the (admin) route group).
//
// Server component. Renders the page chrome (title + "Add New Font" CTA)
// and a two-tab layout per docs/IDEAS.md §3b.4:
//
//   ┌─────────────────────────────────────────────────────────┐
//   │ FONT MANAGEMENT                       [+ Add New Font]  │
//   ├─────────────────────────────────────────────────────────┤
//   │ Tab: [ Active Slots ] [ All Fonts ]                     │
//   └─────────────────────────────────────────────────────────┘
//
// Auth + admin-role gating happens in `(admin)/layout.tsx`; we do not
// duplicate that check here. Data fetching is delegated to the client tabs
// so admins can toggle filters / activate fonts without re-rendering the
// whole page.

import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActiveSlotsPanel } from '@/components/admin/fonts/active-slots-panel'
import { AddFontDialog } from '@/components/admin/fonts/add-font-dialog'
import { FontsTable } from '@/components/admin/fonts/fonts-table'

type ValidTab = 'active' | 'all'
const VALID: readonly ValidTab[] = ['active', 'all'] as const

function pickTab(value: string | undefined): ValidTab {
  if (value && (VALID as readonly string[]).includes(value)) return value as ValidTab
  return 'active'
}

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

export default async function AdminFontsPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const initialTab = pickTab(sp.tab)

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))] sm:text-3xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Font Management
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Kelola tipografi global Atsar — atur font aktif per slot atau
            tambahkan font baru dari Google Fonts, CDN, atau upload.
          </p>
        </div>
        <AddFontDialog />
      </header>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid sm:grid-cols-2">
          <TabsTrigger value="active">Active Slots</TabsTrigger>
          <TabsTrigger value="all">All Fonts</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <ActiveSlotsPanel />
        </TabsContent>

        <TabsContent value="all" className="mt-4">
          <FontsTable />
        </TabsContent>
      </Tabs>
    </div>
  )
}
