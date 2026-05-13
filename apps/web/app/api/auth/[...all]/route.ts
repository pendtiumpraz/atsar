// Better-auth catch-all Next.js route handler.
//
// Exposes every better-auth endpoint under `/api/auth/*` (sign-in,
// sign-up, verify-email, session, etc.). See:
// https://www.better-auth.com/docs/integrations/next

import { toNextJsHandler } from 'better-auth/next-js'

import { auth } from '@/lib/server/auth'

export const { GET, POST } = toNextJsHandler(auth.handler)
