// `<PermissionMatrix />` — role × permission Switch grid.
//
// Rows are permissions grouped by `permission.group` (a sticky group header
// breaks the table into visual sections — figures.*, trash.*, ai.*, …).
// Columns are roles. Each cell is a Switch wired to the (roleId, permissionId)
// edge. Local state is held as `Record<roleId, Set<permissionId>>`.
//
// Save model:
//   • One "Simpan Perubahan" button at the top right submits in parallel for
//     every dirty role — one `PUT /api/v1/admin/roles/:id/permissions` call
//     per role whose Set has diverged from the baseline.
//   • Optimistic UI: on submit we mark the matrix as `saving`, commit the
//     baseline on success, and rollback the failed roles on error.
//   • The header also shows a dirty indicator ("• X perubahan belum disimpan")
//     so the admin always knows there's pending work.
//
// Brand: Atsar. Indonesian copy.

'use client'

import { useMemo, useState } from 'react'
import { Save } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { adminApi } from '@/lib/api/endpoints'
import { ApiClientError } from '@/lib/api/client'
import { cn } from '@/lib/utils'

export interface RoleColumn {
  id: string
  slug: string
  nameId: string
  nameAr: string | null
  description: string | null
  isSystem: boolean
}

export interface PermissionRow {
  id: string
  slug: string
  group: string
  nameId: string
  description: string | null
}

export interface PermissionMatrixProps {
  roles: RoleColumn[]
  permissions: PermissionRow[]
  /** roleId → permissionIds currently granted. */
  initialMatrix: Record<string, string[]>
}

interface GroupedPermissions {
  group: string
  items: PermissionRow[]
}

function groupPermissions(rows: PermissionRow[]): GroupedPermissions[] {
  const buckets = new Map<string, PermissionRow[]>()
  for (const row of rows) {
    const list = buckets.get(row.group)
    if (list) list.push(row)
    else buckets.set(row.group, [row])
  }
  return Array.from(buckets.entries()).map(([group, items]) => ({ group, items }))
}

/** Compare two Sets for equality on string keys. */
function setEquals(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false
  for (const v of a) if (!b.has(v)) return false
  return true
}

function seedMatrix(
  roles: RoleColumn[],
  initial: Record<string, string[]>,
): Record<string, Set<string>> {
  const seed: Record<string, Set<string>> = {}
  for (const role of roles) {
    seed[role.id] = new Set(initial[role.id] ?? [])
  }
  return seed
}

