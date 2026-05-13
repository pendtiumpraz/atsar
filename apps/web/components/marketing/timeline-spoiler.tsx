// Marketing timeline spoiler — a small SVG-based teaser shown on the landing
// page so visitors can see at a glance what "timeline komparatif" means
// without signing up. Hard-coded sample of 6 tokoh across generations,
// rendered as a horizontal bar chart with H/M dual axis. NO interactivity.

import { APP_TAGLINE_ID } from '@athar/shared'

type SpoilerEvent = {
  id: string
  nameId: string
  nameAr: string
  category: string
  birthAh: number // negative = SH (sebelum Hijra)
  deathAh: number
  highlightYear?: number // optional event marker
  highlightLabel?: string
}

// Six iconic figures from each generation, in chronological-by-birth order.
// Numbers are widely-accepted approximate birth/death AH.
const SAMPLE: ReadonlyArray<SpoilerEvent> = [
  {
    id: 'nabi',
    nameId: 'Nabi Muhammad ﷺ',
    nameAr: 'محمد ﷺ',
    category: 'Nabi',
    birthAh: -53,
    deathAh: 11,
    highlightYear: 1,
    highlightLabel: 'Hijrah',
  },
  {
    id: 'abu-bakr',
    nameId: 'Abu Bakr RA',
    nameAr: 'أبو بكر',
    category: 'Sahabat',
    birthAh: -50,
    deathAh: 13,
  },
  {
    id: 'aisyah',
    nameId: 'Aisyah RA',
    nameAr: 'عائشة',
    category: 'Shahabiyat',
    birthAh: -9,
    deathAh: 58,
  },
  {
    id: 'al-hasan',
    nameId: 'Hasan al-Bashri',
    nameAr: 'الحسن البصري',
    category: "Tabi'in",
    birthAh: 21,
    deathAh: 110,
  },
  {
    id: 'bukhari',
    nameId: 'Imam al-Bukhari',
    nameAr: 'البخاري',
    category: "Tabi'ut Tabi'in",
    birthAh: 194,
    deathAh: 256,
  },
  {
    id: 'ibn-taymiyyah',
    nameId: 'Ibn Taimiyyah',
    nameAr: 'ابن تيمية',
    category: 'Pasca-Salaf',
    birthAh: 661,
    deathAh: 728,
  },
]

const MIN_YEAR = -60 // a bit before Nabi's birth
const MAX_YEAR = 740 // a bit after Ibn Taimiyyah's death
const RANGE = MAX_YEAR - MIN_YEAR
const ROW_HEIGHT = 56
const PADDING_X = 64
const PADDING_TOP = 56
const PADDING_BOTTOM = 32
const SVG_WIDTH = 880

const SVG_HEIGHT = PADDING_TOP + SAMPLE.length * ROW_HEIGHT + PADDING_BOTTOM

function yearToX(year: number, width: number): number {
  const usable = width - PADDING_X * 2
  return PADDING_X + ((year - MIN_YEAR) / RANGE) * usable
}

// Axis ticks every 100 H plus the Hijrah baseline (year 0).
const TICKS = [0, 100, 200, 300, 400, 500, 600, 700]

