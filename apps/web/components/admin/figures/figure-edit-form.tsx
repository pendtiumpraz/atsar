// `<FigureEditForm />` — full-surface admin edit form covering every field
// that feeds the 5 public detail tabs (Biografi, Timeline, Peta, Hubungan,
// Hadits) plus Sumber/Citation, plus an Identitas & Status panel up top.
//
// Layout: 7 accordion-style panels.
//
//   Panel A — Identitas & Status   (always open by default)
//   Panel B — Biografi
//   Panel C — Timeline (+ linked battles subform)
//   Panel D — Peta (+ figure_locations M2M subform)
//   Panel E — Hubungan (relations list + add-relation subform)
//   Panel F — Hadits & Rijal
//   Panel G — Sumber / Citation
//
// Save model:
//   - Simple column fields (panels A, B, C dates, D primary FKs, F, etc.)
//     are batched into ONE PATCH /figures/[slug] when admin hits Simpan.
//   - M2M tables (figure_locations, figure_relations, battle_participants,
//     citations) save INLINE per row through their dedicated admin endpoints.
//     This lets admin add a relation without committing pending edits to
//     the simple fields.
//
// Why no shadcn <Accordion>? The project's components/ui/ doesn't ship one
// and the constraint forbids new deps. We build a tiny inline accordion
// using <details><summary> styled to match the rest of the admin shell.
//
// Indonesian labels throughout. Every input has an associated <Label>.

'use client'

import * as React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  Loader2,
  Plus,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { toast } from 'sonner'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { api, ApiClientError } from '@/lib/api/client'
import { confirm } from '@/lib/swal'
import {
  FigureAutocomplete,
  type FigureOption,
} from '@/components/admin/figures/autocomplete-figures'
import {
  LocationAutocomplete,
  type LocationOption,
} from '@/components/admin/locations/autocomplete-locations'
import {
  BattleAutocomplete,
  type BattleOption,
} from '@/components/admin/battles/autocomplete-battles'

// ─── Shared enum types ─────────────────────────────────────────────────

type Status =
  | 'draft'
  | 'under_review'
  | 'needs_edit'
  | 'approved'
  | 'published'
  | 'unpublished'
  | 'archived'

type Gender = 'male' | 'female'

type DatePrecision = 'year' | 'month' | 'day' | 'approximate' | 'range'

type DeathCause = 'natural' | 'martyr' | 'killed' | 'unknown'

type Madhab = 'shafii' | 'maliki' | 'hanafi' | 'hanbali' | 'zhahiri' | 'no_madhab'

type SocialCategory =
  | 'anshar'
  | 'muhajirin'
  | 'qurasy'
  | 'arab_non_qurasy'
  | 'mawla'
  | 'non_arab'
  | 'other'

type RijalGrade =
  | 'sahabi_udul'
  | 'thiqah_thiqah'
  | 'thiqah_hafidz'
  | 'thiqah'
  | 'saduq'
  | 'la_basa_bih'
  | 'shalih_al_hadith'
  | 'layyin'
  | 'daif'
  | 'matruk'
  | 'kadhdhab'
  | 'not_narrator'
  | 'unverified'

type FigureLocationRole = 'birthplace' | 'residence' | 'dakwah' | 'martyr' | 'burial'

type RelationType =
  | 'teacher_of'
  | 'student_of'
  | 'father'
  | 'mother'
  | 'husband'
  | 'wife'
  | 'son'
  | 'daughter'
  | 'sibling'
  | 'companion'
  | 'descendant'
  | 'ancestor'

type BattleRole =
  | 'commander'
  | 'sub_commander'
  | 'sahabat'
  | 'fallen'
  | 'wounded'
  | 'captured'
  | 'witness'
  | 'flag_bearer'
  | 'envoy'

// ─── Label dictionaries ────────────────────────────────────────────────

const STATUS_LABEL: Record<Status, string> = {
  draft: 'Draf',
  under_review: 'Sedang Review',
  needs_edit: 'Perlu Edit',
  approved: 'Disetujui',
  published: 'Terbit',
  unpublished: 'Tidak Terbit',
  archived: 'Diarsipkan',
}

const STATUS_VARIANT: Record<Status, 'default' | 'secondary' | 'destructive' | 'outline'> = {
  draft: 'outline',
  under_review: 'secondary',
  needs_edit: 'destructive',
  approved: 'secondary',
  published: 'default',
  unpublished: 'outline',
  archived: 'outline',
}

const DATE_PRECISION_LABEL: Record<DatePrecision, string> = {
  year: 'Tahun saja',
  month: 'Bulan',
  day: 'Tanggal lengkap',
  approximate: 'Perkiraan',
  range: 'Rentang',
}

const DEATH_CAUSE_LABEL: Record<DeathCause, string> = {
  natural: 'Wafat biasa',
  martyr: 'Syahid',
  killed: 'Dibunuh',
  unknown: 'Tidak diketahui',
}

const MADHAB_LABEL: Record<Madhab, string> = {
  shafii: "Syafi'i",
  maliki: 'Maliki',
  hanafi: 'Hanafi',
  hanbali: 'Hanbali',
  zhahiri: 'Zhahiri',
  no_madhab: 'Tanpa madzhab',
}

const SOCIAL_CATEGORY_LABEL: Record<SocialCategory, string> = {
  anshar: 'Anshar',
  muhajirin: 'Muhajirin',
  qurasy: 'Quraisy',
  arab_non_qurasy: 'Arab non-Quraisy',
  mawla: 'Mawla',
  non_arab: 'Non-Arab',
  other: 'Lainnya',
}

const RIJAL_LABEL: Record<RijalGrade, string> = {
  sahabi_udul: "Sahabat ('udul — otomatis adil)",
  thiqah_thiqah: 'Tsiqah Tsiqah (sangat terpercaya)',
  thiqah_hafidz: 'Tsiqah Hafidz (terpercaya & kuat hafalan)',
  thiqah: 'Tsiqah (terpercaya)',
  saduq: 'Shaduq (jujur, ada sedikit kekeliruan)',
  la_basa_bih: 'La ba’sa bih (tidak mengapa)',
  shalih_al_hadith: 'Shalih al-hadits (haditsnya layak)',
  layyin: 'Layyin (lembek)',
  daif: "Dha'if (lemah)",
  matruk: 'Matruk (ditinggalkan)',
  kadhdhab: 'Kadzab (pendusta)',
  not_narrator: 'Bukan periwayat',
  unverified: 'Belum diverifikasi',
}

const RIJAL_HINT: Record<RijalGrade, string> = {
  sahabi_udul: "Sahabat Nabi — dianggap adil otomatis.",
  thiqah_thiqah: 'Penilaian tertinggi untuk perawi non-sahabat.',
  thiqah_hafidz: 'Hadits diterima, hafalan kuat.',
  thiqah: 'Hadits diterima.',
  saduq: 'Hadits hasan, perlu pengkajian sanad lain.',
  la_basa_bih: 'Sedikit di bawah Shaduq; bisa dipakai i’tibar.',
  shalih_al_hadith: 'Hadits layak ditulis, perlu syawahid.',
  layyin: 'Hadits lemah, hanya untuk i’tibar.',
  daif: 'Hadits lemah, tidak dipakai sebagai hujjah.',
  matruk: 'Tertuduh dusta atau berat kelemahan—ditinggalkan.',
  kadhdhab: 'Terbukti memalsukan hadits.',
  not_narrator: 'Tokoh ini tidak meriwayatkan hadits.',
  unverified: 'Belum dinilai.',
}

const FIGURE_LOCATION_ROLE_LABEL: Record<FigureLocationRole, string> = {
  birthplace: 'Tempat lahir',
  residence: 'Domisili',
  dakwah: 'Lokasi dakwah',
  martyr: 'Tempat wafat / gugur',
  burial: 'Tempat pemakaman',
}

