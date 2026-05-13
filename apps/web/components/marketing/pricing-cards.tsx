// Pricing cards — used both on the landing preview *and* on /pricing.
//
// Server component. Two layout modes:
//   - `compact` (default) — 5 dense cards for the landing-page preview.
//   - `full`              — taller cards with feature bullets, used by the
//                            dedicated `/pricing` page above the comparison
//                            table.
//
// Prices come from `TIER_PRICES_IDR` (single source of truth, see
// docs/IDEAS.md §6.4). `cycle` lets the parent toggle bulanan ↔ tahunan;
// yearly already bakes in the 10% discount per the constants file.

import Link from 'next/link'
import { Check } from 'lucide-react'
import { TIER_PRICES_IDR } from '@athar/shared'
import type { TierSlug } from '@athar/shared'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

export type PricingCycle = 'monthly' | 'yearly'

interface TierMeta {
  slug: TierSlug
  name: string
  blurb: string
  highlight?: string
  features: string[]
}

const TIERS: ReadonlyArray<TierMeta> = [
  {
    slug: 'free',
    name: 'Free',
    blurb: '30 tokoh sahabat pilihan untuk berkenalan dengan Atsar.',
    features: [
      '30 biografi sahabat pilihan',
      'Peta & timeline (mode terbatas)',
      'Tanpa PDF download',
    ],
  },
  {
    slug: 'sampler',
    name: 'Sampler',
    blurb: 'Cicipi semua kategori: 20 nabi + 20 sahabat + 20 tabi’in.',
    highlight: 'PROMO',
    features: [
      '20 nabi, 20 sahabat, 20 tabi’in',
      'Peta & timeline penuh',
      '50 PDF / bulan',
    ],
  },
  {
    slug: 'basic',
    name: 'Basic',
    blurb: 'Seluruh sahabat & shahabiyat. Cocok untuk pelajar agama.',
    features: [
      'Semua sahabat & shahabiyat',
      'AI chat & deep research',
      '100 PDF / bulan',
    ],
  },
  {
    slug: 'pro',
    name: 'Pro',
    blurb: '+ Tabi’in. Untuk pengajar dan da’i yang butuh material lengkap.',
    features: [
      'Semua di Basic',
      '+ seluruh Tabi’in',
      '500 PDF / bulan',
    ],
  },
  {
    slug: 'premium',
    name: 'Premium',
    blurb: '+ Tabi’ut Tabi’in & Ulama Salaf hingga 2026.',
    highlight: 'MOST POPULAR',
    features: [
      'Semua di Pro',
      '+ Tabi’ut Tabi’in & ulama pasca-rasul',
      '1000 PDF / bulan',
    ],
  },
]

const IDR = new Intl.NumberFormat('id-ID')

function priceLabel(slug: TierSlug, cycle: PricingCycle): { amount: string; suffix: string } {
  const price = TIER_PRICES_IDR[slug][cycle]
  if (price === 0) return { amount: 'Rp0', suffix: 'selamanya' }
  return {
    amount: `Rp${IDR.format(price)}`,
    suffix: cycle === 'monthly' ? '/bulan' : '/tahun',
  }
}

interface PricingCardsProps {
  cycle?: PricingCycle
  variant?: 'compact' | 'full'
}

export function PricingCards({ cycle = 'monthly', variant = 'compact' }: PricingCardsProps) {
  return (
    <ul
      className={cn(
        'grid gap-4',
        variant === 'compact'
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-5'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-5',
      )}
    >
      {TIERS.map((tier) => {
        const { amount, suffix } = priceLabel(tier.slug, cycle)
        const isMostPopular = tier.highlight === 'MOST POPULAR'
        return (
          <li key={tier.slug}>
            <Card
              className={cn(
                'flex h-full flex-col',
                isMostPopular &&
                  'border-[rgb(var(--accent))] shadow-md ring-1 ring-[rgb(var(--accent))]',
              )}
            >
              <CardHeader>
                {tier.highlight ? (
                  <span
                    className={cn(
                      'inline-flex w-fit items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider',
                      isMostPopular
                        ? 'bg-[rgb(var(--accent))] text-[rgb(var(--accent-foreground))]'
                        : 'bg-[rgb(var(--primary)/0.10)] text-[rgb(var(--primary))]',
                    )}
                  >
                    {tier.highlight}
                  </span>
                ) : null}
                <CardTitle className="mt-2 text-lg">{tier.name}</CardTitle>
                <div className="mt-2 flex items-baseline gap-1">
                  <span
                    className="text-2xl font-bold text-[rgb(var(--text))]"
                    style={{ fontFamily: 'var(--font-display-latin)' }}
                  >
                    {amount}
                  </span>
                  <span className="text-xs text-[rgb(var(--text-muted))]">{suffix}</span>
                </div>
                <p className="mt-2 text-sm text-[rgb(var(--text-muted))]">{tier.blurb}</p>
              </CardHeader>
              <CardContent className="flex-1">
                {variant === 'full' ? (
                  <ul className="space-y-2 text-sm">
                    {tier.features.map((f) => (
                      <li key={f} className="flex items-start gap-2">
                        <Check
                          aria-hidden="true"
                          className="mt-0.5 h-4 w-4 flex-none text-[rgb(var(--success))]"
                          strokeWidth={2}
                        />
                        <span className="text-[rgb(var(--text))]">{f}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <ul className="space-y-1 text-xs text-[rgb(var(--text-muted))]">
                    {tier.features.slice(0, 2).map((f) => (
                      <li key={f}>• {f}</li>
                    ))}
                  </ul>
                )}
              </CardContent>
              <CardFooter>
                <Button
                  asChild
                  variant={isMostPopular ? 'primary' : 'outline'}
                  size="sm"
                  className="w-full"
                >
                  <Link href={`/register?tier=${tier.slug}`}>
                    {tier.slug === 'free' ? 'Mulai gratis' : 'Pilih paket'}
                  </Link>
                </Button>
              </CardFooter>
            </Card>
          </li>
        )
      })}
    </ul>
  )
}
