import { getSeedDb, logSeed } from './_helpers.js'
import { roles } from '../schema/index.js'

export async function seed001Roles() {
  const db = getSeedDb()
  const data = [
    {
      slug: 'admin',
      nameId: 'Administrator',
      nameAr: 'مدير',
      description: 'Akses penuh — manage konten, AI, lisensi, ustadz, font.',
      isSystem: true,
    },
    {
      slug: 'reviewer',
      nameId: 'Reviewer (Ustadz)',
      nameAr: 'مراجع',
      description: 'Ustadz yang me-review konten AI sebelum di-publish.',
      isSystem: true,
    },
    {
      slug: 'subscriber',
      nameId: 'Subscriber',
      nameAr: 'مشترك',
      description: 'Pengguna berlangganan (Free / Sampler / Basic / Pro / Premium).',
      isSystem: true,
    },
  ]
  const result = await db.insert(roles).values(data).onConflictDoNothing().returning()
  logSeed('roles', result.length)
}
