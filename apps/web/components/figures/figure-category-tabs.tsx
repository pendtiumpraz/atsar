// Figure-category tabs — horizontal swipe of all 6 (+1 derived) categories.
//
// Replaces the dropdown in `figure-filter-bar` so the taxonomy stays
// visible. URL is the source of truth:
//   ?category=<slug>&gender=<male|female>
// "Shahabiyat" is not a real category slug — it's derived from
// `category=sahabat&gender=female`, so the tab toggles both params atomically.

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import {
  BookOpen,
  Crown,
  GraduationCap,
  Library,
  Sparkles,
  Star,
  Trash2,
  Users,
  UserCircle2,
} from 'lucide-react'

import { cn } from '@/lib/utils'

type TabIcon = React.ComponentType<{ className?: string }>

interface TabSpec {
  id: string
  label: string
  icon: TabIcon
  /** URL category param (empty string = no filter). */
  category: string
  /** URL gender param (undefined = clear gender). */
  gender?: 'male' | 'female'
}

const TABS: ReadonlyArray<TabSpec> = [
  { id: 'all', label: 'Semua', icon: Sparkles, category: '' },
  { id: 'nabi', label: 'Nabi & Rasul', icon: Crown, category: 'nabi' },
  {
    id: 'shalih_pre_rasul',
    label: 'Pra-Rasul ﷺ',
    icon: Star,
    category: 'shalih_pre_rasul',
  },
  { id: 'sahabat', label: 'Sahabat', icon: Users, category: 'sahabat', gender: 'male' },
  {
    id: 'shahabiyat',
    label: 'Shahabiyat',
    icon: UserCircle2,
    category: 'sahabat',
    gender: 'female',
  },
  { id: 'tabiin', label: "Tabi'in", icon: BookOpen, category: 'tabiin' },
  { id: 'tabiut_tabiin', label: "Tabi'ut Tabi'in", icon: GraduationCap, category: 'tabiut_tabiin' },
  {
    id: 'shalih_pasca_rasul',
    label: 'Pasca-Salaf',
    icon: Library,
    category: 'shalih_pasca_rasul',
  },
]

function resolveActiveTabId(category: string, gender: string): string {
  // "Sahabat" tab is male-only; "Shahabiyat" is female-only. Anything else
  // ignores gender so we match the broader category.
  if (category === 'sahabat') {
    if (gender === 'female') return 'shahabiyat'
    return 'sahabat'
  }
  const match = TABS.find((t) => t.category === category && !t.gender)
  return match?.id ?? 'all'
}

export interface FigureCategoryTabsProps {
  className?: string
  /** Render the admin-only "Sampah" pill linking to /admin/trash/figures. */
  showTrash?: boolean
}

export function FigureCategoryTabs({ className, showTrash = false }: FigureCategoryTabsProps) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const category = searchParams.get('category') ?? ''
  const gender = searchParams.get('gender') ?? ''
  const activeId = resolveActiveTabId(category, gender)

  const onSelect = React.useCallback(
    (tab: TabSpec) => {
      const next = new URLSearchParams(searchParams.toString())
      if (tab.category) next.set('category', tab.category)
      else next.delete('category')
      if (tab.gender) next.set('gender', tab.gender)
      else next.delete('gender')
      next.delete('page') // reset pagination on category change
      const qs = next.toString()
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false })
    },
    [pathname, router, searchParams],
  )

  return (
    <nav
      aria-label="Kategori tokoh"
      className={cn(
        '-mx-1 flex gap-1 overflow-x-auto px-1 pb-1 [&::-webkit-scrollbar]:hidden snap-x snap-mandatory',
        className,
      )}
    >
      {TABS.map((tab) => {
        const active = tab.id === activeId
        const Icon = tab.icon
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onSelect(tab)}
            aria-pressed={active}
            className={cn(
              'inline-flex shrink-0 snap-start items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
              active
                ? 'border-[rgb(var(--accent))] bg-[rgb(var(--accent))]/10 text-[rgb(var(--accent))]'
                : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]',
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        )
      })}

      {showTrash && (
        <Link
          href="/admin/trash/figures"
          className={cn(
            'ml-auto inline-flex shrink-0 snap-end items-center gap-2 rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors',
            pathname?.startsWith('/admin/trash')
              ? 'border-[rgb(var(--danger))] bg-[rgb(var(--danger))]/10 text-[rgb(var(--danger))]'
              : 'border-[rgb(var(--border))] bg-[rgb(var(--surface))] text-[rgb(var(--text-muted))] hover:border-[rgb(var(--danger))] hover:text-[rgb(var(--danger))]',
          )}
          title="Tokoh yang dihapus (admin)"
        >
          <Trash2 className="h-4 w-4 shrink-0" />
          <span className="whitespace-nowrap">Sampah</span>
        </Link>
      )}
    </nav>
  )
}

export default FigureCategoryTabs
