// Subscriber area shell — gated by auth + active subscription.
//
// Flow:
//   1. Resolve session from request headers via better-auth.
//   2. Redirect to `/login?next=...` if no session.
//   3. Look up the user's active subscription (trial/active + non-expired).
//      Redirect to `/subscription-expired` if none.
//   4. Render sidebar/navbar shell. F5 owns those organisms.
//
// Server component — no `'use client'`. `cookies()`/`headers()` from
// `next/headers` are read implicitly by better-auth when we pass the
// request's header bag.

import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import type { ReactNode } from 'react'

import { Navbar } from '@/components/organisms/navbar'
import { Sidebar } from '@/components/organisms/sidebar'
import { auth, getActiveSubscription } from '@/lib/server/auth'
import { getUserRoleSlugs } from '@/lib/server/rbac/permissions'

// Staff roles bypass the subscription gate — admins manage the platform
// and reviewers (ustadz) approve content; neither needs a paid plan.
const STAFF_ROLES = new Set(['admin', 'reviewer'])

export default async function AppLayout({ children }: { children: ReactNode }) {
  // 1. Auth gate — `headers()` returns a Promise in Next 15.
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const userId = session?.user?.id

  if (!userId) {
    redirect('/login')
  }

  // 2. Subscription gate — staff roles bypass; everyone else needs a
  // non-expired plan to enter the app shell.
  const roles = await getUserRoleSlugs(userId)
  const isStaff = [...roles].some((slug) => STAFF_ROLES.has(slug))
  if (!isStaff) {
    const active = await getActiveSubscription(userId)
    if (!active) {
      redirect('/subscription-expired')
    }
  }

  // 3. Render shell. Sidebar collapses on narrow viewports — F5 handles that.
  return (
    <div className="grid min-h-screen grid-cols-[auto_1fr] bg-[rgb(var(--bg))] text-[rgb(var(--text))]">
      <Sidebar />
      <div className="flex min-w-0 flex-col">
        <Navbar />
        <main className="flex-1 overflow-auto p-4 sm:p-6">{children}</main>
      </div>
    </div>
  )
}
