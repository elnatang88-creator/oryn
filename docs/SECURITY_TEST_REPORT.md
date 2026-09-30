# ORYN v1 — Security test report

| | |
|---|---|
| Date | 2026-09-30 |
| Branch | `oryn-v1` |
| Scope | Account deletion (priority), audit logging, recipient privacy, share expiry, plan gates, tenant isolation, abuse limits |
| Method | Defects reproduced with a failing automated test first, then fixed, then re-run. Unit/integration tests run against real PostgreSQL (embedded PGlite, same migrations). End-to-end tests run in Chromium against a production build. |
| Result | **29/29 unit + integration tests pass · 19/19 end-to-end tests pass** |

> This is an internal engineering test, not an independent security review or penetration test. It does not certify ORYN as secure or compliant with any regulation.

---

## 1. Problems found

| ID | Severity | Problem | How it was found |
|---|---|---|---|
| SEC-1 | **Critical** | **A deletion request for one user could delete a different user.** `executeDeletion` looked up the request by ID only (`WHERE id = $1`) and then deleted whichever `userId` the job payload named. A request belonging to user A, with a payload naming user B, deleted B. | Test `REPRO-2` failed: B was gone. |
| SEC-2 | **High** | **Deleting an organization owner could delete other users' data.** `DELETE FROM organizations WHERE created_by = $1` cascaded through `share_sessions.org_id ON DELETE CASCADE` and the participant tables. Another user's event share inside that organization was silently destroyed. It also keyed on `created_by`, which is not a guarantee of sole ownership. | Test `REPRO-1` failed: the guest's share row was gone. |
| SEC-3 | **High** | **Deletion was not re-authenticated.** Requesting deletion only required typing the account email, which anyone at an unlocked phone knows. | Test `REPRO-3` failed: deletion was scheduled with the email alone. |
| SEC-4 | Medium | **Deletion left personal data behind:** participant entries (email, name) in other organizations' lists, audit rows pointing at the user, the subscription row, pending jobs, and limiter keys. | Code review, then the "no row carries the id or email" test. |
| SEC-5 | Medium | **Email addresses stored in rate-limit keys.** Failed sign-ins were counted under `signin-fail:<email>`. | Code review. |
| SEC-6 | Medium | **Missing audit events** for several sensitive actions: adding/deleting private notes, follow-ups, default-capsule change, context labels, incoming connection requests. | Audit coverage review. |
| SEC-7 | Medium (availability) | **Abuse limits blocked real people at venues.** At most 10 connection requests per hour per IP, and 2 per link per IP. A conference hall on one Wi-Fi shares one public IP. | New test "30 attendees on one Wi-Fi" failed. |
| SEC-8 | Low (privacy) | **Demo data could be mistaken for real data.** Fictional people appeared on recipient pages with no label, and demo activity was counted in product metrics. | QA review. |

## 2. Fixes

| ID | Fix | Where |
|---|---|---|
| SEC-1 | The request must match **both** its ID and the user, be `scheduled` and be **due**. It is row-locked (`FOR UPDATE`) inside the deletion transaction. Anything else is a no-op. | `lib/server/services/privacy.ts` → `executeDeletion` |
| SEC-2 | No blind cascade. An organization with other members is **handed over**: the next admin (then manager, then member) becomes owner, and `created_by` is updated. A solo organization is deleted only after other users' shares inside it are **closed and detached** (`revoked_at` set, `org_id`/`event_id` cleared). That deletion is guarded by `NOT EXISTS (other members)`. Events and organizations in surviving workspaces are re-attributed to the current owner. | same |
| SEC-3 | `requestDeletion(userId, password)` verifies the current password (scrypt), is rate-limited (5 per 15 min), and audits failed attempts. The server action takes the user ID only from the session, never from the form. The UI asks for the password. | `privacy.ts`, `app/actions/settings.ts`, `/settings/privacy` |
| SEC-4 | Deletion now: removes capsules, visibility policies, shares, QR destinations, interactions, requests, connections, notes, follow-ups, notifications, devices, sessions, exports, memberships, subscription, jobs and limiter keys; de-identifies participant entries elsewhere ("Deleted account"); nulls actor/target IDs in the audit log and strips device labels; nulls analytics user IDs. | `executeDeletion` |
| SEC-5 | Limiter keys use a keyed hash (HMAC) of the email. | `lib/server/services/auth.ts` |
| SEC-6 | Audit events added: `note.added`, `note.deleted`, `followup.created`, `followup.completed`, `followup.reopened`, `capsule.default_changed`, `connection.context_updated`, `share.context_updated`, `connection_request.received`, `account.deletion_reauth_failed`, `org.ownership_transferred`. **No note text, names, contact details, place labels or passwords are written to the log.** | services |
| SEC-7 | The tight limit is now **per browser per link** (a hash of the anonymous claim cookie), still 2 per day. The per-IP ceilings rose to venue scale: connect 300/h, sign-up 100/h, sign-in 200/15 min. Per-account lockout (8 failed sign-ins) is unchanged. | `sharing.ts`, `auth.ts` |
| SEC-8 | Recipient pages show "Demo capsule — this is a fictional person" for demo accounts; the workspace shows a demo banner; admin lists mark demo users; demo accounts are excluded from product metrics and admin counts. Demo passwords are not in the repository. | `CapsuleView`, `AppShell`, `insights.ts`, `admin.ts`, `seed.ts` |

## 3. Tests run

### Unit / integration (Vitest, real Postgres schema) — 29 passed

