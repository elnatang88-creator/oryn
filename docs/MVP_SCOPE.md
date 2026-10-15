# ORYN — MVP scope: the first vertical slice

| | |
|---|---|
| Status | **Awaiting founder approval** |
| Date | 2026-09-30 |
| Branch | `oryn-v1` |
| Related | [PRD](PRD.md) · [Information architecture](INFORMATION_ARCHITECTURE.md) · [Data model](DATA_MODEL.md) · [Security model](SECURITY_MODEL.md) · [Product decisions](PRODUCT_DECISIONS.md) |

## The moment we are proving

> A person opens their identity with one tap, shares only what they chose, and the other person decides what to do with it.

The MVP is not a large system. It is **one living, polished path** through that moment, from the sender's phone to the recipient's phone and back to the sender's workspace.

## The slice — 8 steps

| # | Step | Screen (route) | Server logic | Proven by | Status |
|---|---|---|---|---|---|
| 1 | Create an Identity Capsule | Mode picker → editor (`/capsules/new`) | `createCapsule()` | unit `core-flow`, E2E founder demo | Built |
| 2 | Choose visible fields | Per-field control: *Shown first / On "Learn more" / Not shared*, with a live preview | field `layer` + `project()` | unit (hidden fields and private note never leave the server), E2E | Built |
| 3 | Create a secure Shared Session | **Share** (thumb zone) → `/share/quick` → live QR, link, send, stop | `startShare()` / `quickShare()`; signed, expiring, revocable token | unit (tamper, expiry, one-time, revoke), E2E (tap → QR ≈ 250 ms) | Built |
| 4 | Recipient opens it with no forced sign-up | `/c/[token]` (Instant View), `/c/[token]/more` | `resolveShare()` | E2E on phone and desktop, a 400 kbps network, and with no JavaScript | Built |
| 5 | Save the connection | **Recipient side:** Save (vCard) or ask to Connect. **Sender side:** accept (Connect / Not now). The connection is created. | `requestConnection()`, `respondToRequest()`, `keepCapsule()` | unit + E2E | Built |
| 6 | Add a private note | Contact page (`/connections/[id]`), marked "Only you" | `addNote()` | unit + E2E | Built |
| 7 | Create a follow-up | Same page, "What to do" + date | `addFollowUp()` | unit + E2E | Built |
| 8 | See it in the ORYN Workspace | Today (`/today`): Waiting for you · What's next · Who you met · What you're sharing | `todaySummary()` | E2E | Built |

## Requirements for every action

| Requirement | How the slice meets it today | Gap to close before calling the MVP done |
|---|---|---|
| **Mobile first** | Designed at 390 px first; bottom tab bar; recipient pages built for phones | Real-device pass: iPhone Safari and Android Chrome (see BUILD_STATUS) |
| **Simple with one hand** | Share button in the thumb zone; touch targets ≥ 48 px; primary actions low on screen; sticky save in the editor | The capsule editor is a long form on phones. **Proposed:** a 3-field "Quick capsule" (name, one line, one contact) with the full editor as "More options". |
| **Clear without explanation** | One primary action per screen; plain language; "Only you" / "Visible to people you share with" labels; recipient header says what they're viewing | Usability test with 5 people from the research plan, with no instructions |
| **Secure by default** | New shares hide phone numbers by template; signed tokens; no recipient tracking; server-side authorization everywhere; security headers; rate limits | Two-step sign-in and email verification (need an email provider) |
| **Can be undone** | Stop a share instantly; edit applies live; follow-up done/undo; archive a capsule; sign out other sessions | — |
| **Can be deleted** | Delete notes; delete the account (7-day grace, then erased); retention setting | **Missing:** hard-delete of a single connection (today "Remove" archives it), delete a follow-up, delete a capsule (today "archive"), sender deleting a request. These are small server + UI additions. |
| **Full ORYN ownership** | Company-owned repo; portable Postgres; own auth and sessions; no third-party SDKs or trackers; secrets only in environment | Move hosting, database and domain to company accounts (see PRODUCT_DECISIONS B2) |

## In scope for the MVP

- The 8 steps above, polished on phones.
- The recipient's choices: Learn more, Save, Connect, close silently, report.
- Stop sharing, expiry, "opens once".
- Data & privacy center (export, delete account) and security settings (sessions).
- Sign up / sign in.

## Out of scope for the MVP (already built — proposed to hide behind a flag, code kept)

Events, event participants, stations and QR destinations, teams/workspaces, insights, NFC tag writing, and the platform admin console (kept for the founders only). Simulated plan switching is also out: the MVP runs with a single plan.

Hiding them is proposed in [PRODUCT_DECISIONS A14](PRODUCT_DECISIONS.md). Nothing will be hidden or removed until you approve it.

## Explicitly not in the MVP

Native apps, Wallet passes, payments, email/push notifications, SSO/SCIM, photo uploads, "double press" claims, and any public statistics or testimonials (there are no users yet — nothing invented).

## Acceptance criteria (definition of done)

1. On a real iPhone and a real Android phone, a first-time user goes from sign-up to a shareable QR in **under 60 seconds**. A returning user goes from tap to QR in **under 3 seconds**.
2. A recipient on a different phone, without an account, sees **only** the chosen fields. Hidden fields and the private note never reach their device (automated test + manual check of the page source).
3. After "Stop sharing", every recipient route refuses within one request.
4. The sender can accept a request, add a note, set a follow-up and find the person on Today, one-handed.
5. Every item the user creates in the slice can be deleted by them.
6. `npm run typecheck`, `npm run lint`, `npm test` and `npm run test:e2e` all pass. No secrets or real personal data are in git.

## Work after approval (in this order)

1. Close the deletion gaps (connection, follow-up, capsule, request).
2. The "Quick capsule" flow for one-handed creation.
3. Apply the A14 flag, if approved.
4. A real-device pass and a 5-person hallway test. Fix what they reveal.
