'use client'

// Pricing page — `/pricing`.
//
// Client component because the bulanan ↔ tahunan toggle needs local state.
// The cards themselves stay server-friendly (props in, JSX out), so the
// client boundary only wraps the toggle + the cards/feature-table region.
//
// Layout (per WIREFRAMES §32):
//   1. Heading + cycle toggle (Bulanan / Tahunan -10%)
//   2. Five pricing cards in `full` variant
//   3. Feature comparison table (collapsible)
//   4. Refund disclosure + admin contact (Galih)

import { useState } from 'react'
import Link from 'next/link'
import { AlertTriangle, Phone } from 'lucide-react'
import { TIER_PRICES_IDR } from '@athar/shared'
import type { TierSlug } from '@athar/shared'

import { PricingCards, type PricingCycle } from '@/components/marketing/pricing-cards'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface FeatureRow {
  label: string
  values: Record<TierSlug, string | boolean>
}

const COMPARISON: ReadonlyArray<FeatureRow> = [
  {
    label: 'Akses biografi',
    values: {
      free: '30 sahabat pilihan',
      sampler: '20 nabi + 20 sahabat + 20 tabi’in',
      basic: 'Semua sahabat & shahabiyat',
      pro: '+ Tabi’in',
      premium: '+ Tabi’ut Tabi’in & ulama salaf',
    },
  },
  {
    label: 'Peta interaktif',
    values: {
      free: 'Terbatas',
      sampler: true,
      basic: true,
      pro: true,
      premium: true,
    },
  },
  {
    label: 'Timeline komparasi',
    values: {
      free: false,
      sampler: true,
      basic: true,
      pro: true,
      premium: true,
    },
  },
  {
    label: 'AI chat & deep research',
    values: {
      free: false,
      sampler: '20 chat/bulan',
      basic: '500 chat/bulan',
      pro: '1000 chat/bulan',
      premium: 'Tanpa batas',
    },
  },
  {
    label: 'PDF download/bulan',
    values: {
      free: '0',
      sampler: '50',
      basic: '100',
      pro: '500',
      premium: '1000',
    },
  },
  {
    label: 'Cetak / kuiz / hadits link',
    values: {
      free: false,
      sampler: true,
      basic: true,
      pro: true,
      premium: true,
    },
  },
]

const TIER_HEADERS: ReadonlyArray<{ slug: TierSlug; name: string }> = [
  { slug: 'free', name: 'Free' },
  { slug: 'sampler', name: 'Sampler' },
  { slug: 'basic', name: 'Basic' },
  { slug: 'pro', name: 'Pro' },
  { slug: 'premium', name: 'Premium' },
]

const IDR = new Intl.NumberFormat('id-ID')

function priceHeader(slug: TierSlug, cycle: PricingCycle): string {
  const price = TIER_PRICES_IDR[slug][cycle]
  if (price === 0) return 'Gratis'
  return `Rp${IDR.format(price)}${cycle === 'monthly' ? '/bln' : '/thn'}`
}

function renderValue(v: string | boolean): React.ReactNode {
  if (v === true) return <span className="text-[rgb(var(--success))]">✓</span>
  if (v === false) return <span className="text-[rgb(var(--text-faint))]">—</span>
  return <span className="text-[rgb(var(--text))]">{v}</span>
}

