import 'server-only'
import { getDb } from '../db'
import { has, requireCapability, userPlan } from '../plans'

/** Personal insights: value, not vanity. Counts are anonymous by design. */
export async function personalInsights(userId: string) {
  const db = await getDb()
  const plan = await userPlan(db, userId)
  if (!has(plan, 'insights.personal')) await requireCapability(db, plan, 'insights.personal', userId)
  const [s] = await db.query<Record<string, number>>(
    `SELECT (SELECT count(*)::int FROM share_sessions WHERE owner_user_id = $1 AND created_at > now() - interval '30 days' AND station_id IS NULL) AS shares,
            (SELECT count(*)::int FROM share_sessions WHERE owner_user_id = $1 AND created_at > now() - interval '30 days' AND view_count > 0 AND station_id IS NULL) AS shares_opened,
            (SELECT coalesce(sum(view_count),0)::int FROM share_sessions WHERE owner_user_id = $1 AND created_at > now() - interval '30 days') AS opened,
            (SELECT coalesce(sum(expanded_count),0)::int FROM share_sessions WHERE owner_user_id = $1 AND created_at > now() - interval '30 days') AS expanded,
            (SELECT coalesce(sum(saved_count),0)::int FROM share_sessions WHERE owner_user_id = $1 AND created_at > now() - interval '30 days') AS saved,
            (SELECT count(*)::int FROM connection_requests WHERE owner_user_id = $1 AND created_at > now() - interval '30 days') AS requests,
            (SELECT count(*)::int FROM connections WHERE owner_user_id = $1 AND created_at > now() - interval '30 days') AS connections,
            (SELECT count(*)::int FROM follow_ups WHERE owner_user_id = $1 AND created_at > now() - interval '30 days') AS followups,
            (SELECT count(*)::int FROM follow_ups WHERE owner_user_id = $1 AND created_at > now() - interval '30 days' AND done_at IS NOT NULL) AS followups_done,
            (SELECT count(*)::int FROM connections c WHERE c.owner_user_id = $1 AND c.created_at > now() - interval '30 days'
                AND (EXISTS (SELECT 1 FROM private_notes n WHERE n.connection_id = c.id) OR EXISTS (SELECT 1 FROM follow_ups f WHERE f.connection_id = c.id))) AS meaningful`,
    [userId],
  )
  const byCapsule = await db.query<{ name: string; shares: number; opened: number; expanded: number; requests: number }>(
    `SELECT c.name, count(s.id)::int AS shares, coalesce(sum(s.view_count),0)::int AS opened, coalesce(sum(s.expanded_count),0)::int AS expanded,
            (SELECT count(*)::int FROM connection_requests r JOIN share_sessions s2 ON s2.id = r.share_session_id WHERE s2.capsule_id = c.id) AS requests
       FROM capsules c LEFT JOIN share_sessions s ON s.capsule_id = c.id AND s.created_at > now() - interval '30 days'
      WHERE c.owner_user_id = $1 AND c.status = 'active' GROUP BY c.id, c.name ORDER BY opened DESC`,
    [userId],
  )
  return { s, byCapsule }
}

/** Platform product metrics (admin). Mirrors docs/06-analytics.md. */
export async function productMetrics() {
  const db = await getDb()
  const [m] = await db.query<Record<string, number | null>>(
    // Demo accounts (fictional data on the .local domain) are excluded from every product metric.
    `WITH demo AS (SELECT id FROM users WHERE email LIKE '%@oryn.local'),
          ev AS (SELECT name, count(*)::float AS n FROM analytics_events WHERE created_at > now() - interval '30 days' AND (user_id IS NULL OR user_id NOT IN (SELECT id FROM demo)) GROUP BY name)
     SELECT
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'msSinceSignup')::float) / 1000 FROM analytics_events WHERE name = 'capsule_created' AND props->>'first' = 'true' AND user_id NOT IN (SELECT id FROM demo)) AS median_sec_to_first_capsule,
      (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY (props->>'msSinceSignup')::float) / 1000 FROM analytics_events WHERE name = 'share_started' AND props->>'first' = 'true' AND user_id NOT IN (SELECT id FROM demo)) AS median_sec_to_first_share,
      (SELECT count(*) FILTER (WHERE view_count > 0)::float / nullif(count(*),0) FROM share_sessions WHERE created_at > now() - interval '30 days' AND station_id IS NULL AND owner_user_id NOT IN (SELECT id FROM demo)) AS recipient_view_rate,
      (SELECT n FROM ev WHERE name = 'share_expanded') / nullif((SELECT n FROM ev WHERE name = 'share_viewed'),0) AS expanded_view_rate,
      (SELECT n FROM ev WHERE name = 'connect_requested') / nullif((SELECT n FROM ev WHERE name = 'share_viewed'),0) AS connect_request_rate,
      (SELECT n FROM ev WHERE name = 'followup_completed') / nullif((SELECT n FROM ev WHERE name = 'followup_created'),0) AS followup_completion_rate,
      (SELECT count(*) FILTER (WHERE revoked_at IS NOT NULL)::float / nullif(count(*),0) FROM share_sessions WHERE created_at > now() - interval '30 days' AND owner_user_id NOT IN (SELECT id FROM demo)) AS revoked_share_rate,
      (SELECT n FROM ev WHERE name = 'plan_gate_hit') AS plan_gate_hits`,
  )
  return m
}
