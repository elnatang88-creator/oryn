# ORYN

**Share only what you choose. Let the other person decide what happens next.**

ORYN is an identity and relationship platform built around the **Identity Capsule**: a controlled package of selected information you activate in a real-world moment — a conference hall, a shop line, a booth — and share without asking for anything back. The recipient needs no account and no app. They choose whether to learn more, save, ask to connect, or simply close the page.

Founders: Elnatan, Orian, Shoval.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 — embedded Postgres, demo data seeded
```

Demo sign-in: `demo@oryn.local` / `oryn-demo-2026` · Admin: `admin@oryn.local` / `oryn-admin-2026` (local only).

```bash
npm run typecheck && npm test && npm run build && npm run test:e2e
```

## Documents

| | |
|---|---|
| [01 Product requirements](docs/01-product-requirements.md) | Vision, Identity Capsule, layers, Consent Ladder, scope, plans |
| [02 Information architecture](docs/02-information-architecture.md) | Sitemap, navigation, screens, UX and voice rules |
| [03 Data model](docs/03-data-model.md) | Entities, tenant boundaries, share lifecycle |
| [04 Security & privacy model](docs/04-security-model.md) | Threat model, what's implemented, what's required before launch |
| [05 Architecture, setup & deployment](docs/05-operations.md) | Local, staging, production, jobs, monitoring |
| [06 Analytics](docs/06-analytics.md) | Value metrics and event definitions |
| [07 Research plan](docs/07-research-plan.md) | Interviews, test questions, safety research |
| [08 Invention record](docs/08-invention-record.md) | Dated record of novel mechanisms for counsel |
| [09 Founder decisions](docs/09-founder-decisions.md) | Open decisions with recommendations |
| [10 Build status](docs/10-status.md) | Complete / simulated / needs credentials / needs real devices |

## Code map

```
app/                 Routes. (app)/ = signed-in workspace; c/ and q/ = recipient surfaces; api/v1 = JSON API
app/actions/         Server actions (thin: auth check → service call)
components/          UI (CapsuleView is the recipient-facing capsule)
lib/capsule-model.ts Shared vocabulary: modes, field kinds, layers, channels, recipient view type
lib/server/          db, tokens, permissions, plans, rate limits, audit, analytics, jobs
lib/server/services/ All business rules
db/migrations/       PostgreSQL schema
tests/unit/          Service tests on a real in-memory Postgres
tests/e2e/           Playwright: the founder demo on phone + desktop, slow network, no-JS
legacy/              The earlier business-card prototype, preserved unchanged for reference (not built)
```
