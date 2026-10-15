# Deployment

Status 2026-10-15. The app is stateless Next.js (standalone output) + PostgreSQL + a scheduler. The Docker stack under `deploy/` is the reference deployment; docs/OPERATIONS.md has the longer checklist and the restore-drill log.

## Reference stack (`deploy/docker-compose.yml`)
`caddy` (TLS) → `app` (Next.js, port 3000) ← `scheduler` (calls `/api/jobs` every minute) → `db` (PostgreSQL 16) + `backup` (pg_dump, `BACKUP_KEEP_DAYS`).

```
cp deploy/.env.example deploy/.env   # or ./deploy/gen-env.sh
# fill ORYN_DOMAIN, ORYN_SECRET, CRON_SECRET, POSTGRES_ADMIN_PASSWORD, ORYN_DB_PASSWORD, EMAIL_*, (optional) wallet + AI keys
docker compose -f deploy/docker-compose.yml up -d --build
```
Migrations run automatically at startup under an advisory lock. The runtime image installs `openssl` for Apple pass signing and nothing else beyond Node.

## Environment
| Variable | Required | Purpose |
|---|---|---|
| `DATABASE_URL`, `DATABASE_SSL` | yes | PostgreSQL; TLS required unless `disable` on a private network |
| `ORYN_SECRET` | yes | signs share/ticket tokens, cookies |
| `ORYN_PUBLIC_URL` | yes | absolute links in emails, QR, passes |
| `CRON_SECRET` | yes | scheduler → `/api/jobs` |
| `EMAIL_TRANSPORT=smtp`, `SMTP_URL`, `EMAIL_FROM` | for mail | own SMTP; unset ⇒ mails recorded as `skipped` and alerted |
| `NEXT_PUBLIC_BRAND_NAME` | no | product name in the UI (build-time) |
| `ORYN_SEED_DEMO` | must be `false` | fictional demo accounts (development only) |
| `ORYN_AI_PROVIDER=anthropic`, `ANTHROPIC_API_KEY` | no | AI assistance (user consent still required) |
| `ORYN_GOOGLE_WALLET_*`, `ORYN_APPLE_*` | no | wallet issuing; see WALLET_INTEGRATION.md |
| `ORYN_WALLET_PREVIEW` | no | allow the unsigned Apple preview download in production (default off) |

## Go-live gate (what must be true)
1. `npm run verify:env` and `npm run verify:http` (`scripts/verify-deployment.ts`) pass against the production environment.
2. Command Center → Health shows **no critical alerts** (failed jobs, failed mail, demo accounts, missing `CRON_SECRET`).
3. `/api/health` is green behind TLS; the scheduler's runs appear in Health within two minutes.
4. SMTP verified with a real verification email and a password reset.
5. A restore drill from `backup` into staging is logged in docs/OPERATIONS.md.
6. Real-device pass recorded in docs/MVP_QA_REPORT.md: iPhone Safari (Nearby, Present, ticket, check-in camera), Android Chrome; wallet passes only once certificates exist.

## Realtime behind a proxy
`/api/v1/stream` is SSE. Caddy in the reference stack streams it as-is; on other proxies disable response buffering for that path (`X-Accel-Buffering: no` is sent) and allow idle connections ≥ 15 minutes. Clients fall back to polling automatically if the stream cannot be held.

## Rollback
Images are tagged `oryn-app:latest`; keep the previous tag and `docker compose up -d` it. Migrations are additive (0001–0006); no destructive migration exists, so rolling the app back does not require a database rollback.
