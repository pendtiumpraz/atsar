// Relations seeder: figure_locations, battle_participants, figure_relations.
// Runs AFTER all figure seeders (017-025) and battle seeder (026).
// Slug lookups are LOOSE — silently skip when a referenced slug doesn't exist
// (some upstream seeders may produce different slugs or be partially run).

import { and, eq, sql } from 'drizzle-orm'
import { getSeedDb, logSeed } from './_helpers.js'
import {
  figureLocations,
  battleParticipants,
  figureRelations,
  figures,
  locations,
  battles,
} from '../schema/index.js'

type FigureLocationRole = 'birthplace' | 'residence' | 'dakwah' | 'martyr' | 'burial'
type BattleParticipantRole = 'commander' | 'sahabat' | 'fallen' | 'captured'
type FigureRelationType =
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

interface FigureLocationLink {
  figureSlug: string
  locationSlug: string
  role: FigureLocationRole
  periodStartAh?: number
  periodEndAh?: number
}

interface BattleParticipantLink {
  battleSlug: string
  figureSlug: string
  role: BattleParticipantRole
}

interface FigureRelationPair {
  /** Direction A → B; reverse pair is inserted automatically. */
  fromSlug: string
  toSlug: string
  forward: FigureRelationType
  reverse: FigureRelationType
}

