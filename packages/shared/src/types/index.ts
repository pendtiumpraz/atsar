// Shared types between web + worker + packages.

export type Locale = 'id' | 'ar' | 'en'

export type CalendarMode = 'h' | 'm' | 'both'

export type ThemeMode = 'light' | 'dark' | 'auto'

export type DatePrecision = 'year' | 'month' | 'day' | 'approximate' | 'range'

export type Gender = 'male' | 'female'

export type FigureCategorySlug =
  | 'nabi'
  | 'sahabat'
  | 'tabiin'
  | 'tabiut_tabiin'
  | 'shalih_pre_rasul'
  | 'shalih_pasca_rasul'

export type ContentStatus =
  | 'draft'
  | 'under_review'
  | 'needs_edit'
  | 'approved'
  | 'published'
  | 'unpublished'
  | 'archived'

export type RijalGrade =
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

export type RoleSlug = 'admin' | 'reviewer' | 'subscriber'

export type TierSlug = 'free' | 'sampler' | 'basic' | 'pro' | 'premium'

export type AIRoleSlug = 'chat' | 'agent' | 'doc_analyzer' | 'avatar' | 'embedding'

export type FontRole =
  | 'display_latin'
  | 'body_latin'
  | 'display_arab'
  | 'section_arab'
  | 'body_arab'
  | 'quran_arab'
  | 'mono'

// API response envelope
export type ApiSuccess<T> = {
  ok: true
  data: T
  meta?: Record<string, unknown>
}

export type ApiError = {
  ok: false
  error: {
    code: string
    message: string
    details?: unknown
    fieldErrors?: Record<string, string>
  }
  meta?: Record<string, unknown>
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError
