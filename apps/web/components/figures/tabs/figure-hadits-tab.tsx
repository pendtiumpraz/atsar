// Tab "Hadits" — surfaces the figure's narrator-status summary and helpful
// outbound links to dedicated hadith libraries.
//
// Atsar is not a hadith database; the schema only stores
// `hadithCountMin`/`hadithCountMax` (best-effort estimates from rijal
// literature). When those are populated we render them as the prominent
// number. We then offer search links into Sunnah.com / Dorar / Shamela so
// users can pivot to reading the actual matn.

'use client'

import type { FigureDetailData } from '../figure-detail'

export interface FigureHaditsTabProps {
  data: FigureDetailData
}

/**
 * Best-effort transliteration suitable for outbound URL search params.
 * We don't ship a real ICU romanizer (out of scope for this tab); we
 * fall back to the Indonesian latin name which is already a usable
 * transliteration in the seed data.
 */
function searchName(data: FigureDetailData): string {
  return (
    data.nameShortId ||
    data.nameFullId ||
    data.nameShortAr ||
    data.nameFullAr ||
    data.slug
  )
}

function isNarrator(rijal: string | null | undefined): boolean {
  if (!rijal) return false
  return rijal !== 'not_narrator' && rijal !== 'unverified'
}

export function FigureHaditsTab({ data }: FigureHaditsTabProps) {
  const { hadithCountMin, hadithCountMax, rijalGrade } = data
  const hasCount = typeof hadithCountMin === 'number' || typeof hadithCountMax === 'number'
  const name = searchName(data)

  // If the figure is explicitly marked as NOT a narrator we lead with that.
  if (!hasCount && rijalGrade === 'not_narrator') {
    return (
      <EmptyState
        title="Tokoh ini tidak diketahui sebagai perawi hadits"
        body="Berdasarkan kitab rijal yang dirujuk, tokoh ini tidak tercatat sebagai perawi hadits."
      />
    )
  }

  if (!hasCount && !isNarrator(rijalGrade)) {
    return (
      <EmptyState
        title="Belum ada data hadits"
        body="Estimasi jumlah hadits riwayat tokoh ini belum tersedia. Data akan diperbarui setelah review rujukan rijal selesai."
      />
    )
  }

  // Build a display label for the count.
  let countLabel: string | null = null
  if (typeof hadithCountMin === 'number' && typeof hadithCountMax === 'number') {
    if (hadithCountMin === hadithCountMax) {
      countLabel = `${hadithCountMin.toLocaleString('id-ID')} hadits`
    } else {
      countLabel = `${hadithCountMin.toLocaleString('id-ID')} – ${hadithCountMax.toLocaleString('id-ID')} hadits`
    }
  } else if (typeof hadithCountMin === 'number') {
    countLabel = `≈ ${hadithCountMin.toLocaleString('id-ID')} hadits`
  } else if (typeof hadithCountMax === 'number') {
    countLabel = `≈ ${hadithCountMax.toLocaleString('id-ID')} hadits`
  }

  const searchEncoded = encodeURIComponent(name)
  const searchAr = encodeURIComponent(data.nameFullAr ?? name)

  return (
    <div className="flex flex-col gap-4">
      {countLabel ? (
        <div className="rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-4">
          <div className="text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
            Estimasi periwayatan
          </div>
          <div className="mt-1 text-2xl font-semibold text-[rgb(var(--text))]">{countLabel}</div>
          <p className="mt-1 text-xs text-[rgb(var(--text-muted))]">
            Estimasi berdasarkan kitab rijal yang dirujuk. Untuk membaca matn lengkap, gunakan
            tautan ke pustaka hadits di bawah.
          </p>
        </div>
      ) : null}

      <section className="flex flex-col gap-2">
        <h3 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
          Cari hadits riwayat {name}
        </h3>
        <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          <ExternalLinkCard
            label="Sunnah.com"
            description="Pencarian hadits berbahasa Inggris-Arab, mendukung filter perawi."
            href={`https://sunnah.com/search?q=${searchEncoded}`}
          />
          <ExternalLinkCard
            label="Dorar.net"
            description="Mausu'ah hadits berbahasa Arab dengan derajat sanad."
            href={`https://dorar.net/hadith/search?q=${searchAr}`}
          />
          <ExternalLinkCard
            label="Shamela"
            description="Maktabah Syamilah — kitab hadits dan rijal lengkap."
            href={`https://shamela.ws/search?q=${searchAr}`}
          />
          <ExternalLinkCard
            label="HadithDB.com"
            description="Indeks perawi & jalur sanad."
            href={`https://hadithdb.com/?search=${searchEncoded}`}
          />
        </ul>
        <p className="text-xs text-[rgb(var(--text-faint))]">
          Tautan eksternal terbuka di tab baru. Atsar tidak menyimpan matn hadits — kami merujuk
          pengguna ke pustaka hadits yang sudah mapan.
        </p>
      </section>
    </div>
  )
}

function ExternalLinkCard({
  label,
  description,
  href,
}: {
  label: string
  description: string
  href: string
}) {
  return (
    <li>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="block rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2 text-sm transition-colors hover:border-[rgb(var(--primary))] hover:bg-[rgb(var(--surface))]"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="font-medium text-[rgb(var(--text))]">{label}</span>
          <span aria-hidden className="text-xs text-[rgb(var(--text-muted))]">
            ↗
          </span>
        </div>
        <div className="mt-0.5 text-xs text-[rgb(var(--text-muted))]">{description}</div>
      </a>
    </li>
  )
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] p-6 text-sm text-[rgb(var(--text-muted))]">
      <div className="mb-1 font-semibold text-[rgb(var(--text))]">{title}</div>
      <p>{body}</p>
    </div>
  )
}
