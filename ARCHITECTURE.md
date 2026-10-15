# Architecture

Status 2026-10-15 (Genesis V2 pass). One Next.js 15 application (App Router, React 19, TypeScript) on PostgreSQL. No external SaaS in the request path; email is your own SMTP, AI is optional and consent-gated, wallet signing is first-party.

## Layers

```
Browser (phone / desktop, PWA)
  │  server actions (forms) · /api/v1 JSON · /api/v1/stream (SSE)
  ▼
Next.js app (app/)                      ┌─ components/   UI (cards, shell, scanner, command menu, live hooks)
  pages + server actions + API routes   └─ lib/          brand, card design, analytics catalog, live (SSE client)
  ▼
Services (lib/server/services/*)        authorization lives here: every service takes the acting user id and
  auth · capsules · sharing · nearby ·  calls requireUser / requireOrgPermission / requirePlatformAdmin before
  connections · registrations · crm ·   touching data; routes and actions never query the database directly.
  automations · stations · search ·
  wallet-pass · today · admin
  ▼
Infrastructure (lib/server/*)           db (pg or PGlite, migrations under advisory lock) · jobs (Postgres queue,
                                        SKIP LOCKED, retries) · email (outbox + smtp/log/none) · wallet (pass
                                        data) · wallet-pkpass (ZIP + manifest + PKCS#7 via OpenSSL) · ai
                                        (provider interface) · audit · analytics · ratelimit · tokens
  ▼
PostgreSQL 16 (production) / PGlite (local, tests)   migrations db/migrations/0001–0006, raw SQL
```

## Request paths
- **Pages** are server components; mutations are server actions through `ActionForm` (validation with zod, errors shown inline, audit events written in the service).
- **`/api/v1/*`** is the versioned JSON API (cookie session; mutations require a same-origin `Origin`). Used by Nearby, check-in, search, AI, wallet and the client analytics endpoint.
- **`/api/v1/stream`** is Server-Sent Events: one connection per page for `notifications`, `nearby` and (staff only) `checkin` topics. The server watches the database every 1.5 s and emits only on change; streams end after 15 minutes and `EventSource` reconnects. The client hook `useLive` adds backoff and a visibility-aware reconnect; every consumer keeps a slow poll as the fallback. Authorization is checked on connect and per topic (the `checkin` topic requires check-in staff on that event).
- **Background work** goes through the `jobs` table (`email.deliver`, `automation.run`, `tasks.due`, deletions, exports). `scripts/scheduler.mjs` (or any cron) calls `/api/jobs` with `CRON_SECRET`; `ORYN_JOBS_INLINE=true` runs jobs inline in tests.

## Modules (where to look)
| Module | Service | UI |
|---|---|---|
| Identity & cards | `capsules.ts`, `owner-card.ts` (single card source of truth) | `/capsules`, `/capsules/new` (onboarding steps 2–3), `CapsuleEditor`, `CardDesigner` |
| Share / Present / QR / Wallet | `sharing.ts`, `wallet-pass.ts`, `wallet.ts`, `wallet-pkpass.ts` | `/share/[id]`, `/share/[id]/present`, `/share/[id]/wallet`, `/wallet` (Wallet Center) |
| Nearby (ORYN-to-ORYN proximity; never NFC) | `nearby.ts`, `lib/geocell.ts` | `/share/nearby`, `components/nearby/*` (SSE + poll) |
| People, requests, follow-ups, Pulse | `connections.ts`, `today.ts` | `/connections`, `/today`, `/notifications` |
| Events, registration, tickets, check-in | `events.ts`, `registrations.ts` | `/events/[id]`, `/e/[slug]`, `/register/[slug]`, `/ticket/[token]`, `/events/[id]/checkin` |
| Stations (QR/NFC URL, modes) | `stations.ts` | `/stations`, `/s/[code]` (`/q/` alias) |
| Business: CRM, tasks, automations | `crm.ts`, `automations.ts` | `/business/*` |
| Workspaces, roles | `orgs.ts`, `permissions.ts` | `/teams` |
| Search | `search.ts` | `CommandMenu` (single mount, ⌘K) |
| AI (consent-gated) | `ai.ts` | `AiAssist` |
| Command Center | `admin.ts` (`operationalAlerts`) | `/admin`, `/admin/[module]` |
| Accounts, email, privacy | `auth.ts`, `email.ts`, `privacy.ts` | `/signin`, `/signup` (step 1), `/verify`, `/forgot`, `/reset`, `/settings/*` |

## Branding
The product name is configuration: `NEXT_PUBLIC_BRAND_NAME` (default `ORYN`) via `lib/brand.ts`; the logo falls back to a text wordmark for a non-default name; the web manifest is generated (`app/manifest.ts`). Code, routes and cookies keep the `oryn` identifiers (DECISIONS E1, E11).

## Design system
Tokens in `tailwind.config.ts`: Obsidian `#08090D`, Midnight Navy `#07132B`, Graphite `#151A24`, Premium White `#F7F9FC`, Silver `#B9C3D3`, Electric Blue `#246BFD`; card materials and foils in `lib/card-design.ts`; motion in `app/globals.css` (entry stage, card flip, Pulse), all honouring `prefers-reduced-motion`.

## Data
Tenant boundary = `organizations` (workspace data: leads, stations, events, automations) vs. the person (cards, connections, notifications). Share access uses signed tokens (`sid.exp36.hmac22`); tickets use `reg_<id>.<hmac22>` with the hash stored. See docs/DATA_MODEL.md and db/migrations.

## Tests
Vitest (services, on PGlite and on PostgreSQL 16) and Playwright (phone, desktop, two-phone Nearby, iPhone QA, platform, genesis desktop + mobile with screenshots in docs/screenshots/). See FEATURE_STATUS.md for the evidence table.
