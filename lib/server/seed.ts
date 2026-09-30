import 'server-only'
import type { Db } from './db'
import { newId } from './ids'
import crypto from 'node:crypto'
import { hashPassword } from './services/auth'

/**
 * Demo accounts exist only in local/staging demos. They are fictional, live on the reserved `.local`
 * domain, and are labelled "Demo data" in the UI. No password is stored in the repository: set
 * ORYN_DEMO_PASSWORD, or a random one is generated and printed to the server console once.
 */
export const DEMO_EMAIL = 'demo@oryn.local'
export const DEMO_ADMIN_EMAIL = 'admin@oryn.local'
/** Fixed, memorable code for the demo booth: /q/harbordemo. Demo only; real codes are random. */
export const DEMO_STATION_CODE = 'harbordemo'
export const isDemoEmail = (email: string) => email.endsWith('@oryn.local')

function demoPassword() {
  return process.env.ORYN_DEMO_PASSWORD || crypto.randomBytes(12).toString('base64url')
}

/** Local/demo data only. Never enabled in production unless ORYN_SEED_DEMO=true is set on purpose. */
export async function ensureDemoData(db: Db) {
  const [any] = await db.query(`SELECT 1 FROM users LIMIT 1`)
  if (any) return
  const demoId = 'usr_demo'
  const adminId = 'usr_admin'
  const password = demoPassword()
  await db.query(`INSERT INTO users (id, email, password_hash, display_name, plan_key, onboarded_at, created_at) VALUES ($1,$2,$3,'Noa Adler','business',now(), now() - interval '20 days')`, [demoId, DEMO_EMAIL, await hashPassword(password)])
  await db.query(`INSERT INTO users (id, email, password_hash, display_name, plan_key, is_platform_admin) VALUES ($1,$2,$3,'ORYN Admin','free',true)`, [adminId, DEMO_ADMIN_EMAIL, await hashPassword(password)])
  if (!process.env.ORYN_DEMO_PASSWORD) console.log(`[seed] Demo accounts created (fictional data). Password for ${DEMO_EMAIL} and ${DEMO_ADMIN_EMAIL}: ${password}`)

  const fields = (list: [string, string, string, string][]) => JSON.stringify(list.map(([kind, label, value, layer]) => ({ id: newId('f', 6), kind, label, value, layer })))
  await db.query(
    `INSERT INTO capsules (id, owner_user_id, name, mode, display_name, headline, message, fields, private_note, is_default) VALUES
     ('cap_demo_conf', $1, 'Conference', 'professional', 'Noa Adler', 'Product lead · Harbor Labs', 'Good to meet you. I’m around all day — say hi.', $2::jsonb, 'Use at Harbor Summit. Keep phone hidden.', true),
     ('cap_demo_store', $1, 'Just hi', 'personal', 'Noa', '', 'Didn’t want to hold up the line. If you’d like to talk, here’s how.', $3::jsonb, '', false)`,
    [
      demoId,
      fields([['role', 'Role', 'Product lead', 'instant'], ['company', 'Company', 'Harbor Labs', 'instant'], ['social', 'LinkedIn', 'https://www.linkedin.com/in/example', 'instant'], ['email', 'Work email', 'noa@harborlabs.example', 'instant'], ['website', 'Website', 'https://harborlabs.example', 'expanded'], ['booking', 'Book 20 minutes', 'https://cal.example/noa', 'expanded'], ['phone', 'Phone', '+1 555 010 2030', 'hidden']]),
      fields([['social', 'Instagram', 'https://instagram.com/example', 'instant'], ['phone', 'Phone', '+1 555 010 2030', 'hidden']]),
    ],
  )
  await db.query(`INSERT INTO visibility_policies (capsule_id, duration_minutes, one_time, interaction_level, allow_expanded) VALUES ('cap_demo_conf', NULL, false, 'connect', true), ('cap_demo_store', 1440, true, 'connect', false)`)

  await db.query(`INSERT INTO organizations (id, name, slug, plan_key, created_by) VALUES ('org_demo', 'Harbor Labs', 'harbor-labs', 'business', $1)`, [demoId])
  await db.query(`INSERT INTO memberships (org_id, user_id, role) VALUES ('org_demo', $1, 'owner')`, [demoId])
  await db.query(`INSERT INTO events (id, org_id, name, venue, starts_on, ends_on, rules, status, created_by) VALUES ('evt_demo', 'org_demo', 'Harbor Summit 2026', 'Pier 9 Hall', current_date, current_date + 1, '{"allowPhone":false,"allowedKinds":null,"note":"Please share work details only."}', 'live', $1)`, [demoId])
  await db.query(`INSERT INTO event_participants (id, event_id, org_id, user_id, email, display_name, role, status) VALUES ('par_demo', 'evt_demo', 'org_demo', $1, $2, 'Noa Adler', 'exhibitor', 'active'), ('par_demo2', 'evt_demo', 'org_demo', NULL, 'lee@guest.example', 'Lee Park', 'speaker', 'invited')`, [demoId, DEMO_EMAIL])

  // A station at the booth, with a printed code that stays the same while the capsule behind it can change.
  await db.query(`INSERT INTO stations (id, org_id, event_id, name, kind, capsule_id) VALUES ('stn_demo', 'org_demo', 'evt_demo', 'Booth 14', 'booth', 'cap_demo_conf')`)
  await db.query(`INSERT INTO share_sessions (id, capsule_id, owner_user_id, org_id, event_id, station_id, channel, scope, context_label, last_capsule_version) VALUES ('s_demostationxxxxxxxxxx', 'cap_demo_conf', $1, 'org_demo', 'evt_demo', 'stn_demo', 'station', 'event', 'Booth 14', 1)`, [demoId])
  await db.query(`INSERT INTO qr_destinations (code, org_id, owner_user_id, station_id, share_session_id) VALUES ($1, 'org_demo', $2, 'stn_demo', 's_demostationxxxxxxxxxx')`, [DEMO_STATION_CODE, demoId])

  // Yesterday's conference: one share, one request, one connection with a note and a follow-up.
  await db.query(`INSERT INTO share_sessions (id, capsule_id, owner_user_id, channel, context_label, view_count, expanded_count, saved_count, created_at, last_capsule_version) VALUES ('s_demopastsharexxxxxxxx', 'cap_demo_conf', $1, 'qr', 'Harbor Summit — day 1', 4, 2, 1, now() - interval '1 day', 1)`, [demoId])
  await db.query(`INSERT INTO interactions (id, share_session_id, owner_user_id, kind, created_at) SELECT 'int_seed_' || g, 's_demopastsharexxxxxxxx', $1, CASE WHEN g <= 4 THEN 'opened' WHEN g <= 6 THEN 'expanded' ELSE 'saved_vcard' END, now() - interval '1 day' + g * interval '3 minutes' FROM generate_series(1,7) g`, [demoId])
  await db.query(`INSERT INTO recipients (id, name, contact) VALUES ('rcp_demo', 'Sam Rivera', 'sam@rivera.example'), ('rcp_demo2', 'Dana Cole', 'dana.cole@example.com')`)
  await db.query(`INSERT INTO connection_requests (id, share_session_id, owner_user_id, recipient_id, from_name, from_contact, message, status, created_at, responded_at) VALUES
    ('req_demo_done', 's_demopastsharexxxxxxxx', $1, 'rcp_demo', 'Sam Rivera', 'sam@rivera.example', 'Loved your talk on onboarding. Coffee next week?', 'accepted', now() - interval '20 hours', now() - interval '19 hours'),
    ('req_demo_pending', 's_demopastsharexxxxxxxx', $1, 'rcp_demo2', 'Dana Cole', 'dana.cole@example.com', 'We met at the badge line — I run partnerships at a venue group.', 'pending', now() - interval '3 hours', NULL)`, [demoId])
  await db.query(`INSERT INTO connections (id, owner_user_id, name, headline, contact, source, share_session_id, met_where, met_at) VALUES ('con_demo', $1, 'Sam Rivera', 'Design lead', '[{"kind":"email","label":"Shared with you","value":"sam@rivera.example"}]', 'request_accepted', 's_demopastsharexxxxxxxx', 'Harbor Summit — day 1', now() - interval '20 hours')`, [demoId])
  await db.query(`INSERT INTO private_notes (id, connection_id, owner_user_id, body) VALUES ('note_demo', 'con_demo', $1, 'Asked about our onboarding research. Send the deck.')`, [demoId])
  await db.query(`INSERT INTO follow_ups (id, connection_id, owner_user_id, title, due_on) VALUES ('fu_demo', 'con_demo', $1, 'Send the onboarding deck', current_date)`, [demoId])
}
