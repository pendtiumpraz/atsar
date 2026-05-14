// Quick-action grid untuk dashboard admin.
//
// Server component. Tiap aksi adalah `<Link>` yang dibungkus shadcn `Button`
// menggunakan `asChild` (Slot pattern). Tombol Pembayaran menerima
// `pendingPayments` agar bisa menampilkan badge angka di pojok kanan.

import Link from 'next/link'
import {
  Users,
  Wallet,
  ClipboardList,
  Cpu,
  Type as TypeIcon,
  ShieldCheck,
  Shield,
  ListTree,
  CreditCard,
  MapPin,
  Trash2,
  type LucideIcon,
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'

interface QuickAction {
  href: string
  label: string
  icon: LucideIcon
  description: string
}

const ACTIONS: ReadonlyArray<QuickAction> = [
  {
    href: '/admin/users',
    label: 'Manajemen User',
    icon: Users,
    description: 'Kelola pengguna, role, dan langganan.',
  },
  {
    href: '/admin/roles',
    label: 'Roles',
    icon: Shield,
    description: 'Atur role & permission.',
  },
  {
    href: '/admin/menus',
    label: 'Menus',
    icon: ListTree,
    description: 'Kelola item sidebar & akses menu per role.',
  },
  {
    href: '/admin/payments',
    label: 'Pembayaran',
    icon: Wallet,
    description: 'Konfirmasi pembayaran manual.',
  },
  {
    href: '/admin/subscriptions',
    label: 'Langganan',
    icon: CreditCard,
    description: 'Lihat & kelola langganan aktif.',
  },
  {
    href: '/admin/audit-logs',
    label: 'Audit Log',
    icon: ClipboardList,
    description: 'Telusuri aktivitas sistem.',
  },
  {
    href: '/admin/ai-providers',
    label: 'AI Providers',
    icon: Cpu,
    description: 'Konfigurasi penyedia & model AI.',
  },
  {
    href: '/admin/fonts',
    label: 'Fonts',
    icon: TypeIcon,
    description: 'Kelola font Arab & Latin.',
  },
  {
    href: '/admin/locations',
    label: 'Lokasi',
    icon: MapPin,
    description: 'Kelola data lokasi & geografi.',
  },
  {
    href: '/admin/whitelist',
    label: 'Whitelist',
    icon: ShieldCheck,
    description: 'Kelola email whitelist akses.',
  },
  {
    href: '/admin/trash',
    label: 'Trash',
    icon: Trash2,
    description: 'Pulihkan item yang dihapus.',
  },
]

export interface AdminQuickActionsProps {
  /** Jumlah pembayaran menunggu konfirmasi — ditampilkan sebagai badge. */
  pendingPayments?: number
}

export function AdminQuickActions({ pendingPayments = 0 }: AdminQuickActionsProps) {
  return (
    <section aria-labelledby="admin-quick-actions-heading" className="space-y-3">
      <h2
        id="admin-quick-actions-heading"
        className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]"
      >
        Aksi Cepat
      </h2>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {ACTIONS.map((action) => {
          const Icon = action.icon
          const isPayments = action.href === '/admin/payments'
          const showBadge = isPayments && pendingPayments > 0
          return (
            <Button
              key={action.href}
              asChild
              variant="outline"
              className="relative h-auto flex-col items-start gap-2 p-4 text-left"
            >
              <Link href={action.href} title={action.description}>
                <span className="flex w-full items-center justify-between">
                  <Icon className="h-5 w-5 text-[rgb(var(--accent))]" aria-hidden />
                  {showBadge ? (
                    <Badge variant="warning" aria-label={`${pendingPayments} pembayaran menunggu`}>
                      {pendingPayments}
                    </Badge>
                  ) : null}
                </span>
                <span className="text-sm font-medium">{action.label}</span>
              </Link>
            </Button>
          )
        })}
      </div>
    </section>
  )
}

export default AdminQuickActions
