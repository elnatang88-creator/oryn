import 'server-only'
import { z } from 'zod'
import { getDb, type Db } from '../db'
import { newId } from '../ids'
import { AppError, invalid, notFound } from '../errors'
import { audit } from '../audit'
import { track } from '../analytics'
import { rateLimit } from '../ratelimit'
import { has, requireCapability, userPlan } from '../plans'
import { claimHash, signShareToken, verifyShareToken } from '../tokens'
import { sha256 } from '../secrets'
import type { Capsule } from './capsules'
import { CHANNELS, MODE_COPY, type Channel, type CapsuleField, type InteractionLevel, type PublicCapsuleView } from '../../capsule-model'

export type Scope = 'public' | 'limited' | 'event' | 'organization' | 'recipient'

export interface ShareSession {
  id: string
  capsule_id: string
  owner_user_id: string
  org_id: string | null
  event_id: string | null
  station_id: string | null
  channel: Channel
  scope: Scope
  context_label: string
  one_time: boolean
  claim_hash: string | null
  interaction_level: InteractionLevel
  allow_expanded: boolean
  recipient_email_hash: string | null
  max_views: number | null
  view_count: number
  expanded_count: number
  saved_count: number
  expires_at: Date | null
  revoked_at: Date | null
  created_at: Date
}

export type { PublicCapsuleView }

export type ResolveResult =
  | { status: 'ok'; view: PublicCapsuleView; session: ShareSession; setClaim?: string }
  | { status: 'revoked' | 'expired' | 'claimed' | 'not_found' | 'restricted' }
  | { status: 'needs_open'; displayName: string } // one-time capsule not yet opened: needs a deliberate tap

const startInput = z.object({
  capsuleId: z.string().optional(),
  channel: z.enum(CHANNELS).default('qr'),
  contextLabel: z.string().trim().max(80).default(''),
  durationMinutes: z.number().int().min(5).max(60 * 24 * 365).nullable().optional(),
  oneTime: z.boolean().optional(),
  scope: z.enum(['public', 'limited', 'event', 'organization', 'recipient']).default('public'),
  eventId: z.string().nullable().optional(),
  recipientEmail: z.string().email().optional(),
})

export function shareUrl(token: string) {
  const base = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, '') ?? ''
  return `${base}/c/${token}`
}

