# ORYN — Product Requirements (v1)

| | |
|---|---|
| Owners | Elnatan, Orian, Shoval (founders) |
| Status | Draft for founder review |
| Last updated | 2026-09-30 |
| Related | [02 Information architecture](02-information-architecture.md) · [06 Analytics](06-analytics.md) · [07 Research plan](07-research-plan.md) · [08 Invention record](08-invention-record.md) · [09 Founder decisions](09-founder-decisions.md) |

---

## 1. Vision

> A person can activate their ORYN identity instantly, share only the information they choose, and allow the other person to decide what happens next.

ORYN is **not another digital business card**. A business card is a static object: one version of you, handed to everyone, forever. ORYN treats sharing as a short, controlled moment between two people. The sender decides what is visible and for how long. The recipient decides whether anything happens after that.

## 2. Problem

People meet in places where exchanging information is awkward, slow, or all-or-nothing:

- **Too much or too little.** A paper card or a profile link shows everything or nothing. There is no middle step between "here is my name" and "here is my whole professional history."
- **No control after the handoff.** Once shared, information cannot be narrowed, updated for that person, or taken back.
- **The moment is short.** At a crowded event or a busy counter, there are seconds, not minutes. Typing a phone number or finding a profile loses the moment.
- **One-sided pressure.** Many tools are built to capture leads. The recipient is tracked, added to lists, or pushed to install an app before seeing anything useful.
- **Weaknesses common to digital business card apps.** A single static profile per person, recipient tracking as a selling point, app-install walls, and few tools for what happens *after* the first exchange (notes, follow-ups, mutual consent).

## 3. Target users and core scenarios

### Primary users
- Professionals and salespeople who meet many people in short windows.
- Event organizers and exhibitors.
- Recruiters and candidates.
- Creators who want to share selectively.
- Business owners running a team, a venue, or a recurring event.
- Anyone who wants to start a personal conversation without putting the other person on the spot.

### Core scenarios

**A. Conference with 1,000 people.** Maya has ten seconds between sessions. She opens ORYN, taps Share, and her Event capsule is on screen as a QR. The other person scans it and sees her name, role, and company without an account. Tonight, Maya sees "Opened 14 times, 5 connection requests" and adds a follow-up to three of them. The capsule expires when the event ends.

**B. Busy store where you can't interrupt.** Daniel notices someone at a checkout line but doesn't want to interrupt or put them on the spot. He shows a one-time Personal capsule with just a first name and a short note. If the recipient scans it, they can read it privately, later, and choose to connect, ignore silently, or report. Daniel learns only that it was opened, unless the recipient chooses to respond. (This scenario carries safety risk; see §16 and the research plan.)

**C. Booth, desk, or station QR.** A printed QR stays on a booth table all week. Behind it is an ORYN Station. The business reassigns which person's capsule it points to as shifts change, without reprinting anything.

**D. Business running ORYN across a team, event, or venue.** A company sets a shared brand and event rules (for example: "participants may show name, role, company, and a work email; no personal phone numbers"). Team members' capsules follow those rules automatically. Admins see aggregate results, not individual recipient behavior.

## 4. Product principles

1. **The recipient decides what happens next.** No identifiable data about a recipient exists unless they chose to provide it.
2. **Share less, by default.** New capsules start with the minimum set of fields in Instant View.
3. **Seconds, not minutes.** From intent to a scannable code in two taps or fewer.
4. **No wall before value.** Recipients never need an account or app to see what was shared.
5. **Always reversible.** Every share can be edited, narrowed, or revoked, and the change applies immediately.
6. **Say what is visible.** Every screen that shows identity data says who can see it.
7. **Relationships over records.** Features serve follow-up and mutual consent, not list-building.

## 5. The Identity Capsule

### Definition
An **Identity Capsule** is a named, policy-bound package of identity information prepared for a specific context. It is not a profile. A profile describes a person; a capsule describes *what this person is willing to show, to whom, at which depth, and for how long*.

### Required properties

| Property | Description |
|---|---|
| Identity mode | One of: Professional, Business, Event, Personal, Social, Creator, Hiring, Custom. Sets defaults for fields and tone. |
| Visible fields with layers | Each selected field is assigned to a layer: **Instant**, **Expanded**, or **Hidden**. |
| Visibility duration | How long a share of this capsule remains viewable (e.g. 1 hour, 1 day, event duration, no limit). |
| Recipient interaction level | What the recipient may do: view only; view + save to phone; view + save + request to connect. |
| Expiration (optional) | Absolute date/time after which the capsule cannot be shared or viewed. |
| One-time access (optional) | The first recipient to open a share claims it; others see "This share is no longer available." |
| Request-to-connect (optional) | Whether the recipient is offered a "Connect" action. |
| Private notes | Owner-only notes. Never shown to recipients under any setting. |
| Audit trail | A dated log of edits, shares, revocations, and policy changes, visible to the owner. |
| "What you're viewing" indicator | A clear label for recipients (e.g. "Maya shared a limited Event profile with you. Expires today at 18:00.") |

