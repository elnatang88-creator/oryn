# Share · Nearby · Present · Wallet

Founders' decision (2026-09-30): phone-to-phone = **#1 ORYN-to-ORYN Nearby** first, with **#3 Apple / Google Wallet** as part of the same identity. No physical NFC cards and no native Android NFC now. Nearby is **not** NFC and is never called NFC.

Product model: **Create → Wallet → Nearby → Present → Connect → People.** The card made in Card Studio is the one object behind every step.

## How it works

| Step | What the person does | What's built |
|---|---|---|
| Create | Designs a card in Card Studio (material, foil, finish, lettering, layout, **back of card: code or ORYN mark only**) | `capsules.design` (validated, fixed tables) |
| Wallet (Share) | Taps the centre button → their real card rises onto the screen | `/share/[id]`: card first; Nearby + Present primary; Add to Wallet; Share another way; small QR icon |
| Nearby | Opts in, sees ORYN members around them | `/share/nearby`, `nearby_presence`, `lib/server/services/nearby.ts` |
| Present | Card fills the screen; tap to flip | `/share/[id]/present` (Screen Wake Lock where supported) |
| Connect | A taps B → B gets "A would like to connect" → Accept | Existing `connection_requests` (kind `member`) → `respondToRequest` |
| People | Both land in People with what the other card allows | Existing `connections` (source `nearby`) |

**Single source of truth:** `cardFor()` (`lib/server/services/owner-card.ts`) turns a capsule into card design + identity. Share, Present, QR mode, the Wallet preview, Nearby previews and the public recipient page all render the same `CardFace` / back from it. Edit in Card Studio and every surface updates (E2E: *Card Studio is the source of truth*).

## Classification

### Working now (end to end, tested)
- Card-first Share screen, the new centre icon (two cards passing; not a QR, wallet, payment card or contactless waves), tap-to-flip, the designed back.
- Present Card (full screen, flip, send, QR); keeps the screen on where the Screen Wake Lock API exists.
- QR mode (large only when chosen; QR decoded from pixels in the tests).
- Share another way: system share sheet (on iPhone this is where AirDrop appears), copy, Messages (`sms:`), WhatsApp (`wa.me`), Email (`mailto:`), QR.
- Nearby between **two real accounts**: opt-in visibility (Everyone nearby / My connections / Event only / Invisible), coarse area cells computed on the phone (the server never gets coordinates), same-event matching, the incoming sheet on Share and Nearby, Accept / Not now (silent), mutual taps connect at once, both sides in People with only permitted fields, Today shows "ORYN member · Nearby" requests and notifications.
- Non-ORYN recipients: public card page with the card as hero, only permitted fields, Save contact (vCard with only permitted fields), invite to make their own card; no app needed.
- Wallet data contract: Apple `pass.json` (generic style: identity credential), Google Wallet Generic object, and the **Google "Save to Wallet" RS256 signing** (verified in tests with a generated key). The pass link is one non-expiring, revocable share.
- Privacy: export includes Nearby setting and presence; deletion removes presence, member requests and Nearby rate-limit keys (deletion scan test); visibility changes are audited.

### Demo / simulated
- **Demo members** Daniel Cohen, Sarah Levi, Eli Ward: fictional, on `@oryn.local`, unusable passwords, in a presence cell (`demo`) that no phone can produce, **shown only to demo accounts**, labelled "demo". They **auto-accept after ~2 s** (`simulateDemoReplies`), which never runs for real users.
- **Near-realtime is polling**: clients poll every 2 s (every 1 s for a minute after sending a request); presence heartbeats every 30 s with a 2-minute expiry. Measured in E2E: A's tap reaches B in ~0.9–1.9 s; A sees "connected" ~2.4–3.5 s after tapping (B's tap included).

### Integration required (for production)
| Item | What's needed |
|---|---|
| Apple Wallet | Company Apple Developer Program membership (~$99/yr), a Pass Type ID + certificate, Apple WWDR certificate, a **pass signing + .pkpass packaging service** (PKCS#7 detached signature, zip), and the pass web service for updates. Until then the UI shows "Integration pending" with the exact list. |
| Google Wallet | Google Pay & Wallet Console issuer account, a service account with Wallet API access, the Generic class created. Set `ORYN_GOOGLE_WALLET_ISSUER_ID`, `ORYN_GOOGLE_WALLET_SA_EMAIL`, `ORYN_GOOGLE_WALLET_SA_KEY_PEM`; the button then works. |
| Realtime | Replace polling with server push: SSE or WebSocket fed by Postgres `LISTEN/NOTIFY` (self-hosted, no vendor). The service boundary (`nearbyState`, `requestNearby`, `respondToRequest`) stays the same. |
| Push notifications | Web Push (VAPID keys, service worker, subscription storage) for "X would like to connect" when ORYN is closed. Today only **in-app** notifications exist (Today list + sheets). |
| Better proximity | Browser location is coarse indoors. Real "very close" needs native apps: BLE advertising/scanning, UWB (iPhone), or an App Clip. Not built. |
| NFC | Physical NFC cards, Core NFC, Android HCE: future. The only NFC in the code is the pre-existing, flag-gated "write this link to an NFC tag" on Android Chrome. |

### Launch blockers (for real users)
1. **Legal review of Nearby location handling** (coarse cell, 2-minute retention) and of member view tracking — privacy policy text and lawful basis per region (EU/IL). Marked open in PRODUCT_DECISIONS.
2. **Staging on company infrastructure** with the Docker stack, real TLS domain, backups — not yet verified outside this environment.
3. **Real-device pass on iPhone Safari (WebKit)** for location permission, safe areas, share sheet/AirDrop, wake lock. Tests here run Chromium at iPhone size.
4. **Abuse controls at scale** for Nearby: block/report a member, per-venue limits. Rate limits exist (60 requests/h, 3 per pair/day), blocking does not yet.

Wallet and realtime push are **not** launch blockers for a first release: without them the product still works end to end (Present, links, Nearby with polling).

## Privacy and security rules (enforced on the server)
- Nearby is **off by default**; you must be visible to see others.
- A person's rule is checked on every query: *everyone* / *only my connections* / *only the same live event*.
- Presence rows expire after 2 minutes and are deleted on "Invisible", on leaving the page, and on account deletion.
- Clients get a random per-activation **handle**, never user ids. A request needs a handle **currently visible to the requester**, so ids can't be enumerated and a stale handle stops working when someone goes invisible.
- Nearby previews show only the card face (name, headline, company from the first layer, design). Other people's backs render as the ORYN mark — never their QR link.
- On Accept, each side gets exactly what the other's share projection allows (hidden fields and private notes never leave — tested).
- `Permissions-Policy` now allows `geolocation=(self)` (was `()`); camera and microphone stay blocked.
