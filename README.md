# ORYN

**Share only what you choose. Let the other person decide what happens next.**

ORYN is an identity and relationship platform built around the **Identity Capsule**: a controlled package of selected information you activate in a real-world moment — a conference hall, a shop line, a booth — and share without asking for anything back. The recipient needs no account and no app. They choose whether to learn more, save, ask to connect, or simply close the page.

Founders: Elnatan, Orian, Shoval.

## Run it

```bash
npm install
npm run dev        # http://localhost:3000 — embedded Postgres, demo data seeded
```

Local demo accounts (fictional data, local only): `demo@oryn.local` and `admin@oryn.local`. No password is stored in the repo — set `ORYN_DEMO_PASSWORD` before first start, or use the one printed in the server console.

```bash
npm run typecheck && npm test && npm run build && npm run test:e2e
```

## Documents

**For founder approval before more UI is built:**

| | |
|---|---|
| [PRD](docs/PRD.md) | Vision, independence, the Identity Capsule, layers, Consent Ladder, plans |
| [INFORMATION_ARCHITECTURE](docs/INFORMATION_ARCHITECTURE.md) | Sitemap, navigation, screens, UX and voice rules |
| [DATA_MODEL](docs/DATA_MODEL.md) | Entities, tenant boundaries, share lifecycle |
| [SECURITY_MODEL](docs/SECURITY_MODEL.md) | Threat model, what's implemented, what's required before launch |
| [MVP_SCOPE](docs/MVP_SCOPE.md) | The 8-step vertical slice, acceptance criteria, known gaps |
| [PRODUCT_DECISIONS](docs/PRODUCT_DECISIONS.md) | Decisions built in (approve/change) and open founder decisions |

**Also:** [LEGACY_AUDIT](docs/LEGACY_AUDIT.md) · [BUILD_STATUS](docs/BUILD_STATUS.md) · [OPERATIONS](docs/OPERATIONS.md) · [ANALYTICS](docs/ANALYTICS.md) · [RESEARCH_PLAN](docs/RESEARCH_PLAN.md) · [INVENTION_RECORD](docs/INVENTION_RECORD.md)

## Branches

| Branch | Purpose |
|---|---|
| `oryn-v1` | ORYN v1 development |
| `backup/pre-oryn-v1-2026-09-30` | Untouched snapshot of the original code (commit `6ae925a`) — do not modify |
| `main` | Unchanged; nothing is merged without review |

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
legacy/              The earlier prototype, preserved unchanged (not built). See docs/LEGACY_AUDIT.md
```