const RELATION_TYPE_LABEL: Record<RelationType, string> = {
  teacher_of: 'Guru dari',
  student_of: 'Murid dari',
  father: 'Ayah dari',
  mother: 'Ibu dari',
  husband: 'Suami dari',
  wife: 'Istri dari',
  son: 'Anak laki-laki dari',
  daughter: 'Anak perempuan dari',
  sibling: 'Saudara dari',
  companion: 'Sahabat seangkatan',
  ancestor: 'Leluhur dari',
  descendant: 'Keturunan dari',
}

const BATTLE_ROLE_LABEL: Record<BattleRole, string> = {
  commander: 'Komandan',
  sub_commander: 'Wakil komandan',
  sahabat: 'Peserta (sahabat)',
  fallen: 'Syuhada / gugur',
  wounded: 'Terluka',
  captured: 'Tertawan',
  witness: 'Saksi',
  flag_bearer: 'Pembawa panji',
  envoy: 'Utusan',
}

// ─── Types for `initial` prop ──────────────────────────────────────────

export interface FigureCategoryOption {
  id: string
  slug: string
  nameId: string
}

export interface FigureLocationRow {
  id: string
  role: FigureLocationRole
  location: {
    id: string
    slug: string
    nameId: string
    nameAr: string | null
    modernName: string | null
    region: string | null
    countryCode: string | null
  }
}

export interface FigureRelationRow {
  id: string
  relationType: RelationType
  related: {
    id: string
    slug: string
    nameFullId: string
    nameFullAr: string | null
    nameShortId: string | null
  }
}

export interface FigureBattleRow {
  battleId: string
  slug: string
  nameId: string
  nameAr: string
  eventDateAh: number | null
  eventDateCe: number | null
  role: BattleRole
}

export interface FigureCitationRow {
  id: string
  sourceUrl: string
  sourceDomain: string | null
  fieldPath: string | null
  confidenceScore: string | null
  sourceExcerptId: string | null
  sourceLang: 'ar' | 'id' | 'en' | null
}

export interface FigureEditFormInitial {
  // Identitas
  id: string
  slug: string
  categoryId: string
  gender: Gender
  nameFullId: string
  nameFullAr: string
  nameShortId: string | null
  nameShortAr: string | null
  kunyahId: string | null
  kunyahAr: string | null
  laqabId: string | null
  laqabAr: string | null
  status: Status
  publishedAt: string | null

  // Biografi
  summaryId: string | null
  summaryAr: string | null
  biographyPreWafatId: string | null
  biographyPreWafatAr: string | null
  biographyPostWafatId: string | null
  biographyPostWafatAr: string | null
  biographyId: string | null
  biographyAr: string | null

  // Timeline
  birthDateAh: number | null
  birthDateCe: number | null
  birthDatePrecision: DatePrecision | null
  birthDateNotes: string | null
  deathDateAh: number | null
  deathDateCe: number | null
  deathDatePrecision: DatePrecision | null
  deathDateNotes: string | null

  // Peta — direct FKs (admin sets these via autocomplete)
  primaryLocation: LocationOption | null
  deathLocation: LocationOption | null
  burialLocation: LocationOption | null
  figureLocations: FigureLocationRow[]

  // Hubungan
  relations: FigureRelationRow[]

  // Battles (timeline subform)
  battleParticipations: FigureBattleRow[]

  // Hadits & Rijal
  hadithCountMin: number | null
  hadithCountMax: number | null
  rijalGrade: RijalGrade
  rijalNotesId: string | null
  rijalNotesAr: string | null
  specialty: string[] | null
  madhab: Madhab | null
  socialCategory: SocialCategory[] | null
  deathCause: DeathCause | null

  // Sumber
  citations: FigureCitationRow[]
}

export interface FigureEditFormProps {
  initial: FigureEditFormInitial
  /** Active figure_categories rows (for the dropdown). */
  categories: FigureCategoryOption[]
  /** Active whitelist domains (for the "Cek whitelist" indicator). */
  whitelistDomains: string[]
}

// ─── Helpers ───────────────────────────────────────────────────────────

