# Security

Companion to docs/SECURITY_MODEL.md (threat model) and docs/SECURITY_TEST_REPORT.md (what was exercised). Status 2026-10-15; nothing here is a production attestation — an external penetration test has not been done.

## Audit summary (Genesis V2 pass)
| Area | Finding | Action |
|---|---|---|
| Public demo sign-in hint | The sign-in page printed demo credentials when `ORYN_SEED_DEMO=true`, even in production builds | **Fixed**: shown only when `NODE_ENV !== 'production'`; E2E asserts it is absent in the production build |
| Demo accounts in production | Possible if an operator sets `ORYN_SEED_DEMO=true` | Command Center → Health raises a **critical alert** listing demo accounts; `scripts/verify-deployment.ts` fails on it |
| Camera for check-in | `Permissions-Policy: camera=()` blocked the scanner on the same origin | **Fixed**: `camera=(self)` (microphone stays off) |
| Wallet passes | Risk of presenting an unsigned archive as valid | Unsigned previews are zip-typed, name-suffixed, description-prefixed and blocked in production unless `ORYN_WALLET_PREVIEW=true`; signed issuance refuses to proceed if signing fails |
| Live stream (SSE) | Topic leakage across users/events | Session checked on connect; `checkin` topic requires check-in staff on that event; event id validated by pattern; 15-minute stream deadline |
| Secrets in Command Center | Health shows configuration | Only "set / not set" and "configured / pending" are rendered, never values |
| Audit for sensitive actions | — | Added `wallet.pass_issued` (platform, signed flag), `wallet.preview_built`; notifications read/unread carry no new PII |

## Controls in place
- **Auth**: scrypt password hashing, hashed opaque session tokens, HttpOnly/SameSite cookies, per-account lockout, email verification and password reset with hashed single-use tokens, device list and sign-out everywhere.
- **Authorization**: every service call takes the acting user; workspace permissions via `requireOrgPermission` (`leads.view/manage`, `stations.*`, `checkin.perform`, `automations.manage`…); platform admin via `requirePlatformAdmin` (404 for others).
- **CSRF**: mutations on `/api/v1` require a same-origin `Origin`; server actions are Next.js-protected.
- **Share and ticket tokens**: HMAC-signed, expiry in the token, hashes stored; revocation is immediate.
- **Rate limits**: sign-in, sign-up, verification/reset mail, Nearby, registration, lead capture.
- **Headers** (`next.config.ts`): CSP, `X-Frame-Options: DENY`, `Permissions-Policy` (camera/geolocation same-origin only), HSTS outside development, no-store on private API responses.
- **Data minimisation**: Nearby sends a coarse area cell, never coordinates; the pass carries only card-face fields; analytics props pass through an allow-list (`cleanProps`).
- **Audit trail**: `audit_events` for access, sharing, permissions, wallet, admin views, deletions; export and deletion flows covered by `deletion.test`.
- **Secrets**: none in the repository; `.env.example` lists names only; `ORYN_SECRET` required in production; PEMs read from environment.

## Open items (see KNOWN_ISSUES.md)
External penetration test; staging on company infrastructure with real TLS; legal review of Nearby location handling; SSE behaviour behind the company's reverse proxy; real-device wallet and camera passes.
