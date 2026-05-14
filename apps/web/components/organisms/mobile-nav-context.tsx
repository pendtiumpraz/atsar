// Tiny client context that bridges the Navbar hamburger button to the
// Sidebar's mobile drawer. Previously the layout rendered <Navbar /> and
// <Sidebar /> as siblings without wiring `onOpenMobileMenu` ↔ `mobileOpen`,
// so the hamburger button's onClick was undefined and clicking it was a
// silent no-op. This context lets both components own the same state
// without forcing the layout to be a client component.

'use client'

import * as React from 'react'

interface MobileNavContextValue {
  open: boolean
  setOpen: (open: boolean) => void
  toggle: () => void
}

const MobileNavContext = React.createContext<MobileNavContextValue | null>(null)

export function MobileNavProvider({ children }: { children: React.ReactNode }) {
  const [open, setOpen] = React.useState(false)
  const toggle = React.useCallback(() => setOpen((v) => !v), [])
  const value = React.useMemo<MobileNavContextValue>(
    () => ({ open, setOpen, toggle }),
    [open, toggle],
  )
  return <MobileNavContext.Provider value={value}>{children}</MobileNavContext.Provider>
}

/**
 * Returns the current mobile-nav state. Safe to call outside a provider —
 * yields no-op setters so a stray usage doesn't crash. The hamburger in
 * Navbar and the drawer in SidebarClient both read this.
 */
export function useMobileNav(): MobileNavContextValue {
  const ctx = React.useContext(MobileNavContext)
  if (ctx) return ctx
  // Fallback: never-open state so the page still renders sanely if the
  // provider hasn't been mounted (e.g. on routes outside the app shell).
  return {
    open: false,
    setOpen: () => {},
    toggle: () => {},
  }
}
