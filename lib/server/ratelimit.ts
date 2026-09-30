import 'server-only'
import type { Db } from './db'
import { AppError } from './errors'

/** Fixed-window limiter stored in Postgres so it works across instances without extra infrastructure. */
export async function rateLimit(db: Db, key: string, limit: number, windowSeconds: number): Promise<void> {
  const rows = await db.query<{ count: number }>(
    `INSERT INTO rate_limits (key, window_start, count) VALUES ($1, now(), 1)
     ON CONFLICT (key) DO UPDATE SET
       count = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN 1 ELSE rate_limits.count + 1 END,
       window_start = CASE WHEN rate_limits.window_start < now() - make_interval(secs => $2) THEN now() ELSE rate_limits.window_start END
     RETURNING count`,
    [key, windowSeconds],
  )
  if (rows[0].count > limit) throw new AppError('rate_limited', 'Too many attempts. Please wait a moment and try again.')
}

/** Read-only check: is this key already over its limit in the current window? */
export async function isLimited(db: Db, key: string, limit: number, windowSeconds: number): Promise<boolean> {
  const [r] = await db.query<{ count: number }>(`SELECT count FROM rate_limits WHERE key = $1 AND window_start >= now() - make_interval(secs => $2)`, [key, windowSeconds])
  return !!r && r.count >= limit
}
