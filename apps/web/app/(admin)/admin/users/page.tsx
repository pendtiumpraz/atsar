// `/admin/users` — admin user management list (WIREFRAMES §19).
//
// Server component. The `(admin)` layout already enforces admin role + session,
// so this page just renders the chrome and hands off to the client components.
//
// Next.js permits rendering client components (`<InviteUserDialog />`,
// `<UserTable />`) inside a server component, so we don't need a client
// wrapper. Cross-component cache sync is handled inside the dialog itself
// via `queryClient.invalidateQueries(['admin', 'users'])`.

import type { Metadata } from 'next'

import { InviteUserDialog } from '@/components/admin/users/invite-user-dialog'
import { UserTable } from '@/components/admin/users/user-table'

export const metadata: Metadata = {
  title: 'Users · Admin · Atsar',
  description: 'Kelola user, role, dan akses platform Atsar.',
}

export const dynamic = 'force-dynamic'

export default function AdminUsersPage() {
  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1
            className="text-2xl font-semibold text-[rgb(var(--text))]"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Users
          </h1>
          <p className="text-sm text-[rgb(var(--text-muted))]">
            Kelola user, role, dan akses ke platform Atsar.
          </p>
        </div>
        <InviteUserDialog />
      </header>

      <UserTable />
    </div>
  )
}
