# Feature status

Legend: **Implemented** = code is in the repo and wired end to end · **Tested** = covered by automated tests that pass (evidence column) · **Partial** = works for a defined subset, limits stated · **Blocked** = needs something outside this repository · **Not implemented**.

Test evidence as of 2026-10-15: `npm test` 70/70 (PGlite and PostgreSQL 16) · `npm run test:e2e` 31/31 (Pixel 7, desktop, two-phone Nearby, iPhone QA, platform) · typecheck, lint, production build clean. Everything is still a **local/staging demo** — not production-verified on company infrastructure.

| Area (directive §) | Status | Evidence / notes |
|---|---|---|
| Welcome, animated entry, onboarding (§3) | Tested | `demo.spec` entry screen; first card → first-run card |
| Design system tokens (§4) | Partial | Tailwind tokens, card system, sheets, buttons. Palette is ORYN navy/electric (founders' identity), not the §4 hex list — see KNOWN_ISSUES K1. RTL: `dir="auto"` on user text; full RTL layout not done |
| Unified app, navigation, role menus (§5) | Implemented | Routes use existing names (`/today`, `/capsules`, `/connections`, `/business`…) rather than §5's exact list — DECISIONS E1 |
| Accounts: sign-up/in/out, sessions, devices, deletion, export (§6) | Tested | `security.test`, `deletion.test`, `qa.spec` |
| Email verification, password reset, notification prefs (§6) | Tested | `platform.test` "email verification and password reset"; `platform.spec` account flow |
| Roles (individual, workspace roles, staff, platform admin) (§6) | Tested | `permissions.ts`; exhibitor = workspace member with a booth station; "Event organizer" = workspace manager+ |
| Digital identity: profile, field, visibility, `/u/<username>` (§7) | Tested | `platform.test` usernames; `platform.spec` `/u/` resolves to the active card |
| Multiple identity contexts (§7) | Tested | Cards = contexts (professional / personal / social modes) |
| Card builder, templates, materials, QR, VCF, analytics (§8) | Tested | `card-design.test`, `core-flow.test`, `qa.spec` (vCard decoded) · Logo/photo upload: **Not implemented** (photo URL only) |
| ORYN Connect: requests, directory, tags, notes, reminders, timeline, export (§9) | Tested | `relationships.test`, `nearby.spec` · Duplicate detection/merge: **Not implemented** |
| ORYN Pulse (connection animation) (§9) | Tested | "ConnectedMoment" in `nearby.spec` |
| ORYN Presence: event/area discovery, consent (§10) | Tested | `nearby.test`, `nearby.spec` · Interest matching, meeting requests, availability: **Not implemented** |
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
| Wallet engine: Apple pass.json + Google object + RS256 save link (§20–21) | Blocked | `wallet.test`; needs company Apple/Google accounts; Apple signing service not built — docs/NEARBY_AND_WALLET.md |
| Analytics: real events, attribution, Insights, Today (§22) | Tested | `relationships.test`; CSV: leads/registrations only · Date filters / station comparison charts: **Partial** (30-day tables) |
| AI: bio, follow-up, lead summary, tips; consent; fallback (§23) | Tested | Fallback path tested; the Anthropic path is code-reviewed but **not exercised** (no key in CI) |
| Notifications: in-app, email outbox, prefs (§24) | Tested | Push notifications: **Not implemented** |
| Global search ⌘K (§25) | Tested | Authorization test in `platform.test` |
| Subscriptions: plans, entitlements, limits, simulated billing (§26) | Tested | `plans.test`; real billing **Blocked** on a payment provider |
| Command Center (§27) | Tested | Modules users/businesses/events/stations/subscriptions/wallet/health/audit/flags; admin-only (404 otherwise) |
| Database: migrations, indexes, constraints, transactions (§28) | Tested | Raw SQL on PostgreSQL (DECISIONS E2), 6 migrations |
| Security (§29) | Tested | `security.test`, SECURITY_MODEL.md; external pen test **not done** |
| Reliability: health, jobs, retries, backups, logging (§31) | Partial | Health endpoint, job retries, pg_dump backups in the Docker stack; no monitoring backend yet |
| Localization / Hebrew (§4) | Partial | Hebrew text renders correctly (RTL auto); UI strings are English only |
