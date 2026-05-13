import { getSeedDb, logSeed } from './_helpers.js'
import { tiers } from '../schema/index.js'

// Pricing per IDEAS.md §6.3.
const TIERS = [
  {
    slug: 'free',
    nameId: 'Free',
    priceMonthlyIdr: 0,
    priceYearlyIdr: 0,
    downloadQuota: 0,
    aiChatQuota: 10,
    contentScope: {
      categories: ['nabi', 'shalih_pre_rasul'],
      curatedCount: { sahabat: 30 },
    },
    displayOrder: 10,
  },
  {
    slug: 'sampler',
    nameId: 'Sampler',
    priceMonthlyIdr: 29_000,
    priceYearlyIdr: 249_000,
    downloadQuota: 50,
    aiChatQuota: 50,
    contentScope: {
      categories: ['nabi', 'shalih_pre_rasul'],
      curatedCount: { sahabat: 20, tabiin: 20, tabiut_tabiin: 20 },
    },
    displayOrder: 20,
  },
  {
    slug: 'basic',
    nameId: 'Basic',
    priceMonthlyIdr: 99_000,
    priceYearlyIdr: 1_069_200,
    downloadQuota: 100,
    aiChatQuota: 100,
    contentScope: { categories: ['nabi', 'shalih_pre_rasul', 'sahabat'] },
    displayOrder: 30,
  },
  {
    slug: 'pro',
    nameId: 'Pro',
    priceMonthlyIdr: 299_000,
    priceYearlyIdr: 3_229_200,
    downloadQuota: 500,
    aiChatQuota: 300,
    contentScope: {
      categories: ['nabi', 'shalih_pre_rasul', 'sahabat', 'tabiin'],
    },
    displayOrder: 40,
  },
  {
    slug: 'premium',
    nameId: 'Premium',
    priceMonthlyIdr: 499_000,
    priceYearlyIdr: 5_389_200,
    downloadQuota: 1000,
    aiChatQuota: 1000,
    contentScope: {
      categories: [
        'nabi',
        'shalih_pre_rasul',
        'sahabat',
        'tabiin',
        'tabiut_tabiin',
        'shalih_pasca_rasul',
      ],
    },
    displayOrder: 50,
  },
]

export async function seed006Tiers() {
  const db = getSeedDb()
  const result = await db.insert(tiers).values(TIERS).onConflictDoNothing().returning()
  logSeed('tiers', result.length)
}
