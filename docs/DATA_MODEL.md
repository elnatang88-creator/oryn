# ORYN — Data model

> Status: **awaiting founder approval** (2026-09-30).

Source of truth: [`db/migrations/0001_init.sql`](../db/migrations/0001_init.sql). Plain PostgreSQL. The same file runs on managed Postgres in production and on embedded PGlite (Postgres compiled to WASM) for local development and tests, so no developer needs a personal cloud database.

## Tenant boundaries

| Boundary | Column | Rule |
|---|---|---|
| Person | `owner_user_id` | Capsules, shares, connections, notes, follow-ups, interactions. Every service query for these includes `owner_user_id = <caller>`. |
| Business workspace | `org_id` | Events, participants, stations, QR destinations, org audit events. Every service call checks membership + role via `requireOrgPermission()` first. |
| Recipient | none | A recipient without an ORYN account is anonymous until they choose to identify themselves (a connection request). |
| Member view | `capsule_views` | One row per (capsule, signed-in viewer) who allows it: counts, first/last view, whether they chose Learn more. Cascades on deletion of either account. Viewer profile: `users.profile_headline`, `users.industry`, `users.view_visibility`. |

Non-members asking for another tenant's resources get **not found**, never "forbidden", so the existence of other tenants' data is not revealed.

## Entity map (spec entity → table)

| Spec entity | Table | Notes |
|---|---|---|
| User | `users` | Email stored lower-cased. `password_hash` = scrypt. `plan_key` → `plan_catalog`. `retention_days` overrides plan history. |
| Organization | `organizations` | `plan_key` (Business by default). `brand` JSON reserved for the shared brand system. |
| Team | `teams` | Grouping inside an organization. |
| Permission | `memberships` + `ROLE_PERMISSIONS` in `lib/server/permissions.ts` | Role per (org, user): owner / admin / manager / member. The role → permission matrix is code so it is reviewed like code. |
| Identity Capsule | `capsules` | `fields` JSON: `[{id, kind, label, value, layer}]` where `layer ∈ instant / expanded / hidden`. `private_note` is owner-only. `version` increments on each edit. |
| Visibility Policy | `visibility_policies` | Per-capsule defaults copied onto each new share: duration, one-time, interaction level (view / save / connect), whether "Learn more" is offered. |
| Shared Session | `share_sessions` | One activation. Channel, scope, context label (owner-only), one-time claim hash, expiry, revocation, anonymous counters. |
| Recipient | `recipients` | Created only when a recipient sends a connection request (name + the one contact they chose). |
| Connection Request | `connection_requests` | pending / accepted / declined. Decline is never communicated. |
| Connection | `connections` | Owner's record of a person. `contact` holds only what the other person shared. `source`: request_accepted / kept_capsule / manual. |
| Interaction | `interactions` | opened / expanded / saved_vcard / kept / connect_requested / reported / blocked_*. `recipient_id` is set **only** for `connect_requested`. |
| Private Note | `private_notes` | Owner-only, per connection. |
| Follow-up | `follow_ups` | Due date, done flag, reminder flag. |
| Event | `events` | `rules` JSON: `{allowPhone, allowedKinds, note}`. Status draft / live / ended. |
| Event Participant | `event_participants` | By email; linked to a user when an account exists. |
| ORYN Station | `stations` | Booth / table / desk / room / counter / person → current capsule. |
| QR Destination | `qr_destinations` | Short printed code → one long-lived share session. |
| Subscription | `subscriptions` + `plan_catalog` | `plan_catalog` holds capabilities, limits and an optional price label — editable in `/admin` without a deploy. `provider = 'manual'` until a payment provider is chosen. |
| Audit Event | `audit_events` | Append-only (no update/delete path in services, except de-identification on account deletion). |
| Device | `devices` | Named from the user agent, recognised by an HttpOnly device cookie. |
| Session | `sessions` | Only the SHA-256 of the session token is stored. |
| Data Export | `data_exports` | Built by a background job; downloadable for 7 days. |
| Deletion Request | `deletion_requests` | 7-day grace; shares close immediately; erase job runs at the scheduled time. |

Supporting tables: `jobs` (background work), `feature_flags`, `analytics_events` (product metrics, never recipient identity), `rate_limits`, `notifications` (in-app), `schema_migrations`.

## Share session lifecycle

```
start ──► live ──► (opened N times) ──► stopped  (owner revokes, archives capsule, leaves org, deletes account)
                 └─► expired  (expires_at passed, max views reached, event ended)
one-time: live ──(first deliberate tap stores HMAC(session, claim cookie))──► opened_once (only that browser)
```

The recipient always sees the **live** capsule, filtered at request time by: the session policy (layers, "Learn more" allowed, interaction level), the event rules (if event-scoped), and the capsule status. That is why edits and revocations apply instantly.

## Scopes (v1 status)

| Scope | Where enforced | v1 |
|---|---|---|
| Public | default | Working |
| Limited ("Learn more" off) | `allow_expanded` | Working |
| Expiring | `expires_at` (+ signed into the token) | Working |
| One-time | `one_time` + `claim_hash` | Working |
| Event-scoped | `event_id` + event rules/status | Working |
| Organization-scoped | `org_id` recorded | Viewer restriction not yet enforced |
| Recipient-specific | `recipient_email_hash` checked in `resolveShare` | No UI to create one yet |
| Revoked instantly | `revoked_at` | Working |

## Retention

- Interactions older than the person's retention setting are pruned by the `retention.prune` job; anonymous counters on shares remain.
- History shown in Connections is limited by the plan's `historyDays`.
- Deleted accounts: user row deleted (cascades to capsules, shares, interactions, connections, notes, follow-ups, devices, sessions); audit rows de-identified; analytics rows de-identified. Organizations the person created are transferred to another member, or deleted if they were the only member.

## Migrations

Add a new numbered file in `db/migrations/` (e.g. `0002_*.sql`); never edit an applied one. `npm run db:migrate` (or app start) applies pending files in order inside a transaction and records them in `schema_migrations`.

## Nearby (migration 0004)

| Table / column | Purpose |
|---|---|
| `users.nearby_visibility` | `off` (default) · `everyone` · `connections` · `event` |
| `nearby_presence` | One short-lived row per visible person: random `handle`, card (`capsule_id`), coarse `cell` or `event_id`, `expires_at` (2 min). Cascades on user/capsule/event deletion. |
| `connection_requests.kind`, `.from_user_id` | `member` requests between ORYN members reuse the one request pipeline; one pending request per pair |
| `connections.source = 'nearby'` | Both sides of an accepted Nearby exchange; `contact_user_id` links the member |
| `capsules.design.back` | `qr` or `brand` — what the back of the card shows |
