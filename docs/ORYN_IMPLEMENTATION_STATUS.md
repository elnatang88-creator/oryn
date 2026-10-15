# ORYN implementation status (2026-10-15)

Labels: **WORKING AND VERIFIED** (automated tests pass on this commit) · **IMPLEMENTED BUT NOT VERIFIED** · **PARTIALLY IMPLEMENTED** · **BLOCKED** · **NOT STARTED**.

| Directive § | Feature | Status | Evidence / gap |
|---|---|---|---|
| 3 | Collections A–G (Obsidian, Platinum, Titanium, Midnight, Signature Gold, Pure White, Custom) | WORKING AND VERIFIED | `card-design.test` collections; `genesis.spec` |
| 3 | Front/back, double-tap flip, 3D tilt, gestures, reduced motion, fallback | WORKING AND VERIFIED | `qa.spec`, `nearby.spec` (flip), CSS reduced-motion |
| 3 | Logo, profile image | PARTIALLY IMPLEMENTED | URL fields only; no upload/cropping pipeline (K10) |
| 4 | Visual editor, live preview, save, duplicate, make active, archive | WORKING AND VERIFIED | `card-design.test` duplicate; `genesis.spec`; archive in `core-flow` |
| 4 | Draft/publish | PARTIALLY IMPLEMENTED | Saving is immediate and versioned; no separate draft state |
| 5 | Identity capsules (8 modes, separate fields/links/policy/sharing) | WORKING AND VERIFIED | `core-flow.test`, `plans.test`, `qa.spec` |
| 6 | Mobile experience (bottom nav, spacing, empty/error states, safe areas) | WORKING AND VERIFIED (Chromium emulation) | genesis-mobile screenshots; real device pass pending |
| 6 | Loading skeletons | NOT STARTED | Route-level skeleton reverted (ORYN_DECISIONS T6); per-page skeletons pending |
| 7 | Sharing: QR, link, share sheet, vCard, Present, public page, analytics | WORKING AND VERIFIED | `demo.spec`, `nearby.spec`, `relationships.test` |
| 8 | Nearby: opt-in, duration, discovery, requests, block, report, history | WORKING AND VERIFIED | `nearby.test`, `nearby.spec`; true radio proximity BLOCKED (native/BLE needed, docs/NEARBY_AND_WALLET.md) |
| 9 | Wallet: pass model, lifecycle, active-card resolution, validation, status, Wallet Center | WORKING AND VERIFIED (code) · BLOCKED (device install) | `pkpass.test`, `wallet.test`; needs Apple certificates / Google issuer |
| 10 | Events, registration, ticket categories, unique signed tickets, states, export | WORKING AND VERIFIED | `platform.test`, `platform.spec`, `genesis.spec` (paid tickets BLOCKED on payment provider) |
| 11 | Check-in: camera, manual, atomic duplicate prevention, counters, recent, staff-only, audit | WORKING AND VERIFIED (camera path IMPLEMENTED BUT NOT VERIFIED in CI) | `platform.test` race test; `platform.spec` |
| 12 | Smart QR stations: 6 modes, validated redirects, analytics, permissions | WORKING AND VERIFIED | `platform.test` stations v2; `platform.spec` |
| 13 | CRM: leads, stages, assignment, tags, notes, tasks, reminders, history, search, CSV, isolation | WORKING AND VERIFIED | `platform.test` CRM; `security.test` isolation |
| 14 | Automations: triggers, actions, enable/disable, history, retries, idempotency | WORKING AND VERIFIED | `platform.test` automations |
| 15 | Email: templates, outbox queue, retries, status, failure log | WORKING AND VERIFIED (log transport) · BLOCKED (delivery, no SMTP configured) | `platform.test` email; KNOWN_ISSUES K2 |
| 16 | Notifications: center, categories, read/unread, prefs, deep links, live bell | WORKING AND VERIFIED | `genesis.spec` |
| 17 | Analytics: individual + business dashboards from stored events | WORKING AND VERIFIED | `relationships.test`; Today/Insights/Business |
| 18 | Command Center: modules, integrations health, alerts, jobs, audit, reports | WORKING AND VERIFIED (modules) · IMPLEMENTED BUT NOT VERIFIED (alert conditions) | `platform.spec`, `genesis.spec` |
| 19 | Security & privacy audit | WORKING AND VERIFIED (automated) · BLOCKED (external pen test) | SECURITY.md |
| 20 | Performance | PARTIALLY IMPLEMENTED | Standalone build, no heavy deps, lazy sheets; no Lighthouse run recorded |
| 21 | Demo environment and 16-step walkthrough | WORKING AND VERIFIED (steps map to passing specs) | docs/ORYN_MASTER_PLAN.md walkthrough |

## Required environment variables
See DEPLOYMENT.md (table) and `.env.example`. Minimum for production: `DATABASE_URL`, `ORYN_SECRET`, `ORYN_PUBLIC_URL`, `CRON_SECRET`, `EMAIL_TRANSPORT=smtp` + `SMTP_URL` + `EMAIL_FROM`, `ORYN_SEED_DEMO=false`.

## Deployment
DEPLOYMENT.md (Docker reference stack, go-live gate, rollback).

## Recommended next phase
1. Company accounts: Apple Developer (Pass Type ID), Google Wallet issuer, SMTP — unblocks wallet and email in one sprint.
2. Staging on company infrastructure + real-device QA (iPhone Safari, Android) + external penetration test.
3. Upload pipeline (logo/photo with cropping) and Hebrew UI/RTL.
4. Web Push and outbound operational alerting.
