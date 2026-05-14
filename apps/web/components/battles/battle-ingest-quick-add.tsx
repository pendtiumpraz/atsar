// `<BattleIngestQuickAdd />` — admin entrypoint embedded in the public
// `/battles` page header.
//
// Mirrors `<FigureIngestQuickAdd />`. On a successful submit we forward the
// user to `/admin/battles` so they can watch the job finish in the proper
// admin workspace.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { BattleIngestDialog } from '@/components/admin/battles/battle-ingest-dialog'
import { Button } from '@/components/ui/button'
import { api, ApiClientError } from '@/lib/api/client'

type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export function BattleIngestQuickAdd() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  const submit = useMutation({
    mutationFn: (body: { name: string; type?: string; hints?: string }) =>
      api.post<{ jobId: string; status: JobStatus; publishError?: string }>(
        '/admin/battles/ingest',
        body,
      ),
    onSuccess: (data) => {
      toast.success('Memulai riset AI… proses ~30–60 detik')
      if (data.publishError) {
        toast.warning(
          'QStash gagal publish — job tercatat tapi worker tidak ter-trigger di local dev.',
        )
      }
      setDialogOpen(false)
      router.push('/admin/battles')
    },
    onError: (err) => {
      const msg = err instanceof ApiClientError ? err.message : 'Gagal memulai riset'
      toast.error(msg)
    },
  })

  return (
    <>
      <Button
        onClick={() => setDialogOpen(true)}
        size="sm"
        className="shrink-0"
        aria-label="Tambah Perang (AI)"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        <span className="hidden sm:inline">Tambah Perang (AI)</span>
      </Button>

      <BattleIngestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(values) => submit.mutate(values)}
        submitting={submit.isPending}
      />
    </>
  )
}
