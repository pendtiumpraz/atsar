// Marketing landing hero.
//
// Server component. Renders:
//   - The Atsar kaligrafi mark (Arabic أثر big, Latin ATSAR small).
//   - Indonesian tagline (display) + Arabic tagline (companion).
//   - Two CTAs: trial sign-up and a "see the map demo" deep link.
//
// Visual: emerald primary on warm cream — Emerald Turats palette. Subtle
// arabesque ornament is a CSS radial gradient so we avoid shipping an
// image during Phase 4. Hero uses a CSS-only fade/slide entrance so it
// works without `framer-motion` hydration cost on the public surface.
//
// Copy locked from docs/BRANDING.md §2 (taglines) and WIREFRAMES §1.

import Link from 'next/link'
import { APP_NAME_AR, APP_TAGLINE_AR, APP_TAGLINE_ID } from '@athar/shared'

import { Button } from '@/components/ui/button'

export function MarketingHero() {
  return (
    <section
      className="relative isolate overflow-hidden"
      aria-labelledby="hero-tagline"
    >
      {/* Decorative radial ornament — emerald glow + warm gold whisper. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10"
        style={{
          backgroundImage:
            'radial-gradient(60% 60% at 50% 25%, rgb(var(--primary) / 0.10), transparent 70%), radial-gradient(40% 40% at 50% 80%, rgb(var(--accent) / 0.10), transparent 70%)',
        }}
      />

      <div className="mx-auto flex w-full max-w-6xl flex-col items-center px-4 pb-16 pt-20 text-center sm:px-6 sm:pt-28 lg:pb-24 lg:pt-32">
        {/* Arabic kaligrafi mark — primary brand asset. */}
        <p
          className="athar-hero-fade text-7xl leading-none sm:text-8xl lg:text-9xl"
          style={{
            fontFamily: 'var(--font-display-arab)',
            color: 'rgb(var(--primary))',
          }}
          dir="rtl"
          lang="ar"
          aria-hidden="true"
        >
          {APP_NAME_AR}
        </p>

        <h1
          className="athar-hero-fade athar-hero-fade-delay-1 mt-3 text-2xl font-semibold tracking-[0.4em] text-[rgb(var(--text-muted))] sm:text-3xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          ATSAR
        </h1>

        <p
          id="hero-tagline"
          className="athar-hero-fade athar-hero-fade-delay-2 mt-10 max-w-2xl text-balance text-2xl font-medium text-[rgb(var(--text))] sm:text-3xl lg:text-4xl"
          style={{ fontFamily: 'var(--font-display-latin)' }}
        >
          {APP_TAGLINE_ID}
        </p>

        <p
          className="athar-hero-fade athar-hero-fade-delay-3 mt-3 max-w-2xl text-lg text-[rgb(var(--text-muted))] sm:text-xl"
          style={{ fontFamily: 'var(--font-body-arab)' }}
          dir="rtl"
          lang="ar"
        >
          {APP_TAGLINE_AR}
        </p>

        <div className="athar-hero-fade athar-hero-fade-delay-4 mt-10 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-center">
          <Button asChild size="lg" variant="primary">
            <Link href="/register">Coba Gratis 3 Hari</Link>
          </Button>
          <Button asChild size="lg" variant="outline">
            <Link href="/map">Lihat Demo Peta →</Link>
          </Button>
        </div>

        <p className="mt-6 text-xs text-[rgb(var(--text-faint))]">
          Tanpa kartu kredit. Aktivasi langganan manual oleh admin setelah trial.
        </p>
      </div>

      {/* Local fade-in keyframes. Uses CSS only so the hero is render-blocked
          on neither JS nor a heavy animation library. `prefers-reduced-motion`
          is honored globally in `globals.css`. */}
      <style>{`
        @keyframes atharHeroFadeIn {
          from { opacity: 0; transform: translateY(8px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .athar-hero-fade {
          opacity: 0;
          animation: atharHeroFadeIn 600ms ease-out forwards;
        }
        .athar-hero-fade-delay-1 { animation-delay: 80ms; }
        .athar-hero-fade-delay-2 { animation-delay: 180ms; }
        .athar-hero-fade-delay-3 { animation-delay: 260ms; }
        .athar-hero-fade-delay-4 { animation-delay: 360ms; }
      `}</style>
    </section>
  )
}