// ─── A. figure_locations links ──────────────────────────────────────
const LOCATION_LINKS: FigureLocationLink[] = [
  // Nabi Muhammad ﷺ
  { figureSlug: 'nabi-muhammad', locationSlug: 'makkah', role: 'birthplace' },
  { figureSlug: 'nabi-muhammad', locationSlug: 'makkah', role: 'residence', periodStartAh: -53, periodEndAh: 0 },
  { figureSlug: 'nabi-muhammad', locationSlug: 'madinah', role: 'residence', periodStartAh: 1, periodEndAh: 11 },
  { figureSlug: 'nabi-muhammad', locationSlug: 'madinah', role: 'burial' },

  // Khulafa Rasyidin
  { figureSlug: 'abu-bakr-as-shiddiq', locationSlug: 'makkah', role: 'residence', periodStartAh: -50, periodEndAh: 0 },
  { figureSlug: 'abu-bakr-as-shiddiq', locationSlug: 'madinah', role: 'residence', periodStartAh: 1, periodEndAh: 13 },
  { figureSlug: 'abu-bakr-as-shiddiq', locationSlug: 'madinah', role: 'burial' },

  { figureSlug: 'umar-bin-khattab', locationSlug: 'makkah', role: 'residence', periodStartAh: -40, periodEndAh: 0 },
  { figureSlug: 'umar-bin-khattab', locationSlug: 'madinah', role: 'residence', periodStartAh: 1, periodEndAh: 23 },
  { figureSlug: 'umar-bin-khattab', locationSlug: 'madinah', role: 'martyr' },
  { figureSlug: 'umar-bin-khattab', locationSlug: 'madinah', role: 'burial' },

  { figureSlug: 'utsman-bin-affan', locationSlug: 'makkah', role: 'residence', periodStartAh: -45, periodEndAh: 0 },
  { figureSlug: 'utsman-bin-affan', locationSlug: 'madinah', role: 'residence', periodStartAh: 1, periodEndAh: 35 },
  { figureSlug: 'utsman-bin-affan', locationSlug: 'madinah', role: 'martyr' },

  { figureSlug: 'ali-bin-abi-thalib', locationSlug: 'makkah', role: 'birthplace' },
  { figureSlug: 'ali-bin-abi-thalib', locationSlug: 'madinah', role: 'residence', periodStartAh: 1, periodEndAh: 36 },
  { figureSlug: 'ali-bin-abi-thalib', locationSlug: 'kufah', role: 'residence', periodStartAh: 36, periodEndAh: 40 },
  { figureSlug: 'ali-bin-abi-thalib', locationSlug: 'kufah', role: 'martyr' },

  // Ummahatul Mukminin & ahlul bayt
  { figureSlug: 'khadijah-binti-khuwailid', locationSlug: 'makkah', role: 'residence' },
  { figureSlug: 'khadijah-binti-khuwailid', locationSlug: 'makkah', role: 'burial' },
  { figureSlug: 'aisyah-binti-abu-bakr', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'aisyah-binti-abu-bakr', locationSlug: 'madinah', role: 'burial' },
  { figureSlug: 'fathimah-az-zahra', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'fathimah-az-zahra', locationSlug: 'madinah', role: 'burial' },
  { figureSlug: 'hafshah-binti-umar', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'ummu-salamah', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'asma-binti-abu-bakr', locationSlug: 'makkah', role: 'residence' },

  // Sahabat senior (Asyrah Mubasysyarah & others)
  { figureSlug: 'hamzah-bin-abdul-muthalib', locationSlug: 'makkah', role: 'residence' },
  { figureSlug: 'hamzah-bin-abdul-muthalib', locationSlug: 'uhud', role: 'martyr' },
  { figureSlug: 'mush-ab-bin-umair', locationSlug: 'makkah', role: 'residence' },
  { figureSlug: 'mush-ab-bin-umair', locationSlug: 'madinah', role: 'dakwah' },
  { figureSlug: 'mush-ab-bin-umair', locationSlug: 'uhud', role: 'martyr' },
  { figureSlug: 'bilal-bin-rabah', locationSlug: 'makkah', role: 'residence' },
  { figureSlug: 'bilal-bin-rabah', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'bilal-bin-rabah', locationSlug: 'damascus', role: 'burial' },
  { figureSlug: 'khalid-bin-walid', locationSlug: 'makkah', role: 'birthplace' },
  { figureSlug: 'khalid-bin-walid', locationSlug: 'yarmuk', role: 'dakwah' },
  { figureSlug: 'khalid-bin-walid', locationSlug: 'hims', role: 'burial' },
  { figureSlug: 'abu-ubaidah-bin-jarrah', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'abu-ubaidah-bin-jarrah', locationSlug: 'yarmuk', role: 'dakwah' },
  { figureSlug: 'saad-bin-abi-waqqash', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'saad-bin-abi-waqqash', locationSlug: 'qadisiyyah', role: 'dakwah' },
  { figureSlug: 'saad-bin-abi-waqqash', locationSlug: 'kufah', role: 'residence' },
  { figureSlug: 'amr-bin-ash', locationSlug: 'fustat', role: 'residence' },
  { figureSlug: 'amr-bin-ash', locationSlug: 'fustat', role: 'burial' },
  { figureSlug: 'salman-al-farisi', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'salman-al-farisi', locationSlug: 'ctesiphon', role: 'residence' },
  { figureSlug: 'abu-hurairah', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'abu-hurairah', locationSlug: 'madinah', role: 'burial' },
  { figureSlug: 'abdullah-bin-masud', locationSlug: 'kufah', role: 'residence' },
  { figureSlug: 'abdullah-bin-masud', locationSlug: 'madinah', role: 'burial' },
  { figureSlug: 'abdullah-bin-abbas', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'abdullah-bin-abbas', locationSlug: 'thaif', role: 'burial' },
  { figureSlug: 'abdullah-bin-umar', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'anas-bin-malik', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'anas-bin-malik', locationSlug: 'bashrah', role: 'residence' },
  { figureSlug: 'muadz-bin-jabal', locationSlug: 'madinah', role: 'residence' },

  // Sumayyah & Yasir famly (martyr at Makkah)
  { figureSlug: 'sumayyah-binti-khayyat', locationSlug: 'makkah', role: 'martyr' },

  // Tabiin
  { figureSlug: 'said-bin-musayyab', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'urwah-bin-zubair', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'hasan-al-bashri', locationSlug: 'bashrah', role: 'residence' },
  { figureSlug: 'muhammad-bin-sirin', locationSlug: 'bashrah', role: 'residence' },
  { figureSlug: 'az-zuhri', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'az-zuhri', locationSlug: 'damascus', role: 'residence' },
  { figureSlug: 'umar-bin-abdul-aziz', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'umar-bin-abdul-aziz', locationSlug: 'damascus', role: 'residence' },
  { figureSlug: 'ata-bin-abi-rabah', locationSlug: 'makkah', role: 'residence' },
  { figureSlug: 'mujahid-bin-jabr', locationSlug: 'makkah', role: 'residence' },
  { figureSlug: 'ibrahim-an-nakhai', locationSlug: 'kufah', role: 'residence' },

  // Tabiut Tabiin / A'immah arba'ah
  { figureSlug: 'imam-abu-hanifah', locationSlug: 'kufah', role: 'residence' },
  { figureSlug: 'imam-abu-hanifah', locationSlug: 'baghdad', role: 'residence' },
  { figureSlug: 'imam-abu-hanifah', locationSlug: 'baghdad', role: 'burial' },
  { figureSlug: 'imam-malik-bin-anas', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'imam-malik-bin-anas', locationSlug: 'madinah', role: 'burial' },
  { figureSlug: 'imam-asy-syafii', locationSlug: 'makkah', role: 'residence' },
  { figureSlug: 'imam-asy-syafii', locationSlug: 'baghdad', role: 'residence' },
  { figureSlug: 'imam-asy-syafii', locationSlug: 'fustat', role: 'residence' },
  { figureSlug: 'imam-asy-syafii', locationSlug: 'fustat', role: 'burial' },
  { figureSlug: 'imam-ahmad-bin-hanbal', locationSlug: 'baghdad', role: 'birthplace' },
  { figureSlug: 'imam-ahmad-bin-hanbal', locationSlug: 'baghdad', role: 'residence' },
  { figureSlug: 'imam-ahmad-bin-hanbal', locationSlug: 'baghdad', role: 'burial' },
  { figureSlug: 'imam-bukhari', locationSlug: 'bukhara', role: 'birthplace' },
  { figureSlug: 'imam-bukhari', locationSlug: 'naysabur', role: 'residence' },
  { figureSlug: 'imam-bukhari', locationSlug: 'samarkand', role: 'burial' },
  { figureSlug: 'imam-muslim', locationSlug: 'naysabur', role: 'birthplace' },
  { figureSlug: 'imam-muslim', locationSlug: 'naysabur', role: 'residence' },
  { figureSlug: 'imam-muslim', locationSlug: 'naysabur', role: 'burial' },
  { figureSlug: 'imam-at-tirmizi', locationSlug: 'tirmiz', role: 'residence' },
  { figureSlug: 'imam-an-nasai', locationSlug: 'al-quds', role: 'burial' },

  // Ulama pasca salaf
  { figureSlug: 'ibn-taimiyyah', locationSlug: 'damascus', role: 'residence' },
  { figureSlug: 'ibn-taimiyyah', locationSlug: 'damascus', role: 'burial' },
  { figureSlug: 'ibnul-qayyim', locationSlug: 'damascus', role: 'residence' },
  { figureSlug: 'ibnul-qayyim', locationSlug: 'damascus', role: 'burial' },
  { figureSlug: 'ibn-katsir', locationSlug: 'damascus', role: 'residence' },
  { figureSlug: 'ibn-rajab', locationSlug: 'damascus', role: 'residence' },
  { figureSlug: 'ibn-hajar', locationSlug: 'cairo', role: 'residence' },
  { figureSlug: 'ibn-hajar', locationSlug: 'cairo', role: 'burial' },
  { figureSlug: 'as-suyuthi', locationSlug: 'cairo', role: 'residence' },
  { figureSlug: 'an-nawawi', locationSlug: 'damascus', role: 'residence' },
  { figureSlug: 'al-qurthubi', locationSlug: 'cordoba', role: 'birthplace' },
  { figureSlug: 'al-qurthubi', locationSlug: 'cairo', role: 'residence' },
  { figureSlug: 'ibn-qudamah-al-maqdisi', locationSlug: 'damascus', role: 'residence' },
  { figureSlug: 'adz-dzahabi', locationSlug: 'damascus', role: 'residence' },
  { figureSlug: 'imam-ghazali', locationSlug: 'naysabur', role: 'residence' },
  { figureSlug: 'imam-ghazali', locationSlug: 'baghdad', role: 'residence' },
  { figureSlug: 'at-tabari', locationSlug: 'baghdad', role: 'residence' },
  { figureSlug: 'al-baihaqi', locationSlug: 'naysabur', role: 'residence' },
  { figureSlug: 'bin-baz', locationSlug: 'madinah', role: 'residence' },
  { figureSlug: 'muhammad-bin-abdul-wahhab', locationSlug: 'dariyah', role: 'dakwah' },
]

