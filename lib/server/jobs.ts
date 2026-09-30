import 'server-only'
import type { Db } from './db'
import { getDb } from './db'
import { newId } from './ids'

export type JobKind = 'export.build' | 'deletion.execute' | 'retention.prune' | 'followups.remind'

/**
 * Background jobs live in Postgres (no extra broker to own or operate). `npm run worker` processes them;
 * in development they also run right after being queued (ORYN_JOBS_INLINE, default on outside production).
 */
export async function enqueue(db: Db, kind: JobKind, payload: Record<string, unknown>, runAt: Date = new Date()) {
  const id = newId('job')
  await db.query(`INSERT INTO jobs (id, kind, payload, run_at) VALUES ($1,$2,$3::jsonb,$4)`, [id, kind, JSON.stringify(payload), runAt])
  if (inline() && runAt.getTime() <= Date.now()) setTimeout(() => void runDueJobs().catch((e) => console.error('[jobs]', e)), 0)
  return id
}

function inline() {
  return (process.env.ORYN_JOBS_INLINE ?? (process.env.NODE_ENV === 'production' ? 'false' : 'true')) === 'true'
}

export async function runDueJobs(limit = 20): Promise<number> {
  const db = await getDb()
  const jobs = await db.query<{ id: string; kind: JobKind; payload: Record<string, string>; attempts: number }>(
    `UPDATE jobs SET status = 'running', attempts = attempts + 1
      WHERE id IN (SELECT id FROM jobs WHERE status = 'queued' AND run_at <= now() ORDER BY run_at LIMIT $1 FOR UPDATE SKIP LOCKED)
      RETURNING id, kind, payload, attempts`,
    [limit],
  )
  for (const job of jobs) {
    try {
      await handle(db, job.kind, job.payload)
      await db.query(`UPDATE jobs SET status = 'done' WHERE id = $1`, [job.id])
    } catch (e) {
      const retry = job.attempts < 5
      await db.query(`UPDATE jobs SET status = $2, last_error = $3, run_at = now() + make_interval(secs => $4) WHERE id = $1`, [
        job.id, retry ? 'queued' : 'failed', String((e as Error).message).slice(0, 500), 30 * 2 ** job.attempts,
      ])
      console.error('[jobs] failed', job.kind, (e as Error).message)
    }
  }
  return jobs.length
}

async function handle(db: Db, kind: JobKind, p: Record<string, string>) {
  const privacy = await import('./services/privacy')
  switch (kind) {
    case 'export.build':
      return privacy.buildExport(db, p.exportId, p.userId)
    case 'deletion.execute':
      return privacy.executeDeletion(db, p.requestId, p.userId)
    case 'retention.prune':
      return void (await privacy.pruneRetention(db, p.userId))
    case 'followups.remind': {
      // Daily: one calm in-app reminder per due follow-up. Email/push delivery needs a provider (see docs).
      const due = await db.query<{ id: string; owner_user_id: string; title: string; name: string; connection_id: string }>(
        `SELECT f.id, f.owner_user_id, f.title, c.name, f.connection_id FROM follow_ups f JOIN connections c ON c.id = f.connection_id
          WHERE f.done_at IS NULL AND f.reminded_at IS NULL AND f.due_on <= current_date`,
      )
      for (const f of due) {
        await db.query(`INSERT INTO notifications (id, user_id, kind, body, link) VALUES ($1,$2,'followup',$3,$4)`, [newId('ntf'), f.owner_user_id, `${f.title} — ${f.name}`, `/connections/${f.connection_id}`])
        await db.query(`UPDATE follow_ups SET reminded_at = now() WHERE id = $1`, [f.id])
      }
      return
    }
  }
}
