// `<FigureIngestQuickAdd />` — admin entrypoint embedded in the public
// `/figures` page header.
//
// Mirrors the mutation/dialog wiring of `<FigureIngestPanel />` but skips the
// recent-jobs history list: this is just a one-click "open the dialog" affordance
// for admins who happen to be browsing the public listing. On a successful
// submit we forward the user to `/admin/figures` so they can watch the job
// finish in the proper admin workspace.

'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useMutation } from '@tanstack/react-query'
import { Sparkles } from 'lucide-react'
import { toast } from 'sonner'

import { FigureIngestDialog } from '@/components/admin/figures/figure-ingest-dialog'
import { Button } from '@/components/ui/button'
import { api, ApiClientError } from '@/lib/api/client'

type JobStatus = 'pending' | 'running' | 'completed' | 'failed'

export function FigureIngestQuickAdd() {
  const router = useRouter()
  const [dialogOpen, setDialogOpen] = useState(false)

  const submit = useMutation({
    mutationFn: (body: {
      name: string
      category: string
      gender?: string
      hints?: string
    }) =>
      api.post<{ jobId: string; status: JobStatus; publishError?: string }>(
        '/admin/figures/ingest',
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
      // Drop the admin into the proper workspace to watch the job complete.
      router.push('/admin/figures')
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
        aria-label="Tambah Tokoh (AI)"
      >
        <Sparkles className="h-4 w-4" aria-hidden />
        {/* Label hides on narrow widths so the button collapses to icon-only. */}
        <span className="hidden sm:inline">Tambah Tokoh (AI)</span>
      </Button>

      <FigureIngestDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSubmit={(values) => submit.mutate(values)}
        submitting={submit.isPending}
      />
    </>
  )
}