export function PermissionMatrix({
  roles,
  permissions,
  initialMatrix,
}: PermissionMatrixProps) {
  const grouped = useMemo(() => groupPermissions(permissions), [permissions])

  // Live (editable) state and a snapshot baseline so we can compute diffs and
  // roll back on error.
  const [matrix, setMatrix] = useState<Record<string, Set<string>>>(() =>
    seedMatrix(roles, initialMatrix),
  )
  const [baseline, setBaseline] = useState<Record<string, Set<string>>>(() =>
    seedMatrix(roles, initialMatrix),
  )
  const [saving, setSaving] = useState(false)

  const dirtyRoleIds = useMemo(() => {
    const out: string[] = []
    for (const role of roles) {
      const a = matrix[role.id] ?? new Set<string>()
      const b = baseline[role.id] ?? new Set<string>()
      if (!setEquals(a, b)) out.push(role.id)
    }
    return out
  }, [roles, matrix, baseline])

  const isDirty = dirtyRoleIds.length > 0

  function toggle(roleId: string, permissionId: string, next: boolean) {
    setMatrix((prev) => {
      const current = prev[roleId] ?? new Set<string>()
      const updated = new Set(current)
      if (next) updated.add(permissionId)
      else updated.delete(permissionId)
      return { ...prev, [roleId]: updated }
    })
  }

  async function handleSave() {
    if (!isDirty || saving) return
    setSaving(true)

    // Optimistic baseline target — applied to roles whose PUT succeeds.
    const attempted = dirtyRoleIds.slice()
    const results = await Promise.allSettled(
      attempted.map((roleId) =>
        adminApi.roles.setPermissions(roleId, Array.from(matrix[roleId] ?? [])),
      ),
    )

    const succeeded: string[] = []
    const failed: { roleId: string; reason: unknown }[] = []
    results.forEach((res, idx) => {
      const roleId = attempted[idx]
      if (!roleId) return
      if (res.status === 'fulfilled') succeeded.push(roleId)
      else failed.push({ roleId, reason: res.reason })
    })

    if (succeeded.length > 0) {
      setBaseline((prev) => {
        const next = { ...prev }
        for (const id of succeeded) {
          next[id] = new Set(matrix[id] ?? [])
        }
        return next
      })
    }

    if (failed.length > 0) {
      // Roll the matrix state back for failed roles so the UI matches reality.
      setMatrix((prev) => {
        const next = { ...prev }
        for (const { roleId } of failed) {
          next[roleId] = new Set(baseline[roleId] ?? [])
        }
        return next
      })
      const firstErr = failed[0]?.reason
      const message =
        firstErr instanceof ApiClientError
          ? firstErr.message
          : 'Sebagian perubahan gagal disimpan'
      toast.error(
        failed.length === attempted.length
          ? message
          : `${succeeded.length} role tersimpan, ${failed.length} gagal: ${message}`,
      )
    } else {
      toast.success(
        succeeded.length === 1
          ? 'Perubahan izin tersimpan'
          : `Perubahan izin untuk ${succeeded.length} role tersimpan`,
      )
    }

    setSaving(false)
  }

  if (roles.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[rgb(var(--text-muted))]">
        Belum ada role.
      </p>
    )
  }

  if (permissions.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[rgb(var(--text-muted))]">
        Belum ada izin yang terdaftar.
      </p>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs text-[rgb(var(--text-muted))]">
          {isDirty ? (
            <span className="inline-flex items-center gap-1.5 text-[rgb(var(--accent))]">
              <span
                aria-hidden
                className="inline-block h-2 w-2 rounded-full bg-[rgb(var(--accent))]"
              />
              {dirtyRoleIds.length} role memiliki perubahan belum disimpan
            </span>
          ) : (
            <span>Tidak ada perubahan yang tertunda.</span>
          )}
        </div>
        <Button
          type="button"
          onClick={handleSave}
          disabled={!isDirty || saving}
          variant={isDirty ? 'primary' : 'outline'}
        >
          <Save className="h-4 w-4" />
          {saving ? 'Menyimpan…' : 'Simpan Perubahan'}
        </Button>
      </div>

      <div className="w-full overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b border-[rgb(var(--border))] text-left">
              <th className="sticky left-0 z-10 min-w-[14rem] bg-[rgb(var(--surface))] py-2 pr-4 font-medium text-[rgb(var(--text-muted))]">
                Izin
              </th>
              {roles.map((role) => {
                const dirty = dirtyRoleIds.includes(role.id)
                return (
                  <th
                    key={role.id}
                    scope="col"
                    className="px-3 py-2 text-center font-medium text-[rgb(var(--text))]"
                  >
                    <div className="flex flex-col items-center gap-0.5">
                      <span
                        className={cn(
                          'inline-flex items-center gap-1.5',
                          dirty && 'text-[rgb(var(--accent))]',
                        )}
                      >
                        {dirty && (
                          <span
                            aria-hidden
                            className="inline-block h-1.5 w-1.5 rounded-full bg-[rgb(var(--accent))]"
                          />
                        )}
                        {role.nameId}
                      </span>
                      <span className="text-xs font-normal text-[rgb(var(--text-muted))]">
                        {role.slug}
                      </span>
                    </div>
                  </th>
                )
              })}
            </tr>
          </thead>

          <tbody>
            {grouped.map((bucket) => (
              <GroupSection
                key={bucket.group}
                group={bucket.group}
                items={bucket.items}
                roles={roles}
                matrix={matrix}
                onToggle={toggle}
                disabled={saving}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

interface GroupSectionProps {
  group: string
  items: PermissionRow[]
  roles: RoleColumn[]
  matrix: Record<string, Set<string>>
  onToggle: (roleId: string, permissionId: string, next: boolean) => void
  disabled: boolean
}

function GroupSection({ group, items, roles, matrix, onToggle, disabled }: GroupSectionProps) {
  return (
    <>
      <tr className="bg-[rgb(var(--bg-elevated))]">
        <th
          scope="rowgroup"
          colSpan={roles.length + 1}
          className="sticky left-0 z-[5] py-1.5 pr-4 pl-1 text-left text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]"
        >
          {group}
        </th>
      </tr>
      {items.map((perm) => (
        <tr
          key={perm.id}
          className="border-b border-[rgb(var(--border))] last:border-b-0"
        >
          <th
            scope="row"
            className="sticky left-0 z-[5] bg-[rgb(var(--surface))] py-2 pr-4 pl-1 text-left font-normal"
          >
            <div className="flex flex-col">
              <span className="font-mono text-xs text-[rgb(var(--text))]">
                {perm.slug}
              </span>
              <span className="text-xs text-[rgb(var(--text-muted))]">
                {perm.nameId}
              </span>
            </div>
          </th>
          {roles.map((role) => {
            const checked = matrix[role.id]?.has(perm.id) ?? false
            return (
              <td key={role.id} className="px-3 py-2 text-center">
                <div className="flex justify-center">
                  <Switch
                    checked={checked}
                    onCheckedChange={(next) => onToggle(role.id, perm.id, next)}
                    aria-label={`${perm.slug} untuk ${role.nameId}`}
                    disabled={disabled}
                  />
                </div>
              </td>
            )
          })}
        </tr>
      ))}
    </>
  )
}
