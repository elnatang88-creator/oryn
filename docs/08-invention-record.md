# ORYN — Invention and Design Record

> **Read this first.** This document is an internal engineering and design record. It is **not a patent claim, not a patent application, and not a legal opinion**. It makes **no assertion about what competitors do or do not do**, and it does not claim any mechanism is new to the world. Its purpose is to capture, with dates, what the ORYN founders designed and built, so the founders can later discuss intellectual property with **qualified patent counsel**. Counsel should decide what, if anything, is protectable. Do not publish or share this document outside the company before speaking with counsel; public disclosure can affect patent rights in some jurisdictions.

| | |
|---|---|
| Record date | **2026-09-30** |
| Authors | Founders **Elnatan, Orian, Shoval** (with engineering assistance) |
| Product | ORYN v1 (web application, Next.js) |
| Related | [01 PRD](01-product-requirements.md) · [09 Founder decisions](09-founder-decisions.md) |

**Why dates matter.** Priority and inventorship questions often depend on when an idea was conceived and first reduced to practice, and by whom. Keep this file under version control, append entries to the log (§8) with dates and names, and do not rewrite past entries — add corrections as new entries.

**Code paths.** Paths below reflect the v1 layout as of the record date. The code is being built in parallel; confirm each path against the commit hash recorded in the log.

---

## Summary of mechanisms

| ID | Mechanism | Primary code location |
|---|---|---|
| A | Identity Capsule as a policy-bound package | `lib/server/services/capsules.ts` |
| B | Share Session: signed expiring token + live server-side state | `lib/server/services/sharing.ts`, `lib/server/tokens.ts` |
| C | Consent Ladder | `lib/server/services/sharing.ts` |
| D | Activation trigger abstraction | `lib/capsule-model.ts` (CHANNELS), `app/(app)/share/quick/route.ts`, `components/ShareLive.tsx`, `lib/server/services/sharing.ts` (`quickShare`) |
| E | Station / QR destination indirection | `lib/server/services/stations.ts` |
| F | Event-scoped sharing with organizer field rules | `lib/server/services/events.ts` |

---

## A. Identity Capsule as a policy-bound package

**Problem.** A profile is one representation of a person shown the same way to everyone. People need different, limited representations for different contexts, with rules about depth, time, and what the recipient may do.

**Mechanism.** A capsule is a stored object separate from the user's underlying identity data. It contains:
- an **identity mode** (Professional, Business, Event, Personal, Social, Creator, Hiring, Custom) that sets defaults;
- a **per-field layer assignment**: each field is `instant`, `expanded`, or `hidden`;
- a **recipient interaction level** (view; view + save; view + save + connect);
- visibility duration, optional expiration, optional one-time access, optional request-to-connect;
- owner-only private notes, which are never part of any recipient payload;
- an audit trail of changes.

The server renders recipient views by filtering the capsule's fields through the layer the recipient has reached and the session policy (B). Hidden fields are never serialized to the recipient.

**Alternatives considered.**
- *Single profile with per-field public/private toggle* — rejected: no middle layer, no per-context variation.
- *Multiple separate profiles (copies)* — rejected: copies drift; edits must be repeated; no shared policy model.
- *Client-side hiding of fields* — rejected: hidden data would still reach the browser.

**Evidence to keep.** First commit introducing the capsule schema and layer enum; screenshots of the Visibility & layers screen with live preview; dated design notes/sketches of the three-layer model.

## B. Share Session: signed expiring token + live server-side state

**Problem.** A shared link is usually either permanent and uncontrolled, or requires the recipient to sign in. The sender needs to change or withdraw what was shared at any moment, and to limit who can open it, without the recipient having an account.

**Mechanism.**
- Each share creates a **share session** record with policy: scope (public, limited, expiring, one-time, event-scoped, organization-scoped, recipient-specific), expiry, optional **max views**, and revocation state.
- The recipient URL (`/c/[token]`) carries a **signed token** referencing the session and its expiry. The signature prevents guessing or tampering; the embedded expiry allows early rejection.
- On every request, the server also checks **live session state**: revoked? expired? max views reached? scope satisfied (event not ended, intended recipient)? Owner deleted or capsule archived?
- **One-time claim:** every recipient browser carries a random, identity-free first-party claim cookie. A one-time session is claimed atomically by storing an HMAC of (session, claim cookie) on the **first deliberate tap** ("Open it"). A passive page load, link-preview bot or prefetch never reveals or consumes it. Afterwards only that browser can reopen it; others see "This capsule was already opened."
- The recipient always sees the **live capsule filtered by the session policy**, not a snapshot. Edits to the capsule and revocation of the session take effect on the next request.

**Alternatives considered.**
- *Static snapshot at share time* — rejected: edits and narrowing wouldn't apply; stale data persists.
- *Stateless token only (e.g. self-contained signed payload)* — rejected: cannot be revoked before expiry.
- *Opaque random ID only, no signature* — workable, but signing allows cheap rejection of malformed/expired links before a database read.
- *One-time via IP or fingerprint* — rejected: conflicts with the no-tracking principle.

**Evidence to keep.** Commits for `lib/server/tokens.ts` (signing/verification) and session checks in `sharing.ts`; test cases showing revoke → next request refused; screen recordings of edit-then-refresh on the recipient view.

