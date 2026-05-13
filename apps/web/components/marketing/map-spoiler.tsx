// Marketing map spoiler — a stylized SVG region map showing iconic locations
// from the era of Rasulullah ﷺ through the salaf. Pure SVG, no MapLibre,
// no network requests — keeps landing performance crisp. Real interactive
// map at /map post-login.

type SpoilerLocation = {
  id: string
  nameId: string
  nameAr: string
  // Approximate position in SVG-space (viewBox 0 0 800 480),
  // hand-tuned to read as "the Middle East" without being a real geo projection.
  cx: number
  cy: number
  note?: string
}

const LOCATIONS: ReadonlyArray<SpoilerLocation> = [
  { id: 'makkah', nameId: 'Mekkah', nameAr: 'مكة', cx: 360, cy: 320, note: 'Kelahiran Nabi ﷺ' },
  { id: 'madinah', nameId: 'Madinah', nameAr: 'المدينة', cx: 372, cy: 282 },
  { id: 'badr', nameId: 'Badar', nameAr: 'بدر', cx: 338, cy: 290, note: 'Perang Badar' },
  { id: 'al-quds', nameId: 'Al-Quds', nameAr: 'القدس', cx: 305, cy: 222 },
  { id: 'damascus', nameId: 'Damaskus', nameAr: 'دمشق', cx: 330, cy: 198 },
  { id: 'yarmuk', nameId: 'Yarmuk', nameAr: 'اليرموك', cx: 318, cy: 213, note: 'Perang Yarmuk' },
  { id: 'baghdad', nameId: 'Baghdad', nameAr: 'بغداد', cx: 432, cy: 210 },
  { id: 'kufah', nameId: 'Kufah', nameAr: 'الكوفة', cx: 420, cy: 220 },
  { id: 'bashrah', nameId: 'Bashrah', nameAr: 'البصرة', cx: 460, cy: 250 },
  { id: 'qadisiyyah', nameId: 'Qadisiyyah', nameAr: 'القادسية', cx: 416, cy: 232 },
  { id: 'bukhara', nameId: 'Bukhara', nameAr: 'بخارى', cx: 612, cy: 158, note: 'Imam Bukhari' },
  { id: 'naysabur', nameId: 'Naysabur', nameAr: 'نيسابور', cx: 552, cy: 192, note: 'Imam Muslim' },
  { id: 'fustat', nameId: 'Fustat', nameAr: 'الفسطاط', cx: 240, cy: 280 },
  { id: 'cordoba', nameId: 'Cordoba', nameAr: 'قرطبة', cx: 50, cy: 200 },
  { id: 'shanaa', nameId: "Shan'a", nameAr: 'صنعاء', cx: 410, cy: 400 },
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
            wafat. Di dalam aplikasi, peta ini bisa zoom hingga koordinat
            individual + overlay rute hijrah dan medan perang.
          </p>
        </div>

        <figure className="mt-10 overflow-hidden rounded-xl border border-[rgb(var(--border))] bg-[rgb(var(--surface))] p-4 shadow-sm sm:p-6">
          <svg
            viewBox="0 0 800 480"
            role="img"
            aria-label="Contoh peta region Hijaz, Syam, Iraq, Khurasan, Misr, dan Andalusia dengan 15 lokasi penting sirah"
            className="h-auto w-full"
          >
            <defs>
              <linearGradient id="land-grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="rgb(var(--bg-elevated))" />
                <stop offset="100%" stopColor="rgb(var(--bg))" />
              </linearGradient>
              <radialGradient id="pin-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="rgb(var(--accent))" stopOpacity="0.6" />
                <stop offset="100%" stopColor="rgb(var(--accent))" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Stylized region outline — abstract, NOT geographically accurate.
                Represents Andalusia → Misr → Hijaz → Syam → Iraq → Khurasan.
                Drawn as a soft horizontal landmass band. */}
            <path
              d="M 20 180
                 Q 90 150 180 175
                 L 240 220
                 Q 310 195 380 215
                 L 450 245
                 Q 540 215 640 175
                 Q 720 155 780 175
                 L 780 360
                 Q 700 400 600 380
                 Q 500 360 420 380
                 L 360 420
                 Q 280 400 200 410
                 Q 100 415 20 380 Z"
              fill="url(#land-grad)"
              stroke="rgb(var(--border))"
              strokeWidth={1.5}
            />

            {/* Region labels — subtle */}
            <text
              x={70}
              y={235}
              fontSize={11}
              fontWeight={600}
              fill="rgb(var(--text-muted))"
              fontFamily="var(--font-body-latin)"
              opacity={0.7}
            >
              ANDALUSIA
            </text>
            <text
              x={228}
              y={328}
              fontSize={11}
              fontWeight={600}
              fill="rgb(var(--text-muted))"
              fontFamily="var(--font-body-latin)"
              opacity={0.7}
            >
              MISR
            </text>
            <text
              x={310}
              y={356}
              fontSize={11}
              fontWeight={600}
              fill="rgb(var(--text-muted))"
              fontFamily="var(--font-body-latin)"
              opacity={0.7}
            >
              HIJAZ
            </text>
            <text
              x={315}
              y={182}
              fontSize={11}
              fontWeight={600}
              fill="rgb(var(--text-muted))"
              fontFamily="var(--font-body-latin)"
              opacity={0.7}
            >
              SYAM
            </text>
            <text
              x={430}
              y={196}
              fontSize={11}
              fontWeight={600}
              fill="rgb(var(--text-muted))"
              fontFamily="var(--font-body-latin)"
              opacity={0.7}
            >
              IRAQ
            </text>
            <text
              x={580}
              y={142}
              fontSize={11}
              fontWeight={600}
              fill="rgb(var(--text-muted))"
              fontFamily="var(--font-body-latin)"
              opacity={0.7}
            >
              KHURASAN
            </text>

            {/* Hijrah route — dashed line Mekkah → Madinah */}
            <path
              d="M 360 320 Q 358 300 372 282"
              stroke="rgb(var(--accent))"
              strokeWidth={1.5}
              strokeDasharray="4 3"
              fill="none"
              opacity={0.7}
            />

            {/* Pins */}
            {LOCATIONS.map((loc) => (
              <g key={loc.id}>
                {/* Glow */}
                <circle cx={loc.cx} cy={loc.cy} r={14} fill="url(#pin-glow)" />
                {/* Pin */}
                <circle
                  cx={loc.cx}
                  cy={loc.cy}
                  r={5}
                  fill="rgb(var(--primary))"
                  stroke="rgb(var(--surface))"
                  strokeWidth={1.5}
                />
                {/* Label */}
                <text
                  x={loc.cx + 8}
                  y={loc.cy - 6}
                  fontSize={11}
                  fontWeight={500}
                  fill="rgb(var(--text))"
                  fontFamily="var(--font-body-latin)"
                >
                  {loc.nameId}
                </text>
              </g>
            ))}

            {/* Legend (bottom-right) */}
            <g transform="translate(560, 420)">
              <rect
                x={0}
                y={0}
                width={210}
                height={42}
                rx={6}
                fill="rgb(var(--surface))"
                stroke="rgb(var(--border))"
                strokeWidth={1}
              />
              <circle cx={14} cy={14} r={4} fill="rgb(var(--primary))" />
              <text
                x={26}
                y={18}
                fontSize={11}
                fill="rgb(var(--text-muted))"
                fontFamily="var(--font-body-latin)"
              >
                Lokasi penting
              </text>
              <line
                x1={4}
                y1={30}
                x2={24}
                y2={30}
                stroke="rgb(var(--accent))"
                strokeWidth={1.5}
                strokeDasharray="4 3"
              />
              <text
                x={28}
                y={34}
                fontSize={11}
                fill="rgb(var(--text-muted))"
                fontFamily="var(--font-body-latin)"
              >
                Rute Hijrah Nabi ﷺ
              </text>
            </g>
          </svg>

          <figcaption className="mt-4 text-xs text-[rgb(var(--text-muted))]">
            Ilustrasi region — bukan proyeksi geografis akurat. Peta di dalam
            aplikasi pakai tile OpenStreetMap dengan koordinat presisi tiap
            lokasi.
          </figcaption>
        </figure>
      </div>
    </section>
  )
}
