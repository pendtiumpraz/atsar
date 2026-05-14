// Admin → AI Provider detail (`/admin/ai-providers/[id]`).
//
// Server component. Validates the param shape and renders a client component
// that fetches `GET /api/v1/admin/ai-providers/[id]` for the provider header
// + its models table. All mutations (rename, rotate, edit/add/delete model)
// run client-side against the same REST surface.

import { notFound } from 'next/navigation'
import { z } from 'zod'

import { ProviderDetail } from '@/components/admin/ai/provider-detail'

const paramSchema = z.object({ id: z.string().uuid() })

interface PageProps {
  params: Promise<{ id: string }>
}

export const metadata = {
  title: 'AI Provider · Detail · Atsar',
  description: 'Detail provider AI + manajemen model.',
}

export default async function AdminAiProviderDetailPage({ params }: PageProps) {
  const parsed = paramSchema.safeParse(await params)
  if (!parsed.success) notFound()
  return <ProviderDetail providerId={parsed.data.id} />
}
