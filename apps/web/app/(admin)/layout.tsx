// Admin area shell — auth + admin role required.
//
// Subscription is intentionally NOT enforced here: an admin needs to be
// able to manage the platform even if their personal billing has lapsed.
// (Compare with `(app)/layout.tsx` which gates on subscription.)
//
// Role check is performed with a small JOIN against `user_roles → roles`
// rather than the permissions table — admin is a role, not a permission.

import { and, eq, isNull } from 'drizzle-orm'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { MobileNavProvider } from '@/components/organisms/mobile-nav-context'
import { Navbar } from '@/components/organisms/navbar'
import { Sidebar } from '@/components/organisms/sidebar'
import { db } from '@athar/db'
import { roles, userRoles } from '@athar/db/schema'
import { auth } from '@/lib/server/auth'

async function userHasRole(userId: string, slug: string): Promise<boolean> {
  const rows = await db
    .select({ slug: roles.slug })
    .from(userRoles)
    .innerJoin(roles, and(eq(roles.id, userRoles.roleId), isNull(roles.deletedAt)))
    .where(and(eq(userRoles.userId, userId), eq(roles.slug, slug)))
    .limit(1)
  return rows.length > 0
}

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const userId = session?.user?.id

  if (!userId) {
    redirect('/login')
  }

  const isAdmin = await userHasRole(userId, 'admin')
  if (!isAdmin) {
    // Don't leak whether the resource exists — bounce to dashboard.
    redirect('/dashboard')
  }

  return (
    <MobileNavProvider>
      <div className="grid min-h-screen grid-cols-[auto_1fr] bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
        <Sidebar />
        <div className="flex min-w-0 flex-col">
          <Navbar />
          <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </MobileNavProvider>
  )
}
