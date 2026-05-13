// Core historical locations from sirah era. Coordinates approximate.
// Will be enriched by AI deep research crawler (Phase 3.4).

import { sql } from 'drizzle-orm'
import { getSeedDb, logSeed } from './_helpers.js'
import { locations } from '../schema/index.js'

type LocSeed = {
  slug: string
  nameAr: string
  nameId: string
  modernName?: string
  countryCode?: string
  region: string
  lat: number
  lng: number
  descriptionId?: string
}

const LOCATIONS: LocSeed[] = [
  // ─── Hijaz ────────────────────────────────────────────────
  { slug: 'makkah', nameAr: 'مكة المكرمة', nameId: 'Mekkah', modernName: 'Makkah al-Mukarramah', countryCode: 'SA', region: 'hijaz', lat: 21.4225, lng: 39.8262, descriptionId: 'Kota kelahiran Nabi ﷺ.' },
  { slug: 'madinah', nameAr: 'المدينة المنورة', nameId: 'Madinah', modernName: 'Madinah al-Munawwarah', countryCode: 'SA', region: 'hijaz', lat: 24.4709, lng: 39.6121, descriptionId: 'Kota hijrah Nabi ﷺ.' },
  { slug: 'thaif', nameAr: 'الطائف', nameId: "Tha'if", modernName: 'Taif', countryCode: 'SA', region: 'hijaz', lat: 21.4373, lng: 40.5127 },
  { slug: 'jeddah', nameAr: 'جدة', nameId: 'Jeddah', countryCode: 'SA', region: 'hijaz', lat: 21.4858, lng: 39.1925 },
  { slug: 'khaybar', nameAr: 'خيبر', nameId: 'Khaibar', countryCode: 'SA', region: 'hijaz', lat: 25.6961, lng: 39.2922, descriptionId: 'Lokasi Perang Khaibar.' },
  { slug: 'badr', nameAr: 'بدر', nameId: 'Badar', countryCode: 'SA', region: 'hijaz', lat: 23.7794, lng: 38.7894, descriptionId: 'Lokasi Perang Badar.' },
  { slug: 'uhud', nameAr: 'أحد', nameId: 'Uhud', countryCode: 'SA', region: 'hijaz', lat: 24.5081, lng: 39.6147, descriptionId: 'Gunung Uhud, lokasi Perang Uhud.' },
  { slug: 'hudaybiyyah', nameAr: 'الحديبية', nameId: 'Hudaibiyyah', countryCode: 'SA', region: 'hijaz', lat: 21.4500, lng: 39.7333 },

  // ─── Iraq ─────────────────────────────────────────────────
  { slug: 'baghdad', nameAr: 'بغداد', nameId: 'Baghdad', countryCode: 'IQ', region: 'iraq', lat: 33.3152, lng: 44.3661, descriptionId: 'Ibukota Khilafah Abbasiyah.' },
  { slug: 'kufah', nameAr: 'الكوفة', nameId: 'Kufah', countryCode: 'IQ', region: 'iraq', lat: 32.0289, lng: 44.4039, descriptionId: 'Pusat ilmu fiqh & qira\'ah.' },
  { slug: 'bashrah', nameAr: 'البصرة', nameId: 'Bashrah', modernName: 'Basra', countryCode: 'IQ', region: 'iraq', lat: 30.5081, lng: 47.7804, descriptionId: 'Pusat ilmu hadits & sastra.' },

  // ─── Sham ─────────────────────────────────────────────────
  { slug: 'damascus', nameAr: 'دمشق', nameId: 'Damaskus', modernName: 'Damascus', countryCode: 'SY', region: 'sham', lat: 33.5138, lng: 36.2765, descriptionId: 'Ibukota Khilafah Umayyah.' },
  { slug: 'aleppo', nameAr: 'حلب', nameId: 'Aleppo', countryCode: 'SY', region: 'sham', lat: 36.2021, lng: 37.1343 },
  { slug: 'al-quds', nameAr: 'القدس', nameId: 'Al-Quds (Yerusalem)', modernName: 'Jerusalem', countryCode: 'PS', region: 'sham', lat: 31.7857, lng: 35.2270, descriptionId: 'Kiblat pertama, lokasi Masjidil Aqsha.' },
  { slug: 'yarmuk', nameAr: 'اليرموك', nameId: 'Yarmuk', countryCode: 'JO', region: 'sham', lat: 32.7167, lng: 35.7333, descriptionId: 'Lokasi Perang Yarmuk.' },
  { slug: 'hims', nameAr: 'حمص', nameId: 'Hims', modernName: 'Homs', countryCode: 'SY', region: 'sham', lat: 34.7324, lng: 36.7132 },

  // ─── Misr / Egypt ─────────────────────────────────────────
  { slug: 'fustat', nameAr: 'الفسطاط', nameId: 'Fustat', modernName: 'Old Cairo', countryCode: 'EG', region: 'misr', lat: 30.0072, lng: 31.2330 },
  { slug: 'cairo', nameAr: 'القاهرة', nameId: 'Kairo', modernName: 'Cairo', countryCode: 'EG', region: 'misr', lat: 30.0444, lng: 31.2357 },
  { slug: 'alexandria', nameAr: 'الإسكندرية', nameId: 'Iskandariyah', modernName: 'Alexandria', countryCode: 'EG', region: 'misr', lat: 31.2001, lng: 29.9187 },

  // ─── Persia / Yemen / others ──────────────────────────────
  { slug: 'qadisiyyah', nameAr: 'القادسية', nameId: 'Qadisiyyah', countryCode: 'IQ', region: 'iraq', lat: 31.7000, lng: 44.5000, descriptionId: 'Lokasi Perang Qadisiyyah melawan Persia.' },
  { slug: 'ctesiphon', nameAr: 'المدائن', nameId: 'Mada\'in (Ctesiphon)', countryCode: 'IQ', region: 'iraq', lat: 33.0907, lng: 44.5798 },
  { slug: 'shanaa', nameAr: 'صنعاء', nameId: "Shan'a", modernName: 'Sanaa', countryCode: 'YE', region: 'yemen', lat: 15.3694, lng: 44.1910 },
  { slug: 'najran', nameAr: 'نجران', nameId: 'Najran', countryCode: 'SA', region: 'yemen', lat: 17.4924, lng: 44.1277 },

  // ─── Andalusia ────────────────────────────────────────────
  { slug: 'cordoba', nameAr: 'قرطبة', nameId: 'Cordoba', modernName: 'Córdoba', countryCode: 'ES', region: 'andalusia', lat: 37.8882, lng: -4.7794 },
  { slug: 'granada', nameAr: 'غرناطة', nameId: 'Granada', countryCode: 'ES', region: 'andalusia', lat: 37.1773, lng: -3.5986 },

  // ─── Central Asia ─────────────────────────────────────────
  { slug: 'bukhara', nameAr: 'بخارى', nameId: 'Bukhara', countryCode: 'UZ', region: 'central_asia', lat: 39.7747, lng: 64.4286, descriptionId: 'Kota kelahiran Imam Bukhari.' },
  { slug: 'samarkand', nameAr: 'سمرقند', nameId: 'Samarkand', countryCode: 'UZ', region: 'central_asia', lat: 39.6542, lng: 66.9597 },
  { slug: 'naysabur', nameAr: 'نيسابور', nameId: 'Naysabur', modernName: 'Nishapur', countryCode: 'IR', region: 'persia', lat: 36.2133, lng: 58.7959, descriptionId: 'Kota kelahiran Imam Muslim.' },

  // ─── Mu'jizat para Nabi sebelumnya ────────────────────────
  { slug: 'sinai', nameAr: 'سيناء', nameId: 'Sinai', countryCode: 'EG', region: 'sinai', lat: 28.5394, lng: 33.9750, descriptionId: 'Bukit Sinai, lokasi Nabi Musa AS bermunajat.' },
  { slug: 'ararat', nameAr: 'جودي', nameId: 'Gunung Judi', countryCode: 'TR', region: 'anatolia', lat: 37.3833, lng: 42.3500, descriptionId: 'Tempat berlabuhnya bahtera Nabi Nuh AS (riwayat Quran).' },
]

export async function seed015LocationsCore() {
  const db = getSeedDb()
  let total = 0
  for (const loc of LOCATIONS) {
    // ST_GeomFromText returns geometry, casted to geography for storage.
    const wkt = `POINT(${loc.lng} ${loc.lat})`
    try {
      const result = await db
        .insert(locations)
        .values({
          slug: loc.slug,
          nameAr: loc.nameAr,
          nameId: loc.nameId,
          modernName: loc.modernName,
          countryCode: loc.countryCode,
          region: loc.region,
          coordinates: sql`ST_GeogFromText(${wkt})`,
          descriptionId: loc.descriptionId,
        })
        .onConflictDoNothing()
        .returning()
      if (result.length > 0) total++
    } catch (e) {
      console.warn(`  ⚠ skip ${loc.slug}:`, e instanceof Error ? e.message : e)
    }
  }
  logSeed('locations', total)
}
