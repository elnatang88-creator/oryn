# Wallet integration (Apple Wallet · Google Wallet)

Status 2026-10-15. Everything below is first-party code; no pass-generation SaaS. **A pass is never presented as valid unless it is signed with the company's certificates.**

## What the pass is
One pass per person. It carries only card-face data (name, headline, company, colours from the card material) and a QR that opens the person's **permanent pass link**: a non-expiring `wallet_pass` share that always resolves to the *active* card, so the pass never needs reissuing when the card changes. Stopping the link (Wallet Center or Data & privacy) makes every pass open "no longer shared". Creating and issuing are audited (`wallet.pass_issued`, `wallet.preview_built`).

## Apple Wallet
Pipeline (`lib/server/wallet-pkpass.ts`, `lib/server/services/wallet-pass.ts`, `POST /api/v1/wallet/apple`):
1. `pass.json` (generic pass, `applePassJson`) + `icon.png`, `icon@2x.png`, `logo.png`.
2. `manifest.json` = SHA-1 of every file.
3. `signature` = PKCS#7 detached signature of `manifest.json`, created with OpenSSL (`smime -sign -binary -outform DER`) using the Pass Type ID certificate + key and the Apple WWDR intermediate.
4. ZIP (STORE) → `application/vnd.apple.pkpass`.

States:
| Server configuration | What members get |
|---|---|
| All five `ORYN_APPLE_*` variables set | "Add to Apple Wallet" → signed `.pkpass`; iOS shows its own Add sheet. `walletStatus().apple.configured = true`. |
| Any missing | "Integration pending" with the exact missing pieces. In development (or `ORYN_WALLET_PREVIEW=true`) a **Developer preview (unsigned)** download exists: served as `application/zip`, named `*.preview.pkpass.zip`, description prefixed `UNSIGNED PREVIEW`, `x-oryn-pass: unsigned-preview`. It will not install on a device and the UI says so. |

To go live: Apple Developer Program (company account) → Pass Type ID (`pass.<reverse-domain>`) → certificate + private key (PEM) → Apple WWDR G4 certificate (PEM) → set `ORYN_APPLE_TEAM_ID`, `ORYN_APPLE_PASS_TYPE_ID`, `ORYN_APPLE_PASS_CERT_PEM`, `ORYN_APPLE_PASS_KEY_PEM`, `ORYN_APPLE_WWDR_PEM` (PEM line breaks may be written as `\n`). The runtime image installs `openssl` (Dockerfile). Replace the placeholder PNGs with real art (`buildPkpass(json, images)`).

Not implemented: the Apple pass web service (push updates to the pass face) — unnecessary because the pass is a key to the live card, not a copy of it.

## Google Wallet
`googleGenericObject` + `googleSaveUrl` sign an RS256 "Save to Google Wallet" JWT with the service-account key; `POST /api/v1/wallet/google` redirects to Google's own save page. Configured when `ORYN_GOOGLE_WALLET_ISSUER_ID`, `ORYN_GOOGLE_WALLET_SA_EMAIL`, `ORYN_GOOGLE_WALLET_SA_KEY_PEM` are set; otherwise "Integration pending". The Generic class must exist in the issuer account (`<issuerId>.oryn_card`).

## Wallet Center (`/wallet`)
Shows the card the pass follows, Apple/Google availability on this server, the pass link (QR, opens, issued counts, stop button), install steps and troubleshooting. `/share/[id]/wallet` is the in-flow "Add to Wallet" screen and links here.

## Tests
`tests/unit/pkpass.test.ts`: ZIP structure and determinism, manifest hashes, unsigned preview labelling, signed archive with a throwaway self-signed certificate verified by `openssl smime -verify`, service refusal without configuration, audit event. `tests/unit/wallet.test.ts`: pass data contract (no hidden fields), plan gate, Google JWT signature verification. E2E (`genesis.spec.ts`): Wallet Center states and the preview download name.

## Verified / not verified
- Verified: packaging, signing and signature verification with a self-signed chain (CI).
- **Not verified**: installation on a real iPhone/Android with company certificates (none exist yet). Do not describe wallet passes as production-ready until a device pass is recorded in docs/MVP_QA_REPORT.md.
