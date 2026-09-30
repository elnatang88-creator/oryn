# ORYN — Security & privacy model

> Status: **awaiting founder approval** (2026-09-30).

> Status: prototype. This document describes what is **implemented** and what is **still required**. ORYN has not had an independent security review, a penetration test, or a legal/regulatory review. Do not describe it as "fully secure" or compliant with any specific regulation until those are done.

## 1. What we protect

| Asset | Why it matters |
|---|---|
| Hidden capsule fields and private notes | The core promise: "only what you chose". A leak breaks trust permanently. |
| Recipient anonymity | Opening a capsule without an ORYN account must not identify or track the recipient. Signed-in members are shown to the owner only with notice on the page and a private-viewing opt-out (A2, changed 2026-09-30). |
| Connections, follow-ups, "where we met" | Personal relationship data. |
| Workspace data (events, stations, members) | Belongs to the business; must not cross tenants. |
| Accounts and sessions | Account takeover = someone else sharing as you. |
| Company infrastructure and secrets | Company-owned; no personal accounts, no secrets in code. |

## 2. Threat model (v1, STRIDE-style summary)

| Threat | Example | Mitigation in v1 | Still to do |
|---|---|---|---|
| **Spoofing** — guess or forge a share link | Enumerate `/c/…` URLs | 96-bit random session IDs + HMAC-SHA256 signature (128-bit truncated) checked before any DB read (`lib/server/tokens.ts`) | Key rotation procedure (support 2 active keys) |
| Spoofing — account takeover | Password stuffing | scrypt hashes; per-IP and per-account sign-in rate limits; constant-work response for unknown emails; sessions revoked on password change | Passkeys / TOTP; breached-password check; email verification; login alerts |
| **Tampering** — extend an expiring link | Edit the expiry in the URL | Expiry is inside the signed payload; server also checks `expires_at` | — |
| Tampering — XSS via capsule content | `javascript:` link, HTML in name | Zod validation; only `http(s)` links rendered; React escaping; CSP; `rel="noopener noreferrer nofollow"` | Nonce-based CSP (remove `'unsafe-inline'`) |
| Tampering — CSRF | Cross-site form posts | Server Actions (Next.js origin check); `SameSite=Lax` cookies; JSON API mutations require same-origin `Origin` | — |
| **Repudiation** | "I never changed that role" | Append-only `audit_events` for auth, sessions, capsules, shares, org roles, events, stations, exports, deletions, admin actions | Ship audit events to write-once storage; admin access alerts |
| **Information disclosure** — private note in public view | Bug in projection | Single projection function `project()` builds the recipient shape field-by-field; the private note, hidden fields and owner context label never enter it. Unit + E2E tests assert they never appear in recipient output or the vCard | Add a CI lint rule forbidding `capsules.*` in recipient routes |
| Information disclosure — cross-tenant read | User A reads org B's event | Every service query scoped by `owner_user_id` or checked by `requireOrgPermission()`; non-members get *not found*; tests in `tests/unit/security.test.ts` | Postgres Row-Level Security as defense in depth (see §6) |
| Information disclosure — link previews | Chat app unfurls a one-time link | One-time capsules never reveal content on a passive load — they require a deliberate "Open it" tap; bots don't count as opens; capsule pages send generic Open Graph text, `noindex`, `no-store` | — |
| Information disclosure — member views | Owner learns more about a member than the member expects | Only name, headline and field; notice on every capsule page; "view privately" opt-out; owner and self views never recorded; rows cascade on either account's deletion; included in both people's export; pruned by retention | Privacy-policy wording and lawful basis per region (counsel) |
| Information disclosure — recipient tracking | Sender learns who opened | No IP, fingerprint, location or identity stored for opens/expands/saves; rate-limit buckets use a keyed hash of the IP, never the IP | Document cookie use in the formal privacy policy |
| **Denial of service / abuse** | Spam connection requests, harassment | Postgres-backed rate limits (sign-up, sign-in, share creation, connect requests per IP and per share, reports, exports); silent decline; "Report a problem" on every capsule; admin reports queue | Edge rate limiting/WAF; CAPTCHA fallback under attack; block list per user |
| **Elevation of privilege** | Member makes themselves admin | Role matrix in code; owners-only for admin changes; self-role change refused; removal revokes their workspace shares | SSO/SCIM for Enterprise; access reviews |

## 3. Authentication and sessions

- Passwords: scrypt (N=16384, r=8, p=1, 64-byte key, 16-byte salt). Minimum 10 characters.
- Sessions: 32 random bytes in an `HttpOnly; SameSite=Lax; Secure` (production) cookie; only its SHA-256 is stored. 30-day lifetime; last-seen updated at most every 5 minutes.
- Device and session management: `/settings/security` lists sessions and devices; sign out one, all others, or all.
- Server-side authorization on every protected page (`requireUser()` in the workspace layout and in every server action) and every API route.

## 4. Share access tokens

`/c/<sessionId>.<expiry>.<signature>` — signature = HMAC-SHA256(`ORYN_SECRET`, `share:v1:<id>:<exp>`), truncated to 22 base64url chars. The token proves the link was issued by ORYN; the **server-side session** decides whether it still opens (revoked, expired, max views, one-time claim, event ended, capsule archived, owner deleted). Revocation is effective on the next request.

