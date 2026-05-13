// Public landing page — `/`.
//
// Server-rendered (RSC) and statically eligible: every section depends only
// on build-time constants (taglines, tier prices, copy). Mark the route as
// ISR-friendly with `revalidate` so future content changes (e.g. tier
// rename) propagate without a full deploy.
//
// Sections, top to bottom (per WIREFRAMES §1):
//   1. Hero
//   2. Feature grid (4 cards)
//   3. Cakupan tokoh (coverage list)
//   4. Pricing preview (5 cards)
//   5. Final CTA with admin contact + T&C link
//
// The marketing shell (header + footer) is owned by
// `(marketing)/layout.tsx` and we do not duplicate it here.

import Link from 'next/link'

import { FeatureGrid } from '@/components/marketing/feature-grid'
import { MarketingHero } from '@/components/marketing/hero'
import { PricingCards } from '@/components/marketing/pricing-cards'
import { Button } from '@/components/ui/button'

// Re-validate at most every hour — landing copy is essentially static but
// pricing constants might shift if the shared package version bumps.
export const revalidate = 3600

const COVERAGE: ReadonlyArray<{ label: string; arabic: string }> = [
  { label: '25 Nabi & Rasul', arabic: 'الأنبياء والرسل' },
  { label: 'Sahabat & Shahabiyat', arabic: 'الصحابة والصحابيات' },
  { label: "Tabi'in", arabic: 'التابعون' },
  { label: "Tabi'ut Tabi'in", arabic: 'تابعو التابعين' },
  { label: 'Ulama Salaf hingga 2026', arabic: 'علماء السلف إلى ٢٠٢٦' },
]

export default function LandingPage() {
  return (
    <>
      <MarketingHero />
      <FeatureGrid />
      <CoverageSection />
      <PricingPreviewSection />
      <FinalCtaSection />
    </>
  )
}

function CoverageSection() {
  return (
    <section
      className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]"
      aria-labelledby="coverage-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="coverage-heading"
            className="text-3xl font-semibold tracking-tight text-[rgb(var(--text))] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Cakupan Tokoh
          </h2>
          <p className="mt-3 text-base text-[rgb(var(--text-muted))]">
            Dari para nabi hingga ulama salaf masa kini — semua biografi
            bersumber salaf, dilengkapi citation dan tanggal Hijri/Masehi.
          </p>
        </div>

        <ul className="mx-auto mt-10 grid max-w-4xl grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {COVERAGE.map((item) => (
            <li
              key={item.label}
              className="flex items-center justify-between gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--surface))] px-4 py-3"
            >
              <span className="text-sm font-medium text-[rgb(var(--text))]">
                {item.label}
              </span>
              <span
                className="text-sm text-[rgb(var(--text-muted))]"
                dir="rtl"
                lang="ar"
                style={{ fontFamily: 'var(--font-body-arab)' }}
              >
                {item.arabic}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}

function PricingPreviewSection() {
  return (
    <section
      className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg))]"
      aria-labelledby="pricing-preview-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="pricing-preview-heading"
            className="text-3xl font-semibold tracking-tight text-[rgb(var(--text))] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Pilih paket yang sesuai
          </h2>
          <p className="mt-3 text-base text-[rgb(var(--text-muted))]">
            Mulai gratis. Naik kapan saja — aktivasi manual oleh admin setelah
            transfer.
          </p>
        </div>

        <div className="mt-10">
          <PricingCards cycle="monthly" variant="compact" />
        </div>

        <div className="mt-8 text-center">
          <Link
            href="/pricing"
            className="text-sm font-medium text-[rgb(var(--accent))] hover:underline"
          >
            Lihat perbandingan fitur lengkap →
          </Link>
        </div>
      </div>
    </section>
  )
}

function FinalCtaSection() {
  return (
    <section
      className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]"
      aria-labelledby="final-cta-heading"
    >
      <div className="mx-auto w-full max-w-4xl px-4 py-16 text-center sm:px-6 lg:py-20">
        <h2
          id="final-cta-heading"
          className="text-3xl font-semibold tracking-tight text-[rgb(var(--text))] sm:text-4xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          Mulai jejakmu hari ini
        </h2>
        <p className="mx-auto mt-3 max-w-xl text-base text-[rgb(var(--text-muted))]">
          Daftar trial 3 hari — tanpa kartu kredit. Untuk aktivasi langganan,
          hubungi admin langsung.
        </p>

        <div className="mt-8 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:items-center">
          <Button asChild size="lg" variant="primary">
            <Link href="/register">Coba Gratis 3 Hari</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/pricing">Lihat Harga</Link>
          </Button>
        </div>

        <div className="mx-auto mt-10 max-w-md rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-5 text-left">
          <p className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
            Kontak admin
          </p>
          <p className="mt-2 text-sm text-[rgb(var(--text))]">
            <span className="font-medium">Galih</span> —{' '}
            <a
              href="https://wa.me/6281319504441"
              className="text-[rgb(var(--accent))] hover:underline"
              rel="noopener noreferrer"
              target="_blank"
            >
              WA 0813-1950-4441
            </a>
          </p>
          <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
            Dengan mendaftar, Anda menyetujui{' '}
            <Link href="/legal/terms" className="text-[rgb(var(--accent))] hover:underline">
              Syarat Layanan
            </Link>{' '}
            dan{' '}
            <Link href="/legal/privacy" className="text-[rgb(var(--accent))] hover:underline">
              Kebijakan Privasi
            </Link>
            . Pembayaran tidak dapat dikembalikan.
          </p>
        </div>
      </div>
    </section>
  )
}