## C. The Consent Ladder

**Problem.** Sharing tools often identify or track recipients by default. Recipients can't look without being "captured," which discourages opening and makes the experience feel invasive.

**Mechanism.** Recipient actions are ordered by commitment, and identity is revealed only at the step the recipient chooses:
1. Open → anonymous `share_viewed` count.
2. Learn more → anonymous `share_expanded` count.
3. Save to phone (vCard) → anonymous `share_saved_vcard` count.
4. Connection request → recipient types their name and one way to reach them; an identifiable record is created **because they provided it**.
5. Keep in ORYN → recipient signs in; a private copy is created in the *recipient's* workspace. The sender still only sees an anonymous "saved" count.

The sender may accept or decline; **decline is silent** to the recipient. The recipient may choose "Not interested" (silent to the sender) or report abuse. No IP, fingerprint, or location is stored for steps 1–3.

**Alternatives considered.**
- *Show senders who viewed* — rejected: conflicts with recipient control.
- *Require sign-in to view* — rejected: blocks value, forces accounts.
- *Notify recipients of declines* — rejected: creates social pressure and potential conflict.

**Evidence to keep.** Analytics event schema showing recipient events without identity props; screenshots of sender insights ("Opened 3 times"); commit introducing silent decline.

## D. Activation trigger abstraction

**Problem.** People share in different physical situations. Building a separate flow per method (QR, NFC, wallet, shortcut) leads to inconsistent policy and duplicated logic.

**Mechanism.** A single share session model is exposed through interchangeable **channels**: `link`, `qr`, `web_share`, `nfc_tag`, `wallet_pass`, `shortcut`, `station`. Each channel is only a way of delivering or resolving the same session URL; policy (B) and consent (C) are identical regardless of channel. The channel is recorded as a property of `share_started`.
- `nfc_tag`: Web NFC on supported Android browsers writes the URL to a physical tag (not peer-to-peer).
- `wallet_pass`: simulated in v1; real passes require issuer certificates.
- `shortcut`: a PWA home-screen shortcut opens `/share/quick`, which reuses the live general link of the default capsule from the last 12 hours or starts one, then shows the QR.
- Hardware "double-press" activation is **not** claimed as an OS feature; per-platform routes (e.g. iOS Back Tap → Shortcut → `/share/quick`) are to be validated.

**Alternatives considered.** Channel-specific share objects (rejected: policy drift); native-only NFC P2P (not available on the web; deferred).

**Evidence to keep.** Channel definitions in `lib/capsule-model.ts` and the quick-share route; commits adding each channel; dated device test notes (browser, OS version, result).

## E. Station / QR destination indirection

**Problem.** At venues and booths, printed QR codes are fixed, but the person or capsule behind them changes (shifts, speakers, days). Reprinting is slow and costly.

**Mechanism.** A **Station** has a permanent short code resolved at `/q/[code]`. The station stores a **reassignable destination** (a capsule, with its policy). Behind the code sits one long-lived share session. On each scan the server resolves code → destination → session → the station's *current* capsule, then redirects to the recipient view. Reassigning the station re-points that session. Changing the assignment changes what the next scan shows, while the printed code stays the same. A station can be paused, which returns the neutral unavailable state.

**Alternatives considered.** Printing each person's own share link (rejected: reprints on every change); dynamic QR from a generic URL shortener (rejected: no policy, no consent model, no org controls).

**Evidence to keep.** Station schema and resolver commit; photo of a printed station code with dated reassignment log.

## F. Event-scoped sharing with organizer rules

**Problem.** Organizers want attendees to exchange details, but within rules (e.g. no personal phone numbers at a professional event), and only for the event's duration.

**Mechanism.** An event holds **sharing rules** (v1: whether phone numbers may be shown; the model also supports an allowed-field-kinds list). When a participant shares in an event context, the visible field set is the **intersection** of the participant's own layer choices and the event rules, computed at view time — so a rule change applies to shares already open. Ending the event closes every event-scoped share. Organizers see aggregate counts only.

**Alternatives considered.** Organizer-authored attendee profiles (rejected: removes individual control); post-hoc moderation only (rejected: exposure happens before review).

**Evidence to keep.** `project()` in `lib/server/services/sharing.ts` (rule intersection), `lib/server/services/events.ts`, and the test "event rules apply to live shares" in `tests/unit/security.test.ts`; screenshots of event rule setup and resulting recipient view.

---

## 7. General evidence practices

- Keep all work in company-owned repositories (see [09-founder-decisions.md](09-founder-decisions.md)).
- Record commit hashes next to each mechanism in the log when first implemented.
- Keep dated screenshots in a company-owned drive folder; note filename in the log.
- Keep dated notes of who contributed which idea; inventorship is a legal question for counsel.
- Do not delete or rewrite earlier log entries.

## 8. Log

Append new entries at the bottom. Use ISO dates.

| Date | Author(s) | Mechanism | Entry | Evidence (commit / file / screenshot) |
|---|---|---|---|---|
| 2026-09-30 | Elnatan, Orian, Shoval | A–F | Initial record of v1 mechanisms as designed and being implemented. | This file; commit hash: _to be filled_ |
| | | | | |
