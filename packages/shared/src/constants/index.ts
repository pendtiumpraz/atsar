// App-wide constants

export const APP_NAME = 'Atsar'
export const APP_NAME_AR = 'أثر'
export const APP_TAGLINE_ID = 'Jejak generasi terbaik, dalam genggamanmu.'
export const APP_TAGLINE_AR = 'آثار خير القرون بين يديك'

// Bulan Hijriyah — transliterasi standar.
export const HIJRI_MONTHS = [
  'Muharram',
  'Safar',
  "Rabi'ul Awwal",
  "Rabi'ul Akhir",
  'Jumadil Awwal',
  'Jumadil Akhir',
  'Rajab',
  "Sya'ban",
  'Ramadhan',
  'Syawwal',
  "Dzulqa'dah",
  'Dzulhijjah',
] as const

export const MASEHI_MONTHS = [
  'Januari',
  'Februari',
  'Maret',
  'April',
  'Mei',
  'Juni',
  'Juli',
  'Agustus',
  'September',
  'Oktober',
  'November',
  'Desember',
] as const

// Tier monthly prices (IDR). Yearly = monthly * 12 * 0.9 (except sampler).
export const TIER_PRICES_IDR = {
  free: { monthly: 0, yearly: 0 },
  sampler: { monthly: 29_000, yearly: 249_000 },
  basic: { monthly: 99_000, yearly: 1_069_200 },
  pro: { monthly: 299_000, yearly: 3_229_200 },
  premium: { monthly: 499_000, yearly: 5_389_200 },
} as const

export const PDF_QUOTA_PER_MONTH = {
  free: 0,
  sampler: 50,
  basic: 100,
  pro: 500,
  premium: 1000,
} as const

export const TRIAL_DAYS = 3
export const TRASH_RETENTION_DAYS = 30