// ─── B. battle_participants links ───────────────────────────────────
const BATTLE_PARTICIPANTS: BattleParticipantLink[] = [
  // Ghazwah Badar (2 H)
  { battleSlug: 'ghazwah-badar', figureSlug: 'abu-bakr-as-shiddiq', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'umar-bin-khattab', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'ali-bin-abi-thalib', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'hamzah-bin-abdul-muthalib', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'mush-ab-bin-umair', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'saad-bin-abi-waqqash', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'zubair-bin-awwam', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'thalhah-bin-ubaidillah', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'abdurrahman-bin-auf', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'abu-ubaidah-bin-jarrah', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'said-bin-zaid', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'bilal-bin-rabah', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'sa-ad-bin-muadz', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'usaid-bin-hudair', role: 'sahabat' },
  { battleSlug: 'ghazwah-badar', figureSlug: 'abdullah-bin-masud', role: 'sahabat' },

  // Ghazwah Uhud (3 H)
  { battleSlug: 'ghazwah-uhud', figureSlug: 'abu-bakr-as-shiddiq', role: 'sahabat' },
  { battleSlug: 'ghazwah-uhud', figureSlug: 'umar-bin-khattab', role: 'sahabat' },
  { battleSlug: 'ghazwah-uhud', figureSlug: 'ali-bin-abi-thalib', role: 'sahabat' },
  { battleSlug: 'ghazwah-uhud', figureSlug: 'hamzah-bin-abdul-muthalib', role: 'fallen' },
  { battleSlug: 'ghazwah-uhud', figureSlug: 'mush-ab-bin-umair', role: 'fallen' },
  { battleSlug: 'ghazwah-uhud', figureSlug: 'zubair-bin-awwam', role: 'sahabat' },
  { battleSlug: 'ghazwah-uhud', figureSlug: 'thalhah-bin-ubaidillah', role: 'sahabat' },
  { battleSlug: 'ghazwah-uhud', figureSlug: 'abu-ubaidah-bin-jarrah', role: 'sahabat' },
  { battleSlug: 'ghazwah-uhud', figureSlug: 'saad-bin-abi-waqqash', role: 'sahabat' },
  { battleSlug: 'ghazwah-uhud', figureSlug: 'nusaybah-binti-kaab', role: 'sahabat' },

  // Ghazwah Khandaq (5 H)
  { battleSlug: 'ghazwah-khandaq', figureSlug: 'ali-bin-abi-thalib', role: 'sahabat' },
  { battleSlug: 'ghazwah-khandaq', figureSlug: 'umar-bin-khattab', role: 'sahabat' },
  { battleSlug: 'ghazwah-khandaq', figureSlug: 'salman-al-farisi', role: 'sahabat' },
  { battleSlug: 'ghazwah-khandaq', figureSlug: 'zubair-bin-awwam', role: 'sahabat' },

  // Ghazwah Khaibar (7 H)
  { battleSlug: 'ghazwah-khaibar', figureSlug: 'ali-bin-abi-thalib', role: 'commander' },
  { battleSlug: 'ghazwah-khaibar', figureSlug: 'abu-bakr-as-shiddiq', role: 'sahabat' },
  { battleSlug: 'ghazwah-khaibar', figureSlug: 'umar-bin-khattab', role: 'sahabat' },
  { battleSlug: 'ghazwah-khaibar', figureSlug: 'abu-hurairah', role: 'sahabat' },

  // Ghazwah Mu'tah (8 H)
  { battleSlug: 'ghazwah-mutah', figureSlug: 'khalid-bin-walid', role: 'commander' },
  { battleSlug: 'ghazwah-mutah', figureSlug: 'abdullah-bin-masud', role: 'sahabat' },

  // Fath Makkah (8 H)
  { battleSlug: 'fath-makkah', figureSlug: 'abu-bakr-as-shiddiq', role: 'sahabat' },
  { battleSlug: 'fath-makkah', figureSlug: 'umar-bin-khattab', role: 'sahabat' },
  { battleSlug: 'fath-makkah', figureSlug: 'ali-bin-abi-thalib', role: 'sahabat' },
  { battleSlug: 'fath-makkah', figureSlug: 'khalid-bin-walid', role: 'commander' },
  { battleSlug: 'fath-makkah', figureSlug: 'bilal-bin-rabah', role: 'sahabat' },

  // Ghazwah Hunain (8 H)
  { battleSlug: 'ghazwah-hunain', figureSlug: 'abu-bakr-as-shiddiq', role: 'sahabat' },
  { battleSlug: 'ghazwah-hunain', figureSlug: 'umar-bin-khattab', role: 'sahabat' },
  { battleSlug: 'ghazwah-hunain', figureSlug: 'ali-bin-abi-thalib', role: 'sahabat' },
  { battleSlug: 'ghazwah-hunain', figureSlug: 'abbas-bin-abdul-muthalib', role: 'sahabat' },

  // Ghazwah Tabuk (9 H)
  { battleSlug: 'ghazwah-tabuk', figureSlug: 'abu-bakr-as-shiddiq', role: 'sahabat' },
  { battleSlug: 'ghazwah-tabuk', figureSlug: 'umar-bin-khattab', role: 'sahabat' },
  { battleSlug: 'ghazwah-tabuk', figureSlug: 'utsman-bin-affan', role: 'sahabat' },
  { battleSlug: 'ghazwah-tabuk', figureSlug: 'ali-bin-abi-thalib', role: 'sahabat' },

  // Pertempuran Yarmuk (15 H) — fath Sham
  { battleSlug: 'pertempuran-yarmuk', figureSlug: 'khalid-bin-walid', role: 'commander' },
  { battleSlug: 'pertempuran-yarmuk', figureSlug: 'abu-ubaidah-bin-jarrah', role: 'commander' },
  { battleSlug: 'pertempuran-yarmuk', figureSlug: 'amr-bin-ash', role: 'commander' },

  // Pertempuran Qadisiyyah (15 H) — fath Iraq
  { battleSlug: 'pertempuran-qadisiyyah', figureSlug: 'saad-bin-abi-waqqash', role: 'commander' },

  // Fath Misr (19-21 H)
  { battleSlug: 'fath-misr', figureSlug: 'amr-bin-ash', role: 'commander' },
  { battleSlug: 'fath-misr', figureSlug: 'zubair-bin-awwam', role: 'commander' },
]

