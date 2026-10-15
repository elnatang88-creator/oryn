# Implementation plan — platform directive (2026-10-15)

Status legend: **NS** not started · **IP** in progress · **IM** implemented · **T** tested (evidence in FEATURE_STATUS.md) · **B** blocked.

Each slice connects UI → server action/API → service (authorization) → database → tests.

| # | Slice | Scope | Status |
|---|---|---|---|
| 0 | Repository inspection, plan, decisions | DECISIONS.md E1–E10; keep stack; no rename | IM |
| 1 | Schema slice (migration 0006) | auth tokens, email outbox, event registration/tickets/check-ins, leads/notes/tasks, automations/runs, station modes + interactions, usernames, notification prefs | T |
| 2 | Email transport + verification + reset | outbox, SMTP/log transports, `/verify`, `/forgot`, `/reset`, in-app "verify" banner, prefs | T |
| 3 | Events: public page + registration + tickets | `/e/[slug]`, `/register/[slug]`, capacity + waitlist (atomic), `/ticket/[token]` with QR, confirmation email, cancel | T |
| 4 | Check-in | staff auth, camera scan (BarcodeDetector) + manual search, atomic check-in, stats, history | T |
| 5 | Stations v2 | modes, remote destination, `/s/[code]` alias, validated redirects, scan analytics, lead form | T |
| 6 | CRM | leads pipeline (custom stages), notes, tasks, assignment, filters/search, CSV export, consent | T |
| 7 | Automation engine | triggers → actions, idempotent runs, retries via jobs, execution history UI | T |
| 8 | Global search (⌘K) | contacts, people, events, stations, leads, workspaces — authorized only | T |
| 9 | AI boundary | provider interface, consent, bio assistant, follow-up draft, lead summary, fallback | T (fallback path); provider path IM, untested in CI |
| 10 | Command Center | users, businesses, events, stations, subscriptions, wallet status, health, audit, flags | T |
| 11 | Public identity `/u/[username]` | permanent public link that follows the active card | T |
| 12 | Docs + env template + quality gate | FEATURE_STATUS, KNOWN_ISSUES, .env.example, README, full test run | IM — 70/70 unit (2 DBs), 31/31 E2E, build clean |

Priority follows the directive's order; 1–7 are vertical slices with tests before moving on.

## Next steps (recoverable from here)
1. Configure SMTP on staging (`EMAIL_TRANSPORT=smtp`, `SMTP_URL`) and run the account flows for real.
2. Real-phone pass: camera check-in (BarcodeDetector/jsQR), station taps via NFC tag, Nearby on iPhone Safari.
3. Web Push + SSE (self-hosted) for requests and reminders — see docs/NEARBY_AND_WALLET.md.
4. Payment provider decision → paid tickets and billing; Apple/Google wallet accounts → pass issuing.
5. Hebrew UI strings + RTL layout pass; file upload pipeline for photos/logos.