export default function PricingPage() {
  const [cycle, setCycle] = useState<PricingCycle>('monthly')

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-12 sm:px-6 lg:py-16">
      {/* Header */}
      <div className="mx-auto max-w-2xl text-center">
        <h1
          className="text-3xl font-semibold tracking-tight text-[rgb(var(--text))] sm:text-5xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Pilih paket yang sesuai untukmu
        </h1>
        <p className="mt-3 text-base text-[rgb(var(--text-muted))]">
          Semua paket dapat dibayar bulanan atau tahunan (hemat 10%).
        </p>
      </div>

      {/* Cycle toggle */}
      <div
        role="tablist"
        aria-label="Periode penagihan"
        className="mx-auto mt-8 inline-flex items-center gap-1 rounded-full border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-1"
      >
        <button
          type="button"
          role="tab"
          aria-selected={cycle === 'monthly'}
          onClick={() => setCycle('monthly')}
          className={cn(
            'rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            cycle === 'monthly'
              ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
              : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]',
          )}
        >
          Bulanan
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={cycle === 'yearly'}
          onClick={() => setCycle('yearly')}
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full px-4 py-1.5 text-sm font-medium transition-colors',
            cycle === 'yearly'
              ? 'bg-[rgb(var(--primary))] text-[rgb(var(--primary-foreground))]'
              : 'text-[rgb(var(--text-muted))] hover:text-[rgb(var(--text))]',
          )}
        >
          Tahunan
          <span
            className={cn(
              'rounded-full px-1.5 py-0.5 text-[10px] font-semibold',
              cycle === 'yearly'
                ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]'
                : 'bg-[rgb(var(--accent)/0.18)] text-[rgb(var(--accent))]',
            )}
          >
            -10%
          </span>
        </button>
      </div>

      {/* Cards */}
      <div className="mt-10">
        <PricingCards cycle={cycle} variant="full" />
      </div>

      {/* Comparison table */}
      <section
        aria-labelledby="comparison-heading"
        className="mt-16 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-2 sm:p-4"
      >
        <details open>
          <summary className="cursor-pointer list-none px-3 py-2">
            <h2
              id="comparison-heading"
              className="inline text-lg font-semibold text-[rgb(var(--text))]"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              Perbandingan fitur
            </h2>
            <span className="ml-2 text-sm text-[rgb(var(--text-muted))]">
              (klik untuk sembunyikan)
            </span>
          </summary>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <thead>
                <tr className="border-b border-[rgb(var(--border))]">
                  <th
                    scope="col"
                    className="px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]"
                  >
                    Fitur
                  </th>
                  {TIER_HEADERS.map((t) => (
                    <th
                      scope="col"
                      key={t.slug}
                      className="px-3 py-3 text-center text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]"
                    >
                      <div>{t.name}</div>
                      <div className="mt-0.5 text-[10px] font-normal text-[rgb(var(--text-faint))]">
                        {priceHeader(t.slug, cycle)}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {COMPARISON.map((row) => (
                  <tr
                    key={row.label}
                    className="border-b border-[rgb(var(--border))] last:border-0"
                  >
                    <th
                      scope="row"
                      className="px-3 py-3 text-left font-medium text-[rgb(var(--text))]"
                    >
                      {row.label}
                    </th>
                    {TIER_HEADERS.map((t) => (
                      <td
                        key={t.slug}
                        className="px-3 py-3 text-center text-[rgb(var(--text-muted))]"
                      >
                        {renderValue(row.values[t.slug])}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>

      {/* No-refund disclosure */}
      <aside
        role="note"
        className="mt-10 rounded-lg border border-[rgb(var(--warning)/0.40)] bg-[rgb(var(--warning)/0.08)] p-5"
      >
        <div className="flex items-start gap-3">
          <AlertTriangle
            aria-hidden="true"
            className="mt-0.5 h-5 w-5 flex-none text-[rgb(var(--warning))]"
          />
          <div className="text-sm">
            <p className="font-semibold text-[rgb(var(--text))]">
              Pembayaran tidak dapat dikembalikan
            </p>
            <p className="mt-1 text-[rgb(var(--text-muted))]">
              Semua langganan Atsar bersifat non-refundable. Mohon pastikan
              tier dan periode yang dipilih sudah benar sebelum melakukan
              transfer. Selengkapnya di{' '}
              <Link
                href="/legal/terms"
                className="text-[rgb(var(--accent))] hover:underline"
              >
                Syarat Layanan
              </Link>
              .
            </p>
          </div>
        </div>
      </aside>

      {/* Admin contact */}
      <aside
        aria-labelledby="contact-heading"
        className="mt-6 rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5"
      >
        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <Phone
              aria-hidden="true"
              className="mt-0.5 h-5 w-5 flex-none text-[rgb(var(--primary))]"
            />
            <div className="text-sm">
              <p
                id="contact-heading"
                className="font-semibold text-[rgb(var(--text))]"
              >
                Aktivasi manual oleh admin
              </p>
              <p className="mt-1 text-[rgb(var(--text-muted))]">
                Setelah transfer, kirim bukti pembayaran ke admin untuk
                aktivasi.
              </p>
            </div>
          </div>
          <Button asChild variant="primary" size="md">
            <a
              href="https://wa.me/6281319504441"
              rel="noopener noreferrer"
              target="_blank"
            >
              Hubungi Galih (WA 0813-1950-4441)
            </a>
          </Button>
        </div>
      </aside>
    </div>
  )
}
