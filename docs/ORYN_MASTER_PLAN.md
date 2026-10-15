# ORYN — Master plan (premium platform transformation)

Date 2026-10-15. Companion to ARCHITECTURE.md (how it is built), FEATURE_STATUS.md (evidence per area), KNOWN_ISSUES.md, DECISIONS.md and docs/ORYN_IMPLEMENTATION_STATUS.md (this pass, feature by feature).

## Repository audit (focused, 2026-10-15)
| Topic | Finding |
|---|---|
| Stack | Next.js 15 App Router, React 19, TypeScript, Tailwind tokens; raw SQL on PostgreSQL 16 (PGlite locally/tests); Vitest + Playwright. Kept as is (DECISIONS E2). |
| Auth / authz | Own scrypt + hashed sessions; `requireUser`, `requireOrgPermission`, `requirePlatformAdmin` in every service. Verified by `security.test`, `platform.test`. |
| API | Server actions for forms; `/api/v1/*` JSON (same-origin mutations); `/api/v1/stream` SSE. |
| Design system | Tokens (ORIAN palette), card material/foil/finish/font/layout engine, sheets, buttons, entry stage, motion with reduced-motion. |
| Integrations | Own SMTP (optional), Anthropic AI (optional, consent-gated), Apple/Google wallet (first-party packaging; credentials pending). No other vendors. |
| Working | Cards, sharing, public card, Nearby (ORYN-to-ORYN), People, events/registration/tickets/check-in, stations, CRM, automations, notifications, search, Command Center, privacy export/delete. |
| Incomplete before this pass | Card collections (only 6 presets, no platinum/gold/white), duplicate card, "make active" from the list, block/report in Nearby, loading skeletons, abuse reports in Command Center. |
| Duplicated functionality | None found; `/q/` and `/s/` are deliberate aliases. |
| Security | Fixed earlier today: demo hint in production builds, camera policy. New: block/report, reports module. Open: external pen test, staging on company infra. |
| Mobile | Verified screens in docs/screenshots/genesis-mobile-*; tightened page headers; `overflow-x: clip` on `html`. |
| Missing integrations | Apple Pass Type ID certificate, Google Wallet issuer, SMTP credentials, Web Push. |

## Product pillars → modules
1. **Flagship card** — collections A–G (Obsidian, Platinum, Titanium, Midnight, Signature Gold, Pure White, Custom), every part editable, front/back, double-tap flip, live preview, persist, duplicate, make active, archive.
2. **Identity capsules** — one card per context (professional, business, personal, social, creator, event, hiring, custom) with its own fields, layers (card / Learn more / private), policy and sharing rules; the active card drives Share, Nearby, Present, Wallet.
3. **Sharing** — card first; Nearby + Present primary; QR, link, system share, Messages/WhatsApp/Email, vCard; public page needs no account; privacy-aware analytics.
4. **Nearby** — opt-in, coarse area cells or same event, accept/not now, block, report, history in People. Not NFC; no fabricated users (demo members only for demo accounts and labelled).
5. **Wallet** — pass model, lifecycle, active-card resolution, signing pipeline; blocked on certificates; honest status.
6. **Events** — publish, register (capacity, waitlist, custom questions), tickets with signed tokens, server-side validation, states, check-in (camera + manual, atomic), export.
7. **Stations** — one printed code, six modes, validated destinations, analytics.
8. **Business** — CRM (stages, notes, tasks, assignment, CSV), automations (triggers → actions, idempotent, retries, history), workspace isolation.
9. **Platform** — notifications (center + SSE), analytics, Command Center (modules, alerts, reports), security, performance.

## Priorities
- **P0 (done this pass):** collections, duplicate/make-active, block/report, skeleton, mobile header spacing, reports module, tests for all of it, full gate green.
- **P1 (next):** Web Push; outbound alerting; logo/photo upload pipeline; Hebrew UI + RTL; event schedules.
- **P2:** more materials/finishes, advanced personalization (logo placement, image cropping), interest matching, admin analytics.

## Investor demo walkthrough (16 steps, all on real persisted data)
Demo account `demo@oryn.local` (clearly labelled fictional data; banner on every screen). Password is `ORYN_DEMO_PASSWORD` or printed on first start.
1. **Open ORYN** → `/welcome` entry stage (cards deal in) → Sign in.
2. **Premium card** → Today shows the active card block; tap **Share** → the card rises on screen (`/share/quick`).
3. **Customize** → Edit card → Collection grid (A–G) → pick *Signature Gold*, change lettering/layout → live preview → Save.
4. **Flip** → double-tap the card on Share or Present (`/share/[id]/present`).
5. **Switch capsules** → My cards → *Make active* on another card, or "Using ▾" switcher on Share.
6. **Share** → Share another way → copy link / QR / system share.
7. **Public profile** → open the link in a private window (no account) → card hero, only permitted fields; `/u/<username>` permanent link.
8. **Save contact** → "Save contact" → vCard with permitted fields only.
9. **Create a connection** → Nearby: open a demo member → Connect → accepted (demo members reply after ~2 s) → Pulse moment → People.
10. **Create an event** → Events → Harbor Summit → set slug, publish.
11. **Register an attendee** → `/register/<slug>` in a private window.
12. **Ticket** → `/ticket/<token>` with QR and state *Valid*.
13. **Scan** → Events → Check-in → camera (phone) or search → *Welcome, …*; second scan → *already checked in*.
14. **Capture a lead** → Stations → set Booth 14 to *Lead capture* → open `/s/<code>` → submit form with consent.
15. **CRM** → Business → lead in *New*, move stage, add task; automation run visible.
16. **Analytics** → Today "This week", Insights, Business pipeline; Command Center (admin account) → Health.
