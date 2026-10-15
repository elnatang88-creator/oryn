# ORYN QA report — premium platform transformation (2026-10-15)

Supersedes nothing; complements docs/MVP_QA_REPORT.md (history) and FEATURE_STATUS.md (evidence table). Numbers below are from the gate run recorded at the end of this file.

## What was verified in this pass
- Collections A–G render, persist, reach the public page and the wallet colour map (`card-design.test`, `genesis.spec` picks *Signature Gold*).
- Duplicate card → independent copy; make active from the list (`card-design.test`, `genesis.spec` desktop + mobile).
- Nearby block: both directions hidden, pending requests declined, new requests refused, no notification to the blocked person, unblock restores (`nearby.test`). Report: stored, reason validated, 500-char cap, audit event, also blocks (`nearby.test`); controls present on the person sheet (`nearby.spec`).
- Account deletion and export cover `user_blocks` and `abuse_reports` (`deletion.test` scan).
- Command Center gained a *Reports* module and an "open reports" alert (rendered; admin-only through the existing 404 guard, `platform.spec`).
- Mobile: screenshots regenerated for all genesis screens; header spacing tightened; no horizontal overflow (`overflow-x: clip`).

## What was not verified
- Real devices (iPhone Safari, Android Chrome): all E2E runs are Chromium with device emulation.
- Email delivery (no SMTP in CI), wallet installation (no certificates), SSE behind a production proxy, external penetration test.

## Gate run
Gate 2026-10-15 (commit after `fad973f`): typecheck clean · lint clean · `npm test` 80/80 on PGlite and 80/80 on PostgreSQL 16 · production build clean · `npm run test:e2e` 35/35 after two spec fixes (a preset id renamed by the collections, and the loading-skeleton revert below).

Defects found and fixed during this pass: route-level `loading.tsx` broke every post-action refresh (15 E2E failures → reverted, ORYN_DECISIONS T6); `preset-navy`/`preset-marble` ids replaced by collection ids in two specs.
