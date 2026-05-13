// Admin — Menu Management (`/admin/menus`).
//
// Server component. Two tabs:
//   1. "Tree"          → read-only view of the active `menu_items` hierarchy.
//   2. "Akses Matriks" → role × menu_item Switch grid, one save button per role.
//
// The admin route group's layout (`apps/web/app/(admin)/layout.tsx`) already
// gates on session + the `admin` role, so we don't re-check here. Data is
// loaded directly through services since the page lives inside the same
// Next.js app — no need to hit the public HTTP endpoints just to render.
//
// Brand: Atsar. UI copy is Indonesian per project convention.

import * as menuService from '@/lib/server/services/menu.service'
import * as roleService from '@/lib/server/services/role.service'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui'

import { MenuTree } from '@/components/admin/menus/menu-tree'
import { MenuAccessMatrix } from '@/components/admin/menus/menu-access-matrix'

export const dynamic = 'force-dynamic'

export default async function AdminMenusPage() {
  // Fetch tree + roles in parallel; access matrix is fetched per-role afterwards
  // (one round-trip each, but the list is short — admin/reviewer/subscriber).
  const [tree, roles] = await Promise.all([
    menuService.listTree(),
    roleService.list(),
  ])

  // Map of roleId → Set<menuItemId> (serialised to array for client transport).
  const accessEntries = await Promise.all(
    roles.map(async (r) => {
      const set = await menuService.getRoleAccess(r.id)
      return [r.id, Array.from(set)] as const
    }),
  )
  const accessByRole: Record<string, string[]> = Object.fromEntries(accessEntries)

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight text-[rgb(var(--text))]">
          Manajemen Menu
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Kelola hierarki menu Atsar dan akses per-role.
        </p>
      </header>

      <Tabs defaultValue="tree" className="w-full">
        <TabsList>
          <TabsTrigger value="tree">Tree</TabsTrigger>
          <TabsTrigger value="access">Akses Matriks</TabsTrigger>
        </TabsList>

        <TabsContent value="tree">
          <Card>
            <CardHeader>
              <CardTitle>Hierarki Menu</CardTitle>
              <CardDescription>
                Tampilan baca saja. Drag-to-reorder akan tersedia di fase berikutnya.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MenuTree nodes={tree} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="access">
          <Card>
            <CardHeader>
              <CardTitle>Akses Menu per Role</CardTitle>
              <CardDescription>
                Toggle visibilitas menu untuk tiap role, lalu simpan per role.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <MenuAccessMatrix
                tree={tree}
                roles={roles.map((r) => ({
                  id: r.id,
                  slug: r.slug,
                  nameId: r.nameId,
                }))}
                initialAccess={accessByRole}
              />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
