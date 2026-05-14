// GET /api/v1/admin/ai-models — list every model across providers.
// Used by the admin "Semua Model" tab. Permission: `ai_providers.manage`.

import { ok, withErrorHandling } from '@/lib/server/api'
import { requirePermission } from '@/lib/server/rbac'
import * as aiSvc from '@/lib/server/services/ai-provider.service'

export const GET = withErrorHandling(async (req) => {
  await requirePermission(req, 'ai_providers.manage')
  const rows = await aiSvc.listModels()
  return ok(rows)
})
