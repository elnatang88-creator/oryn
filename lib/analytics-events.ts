/**
 * ORYN analytics catalog — one schema for server and client events.
 * Every event: name · created_at · user_id (the ORYN member acting, or the card owner for recipient-side
 * events) · session_id (random per browser tab, client events only) · props (ids and enums ONLY).
 * Never: names, emails, phone numbers, free text, location, recipient identity.
 *
 * Canonical names for events that existed before this catalog (kept so metrics stay continuous):
 *   card_created = capsule_created · card_updated = capsule_edited · public_card_opened = share_viewed
 *   contact_saved = share_saved_vcard · connection_requested = connect_requested
 *   connection_accepted = connect_accepted · connection_deferred = connect_declined ("Not now")
 */
export const CLIENT_EVENTS = [
  'app_opened', 'share_opened', 'card_flipped', 'card_selected',
  'nearby_opened', 'nearby_impression', 'nearby_profile_opened', 'nearby_how_it_works_opened',
  'present_card_opened', 'qr_opened', 'share_sheet_opened', 'share_method_used',
  'wallet_viewed', 'wallet_add_started',
  'person_opened', 'capsule_opened', 'first_run_path_chosen',
] as const
export type ClientEvent = (typeof CLIENT_EVENTS)[number]

export const SERVER_ONLY_EVENTS = [
  'connection_created', 'nearby_visibility_enabled', 'nearby_visibility_disabled',
  'wallet_add_failed', 'tags_updated', 'context_updated', 'public_card_cta_clicked',
] as const
export type ServerOnlyEvent = (typeof SERVER_ONLY_EVENTS)[number]

/** Allowed prop keys and value shapes. Anything else is dropped before storage. */
export const PROP_RULES: Record<string, RegExp> = {
  card_id: /^cap_[A-Za-z0-9_-]{1,40}$/,
  connection_id: /^con_[A-Za-z0-9_-]{1,40}$/,
  context_id: /^(evt|s)_[A-Za-z0-9_-]{1,40}$/, // event or share id
  channel: /^(nearby|qr|link|web_share|wallet_pass|station|shortcut|kept|manual|sms|whatsapp|email|copy|system|present)$/,
  surface: /^(share|present|studio|people|nearby|recipient|wallet|qr|today|first_run)$/,
  platform: /^(apple|google|other)$/,
  source: /^[a-z_]{1,32}$/,
  path: /^(nearby|present|wallet)$/,
  count: /^\d{1,4}$/,
  side: /^(front|back)$/,
}

export function cleanProps(input: unknown): Record<string, string | number> {
  const out: Record<string, string | number> = {}
  if (!input || typeof input !== 'object') return out
  for (const [k, v] of Object.entries(input as Record<string, unknown>)) {
    const rule = PROP_RULES[k]
    if (!rule || (typeof v !== 'string' && typeof v !== 'number')) continue
    const s = String(v)
    if (rule.test(s)) out[k] = k === 'count' ? Number(s) : s
  }
  return out
}
