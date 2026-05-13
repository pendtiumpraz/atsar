// Admin — Menu Access Matrix (role × menu_item).
//
// Mirrors the A3 permission-matrix UX: rows are menu items (flattened from
// the tree, indented by depth so hierarchy is still readable), columns are
// roles, and each cell is a Switch wired to `can_view`. Saves are scoped to
// a single role — one button per column posts to
// `PUT /api/v1/admin/menus/access` with `{ roleId, menuIds }`.
//
// Local state is held as `Record<roleId, Set<menuItemId>>`. We track a
// per-role `dirty` flag so the save button only lights up when there are
// pending changes for that column. Optimistic UI is intentionally kept
// simple: we show a "menyimpan…" toast, then success or rollback on error.

'use client'

import { useMemo, useState } from 'react'
import { toast } from 'sonner'

import { Button, Switch } from '@/components/ui'
import { api, ApiClientError } from '@/lib/api/client'
import type { MenuTreeNode } from '@/lib/server/services/menu.service'
import { cn } from '@/lib/utils'

/** Shape of a role row as passed in from the server page. */
export interface RoleColumn {
  id: string
  slug: string
  nameId: string
}

/** Flat representation of a menu item with its visual depth in the tree. */
interface FlatMenu {
  id: string
  labelId: string
  path: string | null
  depth: number
}

interface MenuAccessMatrixProps {
  tree: MenuTreeNode[]
  roles: RoleColumn[]
  /** roleId → list of menu_item ids that currently have can_view=true. */
  initialAccess: Record<string, string[]>
}

/**
 * Walk the tree depth-first to produce a flat list. Children inherit
 * `parent.depth + 1`. Done once (memoised) since the tree is static for
 * the lifetime of this component.
 */
function flattenTree(nodes: MenuTreeNode[], depth = 0, out: FlatMenu[] = []): FlatMenu[] {
  for (const node of nodes) {
    out.push({
      id: node.id,
      labelId: node.labelId,
      path: node.path,
      depth,
    })
    if (node.children.length > 0) {
      flattenTree(node.children, depth + 1, out)
    }
  }
  return out
}

export function MenuAccessMatrix({ tree, roles, initialAccess }: MenuAccessMatrixProps) {
  const flat = useMemo(() => flattenTree(tree), [tree])

  // roleId → Set<menuItemId>. Sets give us O(1) toggle + cheap membership
  // checks while painting each Switch.
  const [access, setAccess] = useState<Record<string, Set<string>>>(() => {
    const seed: Record<string, Set<string>> = {}
    for (const role of roles) {
      seed[role.id] = new Set(initialAccess[role.id] ?? [])
    }
    return seed
  })

  // Snapshot of the initial state per role — used to compute "dirty".
  const [baseline, setBaseline] = useState<Record<string, Set<string>>>(() => {
    const seed: Record<string, Set<string>> = {}
    for (const role of roles) {
      seed[role.id] = new Set(initialAccess[role.id] ?? [])
    }
    return seed
  })

  const [savingRoleId, setSavingRoleId] = useState<string | null>(null)

  function toggle(roleId: string, menuId: string, next: boolean) {
    setAccess((prev) => {
      const current = prev[roleId] ?? new Set<string>()
      const updated = new Set(current)
      if (next) updated.add(menuId)
      else updated.delete(menuId)
      return { ...prev, [roleId]: updated }
    })
  }

  function isDirty(roleId: string): boolean {
    const a = access[roleId]
    const b = baseline[roleId]
    if (!a || !b) return false
    if (a.size !== b.size) return true
    for (const id of a) {
      if (!b.has(id)) return true
    }
    return false
  }

  async function save(roleId: string) {
    const menuIds = Array.from(access[roleId] ?? [])
    setSavingRoleId(roleId)
    try {
      await api.put('/api/v1/admin/menus/access', { roleId, menuIds })
      // Commit baseline so the row becomes "clean" again.
      setBaseline((prev) => ({ ...prev, [roleId]: new Set(menuIds) }))
      toast.success('Akses menu tersimpan')
    } catch (err) {
      const message =
        err instanceof ApiClientError
          ? err.message
          : 'Gagal menyimpan akses menu'
      toast.error(message)
    } finally {
      setSavingRoleId(null)
    }
  }

  if (flat.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[rgb(var(--text-muted))]">
        Belum ada menu untuk dikelola.
      </p>
    )
  }

  if (roles.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-[rgb(var(--text-muted))]">
        Belum ada role.
      </p>
    )
  }

  return (
    <div className="w-full overflow-x-auto">
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="border-b border-[rgb(var(--border))] text-left">
            <th className="sticky left-0 z-10 bg-[rgb(var(--surface))] py-2 pr-4 font-medium text-[rgb(var(--text-muted))]">
              Menu
            </th>
            {roles.map((role) => (
              <th
                key={role.id}
                scope="col"
                className="px-3 py-2 text-center font-medium text-[rgb(var(--text))]"
              >
                <div className="flex flex-col items-center gap-0.5">
                  <span>{role.nameId}</span>
                  <span className="text-xs font-normal text-[rgb(var(--text-muted))]">
                    {role.slug}
                  </span>
                </div>
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {flat.map((menu) => (
            <tr
              key={menu.id}
              className="border-b border-[rgb(var(--border))] last:border-b-0"
            >
              <th
                scope="row"
                className="sticky left-0 z-10 bg-[rgb(var(--surface))] py-2 pr-4 text-left font-normal"
                // Visual indent reflecting tree depth.
                style={{ paddingLeft: `${menu.depth * 1.25}rem` }}
              >
                <div className="flex flex-col">
                  <span
                    className={cn(
                      'text-[rgb(var(--text))]',
                      menu.depth === 0 && 'font-medium',
                    )}
                  >
                    {menu.labelId}
                  </span>
                  {menu.path && (
                    <span className="font-mono text-xs text-[rgb(var(--text-muted))]">
                      {menu.path}
                    </span>
                  )}
                </div>
              </th>
              {roles.map((role) => {
                const checked = access[role.id]?.has(menu.id) ?? false
                return (
                  <td key={role.id} className="px-3 py-2 text-center">
                    <div className="flex justify-center">
                      <Switch
                        checked={checked}
                        onCheckedChange={(next) => toggle(role.id, menu.id, next)}
                        aria-label={`${menu.labelId} untuk ${role.nameId}`}
                        disabled={savingRoleId === role.id}
                      />
                    </div>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>

        <tfoot>
          <tr>
            <td className="sticky left-0 z-10 bg-[rgb(var(--surface))] pt-3 text-right text-xs text-[rgb(var(--text-muted))]">
              Simpan per role →
            </td>
            {roles.map((role) => {
              const dirty = isDirty(role.id)
              const saving = savingRoleId === role.id
              return (
                <td key={role.id} className="px-3 pt-3 text-center">
                  <Button
                    type="button"
                    size="sm"
                    variant={dirty ? 'primary' : 'outline'}
                    onClick={() => save(role.id)}
                    disabled={!dirty || saving}
                    className="w-full"
                  >
                    {saving ? 'Menyimpan…' : 'Simpan'}
                  </Button>
                </td>
              )
            })}
          </tr>
        </tfoot>
      </table>
    </div>
  )
}