// ─── C. figure_relations (insert BOTH directions) ───────────────────
const RELATIONS: FigureRelationPair[] = [
  // Nabi ﷺ + Ummahatul Mukminin
  { fromSlug: 'nabi-muhammad', toSlug: 'khadijah-binti-khuwailid', forward: 'husband', reverse: 'wife' },
  { fromSlug: 'nabi-muhammad', toSlug: 'aisyah-binti-abu-bakr', forward: 'husband', reverse: 'wife' },
  { fromSlug: 'nabi-muhammad', toSlug: 'hafshah-binti-umar', forward: 'husband', reverse: 'wife' },
  { fromSlug: 'nabi-muhammad', toSlug: 'saudah-binti-zamah', forward: 'husband', reverse: 'wife' },
  { fromSlug: 'nabi-muhammad', toSlug: 'ummu-salamah', forward: 'husband', reverse: 'wife' },
  { fromSlug: 'nabi-muhammad', toSlug: 'zaynab-binti-jahsy', forward: 'husband', reverse: 'wife' },
  { fromSlug: 'nabi-muhammad', toSlug: 'maimunah-binti-harits', forward: 'husband', reverse: 'wife' },

  // Nabi ﷺ + putri-putrinya
  { fromSlug: 'nabi-muhammad', toSlug: 'fathimah-az-zahra', forward: 'father', reverse: 'daughter' },
  { fromSlug: 'nabi-muhammad', toSlug: 'zaynab-binti-muhammad', forward: 'father', reverse: 'daughter' },
  { fromSlug: 'nabi-muhammad', toSlug: 'ruqayyah-binti-muhammad', forward: 'father', reverse: 'daughter' },
  { fromSlug: 'nabi-muhammad', toSlug: 'ummu-kultsum-binti-muhammad', forward: 'father', reverse: 'daughter' },

  // Abu Bakr + putrinya
  { fromSlug: 'abu-bakr-as-shiddiq', toSlug: 'aisyah-binti-abu-bakr', forward: 'father', reverse: 'daughter' },
  { fromSlug: 'abu-bakr-as-shiddiq', toSlug: 'asma-binti-abu-bakr', forward: 'father', reverse: 'daughter' },

  // Umar + putrinya
  { fromSlug: 'umar-bin-khattab', toSlug: 'hafshah-binti-umar', forward: 'father', reverse: 'daughter' },

  // Ali + Fathimah (suami-istri)
  { fromSlug: 'ali-bin-abi-thalib', toSlug: 'fathimah-az-zahra', forward: 'husband', reverse: 'wife' },

  // Abbas → Abdullah bin Abbas (ayah-anak)
  { fromSlug: 'abbas-bin-abdul-muthalib', toSlug: 'abdullah-bin-abbas', forward: 'father', reverse: 'son' },

  // Umar → Abdullah bin Umar (ayah-anak)
  { fromSlug: 'umar-bin-khattab', toSlug: 'abdullah-bin-umar', forward: 'father', reverse: 'son' },

  // Amr bin Ash → Abdullah bin Amr bin Ash (ayah-anak)
  { fromSlug: 'amr-bin-ash', toSlug: 'abdullah-bin-amr-bin-ash', forward: 'father', reverse: 'son' },

  // Companions of Nabi ﷺ (notable narrators)
  { fromSlug: 'abu-hurairah', toSlug: 'nabi-muhammad', forward: 'companion', reverse: 'companion' },
  { fromSlug: 'bilal-bin-rabah', toSlug: 'nabi-muhammad', forward: 'companion', reverse: 'companion' },
  { fromSlug: 'anas-bin-malik', toSlug: 'nabi-muhammad', forward: 'companion', reverse: 'companion' },
  { fromSlug: 'salman-al-farisi', toSlug: 'nabi-muhammad', forward: 'companion', reverse: 'companion' },

  // Guru–murid: silsilah salaf
  { fromSlug: 'az-zuhri', toSlug: 'imam-malik-bin-anas', forward: 'teacher_of', reverse: 'student_of' },
  { fromSlug: 'imam-malik-bin-anas', toSlug: 'imam-asy-syafii', forward: 'teacher_of', reverse: 'student_of' },
  { fromSlug: 'imam-asy-syafii', toSlug: 'imam-ahmad-bin-hanbal', forward: 'teacher_of', reverse: 'student_of' },
  { fromSlug: 'imam-ahmad-bin-hanbal', toSlug: 'imam-bukhari', forward: 'teacher_of', reverse: 'student_of' },
  { fromSlug: 'imam-bukhari', toSlug: 'imam-muslim', forward: 'teacher_of', reverse: 'student_of' },

  // Ibn Taimiyyah → murid-muridnya
  { fromSlug: 'ibn-taimiyyah', toSlug: 'ibnul-qayyim', forward: 'teacher_of', reverse: 'student_of' },
  { fromSlug: 'ibn-taimiyyah', toSlug: 'adz-dzahabi', forward: 'teacher_of', reverse: 'student_of' },
  { fromSlug: 'ibn-taimiyyah', toSlug: 'ibn-katsir', forward: 'teacher_of', reverse: 'student_of' },

  // Adz-Dzahabi → murid
  { fromSlug: 'adz-dzahabi', toSlug: 'ibn-katsir', forward: 'teacher_of', reverse: 'student_of' },

  // Tabiin: Az-Zuhri belajar dari Said bin Musayyab
  { fromSlug: 'said-bin-musayyab', toSlug: 'az-zuhri', forward: 'teacher_of', reverse: 'student_of' },

  // Ibn Abbas → murid besar (tabiin)
  { fromSlug: 'abdullah-bin-abbas', toSlug: 'mujahid-bin-jabr', forward: 'teacher_of', reverse: 'student_of' },
  { fromSlug: 'abdullah-bin-abbas', toSlug: 'ata-bin-abi-rabah', forward: 'teacher_of', reverse: 'student_of' },
  { fromSlug: 'abdullah-bin-abbas', toSlug: 'ikrimah-mawla-ibn-abbas', forward: 'teacher_of', reverse: 'student_of' },

  // Abdullah bin Umar → Nafi'
  { fromSlug: 'abdullah-bin-umar', toSlug: 'nafi-mawla-ibn-umar', forward: 'teacher_of', reverse: 'student_of' },

  // Anas bin Malik → Hasan al-Bashri
  { fromSlug: 'anas-bin-malik', toSlug: 'hasan-al-bashri', forward: 'teacher_of', reverse: 'student_of' },

  // Sibling: Aisyah <-> Asma (both daughters of Abu Bakr)
  { fromSlug: 'aisyah-binti-abu-bakr', toSlug: 'asma-binti-abu-bakr', forward: 'sibling', reverse: 'sibling' },

  // Sibling: Hamzah & Abbas (both paman Nabi)
  { fromSlug: 'hamzah-bin-abdul-muthalib', toSlug: 'abbas-bin-abdul-muthalib', forward: 'sibling', reverse: 'sibling' },
]

