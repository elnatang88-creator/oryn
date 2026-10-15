# Known issues and limitations

Updated 2026-10-15 (Genesis V2). Nothing here is hidden behind a working-looking button; each limit shows an honest state in the UI.

| # | Issue | Impact | Status |
|---|---|---|---|
| K1 | ~~Palette~~ Resolved: tokens now follow the ORIAN palette (Obsidian #08090D, Midnight Navy #07132B, Graphite #151A24, Premium White #F7F9FC, Silver #B9C3D3, Electric Blue #246BFD). Card materials/foils unchanged. | — | Resolved 2026-10-15 |
| K2 | Email is only delivered when `EMAIL_TRANSPORT=smtp` + `SMTP_URL` are set. Otherwise mails are logged (dev) or recorded as `skipped` (production) and the UI says so. | Verification/reset/tickets reach nobody until SMTP is configured. | Configuration |
| K3 | Wallet: packaging + signing are built and tested with a self-signed chain, but the company has no Apple Pass Type ID certificate or Google issuer account, so members see "Integration pending" and no pass has been installed on a real device. | No real wallet passes yet; unsigned previews are development-only. | Blocked externally (certificates) |
| K4 | Paid tickets and plan billing are simulated. | Free events and plan switching only. | Blocked on a payment provider |
| K5 | AI assistance: only the fallback (template) path is covered by tests; the Anthropic path runs only when `ORYN_AI_PROVIDER=anthropic` + key + user consent. | Untested in CI. | Needs a key in staging |
| K6 | Camera scanning (BarcodeDetector / jsQR) is not exercised in CI (no camera). Manual search check-in is tested; the scan API path is tested. | Door scanning needs a real-phone pass. | Needs device QA |
| K7 | Nearby "proximity" = coarse area cell or shared event. Updates arrive over SSE (`/api/v1/stream`) with a 15 s safety poll; without a stream the 2 s poll remains. No BLE/UWB, no push when the app is closed. | Instant while the screen is open; nothing when backgrounded. | SSE done; Web Push not started |
| K8 | Push notifications (Web Push) not implemented; in-app + email only. | Reminders arrive when the app is opened or by email. | Not started |
| K9 | No duplicate-contact detection or merge. | Possible double entries in People/leads. | Not started |
| K10 | Photo/logo upload is a URL field; no file-upload pipeline (validation, storage). | Cards use initials/monogram unless a URL is given. | Not started |
| K11 | UI strings are English; Hebrew user content renders correctly (`dir="auto"`), but there is no translated UI or full RTL layout. | Hebrew-speaking users see English chrome. | Not started |
| K12 | Event schedules/sessions, exhibitor booth catalogs, meeting requests and interest matching are not implemented. | Events are registration + check-in + stations. | Not started |
| K13 | Legal review of Nearby location handling and member-view tracking is still open (docs/PRODUCT_DECISIONS.md). | Launch blocker for EU/IL. | Awaiting counsel |
| K14 | Staging on company infrastructure, a real-iPhone Safari pass and an external penetration test have not been done. | Not production-ready. | Awaiting infrastructure |
| K15 | `/api/v1/events/:id/registrations` returns up to 500 rows without paging. | Large events need paging. | Minor |
| K16 | SSE has been verified only in Playwright against `next start` and in the Caddy reference stack config, not behind the company's eventual proxy/CDN. | A buffering proxy would silently degrade to polling (by design) and nobody would notice without the Health page. | Needs staging |
| K17 | Apple pass images are 1×1 placeholders until brand art is supplied (`buildPkpass(json, images)`). | Passes would show no logo. | Needs assets |
| K18 | The 5-step onboarding indicator counts "Appearance" as step 4 inside the card editor (no separate screen). | Cosmetic; the progress bar jumps 3 → 5 after creating the card. | Minor |
| K19 | Operational alerts are computed on page load of Command Center → Health; there is no outbound alerting (email/webhook) yet. | Someone must open the page. | Not started |