| Area | Test | Verifies |
|---|---|---|
| Deletion | `REPRO-1` | Deleting an org owner does not delete another user's event share or capsule. |
| Deletion | `REPRO-2` | A request for user A can never delete user B. |
| Deletion | `REPRO-3` | Email alone cannot schedule deletion; nothing is scheduled. |
| Deletion | *erases capsules, shares, connections, notes, follow-ups, events, devices, sessions and analytics ids — and nothing of anyone else* | Scans **every table** after deletion: no row contains the user's ID or account email, and no copy of their private note, note or follow-up text remains. The solo org is gone. The shared org is handed to the colleague. Other users, their events, their shares and the stranger's own saved copy are intact. The person's participant entry in another org is de-identified. |
| Deletion | *after deletion the person can no longer read anything* | Shares close at request time; afterwards the session token is invalid, sign-in fails, the share link is `not_found`, the export can't be downloaded, and no shares are listed. |
| Deletion | *a user can't delete another user* | Wrong password is refused and audited; a mismatched request does nothing; nothing is erased before the grace period ends. |
| Privacy | core flow: *runs the full founder demo* | The recipient projection, Learn more view and vCard never contain the private note, hidden phone or owner's context label. |
| Privacy | *keeping a capsule…* | A kept copy contains no private data; the sender sees only a count and no identifiable interaction. |
| Expiry | *expired shares are refused* | After `expires_at` passes, the server returns `expired`. |
| Expiry | *tampered or forged tokens are rejected* | Changing the signed expiry, the signature or the ID is refused before any lookup. |
| Expiry | *one-time capsules…* | A passive load never consumes it; only the first opener's browser can reopen it. |
| Expiry | *event rules apply to live shares, and ending the event closes them* | Server-side closure. |
| Plan gates | *free: one capsule, no expanded layer…* | The **services** (not the UI) refuse a second capsule, the "Learn more" policy, notes, follow-ups, workspaces and NFC, and record `plan_gate_hit`. |
| Plan gates | *plan limits are data* | Changing the catalog changes enforcement without a deploy. |
| Isolation | *users cannot read, edit or revoke other users' capsules and shares* | |
| Isolation | *connections, notes and follow-ups are private to their owner* | |
| Isolation | *workspaces are isolated…* | Non-members get `not_found`; member/manager/owner roles are enforced; removal revokes access. |
| Audit | *records sensitive actions without storing private content* | 12 expected actions logged; the full audit table contains none of 9 planted secrets (note text, names, contacts, place, password). Session tokens are stored only as hashes. |
| Auth | password change revokes other sessions; per-account sign-in lockout; hashed secrets | |
| Abuse | *many different people on one conference Wi-Fi can each ask to connect; one browser can't spam a link* | 30 phones on one IP succeed; the 3rd request from one browser to one link is refused. |
| Validation | *rejects script URLs and malformed contact details* | `javascript:` and `data:` links refused; HTML in names is stored as text. |

### End-to-end (Playwright, production build) — 19 passed

Security-relevant scenarios, run at iPhone size (390×844), plus Android-phone and desktop profiles:

| Scenario | Verifies over real HTTP |
|---|---|
| QA-01…10 | The recipient's raw HTML, the public JSON API and the downloaded vCard contain no private note, hidden field or owner place label. Layer 1 contains exactly the chosen field kinds. |
| QA-11 | A share at an event is blocked with "This capsule has closed" once the event ends; a forged expiry in the URL is refused. |
| QA-12 | A user from another organization gets "Nothing here" on the demo org's event, participants, connection, capsule, visibility and share pages; `/teams?org=`, `/stations?org=` and `/events` never show the other org's data; the API returns 404. |
| QA-13 | With a free account, calling `POST /api/v1/capsules` directly returns **402** for the second capsule, and NFC sharing is refused; the server holds only one capsule. |
| QA-14 | Deletion with a wrong password is refused ("That password isn't right."). The correct password schedules it and closes shares at once. After the job runs: the old session is signed out, the API returns 401, sign-in fails, the link returns "doesn't open a capsule", and `/api/jobs` refuses callers without the secret. |
| demo.spec | Workspace pages redirect to sign-in; CSP / nosniff headers are present; a cross-site `POST` to the API returns 403. |

## 4. What is still not verified

| Item | Why it matters | Needed |
|---|---|---|
| **Independent penetration test** | Our own tests only find what we think to look for. | An external tester before real users or business data. |
| **Production PostgreSQL under concurrency** | Tests run on embedded Postgres (same SQL). Locking (`FOR UPDATE`, `SKIP LOCKED`) under a real connection pool with several app instances was not exercised. | A staging run on the company's managed Postgres, with parallel job workers. |
| **Client-IP trust behind the host's proxy** | Rate limits read the first `X-Forwarded-For` value. If the host doesn't overwrite that header, a client can rotate it to evade per-IP limits. Per-account and per-browser limits still apply. | Confirm the header behaviour on the chosen host; read the platform's trusted header. |
| **Row-level security in the database** | Isolation is enforced (and tested) in the service layer. There is no second line of defence in Postgres yet. | Add RLS policies keyed on a per-request user setting. |
| Two-step sign-in, email verification, login alerts | Account takeover would expose private notes. | Needs an email provider (founder decision). |
| Nonce-based CSP | The current CSP allows inline scripts (a Next.js requirement without nonces). | Hardening item. |
| Backups, restore drill, key rotation | Recovery and rotating `ORYN_SECRET` (which invalidates all links) are not rehearsed. | Operations runbook on company infrastructure. |
| Safari / WebKit | E2E ran in Chromium only (WebKit isn't installed here). | Real iPhone pass. |
| Data other people keep about a deleted user | By design, a copy a recipient chose to keep, and requests the deleted user sent to others, stay with those other people (like an email already sent). | Confirm this policy with counsel and state it in the privacy policy. |
| A station showing a deleted person's capsule | The organization's printed code stops resolving (it pointed to that person's capsule). | Organizations should re-point the station; consider a warning to org admins. |
