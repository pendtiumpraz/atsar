// Marketing map spoiler — section heading + intro + a REAL interactive MapLibre
// canvas. The canvas itself lives in a sibling client component
// (`./map-spoiler-interactive`) loaded via `next/dynamic({ ssr: false })`
// because MapLibre touches `window` at module load.
//
// What this server component owns:
//   - Section chrome (border, padding, heading, intro copy).
//   - The legend (color swatches for the historical regions) — rendered in the
//     server tree so it ships as plain HTML even before the map JS arrives.
//   - The dynamic import + skeleton placeholder.
//
// The interactive map shows:
//   - CARTO Voyager (light) / Dark Matter (dark) raster basemap, theme-aware.
//   - Translucent polygons for Hijaz / Najd / Yemen / Syam / Iraq / Misr /
//     Khurasan / Andalusia / Maghrib with inline labels.
//   - 15 city pins with hover/click popup.
//   - Hijrah route Mekkah → Madinah (dashed).
//   - Zoom + scale controls; users can zoom out to the world to compare with
//     modern geography.

import { MapSpoilerLoader } from './map-spoiler-loader'

// Region label/color metadata for the legend. Must stay in sync with the
// `REGIONS` array in `./map-spoiler-interactive`. Kept duplicated (rather than
// re-exported) so the server bundle does not pull the maplibre import chain.
const LEGEND_REGIONS: ReadonlyArray<{ label: string; color: string }> = [
  { label: 'Hijaz', color: '#10b981' },
  { label: 'Najd', color: '#f59e0b' },
  { label: 'Yaman', color: '#ef4444' },
  { label: 'Syam', color: '#8b5cf6' },
  { label: 'Iraq', color: '#0ea5e9' },
  { label: 'Misr', color: '#d97706' },
  { label: 'Khurasan', color: '#14b8a6' },
  { label: 'Andalusia', color: '#ec4899' },
  { label: 'Maghrib', color: '#84cc16' },
]

export function MapSpoiler() {
  return (
    <section
      className="border-t border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]"
      aria-labelledby="map-spoiler-heading"
    >
      <div className="mx-auto w-full max-w-6xl px-4 py-16 sm:px-6 lg:py-20">
        <div className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-[rgb(var(--accent))]">
            Spoiler · Peta Interaktif
          </p>
          <h2
            id="map-spoiler-heading"
            className="mt-2 text-3xl font-semibold tracking-tight text-[rgb(var(--text))] sm:text-4xl"
            style={{ fontFamily: 'var(--font-display-latin)' }}
          >
            Pahami sirah lewat geografi
          </h2>
          <p className="mt-3 text-base text-[rgb(var(--text-muted))]">
            Setiap tokoh punya jejak lokasi — kelahiran, hijrah, dakwah, hingga
            wafat. Region historis seperti Hijaz, Syam, Iraq, dan Khurasan
            terbentang di peta dunia modern; zoom out untuk membandingkan dengan
            negara saat ini.
          </p>
        </div>

        <figure className="mt-10 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-sm sm:p-6">
          <MapSpoilerLoader />

          {/* Legend — color-coded list of region swatches. Rendered server-side
              so it is visible even before the map JS finishes loading. */}
          <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2">
            {LEGEND_REGIONS.map((r) => (
              <span
                key={r.label}
                className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--text-muted))]"
              >
                <span
                  aria-hidden
                  className="inline-block h-3 w-3 rounded-sm border border-[rgb(var(--border))]"
                  style={{ backgroundColor: r.color, opacity: 0.6 }}
                />
                {r.label}
              </span>
            ))}
            <span className="inline-flex items-center gap-1.5 text-xs text-[rgb(var(--text-muted))]">
              <span
                aria-hidden
                className="inline-block h-[2px] w-5"
                style={{
                  background:
                    'repeating-linear-gradient(90deg, rgb(var(--accent)) 0 4px, transparent 4px 8px)',
                }}
              />
              Rute Hijrah Nabi ﷺ
            </span>
          </div>

          <figcaption className="mt-3 text-xs text-[rgb(var(--text-muted))]">
            Batas region adalah aproksimasi — bukan batas politik. Peta di dalam
            aplikasi menampilkan koordinat presisi tiap tokoh.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
