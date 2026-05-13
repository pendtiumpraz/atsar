// `<RoleList />` — table of roles with create + delete actions.
//
// Source of truth is local state seeded from the server-rendered initial list.
// After every mutation (create, delete) we either patch state in place or
// trigger a `router.refresh()` so the server component re-runs and the matrix
// in the sibling tab stays in sync with new role columns.
//
// Edit is intentionally minimal for now — name/description updates land in a
// follow-up. Delete uses SweetAlert's `deleteConfirm` for the soft-delete
// flow; system roles (`isSystem === true`) cannot be deleted and the action
// is disabled with a tooltip-style hint.
//
// Brand: Atsar. Indonesian copy.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Loader2, Lock, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { adminApi } from '@/lib/api/endpoints'
import { ApiClientError } from '@/lib/api/client'
import { deleteConfirm } from '@/lib/swal'

import { CreateRoleDialog, type CreatedRole } from './create-role-dialog'

export interface RoleListRow {
  id: string
  slug: string
  nameId: string
  nameAr: string | null
  description: string | null
  isSystem: boolean
}

export interface RoleListProps {
  initialRoles: RoleListRow[]
}

export function RoleList({ initialRoles }: RoleListProps) {
  const router = useRouter()
  const [rows, setRows] = useState<RoleListRow[]>(initialRoles)
  const [deletingId, setDeletingId] = useState<string | null>(null)

  function handleCreated(role: CreatedRole) {
    setRows((prev) => [
      ...prev,
      {
        id: role.id,
        slug: role.slug,
        nameId: role.nameId,
        nameAr: role.nameAr,
        description: role.description,
        isSystem: role.isSystem,
      },
    ])
    // Re-render the server component so the sibling Matrix tab picks up the
    // new role column on its next mount.
    router.refresh()
  }

  async function handleDelete(role: RoleListRow) {
    if (role.isSystem) {
      toast.error('Role sistem tidak dapat dihapus')
      return
    }

    const confirmed = await deleteConfirm(`role "${role.nameId}"`)
    if (!confirmed) return

    setDeletingId(role.id)
    // Optimistic removal — restore the row on error.
    const snapshot = rows
    setRows((prev) => prev.filter((r) => r.id !== role.id))
    try {
      await adminApi.roles.remove(role.id)
      toast.success(`Role "${role.nameId}" dipindahkan ke Sampah`)
      router.refresh()
    } catch (err) {
      setRows(snapshot)
      const message =
        err instanceof ApiClientError ? err.message : 'Gagal menghapus role'
      toast.error(message)
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs text-[rgb(var(--text-muted))]">
          Total {rows.length} role.
        </p>
        <CreateRoleDialog onCreated={handleCreated} />
      </div>

      {rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-[rgb(var(--text-muted))]">
          Belum ada role.
        </p>
      ) : (
        <div className="w-full overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="border-b border-[rgb(var(--border))] text-left">
                <th className="py-2 pr-4 font-medium text-[rgb(var(--text-muted))]">
                  Nama
                </th>
                <th className="py-2 pr-4 font-medium text-[rgb(var(--text-muted))]">
                  Slug
                </th>
                <th className="py-2 pr-4 font-medium text-[rgb(var(--text-muted))]">
                  Deskripsi
                </th>
                <th className="py-2 pr-4 font-medium text-[rgb(var(--text-muted))]">
                  Jenis
                </th>
                <th className="py-2 pr-2 text-right font-medium text-[rgb(var(--text-muted))]">
                  Aksi
                </th>
              </tr>
            </thead>
            <tbody>
              {rows.map((role) => {
                const deleting = deletingId === role.id
                return (
                  <tr
                    key={role.id}
                    className="border-b border-[rgb(var(--border))] last:border-b-0"
                  >
                    <td className="py-2 pr-4 align-top">
                      <div className="flex flex-col">
                        <span className="font-medium text-[rgb(var(--text))]">
                          {role.nameId}
                        </span>
                        {role.nameAr && (
                          <span
                            dir="rtl"
                            className="text-xs text-[rgb(var(--text-muted))]"
                            style={{ fontFamily: 'var(--font-body-arab)' }}
                          >
                            {role.nameAr}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-2 pr-4 align-top">
                      <code className="rounded bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 font-mono text-xs text-[rgb(var(--text-muted))]">
                        {role.slug}
                      </code>
                    </td>
                    <td className="py-2 pr-4 align-top text-[rgb(var(--text-muted))]">
                      {role.description ?? <span className="opacity-50">—</span>}
                    </td>
                    <td className="py-2 pr-4 align-top">
                      {role.isSystem ? (
                        <Badge variant="secondary" className="gap-1">
                          <Lock className="h-3 w-3" />
                          Sistem
                        </Badge>
                      ) : (
                        <Badge variant="outline">Custom</Badge>
                      )}
                    </td>
                    <td className="py-2 pr-2 text-right align-top">
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(role)}
                        disabled={role.isSystem || deleting}
                        aria-label={`Hapus role ${role.nameId}`}
                        className="text-[rgb(var(--danger))] hover:text-[rgb(var(--danger))] disabled:text-[rgb(var(--text-muted))]"
                      >
                        {deleting ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        <span className="sr-only sm:not-sr-only sm:ml-1">Hapus</span>
                      </Button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
