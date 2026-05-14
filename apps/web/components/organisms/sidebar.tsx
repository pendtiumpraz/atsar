// Sidebar — server wrapper.
//
// Resolves the user's menu items on the server before the first paint and
// hands them to the client renderer (`SidebarClient`). This eliminates the
// previous flicker where the client mounted with a hardcoded subscriber-only
// fallback menu, fetched `/api/v1/me/menu`, and swapped to admin items on
// every navigation.
//
// If the session can't be resolved we just render an empty sidebar — the
// outer layout's auth gate has already redirected unauthenticated users.

import { headers } from 'next/headers'

import { auth } from '@/lib/server/auth'
import { resolveMenuForUser, type ResolvedMenuItem } from '@/lib/server/menu/resolve'
import {
  SidebarClient,
  type MenuItem,
  type SidebarClientProps,
} from './sidebar-client'

export type { MenuItem } from './sidebar-client'

function toMenuItem(row: ResolvedMenuItem): MenuItem {
  return {
    slug: row.slug,
    label: row.labelId,
    ...(row.labelAr ? { labelAr: row.labelAr } : {}),
    icon: row.icon ?? 'Circle',
    path: row.path ?? '',
  }
}

export type SidebarProps = Pick<SidebarClientProps, 'mobileOpen' | 'onMobileOpenChange'>

export async function Sidebar(props: SidebarProps = {}) {
  const reqHeaders = await headers()
  const session = await auth.api.getSession({ headers: reqHeaders })
  const userId = session?.user?.id

  const rows = userId ? await resolveMenuForUser(userId) : []
  const items = rows.map(toMenuItem)

  return <SidebarClient items={items} {...props} />
}

export default Sidebar
