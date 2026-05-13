// Admin — Role Management & Permission Matrix (`/admin/roles`).
//
// Server component. Two tabs:
//   1. "Matrix Izin"  → role × permission Switch grid (default).
//   2. "Kelola Role"  → list of roles + create dialog + edit / delete actions.
//
// The admin route group's layout (`apps/web/app/(admin)/layout.tsx`) already
// gates on session + the `admin` role, so we don't re-check here. Data is
// loaded directly through services / the DB since this page lives inside the
// same Next.js app — no need to hit the public HTTP endpoints just to render
// the initial UI. Mutations on the client side go through the typed
// `adminApi` helpers (which call `PUT /api/v1/admin/roles/:id/permissions`).
//
// Brand: Atsar. UI copy is Indonesian per project convention. See
// docs/WIREFRAMES.md §20.

import { and, asc, eq, inArray, isNull } from 'drizzle-orm'

import { db } from '@athar/db'
import { permissions, rolePermissions, roles as rolesTable } from '@athar/db/schema'

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
import * as roleService from '@/lib/server/services/role.service'

import { PermissionMatrix } from '@/components/admin/roles/permission-matrix'
import { RoleList } from '@/components/admin/roles/role-list'

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: Promise<{ tab?: string }>
}

type ValidTab = 'matrix' | 'roles'
const VALID_TABS: readonly ValidTab[] = ['matrix', 'roles'] as const

function pickTab(value: string | undefined): ValidTab {
  if (value && (VALID_TABS as readonly string[]).includes(value)) {
    return value as ValidTab
  }
  return 'matrix'
}

export default async function AdminRolesPage({ searchParams }: PageProps) {
  const sp = await searchParams
  const initialTab = pickTab(sp.tab)

  // Roles + permissions are tiny tables; the matrix runs an extra batch query
  // to load every (role, permission) edge in one round-trip.
  const [roleRows, permissionRows] = await Promise.all([
    roleService.list(),
    db
      .select()
      .from(permissions)
      .where(isNull(permissions.deletedAt))
      .orderBy(asc(permissions.group), asc(permissions.slug)),
  ])

  const roleIds = roleRows.map((r) => r.id)
  const edges: Array<{ roleId: string; permissionId: string }> =
    roleIds.length === 0
      ? []
      : await db
          .select({
            roleId: rolePermissions.roleId,
            permissionId: rolePermissions.permissionId,
          })
          .from(rolePermissions)
          .innerJoin(
            rolesTable,
            and(eq(rolesTable.id, rolePermissions.roleId), isNull(rolesTable.deletedAt)),
          )
          .where(inArray(rolePermissions.roleId, roleIds))

  // roleId → string[] of permissionIds currently granted.
  const matrixByRole: Record<string, string[]> = {}
  for (const id of roleIds) matrixByRole[id] = []
  for (const edge of edges) {
    const bucket = matrixByRole[edge.roleId]
    if (bucket) bucket.push(edge.permissionId)
  }

  const rolesForClient = roleRows.map((r) => ({
    id: r.id,
    slug: r.slug,
    nameId: r.nameId,
    nameAr: r.nameAr,
    description: r.description,
    isSystem: r.isSystem,
  }))

  const permissionsForClient = permissionRows.map((p) => ({
    id: p.id,
    slug: p.slug,
    group: p.group,
    nameId: p.nameId,
    description: p.description,
  }))

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <header className="space-y-1">
        <h1
          className="text-2xl font-semibold tracking-tight text-[rgb(var(--text))] sm:text-3xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Roles & Permissions
        </h1>
        <p className="text-sm text-[rgb(var(--text-muted))]">
          Kelola role Atsar dan atur akses tiap role melalui matriks izin.
        </p>
      </header>

      <Tabs defaultValue={initialTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2 sm:w-auto sm:inline-grid">
          <TabsTrigger value="matrix">Matrix Izin</TabsTrigger>
          <TabsTrigger value="roles">Kelola Role</TabsTrigger>
        </TabsList>

        <TabsContent value="matrix">
          <Card>
            <CardHeader>
              <CardTitle>Matriks Izin</CardTitle>
              <CardDescription>
                Aktifkan atau matikan izin per role. Perubahan disimpan per role
                ke endpoint <code>PUT /api/v1/admin/roles/:id/permissions</code>.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <PermissionMatrix
                roles={rolesForClient}
                permissions={permissionsForClient}
                initialMatrix={matrixByRole}
              />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="roles">
          <Card>
            <CardHeader>
              <CardTitle>Daftar Role</CardTitle>
              <CardDescription>
                Role sistem (admin, reviewer, subscriber) tidak dapat dihapus.
                Buat role custom untuk menyesuaikan akses dengan kebutuhan tim.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <RoleList initialRoles={rolesForClient} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
