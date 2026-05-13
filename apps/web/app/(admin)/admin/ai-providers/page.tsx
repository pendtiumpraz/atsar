// Atsar — Admin · AI Providers & Models (`/admin/ai-providers`).
//
// Layout (see docs/WIREFRAMES.md §21):
//   Header: judul + tombol "Tambah Provider".
//   3 tabs (default = "Provider Aktif"):
//     1. Provider Aktif    — daftar provider yang sedang aktif.
//     2. Semua Model       — semua model (20 seeded May 2026) per provider.
//     3. Role Assignment   — pemetaan role → model aktif (5 baris).
//
// This page is a Server Component (no `'use client'`). Auth + admin role
// gating is handled by the parent admin layout. The interactive bits live
// in client components under `components/admin/ai/*`.

import { AddProviderDialog } from '@/components/admin/ai/add-provider-dialog'
import { ModelsList } from '@/components/admin/ai/models-list'
import { ProviderList } from '@/components/admin/ai/provider-list'
import { RoleAssignments } from '@/components/admin/ai/role-assignments'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

export const metadata = {
  title: 'AI Providers · Atsar',
  description:
    'Kelola AI providers, models, dan role assignment untuk Atsar.',
}

export default function AIProvidersPage() {
  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">AI Providers</h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Kelola provider, model, dan role assignment untuk seluruh fitur AI Atsar.
          </p>
        </div>
        <AddProviderDialog />
      </header>

      <Tabs defaultValue="active" className="w-full">
        <TabsList>
          <TabsTrigger value="active">Provider Aktif</TabsTrigger>
          <TabsTrigger value="models">Semua Model</TabsTrigger>
          <TabsTrigger value="roles">Role Assignment</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="space-y-3">
          <ProviderList activeOnly={false} />
        </TabsContent>

        <TabsContent value="models">
          <ModelsList />
        </TabsContent>

        <TabsContent value="roles">
          <RoleAssignments />
        </TabsContent>
      </Tabs>
    </div>
  )
}
