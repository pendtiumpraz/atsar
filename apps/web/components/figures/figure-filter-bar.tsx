// Filter bar for the figures list (WIREFRAMES §6).
//
// Owns three controls:
//   - Search box        (q)         — debounced 300ms before pushing to URL.
//   - Category dropdown (category)  — slug values per the seed data.
//   - Gender dropdown   (gender)    — male | female.
//
// Filters are stored in the URL (`router.replace`) so they survive list↔detail
// navigation and direct linking.  We use `replace` (not `push`) so each
// keystroke doesn't pollute the browser history.

'use client'

import { Search } from 'lucide-react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { useEffect, useState } from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

// Category selection moved to `<FigureCategoryTabs>` (rendered above this
// bar by the parent page). Gender stays as a dropdown because it can be
// orthogonal to any category.

const GENDER_OPTIONS: ReadonlyArray<{ value: string; label: string }> = [
  { value: '', label: 'Semua Gender' },
  { value: 'male', label: 'Laki-laki' },
  { value: 'female', label: 'Perempuan' },
]

export interface FigureFilterBarProps {
  className?: string
}

export function FigureFilterBar({ className }: FigureFilterBarProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  // Local mirror of `?q=` so typing feels instant.  We sync to the URL after
  // a short debounce.
  const initialQ = searchParams.get('q') ?? ''
  const [q, setQ] = useState(initialQ)

  // Keep local state in sync if the URL changes externally (e.g. back/forward).
  useEffect(() => {
    setQ(searchParams.get('q') ?? '')
  }, [searchParams])

  // Debounce search → URL.
  useEffect(() => {
    const current = searchParams.get('q') ?? ''
    if (q === current) return
    const handle = window.setTimeout(() => {
      pushFilter('q', q)
    }, 300)
    return () => window.clearTimeout(handle)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  function pushFilter(key: string, value: string) {
    const next = new URLSearchParams(searchParams.toString())
    if (value) {
      next.set(key, value)
    } else {
      next.delete(key)
    }
    // Changing a filter always resets to page 1.
    next.delete('page')

    // Target the list URL even when called from a detail page so filters
    // operate on the visible list pane.  If user was on `/figures/[slug]`
    // we keep them there — filters still apply to the list pane on the
    // left.  Detail page reads the same searchParams.
    const qs = next.toString()
    router.replace(qs.length > 0 ? `${pathname}?${qs}` : pathname, { scroll: false })
  }

  const category = searchParams.get('category') ?? ''
  const gender = searchParams.get('gender') ?? ''
  // Shahabiyat tab locks the gender filter; hide the dropdown to avoid
  // confusion (user can switch tabs to change the gender bucket).
  const genderLocked = category === 'sahabat' && gender === 'female'

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-3 sm:flex-row sm:items-center',
        className,
      )}
    >
      <div className="relative flex-1">
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[rgb(var(--text-faint))]"
        />
        <Input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Cari nama, kunyah, atau laqab…"
          className="pl-9"
          aria-label="Pencarian tokoh"
        />
      </div>

      {!genderLocked && (
        <div className="flex gap-2 sm:gap-2">
          <FilterSelect
            ariaLabel="Filter gender"
            value={gender}
            onChange={(v) => pushFilter('gender', v)}
            options={GENDER_OPTIONS}
          />
        </div>
      )}
    </div>
  )
}

// Native <select> wrapped in the same border tokens — saves a heavy shadcn
// Select dependency for now and stays keyboard-accessible.
function FilterSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: string
  onChange: (v: string) => void
  options: ReadonlyArray<{ value: string; label: string }>
  ariaLabel: string
}) {
  return (
    <select
      aria-label={ariaLabel}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        'h-10 min-w-[10rem] rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-2 text-sm text-[rgb(var(--text))]',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--ring))]',
      )}
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