export async function seed027Relations() {
  const db = getSeedDb()

  // Build slug → id lookups (active rows only)
  const figs = await db
    .select({ id: figures.id, slug: figures.slug })
    .from(figures)
    .where(sql`${figures.deletedAt} IS NULL`)
  const figBySlug = new Map(figs.map((f) => [f.slug, f.id]))

  const locs = await db
    .select({ id: locations.id, slug: locations.slug })
    .from(locations)
    .where(sql`${locations.deletedAt} IS NULL`)
  const locBySlug = new Map(locs.map((l) => [l.slug, l.id]))

  const btls = await db
    .select({ id: battles.id, slug: battles.slug })
    .from(battles)
    .where(sql`${battles.deletedAt} IS NULL`)
  const btlBySlug = new Map(btls.map((b) => [b.slug, b.id]))

  // ─── A. figure_locations ────────────────────────────────────────
  // No unique constraint on figure_locations → check existence first.
  let countLocs = 0
  for (const link of LOCATION_LINKS) {
    const fid = figBySlug.get(link.figureSlug)
    const lid = locBySlug.get(link.locationSlug)
    if (!fid || !lid) continue

    const existing = await db
      .select({ id: figureLocations.id })
      .from(figureLocations)
      .where(
        and(
          eq(figureLocations.figureId, fid),
          eq(figureLocations.locationId, lid),
          eq(figureLocations.role, link.role),
          sql`${figureLocations.deletedAt} IS NULL`,
        ),
      )
      .limit(1)
    if (existing.length > 0) continue

    const result = await db
      .insert(figureLocations)
      .values({
        figureId: fid,
        locationId: lid,
        role: link.role,
        periodStartAh: link.periodStartAh,
        periodEndAh: link.periodEndAh,
      })
      .returning({ id: figureLocations.id })
    if (result.length > 0) countLocs++
  }
  logSeed('figure_locations', countLocs)

  // ─── B. battle_participants ─────────────────────────────────────
  // Composite PK (battleId, figureId) → onConflictDoNothing handles re-runs.
  let countParts = 0
  for (const link of BATTLE_PARTICIPANTS) {
    const bid = btlBySlug.get(link.battleSlug)
    const fid = figBySlug.get(link.figureSlug)
    if (!bid || !fid) continue

    const result = await db
      .insert(battleParticipants)
      .values({ battleId: bid, figureId: fid, role: link.role })
      .onConflictDoNothing()
      .returning({ battleId: battleParticipants.battleId })
    if (result.length > 0) countParts++
  }
  logSeed('battle_participants', countParts)

  // ─── C. figure_relations (both directions) ──────────────────────
  // Partial unique (figure_id, related_id, relation_type) WHERE deleted_at IS NULL
  let countRels = 0
  for (const pair of RELATIONS) {
    const fromId = figBySlug.get(pair.fromSlug)
    const toId = figBySlug.get(pair.toSlug)
    if (!fromId || !toId || fromId === toId) continue

    // Forward
    const fwd = await db
      .insert(figureRelations)
      .values({ figureId: fromId, relatedId: toId, relationType: pair.forward })
      .onConflictDoNothing()
      .returning({ id: figureRelations.id })
    if (fwd.length > 0) countRels++

    // Reverse
    const rev = await db
      .insert(figureRelations)
      .values({ figureId: toId, relatedId: fromId, relationType: pair.reverse })
      .onConflictDoNothing()
      .returning({ id: figureRelations.id })
    if (rev.length > 0) countRels++
  }
  logSeed('figure_relations', countRels)
}
