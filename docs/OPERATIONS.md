# ORYN — Architecture, setup and deployment

## Architecture in one picture

```
Browser (recipient: no account, works without JS)      Browser / PWA (sender workspace)
          │  /c/[token]  /q/[code]                              │  /today /capsules /share …
          ▼                                                     ▼
 ┌──────────────────────────── Next.js app (App Router) ────────────────────────────┐
 │ Server Components + Server Actions (forms work without JS)    /api/v1 (JSON)      │
 │                     │                                              │               │
 │         lib/server/services/*  ← the only place business rules live               │
 │   auth · capsules · sharing · connections · today · orgs · events · stations      │
 │   privacy · billing · insights · admin                                            │
 │         lib/server/{tokens, permissions, plans, ratelimit, audit, analytics, jobs}│
 └───────────────────────────────────────┬───────────────────────────────────────────┘
                                          ▼
                     PostgreSQL (company-owned; PGlite locally)  ◄── worker (npm run worker)
```

- **Modules** are separated by service file (identity/auth, sharing, relationships, events, stations, billing, organizations, privacy). UI never talks to the database directly.
- **API** `/api/v1` exposes capsules, shares, revocation and the recipient-safe projection, so native apps, stations, wallet passes and partners can be added without re-architecting.
- **Background jobs** are rows in `jobs` processed by `npm run worker` or by a scheduler calling `GET /api/jobs` with `Authorization: Bearer $CRON_SECRET`.
- **Feature flags** live in `feature_flags` and are toggled in `/admin`.
- **Plans** live in `plan_catalog`; prices and limits change in `/admin` without a deploy.
- **Portability**: standard Node.js + standard PostgreSQL. No vendor-specific database, auth or queue. Any host that runs Node 20+ and any Postgres 14+ works.

## Local development

Requirements: Node.js 20.9+ (22 recommended). Nothing else — the database is embedded.

```bash
npm install
npm run dev            # http://localhost:3000
```

- Data is stored in `.data/pglite` (git-ignored). `npm run db:reset` wipes it.
- Demo data is seeded on first start (development only): `demo@oryn.local` (Business plan, sample event, station, requests) and `admin@oryn.local` (for `/admin`). All of it is fictional and the workspace shows a "Demo account" banner. The password comes from `ORYN_DEMO_PASSWORD`, or a random one is printed to the server console once.
- Background jobs run inline in development.
- To use a real Postgres locally instead: `DATABASE_URL=postgres://… DATABASE_SSL=disable npm run dev`.

## Tests

```bash
npm run typecheck
npm test               # unit/integration: real schema on in-memory Postgres (29 tests)
npm run build
npm run test:e2e       # Playwright: phone + desktop, slow network, no-JS, one-time links, auth/headers
```

E2E starts a production build on port 3100 with a throwaway embedded database. Screenshots are written to `docs/screenshots/`.

## Environment variables

| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL` | Production | Company-owned PostgreSQL connection string. |
| `DATABASE_SSL` | No | `disable` for local Postgres, `no-verify` only if the provider requires it. Default verifies certificates. |
| `DATABASE_POOL_MAX` | No | Connection pool size (default 10). Use a pooler (e.g. PgBouncer) on serverless hosts. |
| `ORYN_SECRET` | Production | ≥32 random characters. Signs share tokens and claim hashes. **Rotating it invalidates every existing share link.** |
| `NEXT_PUBLIC_APP_URL` | Production | Public origin used in QR codes and links, e.g. `https://oryn.example`. |
| `CRON_SECRET` | If using `/api/jobs` | Bearer secret for the scheduler. |
| `BILLING_PROVIDER` | Later | When set, simulated plan switching is disabled. |
| `ORYN_SEED_DEMO` | No | `true` seeds demo accounts. Never set in production. |
| `ORYN_DELETION_GRACE_DAYS` | No | Days between a deletion request and erasure (default 7). Tests use 0. |
| `ORYN_DEMO_PASSWORD` | No | Password for the fictional demo accounts. If unset, a random one is printed once. |
| `ORYN_JOBS_INLINE` | No | Run jobs right after they're queued (default on outside production). |
| `ORYN_ALLOW_EMBEDDED_DB` | No | Allows the embedded DB with `NODE_ENV=production` — throwaway demos and E2E only. |
| `ORYN_INSECURE_COOKIES` | No | Allow non-Secure cookies over plain http in a production build — local E2E only. |

Generate secrets with `openssl rand -hex 32`.

## Environments

| | Local | Staging | Production |
|---|---|---|---|
| Database | PGlite in `.data/` | Company-owned managed Postgres (separate instance) | Company-owned managed Postgres with PITR backups |
| Secrets | none needed | Staging-only values in the company secret manager | Production-only values; never shared with staging |
| Demo seed | on | on (`ORYN_SEED_DEMO=true`) | **off** |
| Domain | localhost | `staging.<company domain>` behind basic auth | `<company domain>` |
| Jobs | inline | worker or cron | worker (preferred) or cron every minute + daily sweep (`/api/jobs?daily=1`) |

## Production deployment checklist

1. **Ownership first.** Create every account in the company's name with company email + MFA: hosting, database, DNS/domain registrar, error monitoring, email provider, payment provider, Apple/Google developer accounts. Repository in the company GitHub organization. No production database in anyone's personal account.
2. Provision Postgres 14+ with encryption at rest, automated daily backups and point-in-time recovery.
3. Set environment variables above in the host's secret store.
4. Run migrations before shifting traffic: `DATABASE_URL=… npm run db:migrate`.
5. Build and start: `npm ci && npm run build && npm start` (or the host's Next.js integration). The app is stateless; scale horizontally.
6. Run the worker as a separate long-running process: `npm run worker` — or configure a scheduler to call `/api/jobs` every minute and `/api/jobs?daily=1` once a day.
7. Point uptime monitoring at `/api/health`; connect error reporting; set alerts (see security model §8).
8. Create the first platform admin: `UPDATE users SET is_platform_admin = true WHERE email = '<founder>';` (then audit it).
9. Do a restore drill from backup into staging and record the date and result below.

### Serverless hosts (e.g. Vercel)

Works with `DATABASE_URL` pointing to a pooled connection. The embedded database must not be used there (the file system is ephemeral). Use the host's cron to call `/api/jobs` with `CRON_SECRET`. The `worker` script needs a separate always-on process if preferred over cron.

## Backups and restore drill log

| Date | Backup used | Restored to | Result | By |
|---|---|---|---|---|
| — | — | — | Not yet performed | — |

## Monitoring hook points

`console.error` tags: `[action]` (server action failures), `[api]`, `[jobs]`, `[analytics]`. Wire these to the error-reporting provider once chosen.
