// `<EditRolesDialog />` — checkbox list of all roles, save → PUT roles array.
//
// The dialog fetches the full role catalog on first open (TanStack Query, so
// repeat opens are instant from cache).  `currentRoleIds` is the source of
// truth on mount; we mirror it into local state so toggling checkboxes feels
// instant. Save → `adminApi.users.setRoles(id, roleIds)`.

'use client'

import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Label } from '@/components/ui/label'
import { adminApi } from '@/lib/api/endpoints'
import { ApiClientError } from '@/lib/api/client'

interface RoleRow {
  id: string
  slug: string
  nameId: string
  nameAr?: string | null
  description?: string | null
}

export interface EditRolesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  userId: string
  userEmail: string
  currentRoleIds: string[]
  onSaved?: () => void
}

export function EditRolesDialog({
  open,
  onOpenChange,
  userId,
  userEmail,
  currentRoleIds,
  onSaved,
}: EditRolesDialogProps) {
  const [selected, setSelected] = useState<Set<string>>(new Set(currentRoleIds))
  const [saving, setSaving] = useState(false)

  // Reset selection whenever the dialog re-opens for a (potentially) different
  // user. Without this we'd keep the previous user's selection on second open.
  useEffect(() => {
    if (open) setSelected(new Set(currentRoleIds))
  }, [open, currentRoleIds])

  const rolesQuery = useQuery({
    queryKey: ['admin', 'roles'],
    queryFn: () => adminApi.roles.list() as Promise<RoleRow[]>,
    enabled: open,
    staleTime: 60_000,
  })

  function toggle(roleId: string) {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(roleId)) next.delete(roleId)
      else next.add(roleId)
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    try {
      await adminApi.users.setRoles(userId, Array.from(selected))
      toast.success('Role tersimpan')
      onSaved?.()
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal menyimpan role'
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const roles = rolesQuery.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit Role</DialogTitle>
          <DialogDescription>
            Atur role untuk <span className="font-medium">{userEmail}</span>.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[50vh] space-y-2 overflow-y-auto py-2">
          {rolesQuery.isLoading ? (
            <div className="flex items-center justify-center py-6 text-sm text-[rgb(var(--text-muted))]">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Memuat role…
            </div>
          ) : rolesQuery.isError ? (
            <p className="text-sm" style={{ color: 'rgb(var(--danger))' }}>
              Gagal memuat daftar role.
            </p>
          ) : roles.length === 0 ? (
            <p className="text-sm text-[rgb(var(--text-muted))]">Belum ada role.</p>
          ) : (
            roles.map((role) => {
              const checked = selected.has(role.id)
              const id = `role-${role.id}`
              return (
                <label
                  key={role.id}
                  htmlFor={id}
                  className="flex cursor-pointer items-start gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 hover:bg-[rgb(var(--bg-elevated))]"
                >
                  <Checkbox
                    id={id}
                    checked={checked}
                    onCheckedChange={() => toggle(role.id)}
                  />
                  <div className="flex-1">
                    <Label htmlFor={id} className="cursor-pointer font-medium">
                      {role.nameId}{' '}
                      <span className="text-xs text-[rgb(var(--text-muted))]">
                        ({role.slug})
                      </span>
                    </Label>
                    {role.description && (
                      <p className="mt-0.5 text-xs text-[rgb(var(--text-muted))]">
                        {role.description}
                      </p>
                    )}
                  </div>
                </label>
              )
            })
          )}
        </div>

        <DialogFooter>
          <Button
            type="button"
            variant="ghost"
            onClick={() => onOpenChange(false)}
            disabled={saving}
          >
            Batal
          </Button>
          <Button type="button" onClick={handleSave} disabled={saving || rolesQuery.isLoading}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />}
            Simpan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
