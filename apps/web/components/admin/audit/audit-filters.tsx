// Filter bar for `/admin/audit-logs`.
//
// All filter state is mirrored to the URL query-string via
// `router.replace(?…)`. That lets the page deep-link / back-button cleanly
// and keeps the `<AuditTable />` source-of-truth in one place
// (`useSearchParams`). We deliberately do NOT keep React state in sync
// with the URL — the URL *is* the state.
//
// Inputs:
//   - actorId  (free-text UUID search)
//   - action   (enum select — mirrors `auditActionEnum`)
//   - resourceType (enum-ish select — common resource types)
//   - from / to (date range — two native date inputs)
//   - perPage (page size)

'use client'

import { useRouter, useSearchParams } from 'next/navigation'
import { useCallback, useMemo, useTransition } from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

/**
 * Mirrors `auditActionEnum` from `packages/db/src/schema/enums.ts`. Kept
 * inline (no import from `@athar/db`) so this client component stays free
 * of server-only deps. If you add an action server-side, add it here too.
 */
const AUDIT_ACTIONS = [
  'create',
  'update',
  'soft_delete',
  'restore',
  'hard_delete',
  'login',
  'logout',
  'role_change',
  'permission_change',
  'config_change',
  'crawl_complete',
] as const
type AuditAction = (typeof AUDIT_ACTIONS)[number]

const ACTION_LABEL: Record<AuditAction, string> = {
  create: 'Buat',
  update: 'Ubah',
  soft_delete: 'Hapus (soft)',
  restore: 'Pulihkan',
  hard_delete: 'Hapus permanen',
  login: 'Login',
  logout: 'Logout',
  role_change: 'Ubah role',
  permission_change: 'Ubah permission',
  config_change: 'Ubah konfigurasi',
  crawl_complete: 'Crawl selesai',
}

/**
 * The backend accepts any string for `resourceType`, but in practice we use
 * a short whitelist. Keeping it as a fixed select avoids typos. Add an
 * entry whenever a new resource starts emitting audit rows.
 */
const RESOURCE_TYPES = [
  'figure',
  'battle',
  'quiz',
  'user',
  'role',
  'permission',
  'menu',
  'subscription',
  'payment',
  'citation',
  'location',
  'font',
  'whitelist',
  'crawl_run',
] as const

const PER_PAGE_OPTIONS = [25, 50, 100, 200] as const

// Sentinel used by Radix `<Select>` because it forbids `value=""` on items.
const ALL_SENTINEL = '__all__'