function numOrNull(v: string): number | null {
  if (v.trim() === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? Math.trunc(n) : null
}

function emptyToNull(v: string | null | undefined): string | null {
  if (v == null) return null
  const t = v.trim()
  return t.length === 0 ? null : t
}

function extractDomain(rawUrl: string): string | null {
  try {
    return new URL(rawUrl).hostname.toLowerCase()
  } catch {
    return null
  }
}

// ─── The form ──────────────────────────────────────────────────────────

export function FigureEditForm({ initial, categories, whitelistDomains }: FigureEditFormProps) {
  const router = useRouter()

  // ── Panel A — Identitas ───────────────────────────────────────────────
  const [nameFullId, setNameFullId] = React.useState(initial.nameFullId)
  const [nameFullAr, setNameFullAr] = React.useState(initial.nameFullAr)
  const [nameShortId, setNameShortId] = React.useState(initial.nameShortId ?? '')
  const [nameShortAr, setNameShortAr] = React.useState(initial.nameShortAr ?? '')
  const [kunyahId, setKunyahId] = React.useState(initial.kunyahId ?? '')
  const [kunyahAr, setKunyahAr] = React.useState(initial.kunyahAr ?? '')
  const [laqabId, setLaqabId] = React.useState(initial.laqabId ?? '')
  const [laqabAr, setLaqabAr] = React.useState(initial.laqabAr ?? '')
  const [gender, setGender] = React.useState<Gender>(initial.gender)
  const [categoryId, setCategoryId] = React.useState<string>(initial.categoryId)
  const [status, setStatus] = React.useState<Status>(initial.status)

  // ── Panel B — Biografi ────────────────────────────────────────────────
  const [summaryId, setSummaryId] = React.useState(initial.summaryId ?? '')
  const [summaryAr, setSummaryAr] = React.useState(initial.summaryAr ?? '')
  const [bioPreId, setBioPreId] = React.useState(initial.biographyPreWafatId ?? '')
  const [bioPreAr, setBioPreAr] = React.useState(initial.biographyPreWafatAr ?? '')
  const [bioPostId, setBioPostId] = React.useState(initial.biographyPostWafatId ?? '')
  const [bioPostAr, setBioPostAr] = React.useState(initial.biographyPostWafatAr ?? '')
  const [bioLegacyId, setBioLegacyId] = React.useState(initial.biographyId ?? '')
  const [bioLegacyAr, setBioLegacyAr] = React.useState(initial.biographyAr ?? '')

  // ── Panel C — Timeline (dates only — battles are M2M, see below) ──────
  const [birthAh, setBirthAh] = React.useState<string>(
    initial.birthDateAh != null ? String(initial.birthDateAh) : '',
  )
  const [birthCe, setBirthCe] = React.useState<string>(
    initial.birthDateCe != null ? String(initial.birthDateCe) : '',
  )
  const [birthPrecision, setBirthPrecision] = React.useState<DatePrecision | ''>(
    initial.birthDatePrecision ?? '',
  )
  const [birthNotes, setBirthNotes] = React.useState(initial.birthDateNotes ?? '')
  const [deathAh, setDeathAh] = React.useState<string>(
    initial.deathDateAh != null ? String(initial.deathDateAh) : '',
  )
  const [deathCe, setDeathCe] = React.useState<string>(
    initial.deathDateCe != null ? String(initial.deathDateCe) : '',
  )
  const [deathPrecision, setDeathPrecision] = React.useState<DatePrecision | ''>(
    initial.deathDatePrecision ?? '',
  )
  const [deathNotes, setDeathNotes] = React.useState(initial.deathDateNotes ?? '')

  // ── Panel D — Peta ────────────────────────────────────────────────────
  const [primaryLocation, setPrimaryLocation] = React.useState<LocationOption | null>(
    initial.primaryLocation,
  )
  const [deathLocation, setDeathLocation] = React.useState<LocationOption | null>(
    initial.deathLocation,
  )
  const [burialLocation, setBurialLocation] = React.useState<LocationOption | null>(
    initial.burialLocation,
  )
  const [figureLocations, setFigureLocations] = React.useState<FigureLocationRow[]>(
    initial.figureLocations,
  )

  // ── Panel E — Hubungan ────────────────────────────────────────────────
  const [relations, setRelations] = React.useState<FigureRelationRow[]>(initial.relations)

  // ── Panel C(2) — Battle participations ────────────────────────────────
  const [battleParticipations, setBattleParticipations] = React.useState<FigureBattleRow[]>(
    initial.battleParticipations,
  )

  // ── Panel F — Hadits & Rijal ──────────────────────────────────────────
  const [hadithMin, setHadithMin] = React.useState<string>(
    initial.hadithCountMin != null ? String(initial.hadithCountMin) : '',
  )
  const [hadithMax, setHadithMax] = React.useState<string>(
    initial.hadithCountMax != null ? String(initial.hadithCountMax) : '',
  )
  const [rijalGrade, setRijalGrade] = React.useState<RijalGrade>(initial.rijalGrade)
  const [rijalNotesId, setRijalNotesId] = React.useState(initial.rijalNotesId ?? '')
  const [rijalNotesAr, setRijalNotesAr] = React.useState(initial.rijalNotesAr ?? '')
  const [specialty, setSpecialty] = React.useState<string[]>(initial.specialty ?? [])
  const [madhab, setMadhab] = React.useState<Madhab | ''>(initial.madhab ?? '')
  const [socialCategory, setSocialCategory] = React.useState<SocialCategory[]>(
    initial.socialCategory ?? [],
  )
  const [deathCause, setDeathCause] = React.useState<DeathCause | ''>(initial.deathCause ?? '')

  // ── Panel G — Sumber/Citation ─────────────────────────────────────────
  const [citations, setCitations] = React.useState<FigureCitationRow[]>(initial.citations)

  // ── Form-wide save state ──────────────────────────────────────────────
  const [saving, setSaving] = React.useState(false)
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({})

  // Whitelist domain set for the "Cek whitelist" indicator on citations.
  const whitelistSet = React.useMemo(
    () => new Set(whitelistDomains.map((d) => d.toLowerCase())),
    [whitelistDomains],
  )

  // ── Dirty state — warn before navigation if unsaved simple-column edits ──
  // We only track the column fields; M2M tables save inline so they're never
  // "unsaved". Computed via cheap snapshot comparison.

  const liveSnapshot = JSON.stringify({
    nameFullId,
    nameFullAr,
    nameShortId,
    nameShortAr,
    kunyahId,
    kunyahAr,
    laqabId,
    laqabAr,
    gender,
    categoryId,
    status,
    summaryId,
    summaryAr,
    bioPreId,
    bioPreAr,
    bioPostId,
    bioPostAr,
    bioLegacyId,
    bioLegacyAr,
    birthAh,
    birthCe,
    birthPrecision,
    birthNotes,
    deathAh,
    deathCe,
    deathPrecision,
    deathNotes,
    primaryLocationId: primaryLocation?.id ?? null,
    deathLocationId: deathLocation?.id ?? null,
    burialLocationId: burialLocation?.id ?? null,
    hadithMin,
    hadithMax,
    rijalGrade,
    rijalNotesId,
    rijalNotesAr,
    specialty,
    madhab,
    socialCategory,
    deathCause,
  })

  const initialLiveSnapshot = React.useMemo(
    () =>
      JSON.stringify({
        nameFullId: initial.nameFullId,
        nameFullAr: initial.nameFullAr,
        nameShortId: initial.nameShortId ?? '',
        nameShortAr: initial.nameShortAr ?? '',
        kunyahId: initial.kunyahId ?? '',
        kunyahAr: initial.kunyahAr ?? '',
        laqabId: initial.laqabId ?? '',
        laqabAr: initial.laqabAr ?? '',
        gender: initial.gender,
        categoryId: initial.categoryId,
        status: initial.status,
        summaryId: initial.summaryId ?? '',
        summaryAr: initial.summaryAr ?? '',
        bioPreId: initial.biographyPreWafatId ?? '',
        bioPreAr: initial.biographyPreWafatAr ?? '',
        bioPostId: initial.biographyPostWafatId ?? '',
        bioPostAr: initial.biographyPostWafatAr ?? '',
        bioLegacyId: initial.biographyId ?? '',
        bioLegacyAr: initial.biographyAr ?? '',
        birthAh: initial.birthDateAh != null ? String(initial.birthDateAh) : '',
        birthCe: initial.birthDateCe != null ? String(initial.birthDateCe) : '',
        birthPrecision: initial.birthDatePrecision ?? '',
        birthNotes: initial.birthDateNotes ?? '',
        deathAh: initial.deathDateAh != null ? String(initial.deathDateAh) : '',
        deathCe: initial.deathDateCe != null ? String(initial.deathDateCe) : '',
        deathPrecision: initial.deathDatePrecision ?? '',
        deathNotes: initial.deathDateNotes ?? '',
        primaryLocationId: initial.primaryLocation?.id ?? null,
        deathLocationId: initial.deathLocation?.id ?? null,
        burialLocationId: initial.burialLocation?.id ?? null,
        hadithMin: initial.hadithCountMin != null ? String(initial.hadithCountMin) : '',
        hadithMax: initial.hadithCountMax != null ? String(initial.hadithCountMax) : '',
        rijalGrade: initial.rijalGrade,
        rijalNotesId: initial.rijalNotesId ?? '',
        rijalNotesAr: initial.rijalNotesAr ?? '',
        specialty: initial.specialty ?? [],
        madhab: initial.madhab ?? '',
        socialCategory: initial.socialCategory ?? [],
        deathCause: initial.deathCause ?? '',
      }),
    [initial],
  )

  const isDirty = liveSnapshot !== initialLiveSnapshot

  React.useEffect(() => {
    function onBeforeUnload(e: BeforeUnloadEvent) {
      if (!isDirty) return
      e.preventDefault()
      // Modern browsers ignore the message; setting `returnValue` triggers the prompt.
      e.returnValue = ''
    }
    window.addEventListener('beforeunload', onBeforeUnload)
    return () => window.removeEventListener('beforeunload', onBeforeUnload)
  }, [isDirty])

  // ── Save handler — batched PATCH for all simple-column fields ─────────
  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (saving) return
    setFieldErrors({})

    if (status !== initial.status) {
      const toPublished = status === 'published'
      const fromPublished = initial.status === 'published'
      if (toPublished || fromPublished) {
        const ok = await confirm({
          title: toPublished ? 'Publikasikan tokoh?' : 'Ubah status?',
          text: toPublished
            ? `"${initial.nameFullId}" akan tampil di publik.`
            : `Status berubah dari ${STATUS_LABEL[initial.status]} → ${STATUS_LABEL[status]}.`,
          confirmText: toPublished ? 'Publikasikan' : 'Ubah',
          dangerous: fromPublished && !toPublished,
        })
        if (!ok) return
      }
    }

    const body: Record<string, unknown> = {
      // Identitas
      nameFullId: nameFullId.trim(),
      nameFullAr: nameFullAr.trim(),
      nameShortId: emptyToNull(nameShortId),
      nameShortAr: emptyToNull(nameShortAr),
      kunyahId: emptyToNull(kunyahId),
      kunyahAr: emptyToNull(kunyahAr),
      laqabId: emptyToNull(laqabId),
      laqabAr: emptyToNull(laqabAr),
      gender,
      categoryId,
      status,

      // Biografi
      summaryId: emptyToNull(summaryId),
      summaryAr: emptyToNull(summaryAr),
      biographyPreWafatId: emptyToNull(bioPreId),
      biographyPreWafatAr: emptyToNull(bioPreAr),
      biographyPostWafatId: emptyToNull(bioPostId),
      biographyPostWafatAr: emptyToNull(bioPostAr),
      biographyId: emptyToNull(bioLegacyId),
      biographyAr: emptyToNull(bioLegacyAr),

      // Timeline (dates)
      birthDateAh: numOrNull(birthAh),
      birthDateCe: numOrNull(birthCe),
      birthDatePrecision: birthPrecision === '' ? null : birthPrecision,
      birthDateNotes: emptyToNull(birthNotes),
      deathDateAh: numOrNull(deathAh),
      deathDateCe: numOrNull(deathCe),
      deathDatePrecision: deathPrecision === '' ? null : deathPrecision,
      deathDateNotes: emptyToNull(deathNotes),

      // Peta FKs
      primaryLocationId: primaryLocation?.id ?? null,
      deathLocationId: deathLocation?.id ?? null,
      burialLocationId: burialLocation?.id ?? null,

      // Hadits & Rijal
      hadithCountMin: numOrNull(hadithMin),
      hadithCountMax: numOrNull(hadithMax),
      rijalGrade,
      rijalNotesId: emptyToNull(rijalNotesId),
      rijalNotesAr: emptyToNull(rijalNotesAr),
      specialty: specialty.length > 0 ? specialty : null,
      madhab: madhab === '' ? null : madhab,
      socialCategory: socialCategory.length > 0 ? socialCategory : null,
      deathCause: deathCause === '' ? null : deathCause,
    }

    setSaving(true)
    try {
      await api.patch(`/figures/${encodeURIComponent(initial.slug)}`, body)
      toast.success('Tokoh tersimpan')
      router.refresh()
    } catch (err) {
      if (err instanceof ApiClientError && err.fieldErrors) {
        setFieldErrors(err.fieldErrors)
        toast.error(err.message)
      } else {
        const msg = err instanceof Error ? err.message : 'Gagal menyimpan'
        toast.error(msg)
      }
    } finally {
      setSaving(false)
    }
  }

  // ── Inline M2M handlers ───────────────────────────────────────────────

  async function addFigureLocation(input: {
    locationId: string
    role: FigureLocationRole
  }, optionForUi: LocationOption) {
    try {
      const created = await api.post<{ id: string; role: FigureLocationRole }>(
        `/admin/figures/${encodeURIComponent(initial.slug)}/figure-locations`,
        input,
      )
      setFigureLocations((prev) => [
        ...prev,
        {
          id: created.id,
          role: created.role,
          location: {
            id: optionForUi.id,
            slug: optionForUi.slug,
            nameId: optionForUi.nameId,
            nameAr: optionForUi.nameAr,
            modernName: optionForUi.modernName,
            region: optionForUi.region,
            countryCode: optionForUi.countryCode,
          },
        },
      ])
      toast.success('Lokasi ditambahkan')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menambahkan lokasi'
      toast.error(msg)
    }
  }

  async function removeFigureLocation(rowId: string) {
    const ok = await confirm({
      title: 'Hapus lokasi?',
      text: 'Tautan lokasi pada tokoh ini akan dihapus.',
      confirmText: 'Hapus',
      dangerous: true,
    })
    if (!ok) return
    try {
      await api.delete(
        `/admin/figures/${encodeURIComponent(initial.slug)}/figure-locations/${rowId}`,
      )
      setFigureLocations((prev) => prev.filter((r) => r.id !== rowId))
      toast.success('Lokasi dihapus')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus lokasi'
      toast.error(msg)
    }
  }

  async function addRelation(input: {
    related: FigureOption
    relationType: RelationType
  }) {
    try {
      await api.post(`/admin/figures/${encodeURIComponent(initial.slug)}/relations`, {
        relatedId: input.related.id,
        relationType: input.relationType,
      })
      // We don't have a stable id back without a follow-up GET; fetch the
      // detail to refresh. Cheap because the detail JSON is one round-trip.
      const refreshed = await api.get<{ relations: FigureRelationRow[] }>(
        `/figures/${encodeURIComponent(initial.slug)}`,
      )
      setRelations(refreshed.relations ?? [])
      toast.success('Relasi ditambahkan')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menambahkan relasi'
      toast.error(msg)
    }
  }

  async function removeRelation(relationId: string) {
    const ok = await confirm({
      title: 'Hapus relasi?',
      text: 'Relasi (dua arah) akan dihapus dari catatan tokoh ini.',
      confirmText: 'Hapus',
      dangerous: true,
    })
    if (!ok) return
    try {
      await api.delete(
        `/admin/figures/${encodeURIComponent(initial.slug)}/relations/${relationId}`,
      )
      setRelations((prev) => prev.filter((r) => r.id !== relationId))
      toast.success('Relasi dihapus')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus relasi'
      toast.error(msg)
    }
  }

  async function addBattleParticipation(input: { battle: BattleOption; role: BattleRole }) {
    try {
      await api.post(
        `/admin/figures/${encodeURIComponent(initial.slug)}/battle-participants`,
        { battleId: input.battle.id, role: input.role },
      )
      setBattleParticipations((prev) => [
        ...prev,
        {
          battleId: input.battle.id,
          slug: input.battle.slug,
          nameId: input.battle.nameId,
          nameAr: input.battle.nameAr ?? '',
          eventDateAh: input.battle.eventDateAh,
          eventDateCe: input.battle.eventDateCe,
          role: input.role,
        },
      ])
      toast.success('Peristiwa ditautkan')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menautkan peristiwa'
      toast.error(msg)
    }
  }

  async function removeBattleParticipation(battleId: string) {
    const ok = await confirm({
      title: 'Hapus peristiwa?',
      text: 'Tautan ke peristiwa akan dihapus.',
      confirmText: 'Hapus',
      dangerous: true,
    })
    if (!ok) return
    try {
      await api.delete(
        `/admin/figures/${encodeURIComponent(initial.slug)}/battle-participants/${battleId}`,
      )
      setBattleParticipations((prev) => prev.filter((r) => r.battleId !== battleId))
      toast.success('Peristiwa dihapus')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus peristiwa'
      toast.error(msg)
    }
  }

  async function addCitation(input: {
    sourceUrl: string
    fieldPath: string | null
    sourceExcerptId: string | null
    confidenceScore: string | null
  }) {
    try {
      const created = await api.post<{
        id: string
        sourceUrl: string
        sourceDomain: string | null
        fieldPath: string | null
        confidenceScore: string | null
        sourceExcerptId: string | null
        sourceLang: 'ar' | 'id' | 'en' | null
      }>('/citations', {
        contentType: 'figure',
        contentId: initial.id,
        sourceUrl: input.sourceUrl,
        fieldPath: input.fieldPath,
        sourceExcerptId: input.sourceExcerptId,
        confidenceScore: input.confidenceScore,
      })
      setCitations((prev) => [
        ...prev,
        {
          id: created.id,
          sourceUrl: created.sourceUrl,
          sourceDomain: created.sourceDomain,
          fieldPath: created.fieldPath,
          confidenceScore: created.confidenceScore,
          sourceExcerptId: created.sourceExcerptId,
          sourceLang: created.sourceLang,
        },
      ])
      toast.success('Sitasi ditambahkan')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menambahkan sitasi'
      toast.error(msg)
    }
  }

  async function removeCitation(id: string) {
    const ok = await confirm({
      title: 'Hapus sitasi?',
      text: 'Sitasi akan dihapus dari tokoh ini.',
      confirmText: 'Hapus',
      dangerous: true,
    })
    if (!ok) return
    try {
      await api.delete(`/admin/citations/${id}`)
      setCitations((prev) => prev.filter((c) => c.id !== id))
      toast.success('Sitasi dihapus')
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gagal menghapus sitasi'
      toast.error(msg)
    }
  }

  // ── Render ────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/admin/figures">
              <ArrowLeft className="h-4 w-4" />
              Kembali
            </Link>
          </Button>
          <div>
            <h1
              className="text-2xl font-semibold text-[rgb(var(--text))]"
              style={{ fontFamily: 'var(--font-display-latin)' }}
            >
              Edit Tokoh
            </h1>
            <p className="text-sm text-[rgb(var(--text-muted))]">
              <code className="rounded bg-[rgb(var(--bg-elevated))] px-1.5 py-0.5 font-mono text-xs">
                {initial.slug}
              </code>{' '}
              <Badge variant={STATUS_VARIANT[initial.status]} className="ml-1">
                {STATUS_LABEL[initial.status]}
              </Badge>
              {isDirty ? (
                <span className="ml-2 text-xs text-[rgb(var(--warning))]">
                  • belum disimpan
                </span>
              ) : null}
            </p>
          </div>
        </div>
      </header>

      <form onSubmit={handleSave} className="flex flex-col gap-4" noValidate>
        {/* Panel A — Identitas & Status */}
        <Accordion title="Identitas & Status" defaultOpen ariaId="panel-identitas">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Nama lengkap (Indonesia)" htmlFor="nameFullId" error={fieldErrors['nameFullId']} required>
              <Input
                id="nameFullId"
                value={nameFullId}
                onChange={(e) => setNameFullId(e.target.value)}
                required
              />
            </Field>
            <Field label="Nama lengkap (Arab)" htmlFor="nameFullAr" error={fieldErrors['nameFullAr']} required>
              <Input
                id="nameFullAr"
                value={nameFullAr}
                onChange={(e) => setNameFullAr(e.target.value)}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
                required
              />
            </Field>
            <Field label="Nama pendek (Indonesia)" htmlFor="nameShortId">
              <Input
                id="nameShortId"
                value={nameShortId}
                onChange={(e) => setNameShortId(e.target.value)}
              />
            </Field>
            <Field label="Nama pendek (Arab)" htmlFor="nameShortAr">
              <Input
                id="nameShortAr"
                value={nameShortAr}
                onChange={(e) => setNameShortAr(e.target.value)}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
              />
            </Field>
            <Field label="Kunyah (Indonesia)" htmlFor="kunyahId" hint="mis. Abu Bakar">
              <Input id="kunyahId" value={kunyahId} onChange={(e) => setKunyahId(e.target.value)} />
            </Field>
            <Field label="Kunyah (Arab)" htmlFor="kunyahAr">
              <Input
                id="kunyahAr"
                value={kunyahAr}
                onChange={(e) => setKunyahAr(e.target.value)}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
              />
            </Field>
            <Field label="Laqab (Indonesia)" htmlFor="laqabId" hint="mis. As-Shiddiq">
              <Input id="laqabId" value={laqabId} onChange={(e) => setLaqabId(e.target.value)} />
            </Field>
            <Field label="Laqab (Arab)" htmlFor="laqabAr">
              <Input
                id="laqabAr"
                value={laqabAr}
                onChange={(e) => setLaqabAr(e.target.value)}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
              />
            </Field>

            <Field label="Jenis kelamin" htmlFor="gender" required>
              <RadioGroup
                value={gender}
                onValueChange={(v) => setGender(v as Gender)}
                className="flex gap-4 pt-1"
              >
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="male" id="gender-male" />
                  <Label htmlFor="gender-male" className="cursor-pointer text-sm font-normal">
                    Laki-laki
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <RadioGroupItem value="female" id="gender-female" />
                  <Label htmlFor="gender-female" className="cursor-pointer text-sm font-normal">
                    Perempuan
                  </Label>
                </div>
              </RadioGroup>
            </Field>

            <Field label="Kategori" htmlFor="categoryId" required error={fieldErrors['categoryId']}>
              <Select value={categoryId} onValueChange={setCategoryId}>
                <SelectTrigger id="categoryId">
                  <SelectValue placeholder="Pilih kategori" />
                </SelectTrigger>
                <SelectContent>
                  {categories.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {c.nameId}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Status publikasi"
              htmlFor="status"
              hint={
                initial.publishedAt
                  ? `Pertama terbit: ${new Date(initial.publishedAt).toLocaleString('id-ID')}`
                  : 'Belum pernah dipublikasikan.'
              }
            >
              <Select value={status} onValueChange={(v) => setStatus(v as Status)}>
                <SelectTrigger id="status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(STATUS_LABEL) as Status[]).map((s) => (
                    <SelectItem key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>
        </Accordion>

        {/* Panel B — Biografi */}
        <Accordion title="Biografi" ariaId="panel-biografi">
          <p className="mb-3 text-xs text-[rgb(var(--text-muted))]">
            Biografi dipecah pre-wafat (kelahiran → wafat) dan post-wafat (legacy &
            warisan). Field "biografi (legacy)" hanya dipakai jika belum ada pecahan
            pre/post.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Ringkasan (Indonesia)" htmlFor="summaryId" hint="≤ 280 karakter">
              <Textarea
                id="summaryId"
                value={summaryId}
                onChange={(e) => setSummaryId(e.target.value)}
                rows={3}
                maxLength={280}
              />
            </Field>
            <Field label="Ringkasan (Arab)" htmlFor="summaryAr">
              <Textarea
                id="summaryAr"
                value={summaryAr}
                onChange={(e) => setSummaryAr(e.target.value)}
                rows={3}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
              />
            </Field>
            <Field label="Biografi pre-wafat (Indonesia)" htmlFor="bioPreId">
              <Textarea
                id="bioPreId"
                value={bioPreId}
                onChange={(e) => setBioPreId(e.target.value)}
                rows={8}
              />
            </Field>
            <Field label="Biografi pre-wafat (Arab)" htmlFor="bioPreAr">
              <Textarea
                id="bioPreAr"
                value={bioPreAr}
                onChange={(e) => setBioPreAr(e.target.value)}
                rows={8}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
              />
            </Field>
            <Field label="Biografi post-wafat (Indonesia)" htmlFor="bioPostId">
              <Textarea
                id="bioPostId"
                value={bioPostId}
                onChange={(e) => setBioPostId(e.target.value)}
                rows={6}
              />
            </Field>
            <Field label="Biografi post-wafat (Arab)" htmlFor="bioPostAr">
              <Textarea
                id="bioPostAr"
                value={bioPostAr}
                onChange={(e) => setBioPostAr(e.target.value)}
                rows={6}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
              />
            </Field>
            <Field label="Biografi (legacy, Indonesia)" htmlFor="bioLegacyId">
              <Textarea
                id="bioLegacyId"
                value={bioLegacyId}
                onChange={(e) => setBioLegacyId(e.target.value)}
                rows={4}
              />
            </Field>
            <Field label="Biografi (legacy, Arab)" htmlFor="bioLegacyAr">
              <Textarea
                id="bioLegacyAr"
                value={bioLegacyAr}
                onChange={(e) => setBioLegacyAr(e.target.value)}
                rows={4}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
              />
            </Field>
          </div>
        </Accordion>

        {/* Panel C — Timeline */}
        <Accordion title="Timeline (kelahiran, wafat, peristiwa)" ariaId="panel-timeline">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Lahir (H)" htmlFor="birthAh">
              <Input
                id="birthAh"
                type="number"
                inputMode="numeric"
                value={birthAh}
                onChange={(e) => setBirthAh(e.target.value)}
              />
            </Field>
            <Field label="Lahir (M)" htmlFor="birthCe">
              <Input
                id="birthCe"
                type="number"
                inputMode="numeric"
                value={birthCe}
                onChange={(e) => setBirthCe(e.target.value)}
              />
            </Field>
            <Field label="Presisi lahir" htmlFor="birthPrecision">
              <Select
                value={birthPrecision === '' ? undefined : birthPrecision}
                onValueChange={(v) => setBirthPrecision(v as DatePrecision)}
              >
                <SelectTrigger id="birthPrecision">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DATE_PRECISION_LABEL) as DatePrecision[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {DATE_PRECISION_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Catatan lahir" htmlFor="birthNotes">
              <Input
                id="birthNotes"
                value={birthNotes}
                onChange={(e) => setBirthNotes(e.target.value)}
              />
            </Field>

            <Field label="Wafat (H)" htmlFor="deathAh">
              <Input
                id="deathAh"
                type="number"
                inputMode="numeric"
                value={deathAh}
                onChange={(e) => setDeathAh(e.target.value)}
              />
            </Field>
            <Field label="Wafat (M)" htmlFor="deathCe">
              <Input
                id="deathCe"
                type="number"
                inputMode="numeric"
                value={deathCe}
                onChange={(e) => setDeathCe(e.target.value)}
              />
            </Field>
            <Field label="Presisi wafat" htmlFor="deathPrecision">
              <Select
                value={deathPrecision === '' ? undefined : deathPrecision}
                onValueChange={(v) => setDeathPrecision(v as DatePrecision)}
              >
                <SelectTrigger id="deathPrecision">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DATE_PRECISION_LABEL) as DatePrecision[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {DATE_PRECISION_LABEL[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Catatan wafat" htmlFor="deathNotes">
              <Input
                id="deathNotes"
                value={deathNotes}
                onChange={(e) => setDeathNotes(e.target.value)}
              />
            </Field>
          </div>

          {/* Linked battles subform */}
          <div className="mt-6 flex flex-col gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
              Tautkan Peristiwa (battle_participants)
            </h4>
            {battleParticipations.length === 0 ? (
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Belum ada peristiwa tertaut.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {battleParticipations.map((b) => (
                  <li
                    key={b.battleId}
                    className="flex items-center gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">{b.nameId}</span>
                      <span className="text-xs text-[rgb(var(--text-muted))]">
                        {BATTLE_ROLE_LABEL[b.role]}
                        {typeof b.eventDateAh === 'number' ? ` · ${b.eventDateAh} H` : ''}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeBattleParticipation(b.battleId)}
                      className="ml-auto"
                      aria-label="Hapus peristiwa"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <AddBattleSubform onAdd={(input) => void addBattleParticipation(input)} />
          </div>
        </Accordion>

        {/* Panel D — Peta */}
        <Accordion title="Peta (lokasi)" ariaId="panel-peta">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Lokasi utama (primary)" htmlFor="primaryLocation">
              <LocationAutocomplete
                id="primaryLocation"
                value={primaryLocation}
                onChange={setPrimaryLocation}
              />
            </Field>
            <Field label="Tempat wafat" htmlFor="deathLocation">
              <LocationAutocomplete
                id="deathLocation"
                value={deathLocation}
                onChange={setDeathLocation}
              />
            </Field>
            <Field label="Tempat dimakamkan" htmlFor="burialLocation">
              <LocationAutocomplete
                id="burialLocation"
                value={burialLocation}
                onChange={setBurialLocation}
              />
            </Field>
          </div>
          <p className="mt-2 text-xs text-[rgb(var(--text-muted))]">
            Ketiga FK di atas tersimpan saat klik <strong>Simpan</strong>. Daftar di
            bawah disimpan inline.
          </p>

          <div className="mt-6 flex flex-col gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
              Lokasi terkait lain (figure_locations)
            </h4>
            {figureLocations.length === 0 ? (
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Belum ada lokasi terkait.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {figureLocations.map((row) => (
                  <li
                    key={row.id}
                    className="flex items-center gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {row.location.nameId}
                        {row.location.modernName ? (
                          <span className="ml-1 text-xs text-[rgb(var(--text-muted))]">
                            ({row.location.modernName})
                          </span>
                        ) : null}
                      </span>
                      <span className="text-xs text-[rgb(var(--text-muted))]">
                        {FIGURE_LOCATION_ROLE_LABEL[row.role]}
                      </span>
                    </div>
                    {/* Direct FK synthetic rows aren't deletable via this endpoint —
                        admin should clear the FK above instead. */}
                    {row.id.startsWith('direct:') ? (
                      <Badge variant="outline" className="ml-auto text-[10px]">
                        Dari FK langsung
                      </Badge>
                    ) : (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => void removeFigureLocation(row.id)}
                        className="ml-auto"
                        aria-label="Hapus tautan lokasi"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            <AddFigureLocationSubform onAdd={addFigureLocation} />
          </div>
        </Accordion>

        {/* Panel E — Hubungan */}
        <Accordion title="Hubungan (relasi)" ariaId="panel-hubungan">
          <p className="text-xs text-[rgb(var(--text-muted))]">
            Nasab dapat dilihat di tab publik <Link className="underline" href={`/figures/${initial.slug}`}>/figures/{initial.slug}</Link>.
            Tambah/hapus relasi di bawah; sisi terbalik (mis. ayah ↔ anak) otomatis dibuat.
          </p>

          <div className="mt-4 flex flex-col gap-2">
            <h4 className="text-sm font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
              Relasi tercatat
            </h4>
            {relations.length === 0 ? (
              <p className="text-xs text-[rgb(var(--text-muted))]">
                Belum ada relasi tercatat.
              </p>
            ) : (
              <ul className="flex flex-col gap-2">
                {relations.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2"
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm font-medium">
                        {r.related.nameShortId || r.related.nameFullId}
                      </span>
                      <span className="text-xs text-[rgb(var(--text-muted))]">
                        {RELATION_TYPE_LABEL[r.relationType]}
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeRelation(r.id)}
                      className="ml-auto"
                      aria-label="Hapus relasi"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                ))}
              </ul>
            )}
            <AddRelationSubform
              currentSlug={initial.slug}
              onAdd={(input) => void addRelation(input)}
            />
          </div>
        </Accordion>

        {/* Panel F — Hadits & Rijal */}
        <Accordion title="Hadits & Rijal" ariaId="panel-hadits">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Jumlah hadits (minimum)" htmlFor="hadithMin">
              <Input
                id="hadithMin"
                type="number"
                inputMode="numeric"
                min={0}
                value={hadithMin}
                onChange={(e) => setHadithMin(e.target.value)}
              />
            </Field>
            <Field label="Jumlah hadits (maksimum)" htmlFor="hadithMax">
              <Input
                id="hadithMax"
                type="number"
                inputMode="numeric"
                min={0}
                value={hadithMax}
                onChange={(e) => setHadithMax(e.target.value)}
              />
            </Field>

            <Field label="Derajat rijal" htmlFor="rijalGrade" hint={RIJAL_HINT[rijalGrade]}>
              <Select value={rijalGrade} onValueChange={(v) => setRijalGrade(v as RijalGrade)}>
                <SelectTrigger id="rijalGrade" title={RIJAL_HINT[rijalGrade]}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(RIJAL_LABEL) as RijalGrade[]).map((g) => (
                    <SelectItem key={g} value={g}>
                      <span title={RIJAL_HINT[g]}>{RIJAL_LABEL[g]}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Sebab wafat" htmlFor="deathCause">
              <Select
                value={deathCause === '' ? undefined : deathCause}
                onValueChange={(v) => setDeathCause(v as DeathCause)}
              >
                <SelectTrigger id="deathCause">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(DEATH_CAUSE_LABEL) as DeathCause[]).map((c) => (
                    <SelectItem key={c} value={c}>
                      {DEATH_CAUSE_LABEL[c]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Catatan rijal (Indonesia)" htmlFor="rijalNotesId">
              <Textarea
                id="rijalNotesId"
                value={rijalNotesId}
                onChange={(e) => setRijalNotesId(e.target.value)}
                rows={4}
              />
            </Field>
            <Field label="Catatan rijal (Arab)" htmlFor="rijalNotesAr">
              <Textarea
                id="rijalNotesAr"
                value={rijalNotesAr}
                onChange={(e) => setRijalNotesAr(e.target.value)}
                rows={4}
                dir="rtl"
                style={{ fontFamily: 'var(--font-display-arabic)' }}
              />
            </Field>

            <Field label="Madzhab" htmlFor="madhab">
              <Select
                value={madhab === '' ? undefined : madhab}
                onValueChange={(v) => setMadhab(v as Madhab)}
              >
                <SelectTrigger id="madhab">
                  <SelectValue placeholder="—" />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(MADHAB_LABEL) as Madhab[]).map((m) => (
                    <SelectItem key={m} value={m}>
                      {MADHAB_LABEL[m]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Spesialisasi" htmlFor="specialty" hint="hadits, tafsir, fiqh, dst.">
              <TagInput id="specialty" values={specialty} onChange={setSpecialty} />
            </Field>

            <Field label="Kategori sosial" htmlFor="socialCategory" hint="boleh lebih dari satu">
              <MultiSelectChips
                id="socialCategory"
                options={Object.entries(SOCIAL_CATEGORY_LABEL).map(([value, label]) => ({
                  value,
                  label,
                }))}
                values={socialCategory}
                onChange={(v) => setSocialCategory(v as SocialCategory[])}
              />
            </Field>
          </div>
        </Accordion>

        {/* Panel G — Sumber / Citation */}
        <Accordion title="Sumber / Citation" ariaId="panel-sumber">
          {citations.length === 0 ? (
            <p className="text-xs text-[rgb(var(--text-muted))]">
              Belum ada sitasi.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {citations.map((c) => {
                const domain = c.sourceDomain ?? extractDomain(c.sourceUrl)
                const inWhitelist = domain ? whitelistSet.has(domain) : false
                return (
                  <li
                    key={c.id}
                    className="flex items-start gap-3 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-3 py-2 text-sm"
                  >
                    <div className="flex min-w-0 flex-1 flex-col gap-1">
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="truncate font-medium text-[rgb(var(--text))] hover:underline"
                      >
                        {c.sourceUrl}
                      </a>
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        {domain ? (
                          inWhitelist ? (
                            <Badge variant="secondary" className="gap-1">
                              <ShieldCheck className="h-3 w-3" /> {domain}
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="gap-1">
                              <AlertTriangle className="h-3 w-3" /> {domain} (di luar whitelist)
                            </Badge>
                          )
                        ) : null}
                        {c.fieldPath ? (
                          <span className="text-[rgb(var(--text-muted))]">
                            <code className="rounded bg-[rgb(var(--surface))] px-1 font-mono">
                              {c.fieldPath}
                            </code>
                          </span>
                        ) : null}
                        {c.confidenceScore ? (
                          <span className="text-[rgb(var(--text-muted))]">
                            conf: {c.confidenceScore}
                          </span>
                        ) : null}
                      </div>
                      {c.sourceExcerptId ? (
                        <p className="line-clamp-2 text-xs text-[rgb(var(--text-muted))]">
                          {c.sourceExcerptId}
                        </p>
                      ) : null}
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => void removeCitation(c.id)}
                      aria-label="Hapus sitasi"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </li>
                )
              })}
            </ul>
          )}
          <AddCitationSubform
            whitelistSet={whitelistSet}
            onAdd={(input) => void addCitation(input)}
          />
        </Accordion>

        {/* Save bar */}
        <div className="sticky bottom-0 z-10 -mx-4 mt-2 flex items-center justify-end gap-2 border-t border-[rgb(var(--border))] bg-[rgb(var(--bg))]/95 px-4 py-3 backdrop-blur">
          <span className="mr-auto text-xs text-[rgb(var(--text-muted))]">
            {isDirty
              ? 'Perubahan kolom dasar belum disimpan.'
              : 'Semua perubahan kolom dasar tersimpan.'}
            {' '}
            Relasi, lokasi, peristiwa, dan sitasi disimpan otomatis saat ditambah/dihapus.
          </span>
          <Button
            type="button"
            variant="ghost"
            onClick={() => router.push('/admin/figures')}
            disabled={saving}
          >
            Batal
          </Button>
          <Button type="submit" disabled={saving || !isDirty}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Simpan
          </Button>
        </div>
      </form>
    </div>
  )
}

// ─── Inline reusable primitives ────────────────────────────────────────

interface AccordionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
  ariaId: string
}

function Accordion({ title, children, defaultOpen = false, ariaId }: AccordionProps) {
  return (
    <details
      open={defaultOpen}
      className="group rounded-lg border border-[rgb(var(--border))] bg-[rgb(var(--surface))]"
    >
      <summary
        id={ariaId}
        className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg px-4 py-3 text-sm font-semibold text-[rgb(var(--text))] hover:bg-[rgb(var(--bg-elevated))]"
      >
        <span>{title}</span>
        <span
          aria-hidden
          className="text-xs text-[rgb(var(--text-muted))] transition-transform group-open:rotate-180"
        >
          ▼
        </span>
      </summary>
      <div aria-labelledby={ariaId} className="border-t border-[rgb(var(--border))] px-4 py-4">
        {children}
      </div>
    </details>
  )
}

interface FieldProps {
  label: string
  htmlFor: string
  children: React.ReactNode
  required?: boolean
  hint?: string
  error?: string
}

function Field({ label, htmlFor, children, required, hint, error }: FieldProps) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={htmlFor} className="text-xs font-medium">
        {label}
        {required ? <span className="ml-1 text-[rgb(var(--danger))]">*</span> : null}
      </Label>
      {children}
      {hint && !error ? (
        <p className="text-[10px] text-[rgb(var(--text-muted))]">{hint}</p>
      ) : null}
      {error ? (
        <p className="text-[10px]" style={{ color: 'rgb(var(--danger))' }}>
          {error}
        </p>
      ) : null}
    </div>
  )
}

// ─── Tag input (used for `specialty`) ──────────────────────────────────

function TagInput({
  id,
  values,
  onChange,
}: {
  id: string
  values: string[]
  onChange: (next: string[]) => void
}) {
  const [draft, setDraft] = React.useState('')

  function add(raw: string) {
    const v = raw.trim()
    if (!v) return
    if (values.includes(v)) return
    onChange([...values, v])
    setDraft('')
  }

  function remove(v: string) {
    onChange(values.filter((x) => x !== v))
  }

  return (
    <div className="flex flex-wrap items-center gap-1 rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] px-2 py-1.5">
      {values.map((v) => (
        <span
          key={v}
          className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary))]/15 px-2 py-0.5 text-xs font-medium text-[rgb(var(--primary))]"
        >
          {v}
          <button
            type="button"
            onClick={() => remove(v)}
            aria-label={`Hapus ${v}`}
            className="text-[rgb(var(--primary))] hover:text-[rgb(var(--danger))]"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        id={id}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault()
            add(draft)
          } else if (e.key === 'Backspace' && draft === '' && values.length > 0) {
            // Pop last tag on backspace.
            onChange(values.slice(0, -1))
          }
        }}
        onBlur={() => add(draft)}
        placeholder={values.length === 0 ? 'Tambah tag (Enter)…' : ''}
        className="flex-1 bg-transparent text-sm outline-none placeholder:text-[rgb(var(--text-muted))]"
      />
    </div>
  )
}

// ─── Multi-select chips (used for socialCategory) ──────────────────────

function MultiSelectChips({
  id,
  options,
  values,
  onChange,
}: {
  id: string
  options: { value: string; label: string }[]
  values: string[]
  onChange: (next: string[]) => void
}) {
  function toggle(v: string) {
    if (values.includes(v)) onChange(values.filter((x) => x !== v))
    else onChange([...values, v])
  }
  return (
    <div id={id} className="flex flex-wrap gap-1">
      {options.map((o) => {
        const active = values.includes(o.value)
        return (
          <button
            key={o.value}
            type="button"
            onClick={() => toggle(o.value)}
            aria-pressed={active}
            className={
              'rounded-full border px-2 py-0.5 text-xs ' +
              (active
                ? 'border-[rgb(var(--primary))] bg-[rgb(var(--primary))]/20 text-[rgb(var(--primary))]'
                : 'border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))] text-[rgb(var(--text-muted))] hover:border-[rgb(var(--primary))]/40')
            }
          >
            {o.label}
          </button>
        )
      })}
    </div>
  )
}

// ─── Subforms ──────────────────────────────────────────────────────────

function AddFigureLocationSubform({
  onAdd,
}: {
  onAdd: (input: { locationId: string; role: FigureLocationRole }, opt: LocationOption) => void
}) {
  const [picked, setPicked] = React.useState<LocationOption | null>(null)
  const [role, setRole] = React.useState<FigureLocationRole>('residence')

  return (
    <div className="mt-2 rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/50 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_180px_auto] sm:items-end">
        <Field label="Lokasi" htmlFor="add-fl-location">
          <LocationAutocomplete value={picked} onChange={setPicked} id="add-fl-location" />
        </Field>
        <Field label="Peran" htmlFor="add-fl-role">
          <Select value={role} onValueChange={(v) => setRole(v as FigureLocationRole)}>
            <SelectTrigger id="add-fl-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(FIGURE_LOCATION_ROLE_LABEL) as FigureLocationRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {FIGURE_LOCATION_ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={!picked}
          onClick={() => {
            if (!picked) return
            onAdd({ locationId: picked.id, role }, picked)
            setPicked(null)
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah
        </Button>
      </div>
    </div>
  )
}

function AddRelationSubform({
  currentSlug,
  onAdd,
}: {
  currentSlug: string
  onAdd: (input: { related: FigureOption; relationType: RelationType }) => void
}) {
  const [picked, setPicked] = React.useState<FigureOption | null>(null)
  const [type, setType] = React.useState<RelationType>('teacher_of')

  return (
    <div className="mt-2 rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/50 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto] sm:items-end">
        <Field label="Tokoh target" htmlFor="add-rel-target">
          <FigureAutocomplete
            value={picked}
            onChange={setPicked}
            excludeSlugs={[currentSlug]}
            id="add-rel-target"
          />
        </Field>
        <Field label="Jenis relasi" htmlFor="add-rel-type">
          <Select value={type} onValueChange={(v) => setType(v as RelationType)}>
            <SelectTrigger id="add-rel-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(RELATION_TYPE_LABEL) as RelationType[]).map((t) => (
                <SelectItem key={t} value={t}>
                  {RELATION_TYPE_LABEL[t]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={!picked}
          onClick={() => {
            if (!picked) return
            onAdd({ related: picked, relationType: type })
            setPicked(null)
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah
        </Button>
      </div>
    </div>
  )
}

function AddBattleSubform({
  onAdd,
}: {
  onAdd: (input: { battle: BattleOption; role: BattleRole }) => void
}) {
  const [picked, setPicked] = React.useState<BattleOption | null>(null)
  const [role, setRole] = React.useState<BattleRole>('sahabat')

  return (
    <div className="mt-2 rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/50 p-3">
      <div className="grid gap-2 sm:grid-cols-[1fr_220px_auto] sm:items-end">
        <Field label="Peristiwa" htmlFor="add-bat-battle">
          <BattleAutocomplete value={picked} onChange={setPicked} id="add-bat-battle" />
        </Field>
        <Field label="Peran" htmlFor="add-bat-role">
          <Select value={role} onValueChange={(v) => setRole(v as BattleRole)}>
            <SelectTrigger id="add-bat-role">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {(Object.keys(BATTLE_ROLE_LABEL) as BattleRole[]).map((r) => (
                <SelectItem key={r} value={r}>
                  {BATTLE_ROLE_LABEL[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Button
          type="button"
          variant="outline"
          disabled={!picked}
          onClick={() => {
            if (!picked) return
            onAdd({ battle: picked, role })
            setPicked(null)
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah
        </Button>
      </div>
    </div>
  )
}

function AddCitationSubform({
  whitelistSet,
  onAdd,
}: {
  whitelistSet: Set<string>
  onAdd: (input: {
    sourceUrl: string
    fieldPath: string | null
    sourceExcerptId: string | null
    confidenceScore: string | null
  }) => void
}) {
  const [url, setUrl] = React.useState('')
  const [fieldPath, setFieldPath] = React.useState('')
  const [confidence, setConfidence] = React.useState<'high' | 'medium' | 'low'>('medium')
  const [excerpt, setExcerpt] = React.useState('')

  const domain = extractDomain(url)
  const inWhitelist = domain ? whitelistSet.has(domain) : null

  const confidenceNumeric: Record<'high' | 'medium' | 'low', string> = {
    high: '0.90',
    medium: '0.60',
    low: '0.30',
  }

  return (
    <div className="mt-3 rounded-md border border-dashed border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]/50 p-3">
      <h5 className="mb-2 text-xs font-semibold uppercase tracking-wide text-[rgb(var(--text-muted))]">
        Tambah sitasi
      </h5>
      <div className="grid gap-2 sm:grid-cols-2">
        <Field label="URL sumber" htmlFor="add-cit-url" required>
          <Input
            id="add-cit-url"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://…"
          />
          {domain ? (
            inWhitelist ? (
              <p className="mt-1 inline-flex items-center gap-1 text-[10px] text-[rgb(var(--success))]">
                <ShieldCheck className="h-3 w-3" /> {domain} ada di whitelist
              </p>
            ) : (
              <p className="mt-1 inline-flex items-center gap-1 text-[10px]" style={{ color: 'rgb(var(--danger))' }}>
                <AlertTriangle className="h-3 w-3" /> {domain} di luar whitelist
              </p>
            )
          ) : null}
        </Field>
        <Field label="Field path (opsional)" htmlFor="add-cit-field" hint="mis. summaryId, biographyId">
          <Input
            id="add-cit-field"
            value={fieldPath}
            onChange={(e) => setFieldPath(e.target.value)}
          />
        </Field>
        <Field label="Confidence" htmlFor="add-cit-conf">
          <Select value={confidence} onValueChange={(v) => setConfidence(v as 'high' | 'medium' | 'low')}>
            <SelectTrigger id="add-cit-conf">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="high">Tinggi (0.90)</SelectItem>
              <SelectItem value="medium">Sedang (0.60)</SelectItem>
              <SelectItem value="low">Rendah (0.30)</SelectItem>
            </SelectContent>
          </Select>
        </Field>
        <Field label="Excerpt (Indonesia)" htmlFor="add-cit-excerpt">
          <Textarea
            id="add-cit-excerpt"
            value={excerpt}
            onChange={(e) => setExcerpt(e.target.value)}
            rows={2}
          />
        </Field>
      </div>
      <div className="mt-2 flex justify-end">
        <Button
          type="button"
          variant="outline"
          disabled={!url.trim()}
          onClick={() => {
            onAdd({
              sourceUrl: url.trim(),
              fieldPath: emptyToNull(fieldPath),
              sourceExcerptId: emptyToNull(excerpt),
              confidenceScore: confidenceNumeric[confidence],
            })
            setUrl('')
            setFieldPath('')
            setExcerpt('')
            setConfidence('medium')
          }}
        >
          <Plus className="h-4 w-4" />
          Tambah sitasi
        </Button>
      </div>
    </div>
  )
}