export function TimelineSpoiler() {
  return (
    <section
      className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg))]"
      aria-labelledby="timeline-spoiler-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[rgb(var(--accent))]">
            Spoiler · Timeline Komparatif
          </p>
          <h2
            id="timeline-spoiler-heading"
            className="mt-2 text-3xl font-semibold tracking-tight text-[rgb(var(--text))] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Bandingkan masa hidup
            <br />
            di satu sumbu waktu
          </h2>
          <p className="mt-3 text-base text-[rgb(var(--text-muted))]">
            {APP_TAGLINE_ID} — di dalam aplikasi, sumbu ini interaktif:
            zoom, drag, dan tambah hingga 5 tokoh sekaligus.
          </p>
        </div>

        <figure className="mt-10 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-sm sm:p-6">
          <svg
            viewBox={`0 0 ${SVG_WIDTH} ${SVG_HEIGHT}`}
            role="img"
            aria-label="Contoh timeline komparatif 6 tokoh dari masa Rasulullah ﷺ hingga Ibn Taimiyyah rahimahullah"
            className="h-auto w-full"
          >
            {/* Axis line */}
            <line
              x1={PADDING_X}
              y1={PADDING_TOP - 16}
              x2={SVG_WIDTH - PADDING_X}
              y2={PADDING_TOP - 16}
              stroke="rgb(var(--border))"
              strokeWidth={1}
            />
            {/* Axis ticks */}
            {TICKS.map((t) => {
              const x = yearToX(t, SVG_WIDTH)
              return (
                <g key={t}>
                  <line
                    x1={x}
                    y1={PADDING_TOP - 20}
                    x2={x}
                    y2={PADDING_TOP - 12}
                    stroke="rgb(var(--border))"
                    strokeWidth={1}
                  />
                  <text
                    x={x}
                    y={PADDING_TOP - 26}
                    textAnchor="middle"
                    fontSize={11}
                    fill="rgb(var(--text-muted))"
                    fontFamily="var(--font-body-latin)"
                  >
                    {t === 0 ? '1 H' : `${t} H`}
                  </text>
                </g>
              )
            })}

            {/* Hijrah baseline */}
            <line
              x1={yearToX(0, SVG_WIDTH)}
              y1={PADDING_TOP - 16}
              x2={yearToX(0, SVG_WIDTH)}
              y2={SVG_HEIGHT - PADDING_BOTTOM}
              stroke="rgb(var(--accent))"
              strokeOpacity={0.35}
              strokeWidth={1}
              strokeDasharray="3 3"
            />

            {/* Bars */}
            {SAMPLE.map((row, i) => {
              const y = PADDING_TOP + i * ROW_HEIGHT
              const x1 = yearToX(row.birthAh, SVG_WIDTH)
              const x2 = yearToX(row.deathAh, SVG_WIDTH)
              const barY = y + 16
              return (
                <g key={row.id}>
                  {/* Row separator */}
                  {i > 0 && (
                    <line
                      x1={PADDING_X}
                      y1={y}
                      x2={SVG_WIDTH - PADDING_X}
                      y2={y}
                      stroke="rgb(var(--border))"
                      strokeOpacity={0.4}
                      strokeWidth={1}
                    />
                  )}
                  {/* Label (left) */}
                  <text
                    x={PADDING_X - 12}
                    y={y + 20}
                    textAnchor="end"
                    fontSize={13}
                    fontWeight={600}
                    fill="rgb(var(--text))"
                    fontFamily="var(--font-body-latin)"
                  >
                    {row.nameId}
                  </text>
                  <text
                    x={PADDING_X - 12}
                    y={y + 34}
                    textAnchor="end"
                    fontSize={11}
                    fill="rgb(var(--text-muted))"
                    fontFamily="var(--font-body-latin)"
                  >
                    {row.category} · {row.birthAh < 0 ? `${-row.birthAh} SH` : `${row.birthAh} H`} –{' '}
                    {row.deathAh} H
                  </text>

                  {/* Bar */}
                  <rect
                    x={x1}
                    y={barY}
                    width={Math.max(2, x2 - x1)}
                    height={14}
                    rx={4}
                    fill="rgb(var(--primary))"
                    fillOpacity={0.78}
                  />
                  {/* Birth & death endpoints */}
                  <circle cx={x1} cy={barY + 7} r={4} fill="rgb(var(--primary))" />
                  <circle cx={x2} cy={barY + 7} r={4} fill="rgb(var(--text-muted))" />

                  {/* Optional highlight marker (e.g., Hijrah for Nabi) */}
                  {row.highlightYear !== undefined && (
                    <g>
                      <circle
                        cx={yearToX(row.highlightYear, SVG_WIDTH)}
                        cy={barY + 7}
                        r={5}
                        fill="rgb(var(--accent))"
                      />
                      {row.highlightLabel && (
                        <text
                          x={yearToX(row.highlightYear, SVG_WIDTH) + 10}
                          y={barY + 4}
                          fontSize={10}
                          fill="rgb(var(--accent))"
                          fontFamily="var(--font-body-latin)"
                        >
                          {row.highlightLabel}
                        </text>
                      )}
                    </g>
                  )}
                </g>
              )
            })}
          </svg>

          <figcaption className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-[rgb(var(--text-muted))]">
            <span>
              ● Lahir &nbsp; ● Wafat &nbsp; <span className="text-[rgb(var(--accent))]">●</span>{' '}
              Peristiwa penting
            </span>
            <span>
              Garis putus-putus = 1 H (Hijrah Rasulullah ﷺ ke Madinah)
            </span>
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
