# Feature status

Legend: **Implemented** = code is in the repo and wired end to end · **Tested** = covered by automated tests that pass (evidence column) · **Partial** = works for a defined subset, limits stated · **Blocked** = needs something outside this repository · **Not implemented**.

Test evidence as of 2026-10-15 (final MVP pass): `npm test` 82/82 (PGlite and PostgreSQL 16) · `npm run test:e2e` 35/35 (Pixel 7, desktop, two-phone Nearby, iPhone QA, platform, genesis desktop + mobile) · typecheck, lint, production build clean · 36 screenshots in docs/screenshots/genesis-*. Everything is still a **local/staging demo** — not production-verified on company infrastructure, and no real-device wallet pass exists.

| Area (directive §) | Status | Evidence / notes |
|---|---|---|
| Welcome, animated entry, onboarding (§3) | Tested | `demo.spec` entry screen; `genesis.spec` 5-step progress (Identity → Profile type → Your card → Appearance → Share) |
| Design system tokens (§4) | Implemented | ORIAN palette tokens (Obsidian/Midnight Navy/Graphite/Premium White/Silver/Electric Blue) in `tailwind.config.ts`; card materials, motion with reduced-motion. Brand name by configuration (`NEXT_PUBLIC_BRAND_NAME`). RTL: `dir="auto"` on user text; full RTL layout not done |
| Unified app, navigation, role menus (§5) | Implemented | Routes use existing names (`/today`, `/capsules`, `/connections`, `/business`…) rather than §5's exact list — DECISIONS E1 |
| Accounts: sign-up/in/out, sessions, devices, deletion, export (§6) | Tested | `security.test`, `deletion.test`, `qa.spec` |
| Email verification, password reset, notification prefs (§6) | Tested | `platform.test` "email verification and password reset"; `platform.spec` account flow |
| Roles (individual, workspace roles, staff, platform admin) (§6) | Tested | `permissions.ts`; exhibitor = workspace member with a booth station; "Event organizer" = workspace manager+ |
| Digital identity: profile, field, visibility, `/u/<username>` (§7) | Tested | `platform.test` usernames; `platform.spec` `/u/` resolves to the active card |
| Multiple identity contexts (§7) | Tested | Cards = contexts (professional / personal / social modes) |
| Card builder, collections A–G, materials, duplicate/make active/archive, QR, VCF, analytics (§8) | Tested | `card-design.test` (collections, duplicate), `core-flow.test`, `qa.spec`, `genesis.spec` · Logo/photo upload: **Not implemented** (photo URL only) |
| ORYN Connect: requests, directory, tags, notes, reminders, timeline, export (§9) | Tested | `relationships.test`, `nearby.spec` · Duplicate detection/merge: **Not implemented** |
| ORYN Pulse (connection animation) (§9) | Tested | "ConnectedMoment" in `nearby.spec` |
| ORYN Presence: event/area discovery, consent, block, report (§10) | Tested | `nearby.test` (block/report), `nearby.spec` · Interest matching, meeting requests, availability: **Not implemented** |
| Stations: provisioning, modes, remote destination, validated redirects, transfer, scan analytics (§11) | Tested | `platform.test` "stations v2"; `platform.spec` lead capture; `/q/` alias kept for printed codes |
| Station experience (§12): card · lead form · registration · check-in · booking/link hand-off | Tested | Product catalog mode: **Not implemented** (use "custom page") |
| Events: create, publish, public page, schedule fields, capacity, branding (§13) | Partial | Public page + registration settings tested; schedules/sessions and branding upload: **Not implemented** |
| Registration: custom fields, limits, waitlist, confirmation email, IDs, QR ticket, cancel (§14) | Tested | `platform.test` capacity/waitlist/promotion; `platform.spec` |
| Paid ticketing (§14) | Blocked | Ticket types with a price are stored and shown as "not on sale yet" until a payment provider is configured |
| Check-in: camera scan, manual search, atomic, staff auth, stats, history (§15) | Tested | Atomic race test; `platform.spec` manual + scan API. Camera path (BarcodeDetector / jsQR) needs a real device pass |
| Exhibitors: booth station, lead capture, notes, assignment, export, consent (§16) | Tested | Leads need consent; export is owner/admin |
| Business workspaces, roles, isolation (§17) | Tested | `security.test` tenant isolation; `platform.test` outsider checks |
| CRM: stages (custom), notes, tasks, assignment, filters, CSV (§18) | Tested | `platform.test` "CRM and automations" |
| Automation engine: 7 triggers, 6 actions, idempotent runs, retries, history (§19) | Tested | Idempotency and condition tests; UI run log |
| Wallet engine: Apple .pkpass packaging + PKCS#7 signing, Google object + RS256 save link, Wallet Center (§20–21) | Tested (code) · Blocked (device) | `pkpass.test` (ZIP, manifest, signed with a self-signed chain and verified, unsigned preview labelled), `wallet.test`; `genesis.spec` Wallet Center. Real installation needs the company's Apple certificates / Google issuer — WALLET_INTEGRATION.md |
| Analytics: real events, attribution, Insights, Today (§22) | Tested | `relationships.test`; CSV: leads/registrations only · Date filters / station comparison charts: **Partial** (30-day tables) |
| AI: bio, follow-up, lead summary, tips; consent; fallback (§23) | Tested | Fallback path tested; the Anthropic path is code-reviewed but **not exercised** (no key in CI) |
| Notifications: in-app center (read/unread, history, deep links), live bell (SSE), email outbox, prefs (§24) | Tested | `genesis.spec` (stream + center); Push notifications: **Not implemented** |
| Realtime: SSE stream for notifications, Nearby, check-in stats; reconnect + poll fallback | Tested | `/api/v1/stream` asserted in `genesis.spec`; Nearby and check-in flows pass with the stream active |
| Personal dashboard (role-adaptive): primary card + quick share, tickets, workspace pulse | Tested | `genesis.spec` individual (no workspace blocks) vs. workspace member |
| Ticket states Valid · Checked in · Cancelled · Expired | Tested | `genesis.spec` all four states |
| Global search ⌘K (§25) | Tested | Authorization test in `platform.test` |
| Subscriptions: plans, entitlements, limits, simulated billing (§26) | Tested | `plans.test`; real billing **Blocked** on a payment provider |
| Command Center (§27) incl. operational alerts and abuse reports | Tested (modules) · Implemented (alerts) | Modules users/businesses/events/stations/subscriptions/wallet/health/audit/flags; admin-only (404 otherwise); Health lists alerts (failed jobs/mail, stuck queue, missing CRON_SECRET, non-SMTP transport, demo accounts in production, wallet pending) |
| Database: migrations, indexes, constraints, transactions (§28) | Tested | Raw SQL on PostgreSQL (DECISIONS E2), 6 migrations |
| Security (§29) | Tested | `security.test`, SECURITY.md audit (demo hint removed from production builds, camera policy fixed, wallet audit events); external pen test **not done** |
| Reliability: health, jobs, retries, backups, logging (§31) | Partial | Health endpoint, job retries, pg_dump backups in the Docker stack; no monitoring backend yet |
| Localization / Hebrew (§4) | Partial | Hebrew text renders correctly (RTL auto); UI strings are English only |
