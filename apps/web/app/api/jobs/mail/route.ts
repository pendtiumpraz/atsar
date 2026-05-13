// Job: send transactional email via Resend.
//
// Producers publish to `/api/jobs/mail` with `{ to, subject, html|text }`
// (see `publishJob('mail', ...)`). This handler verifies the QStash
// signature, validates the payload, and forwards to Resend.
//
// Resend lib isn't installed yet — the actual API call is commented out;
// for now we just log the payload so the queue end-to-end can be smoke-
// tested without external creds.

import { z } from 'zod'
import { withSignature } from '../_lib/with-signature.js'

export const runtime = 'nodejs'
export const maxDuration = 60
export const dynamic = 'force-dynamic'

// TODO: install + import Resend SDK.
// import { Resend } from 'resend'
// const resend = new Resend(process.env.RESEND_API_KEY!)

const MailPayload = z
  .object({
    to: z.union([z.string().email(), z.array(z.string().email()).min(1)]),
    subject: z.string().min(1).max(998),
    html: z.string().optional(),
    text: z.string().optional(),
    from: z.string().email().optional(),
    replyTo: z.string().email().optional(),
    tags: z.record(z.string()).optional(),
  })
  .refine((v) => Boolean(v.html ?? v.text), {
    message: 'either `html` or `text` is required',
    path: ['html'],
  })

export type MailPayload = z.infer<typeof MailPayload>

export const POST = withSignature(async (req) => {
  let json: unknown
  try {
    json = await req.json()
  } catch {
    return Response.json(
      { ok: false, error: { code: 'VALIDATION_ERROR', message: 'invalid JSON' } },
      { status: 422 },
    )
  }

  const parsed = MailPayload.safeParse(json)
  if (!parsed.success) {
    return Response.json(
      {
        ok: false,
        error: {
          code: 'VALIDATION_ERROR',
          message: 'invalid mail payload',
          details: parsed.error.flatten(),
        },
      },
      { status: 422 },
    )
  }

  const payload = parsed.data
  const from = payload.from ?? process.env.MAIL_FROM ?? 'noreply@athar.id'

  // TODO: replace stub with Resend call once the lib is installed.
  //
  // const { data, error } = await resend.emails.send({
  //   from,
  //   to: payload.to,
  //   subject: payload.subject,
  //   html: payload.html,
  //   text: payload.text,
  //   replyTo: payload.replyTo,
  //   tags: payload.tags ? Object.entries(payload.tags).map(([name, value]) => ({ name, value })) : undefined,
  // })
  // if (error) {
  //   console.error('[jobs/mail] resend error', error)
  //   // Returning non-2xx triggers QStash retry (with backoff).
  //   return Response.json({ ok: false, error }, { status: 502 })
  // }
  // return Response.json({ ok: true, id: data?.id })

  console.info('[jobs/mail] (stub) would send mail', {
    from,
    to: payload.to,
    subject: payload.subject,
    hasHtml: Boolean(payload.html),
    hasText: Boolean(payload.text),
  })

  return Response.json({ ok: true, id: null, stub: true })
})