A user may have **multiple capsules** (subject to plan) and choose a **default** for fast sharing.

### Example capsules

| Capsule | Mode | Instant | Expanded | Hidden | Duration | Interaction | Other |
|---|---|---|---|---|---|---|---|
| Conference | Event | Name, role, company, photo | Work email, website, short bio, topics | Phone, personal socials | Event duration | View + save + connect | Event-scoped |
| Store | Personal | First name, short note | One social handle | Everything else | 24 hours | View + connect | One-time access |
| Booth | Business | Company, name, role | Product links, work email, booking link | Personal fields | No limit | View + save + connect | Served through a Station |
| Private event | Social | Name, photo | Phone, social handles | Work details | 1 day | View + save | Recipient-specific link |

## 6. Progressive disclosure

| Layer | Where | Account needed | Contains |
|---|---|---|---|
| **Layer 1 — Instant View** | `/c/[token]` | No | Fields marked Instant. Actions: Learn more, Save to phone, Connect (if allowed). |
| **Layer 2 — Expanded View** | `/c/[token]/more` | No | Fields marked Expanded, reached by tapping "Learn more." |
| **Layer 3 — Relationship View** | Inside ORYN (`/c/[token]/keep` → workspace) | Yes | The shared capsule saved as a connection, with notes, follow-ups, and ongoing updates if both sides agree. |

Hidden fields are never sent to the recipient's browser.

## 7. The Consent Ladder

Each step up the ladder reveals more about the recipient, and each step is the recipient's choice.

| Step | Recipient action | What the sender learns |
|---|---|---|
| 1 | Opens the capsule | Anonymous "opened" count. Nothing identifying. |
| 2 | Taps "Learn more" | Anonymous "expanded" count. |
| 3 | Taps "Save to phone" (vCard) | Anonymous "saved" count. |
| 4 | Sends a connection request (types their name + one way to reach them) | Identifiable record, because the recipient provided it. |
| 5 | Chooses "Keep in ORYN" (signs in) | Still only an anonymous "saved" count. The kept copy lives in the *recipient's* workspace; the sender is not told who kept it. |

Rules:
- The sender can **accept** or **decline** a request. **Declining is silent**; the recipient is not notified.
- The recipient can choose **"Not interested"**, which is silent to the sender.
- The recipient can **report abuse** from any recipient screen.
- No IP address, device fingerprint, or location is stored for recipient views.

## 8. Central interaction (7 steps)

1. **Activate.** The sender taps Share (or uses a shortcut, NFC tag, station, or wallet pass).
2. **Choose.** The default capsule is preselected; one tap switches capsule.
3. **Present.** A share session is created and shown as a QR, link, or system share sheet.
4. **Instant View.** The recipient sees Layer 1 in the browser, no account.
5. **Recipient decides.** Learn more, Save to phone, Connect, Not interested, or simply close.
6. **Sender reviews.** Anonymous counts and any connection requests appear on Today.
7. **Follow up.** The sender accepts or declines, adds a private note, and sets a follow-up.

## 9. Activation trigger abstraction

All activation methods create or resolve the same **share session**. The channel is recorded only as `share_started {channel}`.

| Channel | v1 behavior |
|---|---|
| `link` | Copyable URL to `/c/[token]`. |
| `qr` | QR on screen encoding the link. |
| `web_share` | Browser system share sheet where supported. |
| `nfc_tag` | Web NFC on supported Android browsers **writes a physical tag**. Not peer-to-peer. |
| `wallet_pass` | Requires issuer certificates; **simulated in v1**. |
| `shortcut` | PWA home-screen shortcut that opens `/share/quick` and starts the default capsule immediately. |
| `station` | A fixed QR at `/q/[code]` that resolves to whichever capsule is currently assigned. |

**Double-press / hardware-button activation is not promised as an operating-system feature.** It must be validated per platform (e.g. iOS Back Tap → Shortcut → open `/share/quick`; an Android quick-settings tile in a future native wrapper).

## 10. Share session scopes

| Scope | Meaning |
|---|---|
| Public | Anyone with the link or code can view. |
| Limited | Only Instant fields; Expanded disabled for this session. |
| Expiring | Stops working after a set time. |
| One-time | First recipient browser claims it; later opens are refused. |
| Event-scoped | Valid only during the event; fields constrained by event rules. |
| Organization-scoped | Tied to a workspace capsule and workspace. *v1: modeled and recorded; viewer restriction to signed-in members is not yet enforced.* |
| Recipient-specific | Intended for one person, matched by a hash of their email. *v1: enforced in the service layer; no screen to create one yet.* |
| Revocable instantly | Every session can be revoked; the next request shows "No longer available." |