export function AuditFilters() {
  const router = useRouter()
  const sp = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Read current filter values from the URL.
  const current = useMemo(
    () => ({
      actorId: sp.get('actorId') ?? '',
      action: sp.get('action') ?? '',
      resourceType: sp.get('resourceType') ?? '',
      from: sp.get('from') ?? '',
      to: sp.get('to') ?? '',
      perPage: sp.get('perPage') ?? '50',
    }),
    [sp],
  )

  /**
   * Patch the URL: merge `next` over the current params, drop empties,
   * always reset to page 1 so the user doesn't land past the new
   * (filtered) tail.
   */
  const patchUrl = useCallback(
    (next: Record<string, string | undefined>) => {
      const params = new URLSearchParams(sp.toString())
      for (const [key, value] of Object.entries(next)) {
        if (value === undefined || value === '' || value === ALL_SENTINEL) {
          params.delete(key)
        } else {
          params.set(key, value)
        }
      }
      // Whenever filters change, snap back to page 1.
      params.delete('page')
      const qs = params.toString()
      startTransition(() => {
        router.replace(qs ? `?${qs}` : '?', { scroll: false })
      })
    },
    [router, sp],
  )

  const handleReset = useCallback(() => {
    startTransition(() => {
      router.replace('?', { scroll: false })
    })
  }, [router])

  // For the actorId text input we commit on blur / Enter to avoid
  // navigating after every keystroke.
  const handleActorCommit = useCallback(
    (raw: string) => {
      const value = raw.trim()
      if (value === current.actorId) return
      patchUrl({ actorId: value || undefined })
    },
    [current.actorId, patchUrl],
  )

  return (
    <form
      aria-label="Filter audit log"
      aria-busy={isPending ? 'true' : 'false'}
      onSubmit={(e) => e.preventDefault()}
      className="grid gap-3 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 sm:grid-cols-2 lg:grid-cols-6"
    >
      {/* Actor */}
      <div className="space-y-1 lg:col-span-2">
        <Label htmlFor="audit-actor" className="text-xs">
          Aktor (UUID)
        </Label>
        <Input
          id="audit-actor"
          type="search"
          placeholder="UUID pengguna…"
          defaultValue={current.actorId}
          onBlur={(e) => handleActorCommit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              handleActorCommit((e.target as HTMLInputElement).value)
            }
          }}
        />
      </div>

      {/* Action */}
      <div className="space-y-1">
        <Label htmlFor="audit-action" className="text-xs">
          Action
        </Label>
        <Select
          value={current.action || ALL_SENTINEL}
          onValueChange={(value) => patchUrl({ action: value })}
        >
          <SelectTrigger id="audit-action">
            <SelectValue placeholder="Semua action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>Semua action</SelectItem>
            {AUDIT_ACTIONS.map((a) => (
              <SelectItem key={a} value={a}>
                {ACTION_LABEL[a]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Resource type */}
      <div className="space-y-1">
        <Label htmlFor="audit-resource-type" className="text-xs">
          Resource
        </Label>
        <Select
          value={current.resourceType || ALL_SENTINEL}
          onValueChange={(value) => patchUrl({ resourceType: value })}
        >
          <SelectTrigger id="audit-resource-type">
            <SelectValue placeholder="Semua resource" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL_SENTINEL}>Semua resource</SelectItem>
            {RESOURCE_TYPES.map((r) => (
              <SelectItem key={r} value={r}>
                {r}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Date range */}
      <div className="space-y-1">
        <Label htmlFor="audit-from" className="text-xs">
          Dari
        </Label>
        <Input
          id="audit-from"
          type="date"
          value={isoToDateInput(current.from)}
          onChange={(e) =>
            patchUrl({ from: dateInputToIso(e.target.value, 'start') })
          }
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="audit-to" className="text-xs">
          Sampai
        </Label>
        <Input
          id="audit-to"
          type="date"
          value={isoToDateInput(current.to)}
          onChange={(e) =>
            patchUrl({ to: dateInputToIso(e.target.value, 'end') })
          }
        />
      </div>

      {/* Per page + reset */}
      <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-6">
        <div className="space-y-1">
          <Label htmlFor="audit-per-page" className="text-xs">
            Per halaman
          </Label>
          <Select
            value={current.perPage}
            onValueChange={(value) => patchUrl({ perPage: value })}
          >
            <SelectTrigger id="audit-per-page" className="w-28">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PER_PAGE_OPTIONS.map((n) => (
                <SelectItem key={n} value={String(n)}>
                  {n}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleReset}
          disabled={
            !current.actorId &&
            !current.action &&
            !current.resourceType &&
            !current.from &&
            !current.to &&
            current.perPage === '50'
          }
        >
          Reset filter
        </Button>
      </div>
    </form>
  )
}

// ─── helpers ────────────────────────────────────────────────────────────

/** ISO datetime → `YYYY-MM-DD` for `<input type="date">`. */
function isoToDateInput(iso: string): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const yyyy = d.getUTCFullYear()
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0')
  const dd = String(d.getUTCDate()).padStart(2, '0')
  return `${yyyy}-${mm}-${dd}`
}

/**
 * `YYYY-MM-DD` from the date picker → ISO datetime. `boundary='start'`
 * yields 00:00:00Z (inclusive lower bound), `boundary='end'` yields
 * 23:59:59.999Z so "sampai 13 Mei" includes all of that day.
 */
function dateInputToIso(
  value: string,
  boundary: 'start' | 'end',
): string | undefined {
  if (!value) return undefined
  const time = boundary === 'start' ? '00:00:00.000Z' : '23:59:59.999Z'
  const iso = `${value}T${time}`
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return undefined
  return d.toISOString()
}
