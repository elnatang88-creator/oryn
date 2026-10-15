# Known issues and limitations

Updated 2026-10-15. Nothing here is hidden behind a working-looking button; each limit shows an honest state in the UI.

| # | Issue | Impact | Status |
|---|---|---|---|
| K1 | Visual identity uses the founders' approved navy + electric blue + card materials, not the §4 palette (#08090B / #318CFF …). | Cosmetic; tokens live in `tailwind.config.ts` and can be re-pointed in one place. | Awaiting founders |
| K2 | Email is only delivered when `EMAIL_TRANSPORT=smtp` + `SMTP_URL` are set. Otherwise mails are logged (dev) or recorded as `skipped` (production) and the UI says so. | Verification/reset/tickets reach nobody until SMTP is configured. | Configuration |
| K3 | Apple Wallet: no pass signing/packaging service; Google Wallet: no issuer account. UI shows "Integration pending". | No real wallet passes yet. | Blocked externally |
| K4 | Paid tickets and plan billing are simulated. | Free events and plan switching only. | Blocked on a payment provider |
| K5 | AI assistance: only the fallback (template) path is covered by tests; the Anthropic path runs only when `ORYN_AI_PROVIDER=anthropic` + key + user consent. | Untested in CI. | Needs a key in staging |
| K6 | Camera scanning (BarcodeDetector / jsQR) is not exercised in CI (no camera). Manual search check-in is tested; the scan API path is tested. | Door scanning needs a real-phone pass. | Needs device QA |
| K7 | Nearby "proximity" = coarse area cell or shared event, polled every 2 s. No BLE/UWB, no push. | Fine for demos; not instant when the app is backgrounded. | Integration (SSE/Web Push) |
| K8 | Push notifications (Web Push) not implemented; in-app + email only. | Reminders arrive when the app is opened or by email. | Not started |
| K9 | No duplicate-contact detection or merge. | Possible double entries in People/leads. | Not started |
| K10 | Photo/logo upload is a URL field; no file-upload pipeline (validation, storage). | Cards use initials/monogram unless a URL is given. | Not started |
| K11 | UI strings are English; Hebrew user content renders correctly (`dir="auto"`), but there is no translated UI or full RTL layout. | Hebrew-speaking users see English chrome. | Not started |
| K12 | Event schedules/sessions, exhibitor booth catalogs, meeting requests and interest matching are not implemented. | Events are registration + check-in + stations. | Not started |
| K13 | Legal review of Nearby location handling and member-view tracking is still open (docs/PRODUCT_DECISIONS.md). | Launch blocker for EU/IL. | Awaiting counsel |
| K14 | Staging on company infrastructure, a real-iPhone Safari pass and an external penetration test have not been done. | Not production-ready. | Awaiting infrastructure |
| K15 | `/api/v1/events/:id/registrations` returns up to 500 rows without paging. | Large events need paging. | Minor |