## 5. Privacy by design (the Consent Ladder)

1. **Open** → anonymous count. 2. **Learn more** → anonymous count. 3. **Save to phone** → anonymous count. 4. **Keep in ORYN** → private copy in the *recipient's* workspace; the sender still sees only a count. 5. **Ask to connect** → the recipient types their name and one way to reach them; only now is an identifiable record created. Declines are silent. "Not now" is simply closing the page.

Safety and privacy controls (stop a share, stop all shares, expiry, one-time, export, delete) are available on every plan.

## 6. Data protection

| Control | v1 | Production requirement |
|---|---|---|
| Encryption in transit | HSTS header in production; secure cookies | TLS 1.2+ at the edge (hosting provider); HSTS preload after domain is final |
| Encryption at rest | Relies on the database/storage provider | Managed Postgres with encryption at rest; encrypted backups; company-owned KMS where available |
| Row-Level Security | Service-layer scoping (tested) | Add RLS policies keyed on a per-request `app.user_id` setting as defense in depth |
| Backups | — | Daily automated backups + point-in-time recovery; **quarterly restore drill** documented in `docs/OPERATIONS.md` |
| Secrets | `ORYN_SECRET`, `DATABASE_URL`, `CRON_SECRET` from environment only; `.env*` git-ignored | Company-owned secret manager; rotation runbook |
| File uploads | Not implemented (photos are https links) | When added: size/type allow-list, re-encode images, strip EXIF, private bucket + signed URLs, malware scan |
| Data export | JSON export of everything tied to the account (`/settings/privacy`) | Org-level export for Business |
| Deletion | 7-day grace, immediate share shutdown, cascade delete, de-identified audit | Backups age out on schedule; document in privacy policy |
| Retention | Per-user setting + plan history window | Org-level retention (Enterprise) |
| AI/model training | Customer data is not used to train external models | Keep this in contracts with every vendor |

## 7. HTTP hardening (next.config.ts, middleware.ts)

CSP (`default-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `form-action 'self'`), `X-Content-Type-Options: nosniff`, `Referrer-Policy: same-origin (nothing sent to other sites; `no-referrer` breaks form posts because browsers then send `Origin: null`)`, `X-Frame-Options: DENY`, `Permissions-Policy`, HSTS (production), `Cache-Control: private, no-store` + `X-Robots-Tag: noindex` on `/c/*` and `/q/*`. `poweredByHeader` off.

## 8. Monitoring and alerting (required before production)

- Uptime check on `/api/health` (returns only `{ok}`).
- Error reporting (e.g. a company-owned Sentry or equivalent project) — not yet wired; `console.error` calls mark the hook points (`[action]`, `[api]`, `[jobs]`, `[analytics]`).
- Alerts: spikes in `signin.failed`, `share.reported`, rate-limit rejections, failed jobs (`/admin` shows the count), 5xx rate.

## 9. Before handling real users at scale

1. Written threat model review with an external reviewer.
2. Independent penetration test, including tenant isolation and share-token attacks.
3. Privacy policy, terms of service and cookie notice written by counsel.
4. Passkeys or TOTP; email verification; login alerts.
5. Nonce-based CSP; RLS policies; secret rotation runbook.
6. Backup restore drill completed and documented.
7. Incident response plan with named owners among the founders.

## Nearby and Wallet (added 2026-09-30)

| Threat | Control | Residual |
|---|---|---|
| Location tracking | Opt-in; phone sends only a 7-char geohash cell (~150 m), never coordinates; presence expires in 2 min and is deleted on Invisible/leave/deletion; `Permissions-Policy: geolocation=(self)` | Legal review of location notice (open) |
| Member enumeration | Random per-activation handles; requests only to someone visible to the requester right now; rate limits (60/h, 3 per pair/day) | No block/report for members yet |
| Bypassing visibility | Every query re-applies the target's rule (everyone / connections / event) on the server; lurkers must be visible to look | — |
| Data leakage on exchange | Each side gets the other's share projection (first + permitted second layer); hidden fields and notes never leave; other people's card backs never show their QR | — |
| Impersonation | Requests carry the signed-in user; answering is owner-checked; a person can't answer their own or someone else's request (tested) | — |
| Wallet | Pass contains card-face data + one revocable link; Google save links are RS256-signed server-side; Apple is refused until a signing service exists | Key custody for wallet certificates (company-owned) |

## Product pass (2026-09-30)

| Area | Control |
|---|---|
| Client analytics endpoint | Auth + same-origin, allow-listed names, props reduced to ids/enums, 900/h per user |
| Card back | Owner surfaces show only first-layer details; other members' cards show the ORYN mark until you're connected; after connecting, only what their share projection allowed |
| People search | Notes are searched only for their owner (tested: another user's note never matches) |
| Tags / reminders | Owner-checked in the service; tags validated (≤8, ≤24 chars) |
| Wallet permanent link | One revocable `wallet_pass` share per person, `follow_default` → always the current active card; stopping it closes the pass |
| Offline Present (service worker) | Caches only static assets and the **last Present screen** (your own card); never API data or other pages; cleared on sign-in/sign-out pages. Shared devices: sign out clears it. |
| Google Wallet errors | Return to the Wallet screen with an error state; only same-site `/share/<id>/wallet` paths are accepted as the return path |
