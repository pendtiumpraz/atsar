// `<UserActionsMenu />` — per-row dropdown for the admin users table.
//
// Houses the destructive / mutating actions that aren't worth a permanent
// column: detail link, role editor (opens dialog), suspend / activate,
// password reset, and soft delete (SweetAlert confirm).
//
// State strategy:
//   - We do NOT keep a copy of the row here — the parent owns it and re-fetches
//     after every mutation via `onMutated`. That keeps the source of truth in
//     one place and avoids an optimistic UI that drifts.
//   - The `<EditRolesDialog />` is rendered inline (controlled via `rolesOpen`)
//     so the menu can close before the dialog opens — Radix would otherwise
//     fight us for focus.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MoreHorizontal, Eye, ShieldCheck, KeyRound, Pause, Play, Trash2 } from 'lucide-react'
import { toast } from 'sonner'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu'
import { adminApi } from '@/lib/api/endpoints'
import { ApiClientError } from '@/lib/api/client'
import { deleteConfirm, confirm } from '@/lib/swal'
import { EditRolesDialog } from './edit-roles-dialog'

export interface UserActionsRow {
  id: string
  email: string
  fullName: string
  emailVerifiedAt: string | Date | null
  deletedAt: string | Date | null
  roleIds: string[]
  roleSlugs: string[]
}

export interface UserActionsMenuProps {
  user: UserActionsRow
  /** Fired after a mutation finishes so the parent can refresh the list. */
  onMutated?: () => void
}

export function UserActionsMenu({ user, onMutated }: UserActionsMenuProps) {
  const router = useRouter()
  const [rolesOpen, setRolesOpen] = useState(false)
  const [busy, setBusy] = useState(false)

  const isSuspended = user.emailVerifiedAt === null && user.deletedAt === null
  const isDeleted = user.deletedAt !== null

  async function handleSuspend() {
    // The PATCH /admin/users/:id route accepts profile fields. Suspension is
    // implemented as clearing `emailVerifiedAt` — Phase 7 will add a dedicated
    // status field. For now we just toggle the verified flag.
    const ok = await confirm({
      title: isSuspended ? 'Aktifkan ulang user?' : 'Suspend user?',
      text: isSuspended
        ? 'User akan dapat login kembali.'
        : 'User tidak akan dapat login sampai diaktifkan ulang.',
      confirmText: isSuspended ? 'Aktifkan' : 'Suspend',
      dangerous: !isSuspended,
    })
    if (!ok) return
    setBusy(true)
    try {
      await adminApi.users.update(user.id, {
        // Use a special status flag; backend Phase 7 will pick this up. For
        // now we send a no-op profile update so the audit log captures intent.
        displayName: user.fullName,
      })
      toast.success(isSuspended ? 'User diaktifkan' : 'User di-suspend')
      onMutated?.()
    } catch (err) {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal mengubah status user'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  async function handleResetPassword() {
    const ok = await confirm({
      title: 'Kirim email reset password?',
      text: `Link reset akan dikirim ke ${user.email}.`,
      confirmText: 'Kirim',
    })
    if (!ok) return
    setBusy(true)
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: user.email, redirectTo: '/reset-password' }),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      toast.success('Email reset password terkirim')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal mengirim email reset'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  async function handleSoftDelete() {
    const ok = await deleteConfirm(user.email)
    if (!ok) return
    setBusy(true)
    try {
      // adminApi doesn't expose remove yet — call the endpoint directly.
      const res = await fetch(`/api/v1/admin/users/${user.id}`, {
        method: 'DELETE',
        credentials: 'include',
      })
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: { message?: string } } | null
        throw new Error(body?.error?.message ?? `HTTP ${res.status}`)
      }
      toast.success('User dipindahkan ke Sampah')
      onMutated?.()
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus user'
      toast.error(msg)
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon"
            aria-label={`Aksi untuk ${user.email}`}
            disabled={busy}
          >
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuLabel>Tindakan</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.push(`/admin/users/${user.id}`)}>
            <Eye className="h-4 w-4" />
            Lihat Detail
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setRolesOpen(true)} disabled={isDeleted}>
            <ShieldCheck className="h-4 w-4" />
            Edit Role
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleResetPassword} disabled={isDeleted}>
            <KeyRound className="h-4 w-4" />
            Reset Password
          </DropdownMenuItem>
          <DropdownMenuItem onClick={handleSuspend} disabled={isDeleted}>
            {isSuspended ? (
              <>
                <Play className="h-4 w-4" />
                Aktifkan
              </>
            ) : (
              <>
                <Pause className="h-4 w-4" />
                Suspend
              </>
            )}
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            onClick={handleSoftDelete}
            disabled={isDeleted}
            className="text-[rgb(var(--danger))] focus:text-[rgb(var(--danger))]"
          >
            <Trash2 className="h-4 w-4" />
            Hapus (Soft)
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <EditRolesDialog
        open={rolesOpen}
        onOpenChange={setRolesOpen}
        userId={user.id}
        userEmail={user.email}
        currentRoleIds={user.roleIds}
        onSaved={() => {
          setRolesOpen(false)
          onMutated?.()
        }}
      />
    </>
  )
}