The recipient always sees the **live** capsule filtered by the session policy, so edits and revocations apply at once.

## 11. Event mode

- Organizers create an event with dates, venue, and **sharing rules**. v1 ships the phone-number rule (off by default) and a note to participants; the data model also supports an allowed-field-kinds list (no screen yet).
- Participants share their own capsule "at" the event; the event's rules are applied on top of their choices at view time.
- Organizers can create **Stations** (booth or desk QRs) for the event.
- Organizers see aggregate counts per event (opens, expansions, connections), never individual recipient identities.
- When the organizer ends the event, every event-scoped share closes at once. (Automatic closing on the end date is a planned background job.)

## 12. Business / team workspace

- Shared brand (colors, logo, company fields) — *planned; the `organizations.brand` field exists, no editor yet.*
- Roles: Owner, Admin, Manager (runs events and stations), Member. Role → permission matrix in `lib/server/permissions.ts`.
- Team templates for capsules, with locked company fields — *planned.*
- Stations and QR destinations managed by admins.
- Aggregate analytics, data export, audit logs, org-level privacy defaults.

## 13. v1 scope — 20 screens

| # | Screen | Route |
|---|---|---|
| 1 | Landing | `/` |
| 2 | Sign in / Sign up | `/signin`, `/signup` |
| 3 | Today | `/today` |
| 4 | My Capsules | `/capsules` |
| 5 | Capsule editor | `/capsules/new`, `/capsules/[id]` |
| 6 | Visibility & layers | `/capsules/[id]/visibility` |
| 7 | Share (active sharing) | `/share`, `/share/[id]`, `/share/quick` |
| 8 | Recipient Instant View | `/c/[token]` |
| 9 | Recipient Expanded View | `/c/[token]/more` |
| 10 | Connection request (recipient) | `/c/[token]/connect` |
| 11 | Keep in ORYN (recipient) | `/c/[token]/keep` |
| 12 | Connections & requests | `/connections`, `/connections/requests` |
| 13 | Contact detail | `/connections/[id]` |
| 14 | Follow-ups | `/follow-ups` |
| 15 | Events | `/events`, `/events/new`, `/events/[id]` |
| 16 | Event participants | `/events/[id]/participants` |
| 17 | Stations & QR destinations | `/stations` (+ new), `/q/[code]` |
| 18 | Teams | `/teams` |
| 19 | Insights | `/insights` |
| 20 | Settings (plan, privacy center, security) | `/settings`, `/settings/plan`, `/settings/privacy`, `/settings/security` |

Internal (not counted): platform admin console at `/admin`.

## 14. Plans as capability levels

Plans are defined as **sets of capabilities**, not prices. **Prices are intentionally not set.** Plans, prices, and limits live in a **plan catalog** editable by platform admins, so pricing can change after research without a code change. When a user reaches a limit, the product records `plan_gate_hit {capability}` and explains what the next level adds.

| Plan | Capabilities |
|---|---|
| **Free** | 1 capsule, basic sharing, QR & link, basic contact saving, 30-day history |
| **Pro** | Multiple capsules, progressive disclosure controls, follow-ups, private notes, advanced branding, more sharing methods, extended history, personal insights |
| **Business** | Team workspace, shared brand, roles & permissions, event mode, stations & QR destinations, analytics, team admin, data export, audit logs, org controls |
| **Enterprise** | SSO, SCIM, advanced access policies, dedicated support, custom retention, security review support, custom domains, API access, regional data options |

## 15. Non-goals (v1)

- **No CRM dashboard.** Connections and follow-ups, not pipelines and deal stages.
- **No indiscriminate lead scraping.** No bulk capture of people who did not choose to connect.
- **No recipient tracking.** No IP storage, fingerprinting, location, or cross-site tracking of recipients.
- **No forced app download.** Recipients get value in the browser. The app offer appears only after something useful was shown, and can be dismissed.
- No native apps in v1 (PWA only). No peer-to-peer NFC.

## 16. Success metrics

See [06-analytics.md](06-analytics.md) for definitions and formulas. Leading indicators for v1:

- Time to first share
- Recipient view rate and expanded view rate
- Connection request rate and follow-up completion rate
- 7-day return %
- Privacy control usage
- Support issues caused by confusion (target: trending down)

## 17. Open decisions for founders

Full detail in [09-founder-decisions.md](09-founder-decisions.md).

1. Does Personal (romantic/social) mode ship at launch, and with which safety features?
2. Default visibility duration for new capsules (proposal: 24 hours).
3. Default recipient interaction level (proposal: view + save; connect off for Personal mode until research is done).
4. Free-plan history window (30 days proposed) and data retention defaults.
5. Pricing, after the research pricing probe.
6. Whether event organizers can see participant-level (not recipient-level) counts.
7. Native app timing, and whether wallet passes move from simulated to real in v1.x.
