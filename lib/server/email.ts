import 'server-only'
import type { Db } from './db'
import { newId } from './ids'

/**
 * Transactional email, outbox-first. Every message is written to `email_outbox` and delivered by a job,
 * so a slow or missing mail server never blocks a request and nothing is silently lost.
 *
 * Transports (EMAIL_TRANSPORT):
 *   smtp — the company's own SMTP server (SMTP_URL, e.g. smtps://user:pass@mail.example.com:465), via nodemailer.
 *   log  — print to the server log (default outside production).
 *   none — record as `skipped` (default in production when SMTP is not configured). The UI says so.
 * No email SaaS. Marketing email is not a thing here: only messages the person triggered.
 */
export type EmailKind = 'verify_email' | 'reset_password' | 'ticket' | 'registration_waitlisted' | 'automation' | 'lead_assigned' | 'security'

export interface Mail { to: string; userId?: string | null; kind: EmailKind; subject: string; text: string }

export function emailTransport(): 'smtp' | 'log' | 'none' {
  const t = process.env.EMAIL_TRANSPORT
  if (t === 'smtp' && process.env.SMTP_URL) return 'smtp'
  if (t === 'log') return 'log'
  if (t === 'none') return 'none'
  return process.env.NODE_ENV === 'production' ? 'none' : 'log'
}

export function emailFrom() {
  return process.env.EMAIL_FROM || 'ORYN <no-reply@oryn.local>'
}

/** Queue a message. Respects the person's email preference for non-security mail. */
export async function queueEmail(db: Db, mail: Mail) {
  if (mail.userId && mail.kind !== 'security' && mail.kind !== 'verify_email' && mail.kind !== 'reset_password') {
    const [u] = await db.query<{ notify_email: boolean }>(`SELECT notify_email FROM users WHERE id = $1`, [mail.userId])
    if (u && !u.notify_email) return null
  }
  const id = newId('mail')
  await db.query(`INSERT INTO email_outbox (id, to_email, user_id, kind, subject, text_body) VALUES ($1,$2,$3,$4,$5,$6)`, [id, mail.to, mail.userId ?? null, mail.kind, mail.subject, mail.text])
  const { enqueue } = await import('./jobs')
  await enqueue(db, 'email.deliver', { mailId: id })
  return id
}

/** Deliver one outbox row. Called by the job runner; throws so the queue retries on transient failure. */
export async function deliverEmail(db: Db, mailId: string) {
  const [m] = await db.query<{ id: string; to_email: string; subject: string; text_body: string; status: string; attempts: number }>(`SELECT * FROM email_outbox WHERE id = $1`, [mailId])
  if (!m || m.status === 'sent') return
  const transport = emailTransport()
  await db.query(`UPDATE email_outbox SET attempts = attempts + 1 WHERE id = $1`, [mailId])
  try {
    if (transport === 'none') {
      await db.query(`UPDATE email_outbox SET status = 'skipped', last_error = 'No email transport configured (EMAIL_TRANSPORT / SMTP_URL)' WHERE id = $1`, [mailId])
      return
    }
    if (transport === 'log') {
      console.log(`[email → ${m.to_email}] ${m.subject}\n${m.text_body}\n`)
    } else {
      const nodemailer = await import('nodemailer')
      const t = nodemailer.createTransport(process.env.SMTP_URL!)
      await t.sendMail({ from: emailFrom(), to: m.to_email, subject: m.subject, text: m.text_body })
    }
    await db.query(`UPDATE email_outbox SET status = 'sent', sent_at = now(), last_error = NULL WHERE id = $1`, [mailId])
  } catch (e) {
    const msg = String((e as Error).message).slice(0, 400)
    await db.query(`UPDATE email_outbox SET status = $2, last_error = $3 WHERE id = $1`, [mailId, m.attempts + 1 >= 5 ? 'failed' : 'queued', msg])
    throw e
  }
}