export async function startShare(userId: string, input: z.input<typeof startInput>) {
  const r = startInput.safeParse(input)
  if (!r.success) throw invalid(r.error.issues[0].message)
  const data = r.data
  const db = await getDb()
  await rateLimit(db, `share:${userId}`, 120, 3600)
  const plan = await userPlan(db, userId)
  if (data.channel === 'nfc_tag') await requireCapability(db, plan, 'share.nfc', userId)
  if (data.channel === 'wallet_pass') await requireCapability(db, plan, 'share.wallet', userId)

  const [capsule] = data.capsuleId
    ? await db.query<Capsule>(`SELECT * FROM capsules WHERE id = $1 AND owner_user_id = $2 AND status = 'active'`, [data.capsuleId, userId])
    : await db.query<Capsule>(`SELECT * FROM capsules WHERE owner_user_id = $1 AND status = 'active' ORDER BY is_default DESC, updated_at DESC LIMIT 1`, [userId])
  if (!capsule) throw notFound('That capsule')
  const [policy] = await db.query<{ duration_minutes: number | null; one_time: boolean; interaction_level: InteractionLevel; allow_expanded: boolean }>(
    `SELECT duration_minutes, one_time, interaction_level, allow_expanded FROM visibility_policies WHERE capsule_id = $1`, [capsule.id],
  )

  let orgId: string | null = null
  let eventId: string | null = null
  if (data.scope === 'event') {
    if (!data.eventId) throw invalid('Choose the event for this share.')
    const [ev] = await db.query<{ id: string; org_id: string }>(
      `SELECT e.id, e.org_id FROM events e
        WHERE e.id = $1 AND e.status <> 'ended' AND (
          EXISTS (SELECT 1 FROM memberships m WHERE m.org_id = e.org_id AND m.user_id = $2)
          OR EXISTS (SELECT 1 FROM event_participants p WHERE p.event_id = e.id AND p.user_id = $2 AND p.status <> 'removed'))`,
      [data.eventId, userId],
    )
    if (!ev) throw notFound('That event')
    orgId = ev.org_id
    eventId = ev.id
  }
  if (data.scope === 'organization') {
    if (!capsule.org_id) throw invalid('Only workspace capsules can be shared inside a workspace.')
    orgId = capsule.org_id
  }
  if (data.scope === 'recipient' && !data.recipientEmail) throw invalid('Add the email of the person this is for.')

  const duration = data.durationMinutes !== undefined ? data.durationMinutes : policy.duration_minutes
  const expiresAt = duration ? new Date(Date.now() + duration * 60_000) : null
  const oneTime = data.oneTime ?? policy.one_time
  const id = newId('s', 16)
  await db.query(
    `INSERT INTO share_sessions (id, capsule_id, owner_user_id, org_id, event_id, channel, scope, context_label, one_time, interaction_level, allow_expanded, recipient_email_hash, expires_at, last_capsule_version)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
    [id, capsule.id, userId, orgId, eventId, data.channel, data.scope, data.contextLabel, oneTime, policy.interaction_level,
      policy.allow_expanded && has(plan, 'disclosure.controls'), data.recipientEmail ? sha256(data.recipientEmail.toLowerCase()) : null, expiresAt, capsule.version],
  )
  await audit(db, { actor: userId, action: 'share.started', targetType: 'share_session', targetId: id, orgId, meta: { channel: data.channel, scope: data.scope, oneTime, expiresAt } })
  const [{ n }] = await db.query<{ n: number }>(`SELECT count(*)::int AS n FROM share_sessions WHERE owner_user_id = $1`, [userId])
  const [{ created_at }] = await db.query<{ created_at: Date }>(`SELECT created_at FROM users WHERE id = $1`, [userId])
  await track(db, 'share_started', { userId, orgId, props: { channel: data.channel, scope: data.scope, first: n === 1, msSinceSignup: Date.now() - new Date(created_at).getTime() } })
  const token = signShareToken(id, expiresAt)
  return { id, token, url: shareUrl(token), expiresAt, oneTime, capsuleId: capsule.id }
}

export async function listShares(userId: string, opts: { activeOnly?: boolean; limit?: number } = {}) {
  const db = await getDb()
  const rows = await db.query<ShareSession & { capsule_name: string; display_name: string }>(
    `SELECT s.*, c.name AS capsule_name, c.display_name FROM share_sessions s JOIN capsules c ON c.id = s.capsule_id
      WHERE s.owner_user_id = $1 AND s.station_id IS NULL ${opts.activeOnly ? `AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > now()) AND NOT (s.one_time AND s.claim_hash IS NOT NULL AND s.view_count > 0 AND s.created_at < now() - interval '1 day')` : ''}
      ORDER BY s.created_at DESC LIMIT $2`,
    [userId, opts.limit ?? 50],
  )
  return rows.map((s) => ({ ...s, token: signShareToken(s.id, s.expires_at), state: shareState(s) }))
}

export function shareState(s: Pick<ShareSession, 'revoked_at' | 'expires_at' | 'one_time' | 'claim_hash' | 'max_views' | 'view_count'>): 'live' | 'stopped' | 'expired' | 'opened_once' {
  if (s.revoked_at) return 'stopped'
  if (s.expires_at && new Date(s.expires_at).getTime() <= Date.now()) return 'expired'
  if (s.max_views && s.view_count >= s.max_views) return 'expired'
  if (s.one_time && s.claim_hash) return 'opened_once'
  return 'live'
}

export async function getShareForOwner(userId: string, shareId: string) {
  const db = await getDb()
  const [s] = await db.query<ShareSession>(`SELECT * FROM share_sessions WHERE id = $1 AND owner_user_id = $2`, [shareId, userId])
  if (!s) throw notFound('That share')
  return { ...s, token: signShareToken(s.id, s.expires_at), url: shareUrl(signShareToken(s.id, s.expires_at)), state: shareState(s) }
}

/** Instantly stops a share. The very next request for its link is refused. */
export async function revokeShare(userId: string, shareId: string) {
  const db = await getDb()
  const r = await db.query<{ id: string; org_id: string | null }>(`UPDATE share_sessions SET revoked_at = now() WHERE id = $1 AND owner_user_id = $2 AND revoked_at IS NULL RETURNING id, org_id`, [shareId, userId])
  if (!r.length) {
    const [exists] = await db.query(`SELECT 1 FROM share_sessions WHERE id = $1 AND owner_user_id = $2`, [shareId, userId])
    if (!exists) throw notFound('That share')
    return
  }
  await audit(db, { actor: userId, action: 'share.revoked', targetType: 'share_session', targetId: shareId, orgId: r[0].org_id })
  await track(db, 'share_revoked', { userId })
}

export async function revokeAllShares(userId: string) {
  const db = await getDb()
  const r = await db.query(`UPDATE share_sessions SET revoked_at = now() WHERE owner_user_id = $1 AND revoked_at IS NULL AND station_id IS NULL RETURNING id`, [userId])
  await audit(db, { actor: userId, action: 'share.revoked_all', targetType: 'user', targetId: userId, meta: { count: r.length } })
  await track(db, 'privacy_control_used', { userId, props: { control: 'stop_all_shares' } })
  return r.length
}

// ─── Recipient side ───────────────────────────────────────────────────────────

async function loadForRecipient(db: Db, sessionId: string) {
  const [row] = await db.query<ShareSession & { capsule: Capsule; event_name: string | null; event_rules: Record<string, unknown> | null; event_status: string | null; owner_deleted: boolean }>(
    `SELECT s.*, to_jsonb(c.*) AS capsule, e.name AS event_name, e.rules AS event_rules, e.status AS event_status, (u.deleted_at IS NOT NULL) AS owner_deleted
       FROM share_sessions s JOIN capsules c ON c.id = s.capsule_id JOIN users u ON u.id = s.owner_user_id
       LEFT JOIN events e ON e.id = s.event_id
      WHERE s.id = $1`,
    [sessionId],
  )
  return row ?? null
}

/** Applies event rules and the session's layer policy to the LIVE capsule. Private notes never pass this point. */
export function project(
  capsule: Pick<Capsule, 'mode' | 'display_name' | 'headline' | 'message' | 'avatar_url' | 'accent' | 'fields' | 'primary_action'>,
  s: Pick<ShareSession, 'allow_expanded' | 'interaction_level' | 'expires_at' | 'one_time' | 'context_label'>,
  layer: 'instant' | 'expanded',
  ctx: { eventName?: string | null; eventRules?: Record<string, unknown> | null } = {},
): PublicCapsuleView {
  const rules = ctx.eventRules ?? {}
  const allowedKinds = Array.isArray(rules.allowedKinds) ? (rules.allowedKinds as string[]) : null
  const eventAllows = (f: CapsuleField) => (!allowedKinds || allowedKinds.includes(f.kind)) && !(rules.allowPhone === false && f.kind === 'phone')
  const visible = capsule.fields.filter((f) => f.value && eventAllows(f))
  const instant = visible.filter((f) => f.layer === 'instant')
  const expanded = s.allow_expanded ? visible.filter((f) => f.layer === 'expanded') : []
  const fields = (layer === 'expanded' ? [...instant, ...expanded] : instant).map(({ id, kind, label, value }) => ({ id, kind, label, value }))
  const primary = capsule.primary_action?.fieldId && instant.some((f) => f.id === capsule.primary_action!.fieldId) ? capsule.primary_action.fieldId : null
  return {
    layer,
    mode: capsule.mode,
    modeLabel: MODE_COPY[capsule.mode].label,
    displayName: capsule.display_name,
    headline: capsule.headline,
    message: capsule.message,
    avatarUrl: capsule.avatar_url,
    accent: capsule.accent,
    fields,
    primaryFieldId: primary,
    hasMore: layer === 'instant' && expanded.length > 0,
    canSave: s.interaction_level !== 'view',
    canConnect: s.interaction_level === 'connect',
    expiresAt: s.expires_at ? new Date(s.expires_at).toISOString() : null,
    oneTime: s.one_time,
    contextLabel: null, // the owner's context label is private to the owner
    eventName: ctx.eventName ?? null,
  }
}

async function logInteraction(db: Db, s: ShareSession, kind: string, extra: { recipientId?: string | null; version?: number } = {}) {
  await db.query(`INSERT INTO interactions (id, share_session_id, owner_user_id, recipient_id, kind, capsule_version) VALUES ($1,$2,$3,$4,$5,$6)`, [
    newId('int'), s.id, s.owner_user_id, extra.recipientId ?? null, kind, extra.version ?? null,
  ])
}

/**
 * Resolves a share token for a recipient. `claimToken` is the recipient browser's random claim cookie,
 * used only to bind one-time capsules to the first browser that opened them.
 */
export async function resolveShare(
  token: string,
  opts: { layer?: 'instant' | 'expanded'; claimToken?: string | null; record?: boolean; recipientEmail?: string | null } = {},
): Promise<ResolveResult> {
  const check = verifyShareToken(token)
  if (!check.ok) return { status: 'not_found' }
  const db = await getDb()
  const row = await loadForRecipient(db, check.sessionId)
  if (!row || row.owner_deleted || row.capsule.status !== 'active') return { status: 'not_found' }
  const { capsule, event_name, event_rules, event_status, owner_deleted: _deleted, ...session } = row
  const s = session as ShareSession
  const layer = opts.layer ?? 'instant'

  if (s.revoked_at) {
    if (opts.record) await logInteraction(db, s, 'blocked_revoked')
    return { status: 'revoked' }
  }
  if (check.expired || (s.expires_at && new Date(s.expires_at).getTime() <= Date.now()) || (s.max_views && s.view_count >= s.max_views) || event_status === 'ended') {
    if (opts.record) await logInteraction(db, s, 'blocked_expired')
    return { status: 'expired' }
  }
  if (s.scope === 'recipient' && (!opts.recipientEmail || sha256(opts.recipientEmail.toLowerCase()) !== s.recipient_email_hash)) return { status: 'restricted' }

  let setClaim: string | undefined
  if (s.one_time) {
    if (s.claim_hash) {
      if (!opts.claimToken || claimHash(s.id, opts.claimToken) !== s.claim_hash) {
        if (opts.record) await logInteraction(db, s, 'blocked_claimed')
        return { status: 'claimed' }
      }
    } else if (!opts.record) {
      // Never reveal a one-time capsule on a passive load (link previews, prefetch). The recipient taps to open.
      return { status: 'needs_open', displayName: capsule.display_name.split(' ')[0] }
    } else {
      if (!opts.claimToken) return { status: 'claimed' }
      // Atomic: only the first browser can claim.
      const won = await db.query(`UPDATE share_sessions SET claim_hash = $2 WHERE id = $1 AND claim_hash IS NULL RETURNING id`, [s.id, claimHash(s.id, opts.claimToken)])
      if (!won.length) return { status: 'claimed' }
      setClaim = opts.claimToken
    }
  }

  if (layer === 'expanded' && !s.allow_expanded) return { status: 'ok', view: project(capsule, s, 'instant', { eventName: event_name, eventRules: event_rules }), session: s, setClaim }
  const view = project(capsule, s, layer, { eventName: event_name, eventRules: event_rules })

  if (opts.record) {
    const col = layer === 'instant' ? 'view_count' : 'expanded_count'
    await db.query(`UPDATE share_sessions SET ${col} = ${col} + 1, last_capsule_version = $2 WHERE id = $1`, [s.id, capsule.version])
    await logInteraction(db, s, layer === 'instant' ? 'opened' : 'expanded', { version: capsule.version })
    await track(db, layer === 'instant' ? 'share_viewed' : 'share_expanded', { userId: s.owner_user_id, orgId: s.org_id, props: { channel: s.channel, layer } })
  }
  return { status: 'ok', view, session: s, setClaim }
}

function vcardEscape(v: string) {
  return v.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/([,;])/g, '\\$1')
}

/** vCard containing only the fields this recipient is allowed to see. */
export async function recipientVcard(token: string, claimToken: string | null) {
  const res = await resolveShare(token, { layer: 'expanded', claimToken })
  if (res.status !== 'ok') return res
  if (!res.view.canSave) return { status: 'restricted' as const }
  const db = await getDb()
  await db.query(`UPDATE share_sessions SET saved_count = saved_count + 1 WHERE id = $1`, [res.session.id])
  await logInteraction(db, res.session, 'saved_vcard')
  await track(db, 'share_saved_vcard', { userId: res.session.owner_user_id, orgId: res.session.org_id })
  const v = res.view
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `FN:${vcardEscape(v.displayName)}`]
  const org = v.fields.find((f) => f.kind === 'company')
  const role = v.fields.find((f) => f.kind === 'role')
  if (org) lines.push(`ORG:${vcardEscape(org.value)}`)
  if (role || v.headline) lines.push(`TITLE:${vcardEscape(role?.value ?? v.headline)}`)
  for (const f of v.fields) {
    if (f.kind === 'email') lines.push(`EMAIL;TYPE=INTERNET:${vcardEscape(f.value)}`)
    else if (f.kind === 'phone') lines.push(`TEL;TYPE=CELL:${vcardEscape(f.value)}`)
    else if (['website', 'social', 'booking', 'link'].includes(f.kind)) lines.push(`URL:${vcardEscape(f.value)}`)
  }
  lines.push(`NOTE:${vcardEscape(`Shared with ORYN${v.eventName ? ` at ${v.eventName}` : ''}`)}`, 'END:VCARD')
  return { status: 'ok' as const, vcard: lines.join('\r\n') + '\r\n', filename: `${v.displayName.replace(/[^\w -]/g, '').trim() || 'contact'}.vcf` }
}

const connectInput = z.object({
  name: z.string().trim().min(1, 'Add your name.').max(80),
  contact: z.string().trim().min(3, 'Add one way to reach you.').max(160),
  message: z.string().trim().max(300).default(''),
})

/** Recipient asks to connect. This is the first moment the recipient becomes identifiable — by their choice. */
export async function requestConnection(token: string, input: z.input<typeof connectInput>, ctx: { claimToken: string | null; ipKey: string; recipientUserId?: string | null }) {
  const parsed = connectInput.safeParse(input)
  if (!parsed.success) throw invalid(parsed.error.issues[0].message)
  const res = await resolveShare(token, { claimToken: ctx.claimToken })
  if (res.status !== 'ok') throw new AppError('not_found', 'This capsule is no longer available.')
  if (!res.view.canConnect) throw new AppError('forbidden', 'This capsule doesn’t accept requests.')
  const db = await getDb()
  await rateLimit(db, `connect:${ctx.ipKey}`, 10, 3600)
  await rateLimit(db, `connect-share:${res.session.id}:${ctx.ipKey}`, 2, 86400)
  const recipientId = newId('rcp')
  const requestId = newId('req')
  await db.tx(async (t) => {
    await t.query(`INSERT INTO recipients (id, user_id, name, contact) VALUES ($1,$2,$3,$4)`, [recipientId, ctx.recipientUserId ?? null, parsed.data.name, parsed.data.contact])
    await t.query(`INSERT INTO connection_requests (id, share_session_id, owner_user_id, recipient_id, from_name, from_contact, message) VALUES ($1,$2,$3,$4,$5,$6,$7)`, [
      requestId, res.session.id, res.session.owner_user_id, recipientId, parsed.data.name, parsed.data.contact, parsed.data.message,
    ])
    await logInteraction(t, res.session, 'connect_requested', { recipientId })
    // Who asked and how to reach them stay in the request row; the log records only that it happened.
    await audit(t, { actor: null, action: 'connection_request.received', targetType: 'connection_request', targetId: requestId, orgId: res.session.org_id })
    await t.query(`INSERT INTO notifications (id, user_id, kind, body, link) VALUES ($1,$2,'connect_request',$3,$4)`, [
      newId('ntf'), res.session.owner_user_id, `${parsed.data.name} would like to connect.`, '/connections/requests',
    ])
  })
  await track(db, 'connect_requested', { userId: res.session.owner_user_id, orgId: res.session.org_id })
  return requestId
}

/** "Not interested" and "Report" are silent to the sender. Reports go to trust & safety via the audit log. */
export async function reportShare(token: string, reason: string, ctx: { ipKey: string }) {
  const check = verifyShareToken(token)
  if (!check.ok) return
  const db = await getDb()
  await rateLimit(db, `report:${ctx.ipKey}`, 10, 3600)
  const row = await loadForRecipient(db, check.sessionId)
  if (!row) return
  await logInteraction(db, row as unknown as ShareSession, 'reported')
  await audit(db, { actor: null, action: 'share.reported', targetType: 'share_session', targetId: row.id, meta: { reason: reason.slice(0, 300), owner: row.owner_user_id } })
}

/**
 * The fastest path (Share button, home-screen shortcut, Back Tap / double-press automations):
 * reuse the live general-purpose link of the default capsule from the last 12 hours, or start one.
 */
export async function quickShare(userId: string, channel: Channel = 'qr') {
  const db = await getDb()
  const [live] = await db.query<{ id: string }>(
    `SELECT s.id FROM share_sessions s JOIN capsules c ON c.id = s.capsule_id
      WHERE s.owner_user_id = $1 AND c.status = 'active' AND c.is_default AND s.station_id IS NULL AND s.event_id IS NULL
        AND s.scope = 'public' AND NOT s.one_time AND s.revoked_at IS NULL AND (s.expires_at IS NULL OR s.expires_at > now() + interval '5 minutes')
        AND s.context_label = '' AND s.created_at > now() - interval '12 hours'
      ORDER BY s.created_at DESC LIMIT 1`,
    [userId],
  )
  if (live) return { id: live.id, reused: true }
  const r = await startShare(userId, { channel })
  return { id: r.id, reused: false }
}

export async function setShareContext(userId: string, shareId: string, label: string) {
  const db = await getDb()
  const r = await db.query(`UPDATE share_sessions SET context_label = $3 WHERE id = $1 AND owner_user_id = $2 RETURNING id`, [shareId, userId, label.trim().slice(0, 80)])
  if (!r.length) throw notFound('That share')
  await audit(db, { actor: userId, action: 'share.context_updated', targetType: 'share_session', targetId: shareId })
}
