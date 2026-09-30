# ORYN — Build status (v1 prototype)

Date: 2026-09-30. Branch: `claude/oryn-product-strategy-02whh5`.

Legend: **Working** = implemented end to end and covered by tests. **Partial** = works, with a stated gap. **Simulated** = the flow exists but a real provider is not connected. **Not started**.

## The first demo (all 12 steps)

| # | Step | Status | Where |
|---|---|---|---|
| 1 | User creates a capsule | Working | `/capsules/new` → `CapsuleEditor` → `createCapsule()` |
| 2 | Selects visible fields (Shown first / On "Learn more" / Not shared) | Working | Per-field layer control + live preview |
| 3 | Activates ORYN | Working | Share button (tab bar / rail) → `/share/quick` → live QR. E2E measures tap → QR under 3 s |
| 4 | Recipient opens the view (no account, no app) | Working | `/c/[token]` |
| 5 | Sees only selected information | Working | `project()`; asserted in unit + E2E (hidden fields, private note, context label never present) |
| 6 | Chooses "Learn more" | Working | `/c/[token]/more` |
| 7 | Offered ORYN web continuation | Working | "Keep in ORYN" on the Expanded View → sign up → kept in their workspace. A native app is not offered (none exists yet) |
| 8 | Sender sees the interaction | Working | Today: counts, requests, activity |
| 9 | Adds a private note | Working | Contact detail |
| 10 | Creates a follow-up | Working | Contact detail, Follow-ups, Today |
| 11 | Revokes or edits the capsule | Working | Stop sharing (instant), edit (live), archive |
| 12 | Recipient can no longer access revoked content | Working | Instant, Learn more, Save and Connect all refuse |

## The 20 screens

| # | Screen | Status |
|---|---|---|
| 1 | Landing | Working |
| 2 | Sign up / sign in | Working (email + password). Email verification, password reset, passkeys: **not started** (need an email provider) |
| 3 | Create Identity Capsule (mode picker + templates) | Working |
| 4 | Capsule editor with live preview | Working. Photo is an https link; **uploads not started** |
| 5 | Visibility controls | Working |
| 6 | Active sharing screen (QR, send, copy, NFC tag, stop, context label, live counts, offline notice) | Working |
| 7 | Recipient Instant View | Working (also without JavaScript) |
| 8 | Recipient Expanded View | Working |
| 9 | Connection request (recipient form + owner inbox) | Working |
| 10 | Connections list (search) | Working |
| 11 | Contact detail | Working |
| 12 | Private notes & follow-ups | Working. Reminders are in-app only (email/push need a provider) |
| 13 | Today workspace | Working |
| 14 | Event creation | Working |
| 15 | Event participant management | Working. Email invitations **simulated** (participants must already have or create an account) |
| 16 | Stations / QR destinations | Working (create, reassign, pause, printable QR) |
| 17 | Subscription & plan management | **Simulated billing** — plan switches are recorded with `provider = manual`; no payment taken |
| 18 | Data & privacy center | Working (who-sees-what, stop all shares, export, retention, deletion with grace period) |
| 19 | Security settings | Working (sessions, devices, password change, sign out everywhere). 2FA **not started** |
| 20 | Admin console | Working (stats, value metrics, plan catalog editing, feature flags, user plans, reports, audit log) |

Also built: Teams (workspace, members, roles, teams, org audit log), Insights, Follow-ups, "More" menu for phones, privacy notice, JSON API `/api/v1`, background jobs, worker.

## What is simulated

| Area | Today | To make it real |
|---|---|---|
| Payments | Self-service plan switch, labelled "simulation" | Choose provider; set `BILLING_PROVIDER`; add checkout + webhook calling `applyPlanChange()` |
| Email (verification, reset, invites, reminders) | Not sent. Reminders appear in-app | Choose provider; add templates |
| Wallet passes | Channel defined; flag `share.wallet_pass` off | Company Apple Developer + Google Wallet issuer accounts and signing certificates |
| Error reporting | `console.error` hook points | Company-owned error monitoring project |
| Logo | Placeholder wordmark (`public/brand/oryn-wordmark.svg`, `components/Logo.tsx`) | Founders supply the ORYN logo asset — the repo did not contain one |

## What requires credentials (company-owned)

`DATABASE_URL` (production Postgres), `ORYN_SECRET`, `NEXT_PUBLIC_APP_URL` + domain, `CRON_SECRET`, payment provider keys, email provider keys, Apple/Google wallet certificates, error-monitoring DSN. See `docs/05-operations.md`.

## What must be tested on real devices

| Item | Why |
|---|---|
| QR scanning distance/angle in bright light and dim halls, with iPhone and Android camera apps | Emulation can't judge real scanning |
| Web NFC tag writing (Chrome on Android) and reading the tag with iPhone and Android | Only available on real hardware |
| System share sheet (`navigator.share`) on iOS Safari and Android Chrome | Varies by OS |
| Add-to-home-screen and the "Share now" PWA shortcut (Android long-press; iOS has no manifest shortcuts) | OS-specific |
| "Double press" paths: iOS Back Tap → Shortcuts → open `/share/quick`; Android: Quick Settings tile (needs a native wrapper) | Not an OS feature ORYN can claim; must be validated per device |
| vCard import on iOS and Android | Contact apps differ |
| One-handed reach, glare, noisy/stressful conditions | Needs a field test at a real event (see research plan) |
| Screen readers (VoiceOver, TalkBack) | Semantics are in place; needs a real audit |

## Verified in this environment

- `npm run typecheck` — clean
- `npm run lint` — clean
- `npm test` — 21 tests: full demo flow on a real Postgres schema, private-data projection, one-time/expiry/tamper, view-only policy, silent decline, keep-in-ORYN privacy, quick-share reuse, tenant isolation across users and workspaces, role enforcement, event rules on live shares, station reassignment/pause, admin hidden, auth + session revocation, sign-in rate limit, hashed secrets, export + deletion lifecycle, plan gates, catalog-driven limits, input validation (script URLs)
- `npm run build` — production build succeeds
- `npm run test:e2e` — see results below

## E2E results

_Filled in from the latest run; see the summary at the end of the build report._
