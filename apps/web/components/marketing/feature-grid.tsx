// Feature grid for the landing page.
//
// Four cards highlighting Atsar's USP per WIREFRAMES §1 + IDEAS:
//   1. Timeline komparasi   — visualisasi sumbu waktu Hijri/Masehi.
//   2. Peta interaktif      — geo-historis perang, hijrah, rihlah.
//   3. PDF Book Generator    — buku biografi salaf siap cetak.
//   4. AI Chat               — riset deep, bersumber salaf, cite-by-default.
//
// Server component. Lucide icons only — no client JS required.

import { BookText, Bot, Map, MoveRight } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

interface Feature {
  icon: LucideIcon
  title: string
  description: string
}

const FEATURES: ReadonlyArray<Feature> = [
  {
    icon: MoveRight,
    title: 'Timeline Komparasi',
    description:
      'Bandingkan biografi salaf dalam satu sumbu Hijri/Masehi. Lihat siapa hidup di masa yang sama, kapan, dan di mana.',
  },
  {
    icon: Map,
    title: 'Peta Interaktif',
    description:
      'Geo-historis perang, hijrah, dan rihlah ulama — dengan klaster, fase, dan tooltip bersumber salaf.',
  },
  {
    icon: BookText,
    title: 'PDF Book Generator',
    description:
      'Buat buku biografi tokoh siap cetak — dengan font Arab klasik, footnotes, dan cover bertema Emerald Turats.',
  },
  {
    icon: Bot,
    title: 'AI Chat Belajar',
    description:
      'Tanya jawab dengan AI yang menahan diri pada sumber salaf — cite-by-default, tanpa konjektur.',
  },
]

export function FeatureGrid() {
  return (
    <section
      className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg))]"
      aria-labelledby="features-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-24">
        <div className="mx-auto max-w-2xl text-center">
          <h2
            id="features-heading"
            className="text-3xl font-semibold tracking-tight text-[rgb(var(--text))] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Fitur Unggulan
          </h2>
          <p className="mt-3 text-base text-[rgb(var(--text-muted))]">
            Empat alat utama untuk menelusuri jejak generasi terbaik.
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature) => {
            const Icon = feature.icon
            return (
              <li key={feature.title}>
                <Card className="h-full transition-shadow hover:shadow-md">
                  <CardHeader>
                    <span
                      aria-hidden="true"
                      className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-[rgb(var(--primary)/0.10)] text-[rgb(var(--primary))]"
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </span>
                    <CardTitle className="mt-3 text-base">{feature.title}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <CardDescription>{feature.description}</CardDescription>
                  </CardContent>
                </Card>
              </li>
            )
          })}
        </ul>
      </div>
    </section>
  )
}
