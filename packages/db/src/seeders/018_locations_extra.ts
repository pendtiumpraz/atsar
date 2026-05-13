// Extra historical locations (Phase 7 content seed).
// Complements 015_locations_core.ts. New slugs only — no duplicates.
// Coordinates approximate (4 decimal places, Wikipedia/GeoNames).

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
  // ─── Hijaz / Arabia tambahan ─────────────────────────────
  { slug: 'yanbu', nameAr: 'ينبع', nameId: "Yanbu'", modernName: 'Yanbu', countryCode: 'SA', region: 'hijaz', lat: 24.0895, lng: 38.0618, descriptionId: 'Pelabuhan tua di pesisir Laut Merah.' },
  { slug: 'tabuk', nameAr: 'تبوك', nameId: 'Tabuk', countryCode: 'SA', region: 'hijaz', lat: 28.3835, lng: 36.5662, descriptionId: 'Lokasi Ekspedisi Tabuk pada 9 H.' },
  { slug: 'quba', nameAr: 'قباء', nameId: 'Quba', countryCode: 'SA', region: 'hijaz', lat: 24.4391, lng: 39.6175, descriptionId: 'Lokasi Masjid Quba, masjid pertama dalam Islam.' },
  { slug: 'mina', nameAr: 'منى', nameId: 'Mina', countryCode: 'SA', region: 'hijaz', lat: 21.4131, lng: 39.8933, descriptionId: 'Tempat manasik haji.' },
  { slug: 'arafah', nameAr: 'عرفة', nameId: 'Arafah', countryCode: 'SA', region: 'hijaz', lat: 21.3548, lng: 39.9839, descriptionId: 'Padang Arafah, wukuf jamaah haji.' },
  { slug: 'muzdalifah', nameAr: 'المزدلفة', nameId: 'Muzdalifah', countryCode: 'SA', region: 'hijaz', lat: 21.3833, lng: 39.9333, descriptionId: 'Tempat mabit jamaah haji setelah wukuf.' },
  { slug: 'wadi-al-qura', nameAr: 'وادي القرى', nameId: 'Wadi al-Qura', countryCode: 'SA', region: 'hijaz', lat: 26.6167, lng: 37.9167, descriptionId: 'Lembah penting di jalur kafilah Madinah–Sham.' },
  { slug: 'buwath', nameAr: 'بواط', nameId: 'Buwath', countryCode: 'SA', region: 'hijaz', lat: 24.7833, lng: 38.7167, descriptionId: 'Lokasi Ghazwah Buwath tahun 2 H.' },
  { slug: 'dzul-asyirah', nameAr: 'ذو العشيرة', nameId: "Dzul 'Asyirah", countryCode: 'SA', region: 'hijaz', lat: 23.9500, lng: 38.6500, descriptionId: "Lokasi Ghazwah Dzul 'Asyirah." },
  { slug: 'dzul-qarad', nameAr: 'ذو قرد', nameId: 'Dzul Qarad', countryCode: 'SA', region: 'hijaz', lat: 25.1000, lng: 39.4500, descriptionId: 'Lokasi Ghazwah Dzul Qarad (al-Ghabah).' },
  { slug: 'hunayn', nameAr: 'حنين', nameId: 'Hunain', countryCode: 'SA', region: 'hijaz', lat: 21.4500, lng: 40.2167, descriptionId: 'Lokasi Perang Hunain 8 H.' },
  { slug: 'autas', nameAr: 'أوطاس', nameId: 'Autas', countryCode: 'SA', region: 'hijaz', lat: 21.5000, lng: 40.5000, descriptionId: 'Lokasi pertempuran Autas, lanjutan Perang Hunain.' },

  // ─── Najd ────────────────────────────────────────────────
  { slug: 'yamamah', nameAr: 'اليمامة', nameId: 'Yamamah', modernName: 'Region Riyadh', countryCode: 'SA', region: 'najd', lat: 24.1500, lng: 47.3000, descriptionId: 'Lokasi Perang Yamamah melawan Musailamah al-Kadzdzab.' },
  { slug: 'dariyah', nameAr: 'الدرعية', nameId: "Dar'iyyah", countryCode: 'SA', region: 'najd', lat: 24.7378, lng: 46.5750, descriptionId: 'Kota tua di Najd.' },
  { slug: 'hajar-bahrain', nameAr: 'هجر', nameId: 'Hajar', modernName: 'Al-Ahsa', countryCode: 'SA', region: 'najd', lat: 25.3833, lng: 49.5833, descriptionId: 'Pusat wilayah Bahrain klasik (al-Hasa).' },

  // ─── Sham / Levant ───────────────────────────────────────
  { slug: 'mutah', nameAr: 'مؤتة', nameId: "Mu'tah", countryCode: 'JO', region: 'sham', lat: 31.0900, lng: 35.7000, descriptionId: "Lokasi Perang Mu'tah 8 H." },
  { slug: 'ajnadayn', nameAr: 'أجنادين', nameId: 'Ajnadain', countryCode: 'PS', region: 'sham', lat: 31.6500, lng: 34.9333, descriptionId: 'Lokasi Perang Ajnadain melawan Romawi.' },
  { slug: 'fihl', nameAr: 'فحل', nameId: 'Fihl', modernName: 'Pella', countryCode: 'JO', region: 'sham', lat: 32.4500, lng: 35.6167, descriptionId: 'Lokasi Perang Fihl (Pella).' },
  { slug: 'marj-as-suffar', nameAr: 'مرج الصفر', nameId: 'Marj as-Suffar', countryCode: 'SY', region: 'sham', lat: 33.2500, lng: 36.2500, descriptionId: 'Lokasi Perang Marj as-Suffar.' },
  { slug: 'tabariyya', nameAr: 'طبرية', nameId: 'Tabariyyah', modernName: 'Tiberias', countryCode: 'IL', region: 'sham', lat: 32.7922, lng: 35.5312 },
  { slug: 'antakiya', nameAr: 'أنطاكية', nameId: 'Antakiyah', modernName: 'Antakya', countryCode: 'TR', region: 'sham', lat: 36.2025, lng: 36.1606, descriptionId: 'Kota tua Sham, pusat awal Kristen.' },
  { slug: 'al-khalil', nameAr: 'الخليل', nameId: 'Al-Khalil', modernName: 'Hebron', countryCode: 'PS', region: 'sham', lat: 31.5326, lng: 35.0998, descriptionId: 'Kota Nabi Ibrahim AS.' },
  { slug: 'asqalan', nameAr: 'عسقلان', nameId: 'Asqalan', modernName: 'Ashkelon', countryCode: 'IL', region: 'sham', lat: 31.6688, lng: 34.5743 },
  { slug: 'qaysariyyah', nameAr: 'قيسارية', nameId: 'Qaysariyyah', modernName: 'Caesarea', countryCode: 'IL', region: 'sham', lat: 32.5000, lng: 34.8917, descriptionId: 'Kota pelabuhan dibebaskan zaman Umar.' },

  // ─── Iraq / Persia ───────────────────────────────────────
  { slug: 'anbar', nameAr: 'الأنبار', nameId: 'Anbar', countryCode: 'IQ', region: 'iraq', lat: 33.3833, lng: 43.7333, descriptionId: 'Kota tua di pinggir Furat.' },
  { slug: 'mawsil', nameAr: 'الموصل', nameId: 'Mawshil', modernName: 'Mosul', countryCode: 'IQ', region: 'iraq', lat: 36.3450, lng: 43.1450 },
  { slug: 'wasit', nameAr: 'واسط', nameId: 'Wasith', countryCode: 'IQ', region: 'iraq', lat: 32.1833, lng: 46.3000, descriptionId: 'Kota dibangun oleh al-Hajjaj bin Yusuf.' },
  { slug: 'hirah', nameAr: 'الحيرة', nameId: 'Hirah', countryCode: 'IQ', region: 'iraq', lat: 31.8833, lng: 44.4500, descriptionId: 'Ibukota Lakhmid pra-Islam.' },
  { slug: 'samarra', nameAr: 'سامراء', nameId: 'Samarra', countryCode: 'IQ', region: 'iraq', lat: 34.1983, lng: 43.8742, descriptionId: 'Ibukota Abbasiyah era pertengahan.' },
  { slug: 'nahawand', nameAr: 'نهاوند', nameId: 'Nahawand', countryCode: 'IR', region: 'persia', lat: 34.1889, lng: 48.3775, descriptionId: 'Lokasi Perang Nahawand (Fath al-Futuh).' },
  { slug: 'jalula', nameAr: 'جلولاء', nameId: 'Jalula', countryCode: 'IQ', region: 'iraq', lat: 34.2667, lng: 45.1500, descriptionId: 'Lokasi Perang Jalula melawan Persia.' },
  { slug: 'tustar', nameAr: 'تستر', nameId: 'Tustar', modernName: 'Shushtar', countryCode: 'IR', region: 'persia', lat: 32.0456, lng: 48.8567, descriptionId: 'Kota dibebaskan zaman Umar; lokasi penangkapan Hurmuzan.' },
  { slug: 'marw', nameAr: 'مرو', nameId: 'Marw', modernName: 'Merv', countryCode: 'TM', region: 'persia', lat: 37.6611, lng: 62.1936, descriptionId: 'Ibukota Khorasan, pusat ilmu masa Abbasiyah awal.' },
  { slug: 'balkh', nameAr: 'بلخ', nameId: 'Balkh', countryCode: 'AF', region: 'central_asia', lat: 36.7581, lng: 66.8972, descriptionId: 'Kota tua di Khurasan, kelahiran banyak ulama.' },
  { slug: 'sijistan', nameAr: 'سجستان', nameId: 'Sijistan', modernName: 'Sistan', countryCode: 'IR', region: 'persia', lat: 30.9500, lng: 61.8000, descriptionId: 'Wilayah timur Persia, kelahiran Abu Dawud.' },
  { slug: 'isfahan', nameAr: 'أصبهان', nameId: 'Ashbahan', modernName: 'Isfahan', countryCode: 'IR', region: 'persia', lat: 32.6539, lng: 51.6660 },
  { slug: 'ray', nameAr: 'الري', nameId: 'Ray', modernName: 'Rey', countryCode: 'IR', region: 'persia', lat: 35.5928, lng: 51.4344, descriptionId: 'Kota tua, kelahiran Imam ar-Razi.' },
  { slug: 'hamadan', nameAr: 'همذان', nameId: 'Hamadzan', modernName: 'Hamadan', countryCode: 'IR', region: 'persia', lat: 34.7989, lng: 48.5147 },

  // ─── Misr / Afrika ───────────────────────────────────────
  { slug: 'asyut', nameAr: 'أسيوط', nameId: 'Asyuth', modernName: 'Asyut', countryCode: 'EG', region: 'misr', lat: 27.1809, lng: 31.1837 },
  { slug: 'damiat', nameAr: 'دمياط', nameId: 'Damiath', modernName: 'Damietta', countryCode: 'EG', region: 'misr', lat: 31.4175, lng: 31.8144, descriptionId: 'Kota pelabuhan, lokasi Pertempuran Damietta era Salib.' },
  { slug: 'qairouan', nameAr: 'القيروان', nameId: 'Qairawan', modernName: 'Kairouan', countryCode: 'TN', region: 'maghrib', lat: 35.6781, lng: 10.0961, descriptionId: 'Kota didirikan oleh Uqbah bin Nafi.' },
  { slug: 'fas', nameAr: 'فاس', nameId: 'Fas', modernName: 'Fes', countryCode: 'MA', region: 'maghrib', lat: 34.0331, lng: -5.0003, descriptionId: 'Pusat ilmu Maghrib, lokasi Universitas al-Qarawiyyin.' },
  { slug: 'tahart', nameAr: 'تاهرت', nameId: 'Tahart', modernName: 'Tiaret', countryCode: 'DZ', region: 'maghrib', lat: 35.3700, lng: 1.3170, descriptionId: 'Ibukota Rustamiyyah di Maghrib Tengah.' },
  { slug: 'mahdiyyah', nameAr: 'المهدية', nameId: 'Mahdiyyah', modernName: 'Mahdia', countryCode: 'TN', region: 'maghrib', lat: 35.5047, lng: 11.0622, descriptionId: 'Ibukota Fatimiyyah awal.' },

  // ─── Andalusia ───────────────────────────────────────────
  { slug: 'isybiliyyah', nameAr: 'إشبيلية', nameId: 'Isybiliyyah', modernName: 'Sevilla', countryCode: 'ES', region: 'andalusia', lat: 37.3886, lng: -5.9823 },
  { slug: 'tulaitulah', nameAr: 'طليطلة', nameId: 'Thulaithilah', modernName: 'Toledo', countryCode: 'ES', region: 'andalusia', lat: 39.8628, lng: -4.0273, descriptionId: 'Pusat penerjemahan ilmu di Andalusia.' },
  { slug: 'saraqustha', nameAr: 'سرقسطة', nameId: 'Saraqusthah', modernName: 'Zaragoza', countryCode: 'ES', region: 'andalusia', lat: 41.6488, lng: -0.8891 },
  { slug: 'malaqah', nameAr: 'مالقة', nameId: 'Malaqah', modernName: 'Málaga', countryCode: 'ES', region: 'andalusia', lat: 36.7213, lng: -4.4214 },
  { slug: 'balansiyah', nameAr: 'بلنسية', nameId: 'Balansiyyah', modernName: 'Valencia', countryCode: 'ES', region: 'andalusia', lat: 39.4699, lng: -0.3763 },

  // ─── Central Asia ────────────────────────────────────────
  { slug: 'khwarizm', nameAr: 'خوارزم', nameId: 'Khawarizm', modernName: 'Khorezm', countryCode: 'UZ', region: 'central_asia', lat: 41.5500, lng: 60.6333, descriptionId: 'Wilayah kelahiran al-Khawarizmi.' },
  { slug: 'tirmiz', nameAr: 'ترمذ', nameId: 'Tirmidz', modernName: 'Termez', countryCode: 'UZ', region: 'central_asia', lat: 37.2242, lng: 67.2783, descriptionId: 'Kota kelahiran Imam at-Tirmidzi.' },
  { slug: 'farghanah', nameAr: 'فرغانة', nameId: 'Farghanah', modernName: 'Fergana', countryCode: 'UZ', region: 'central_asia', lat: 40.3864, lng: 71.7864 },

  // ─── Anatolia ────────────────────────────────────────────
  { slug: 'qusthantiniyyah', nameAr: 'القسطنطينية', nameId: 'Qusthanthiniyyah', modernName: 'Istanbul', countryCode: 'TR', region: 'anatolia', lat: 41.0082, lng: 28.9784, descriptionId: 'Konstantinopel, dibebaskan tahun 1453 M.' },
  { slug: 'amuriyyah', nameAr: 'عمورية', nameId: 'Amuriyyah', modernName: 'Amorium', countryCode: 'TR', region: 'anatolia', lat: 39.0214, lng: 31.2914, descriptionId: 'Kota Bizantium, dibebaskan al-Mu`tashim 838 M.' },
]

export async function seed018LocationsExtra() {
  const db = getSeedDb()
  let total = 0
  for (const loc of LOCATIONS) {
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
  logSeed('locations_extra', total)
}
