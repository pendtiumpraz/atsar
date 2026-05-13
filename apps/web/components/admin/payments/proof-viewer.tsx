// `<ProofViewer />` — modal that previews a bukti-pembayaran asset.
//
// The proof URL can point at either an image (PNG/JPG/WEBP) or a PDF — we
// branch on the URL extension and render `<img>` for images, `<iframe>` for
// PDFs. We always offer an "Open in new tab" fallback so the admin can pop
// the proof out for closer inspection.
//
// All copy is Indonesian (admin surface).

'use client'

import { ExternalLink } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

export interface ProofViewerProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Public URL to the uploaded proof. */
  url: string | null | undefined
  /** Optional label shown in the title (e.g. payment reference / user). */
  title?: string
}

function isPdf(url: string): boolean {
  const clean = url.split('?')[0]?.toLowerCase() ?? ''
  return clean.endsWith('.pdf')
}

export function ProofViewer({ open, onOpenChange, url, title }: ProofViewerProps) {
  const hasUrl = typeof url === 'string' && url.trim().length > 0
  const pdf = hasUrl && isPdf(url as string)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Bukti Pembayaran</DialogTitle>
          <DialogDescription>
            {title ? title : 'Pratinjau file bukti transfer yang diunggah pengguna.'}
          </DialogDescription>
        </DialogHeader>

        <div className="relative max-h-[70vh] min-h-[320px] overflow-hidden rounded-md border border-[rgb(var(--border))] bg-[rgb(var(--bg-elevated))]">
          {!hasUrl ? (
            <div className="flex h-[320px] items-center justify-center p-6 text-sm text-[rgb(var(--text-muted))]">
              Tidak ada bukti yang dilampirkan.
            </div>
          ) : pdf ? (
            <iframe
              src={url as string}
              title="Bukti pembayaran (PDF)"
              className="h-[70vh] w-full"
            />
          ) : (
            // Plain <img> avoids next/image domain config friction for admin-
            // only screens; bukti pembayaran is rarely above a few MB.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={url as string}
              alt="Bukti pembayaran"
              className="mx-auto block max-h-[70vh] w-auto object-contain"
            />
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          {hasUrl ? (
            <Button asChild variant="outline">
              <a
                href={url as string}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5"
              >
                <ExternalLink className="h-4 w-4" />
                Buka di tab baru
              </a>
            </Button>
          ) : null}
          <Button type="button" onClick={() => onOpenChange(false)}>
            Tutup
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
