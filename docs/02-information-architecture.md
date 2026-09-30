# ORYN — Information Architecture

| | |
|---|---|
| Status | Draft for founder review |
| Last updated | 2026-09-30 |
| Related | [01 PRD](01-product-requirements.md) · [06 Analytics](06-analytics.md) |

ORYN has two surfaces:

1. **The workspace** — for people who own capsules (signed in).
2. **The recipient surface** — for people who receive a share (no account needed).

---

## 1. Sitemap

```
Public
├── /                         Landing
├── /signin                   Sign in
├── /signup                   Sign up
├── /q/[code]                 Station / QR destination (redirects to a live share)
└── /c/[token]                Recipient — Instant View (Layer 1)
    ├── /more                 Recipient — Expanded View (Layer 2)
    ├── /connect              Recipient — Connection request form
    └── /keep                 Recipient — Continue in ORYN (Layer 3 entry)

Workspace (signed in)
├── /today                    Today
├── /capsules                 My Capsules
│   ├── /new                  New capsule
│   └── /[id]                 Capsule editor
│       └── /visibility       Visibility & layers
├── /share                    Choose capsule & start (?capsule=<id>)
├── /share/quick              One tap → live share of the default capsule
├── /share/[id]               Active sharing screen (QR, link, NFC, stop)
├── /connections              Connections
│   ├── /requests             Incoming connection requests
│   └── /[id]                 Contact detail (private notes, follow-ups)
├── /follow-ups               Follow-ups
├── /events                   Events
│   ├── /new                  New event
│   └── /[id]                 Event detail
│       └── /participants     Participants
├── /stations                 Stations & QR destinations (+ new)
├── /teams                    Teams
├── /insights                 Insights
└── /settings                 Settings
    ├── /plan                 Plan & capabilities
    ├── /privacy              Data & privacy center
    └── /security             Security

Internal
└── /admin                    Platform admin console (plan catalog, abuse reports)
```

## 2. Navigation

### Main navigation (workspace)
Today · My Capsules · Connections · Follow-ups · Events · Teams · Insights · Settings

Events and Teams are shown to all users; when the plan does not include them, the screen explains what the capability is and how to get it (no dead links).

### Mobile (< 768px): bottom tab bar

| Position | Item | Destination |
|---|---|---|
| 1 | Today | `/today` |
| 2 | Capsules | `/capsules` |
| 3 (center, raised) | **Share** | `/share/quick` (default capsule) |
| 4 | Connections | `/connections` |
| 5 | More | Sheet: Follow-ups, Events, Teams, Insights, Settings |

The Share action sits in the center, within thumb reach, and is always one tap away.

### Desktop (≥ 768px): left rail
A persistent left rail with all main items, a prominent **Share** button at the top, and the account/workspace switcher at the bottom.

## 3. Route table

| Route | Surface | Auth | Screen | Primary action |
|---|---|---|---|---|
| `/` | Public | No | Landing | Create your capsule |
| `/signin` | Public | No | Sign in | Sign in |
| `/signup` | Public | No | Sign up | Create account |
| `/c/[token]` | Recipient | No | Instant View | Learn more |
| `/c/[token]/more` | Recipient | No | Expanded View | Save to phone |
| `/c/[token]/connect` | Recipient | No | Connection request | Send request |
| `/c/[token]/keep` | Recipient | Sign-in offered | Keep in ORYN | Keep in ORYN |
| `/q/[code]` | Recipient | No | Station resolver | (redirects to Instant View) |
| `/today` | Workspace | Yes | Today | Share |
| `/capsules` | Workspace | Yes | My Capsules | New capsule |
| `/capsules/new` | Workspace | Yes | New capsule | Create capsule |
| `/capsules/[id]` | Workspace | Yes | Capsule editor | Save changes |
| `/capsules/[id]/visibility` | Workspace | Yes | Visibility & layers | Save visibility |
| `/share` | Workspace | Yes | Active sharing | Show code (auto) → Stop sharing |
| `/connections` | Workspace | Yes | Connections | Open contact |
| `/connections/requests` | Workspace | Yes | Requests | Accept |
| `/connections/[id]` | Workspace | Yes | Contact detail | Add follow-up |
| `/follow-ups` | Workspace | Yes | Follow-ups | Mark done |
| `/events` | Workspace | Yes | Events | New event |
| `/events/new` | Workspace | Yes | New event | Create event |
| `/events/[id]` | Workspace | Yes | Event detail | Share event capsule |
| `/events/[id]/participants` | Workspace | Yes | Participants | Add participant |
| `/stations` | Workspace | Yes | Stations | New station |
| `/teams` | Workspace | Yes | Teams | Invite member |
| `/insights` | Workspace | Yes | Insights | (read-only) View capsule details |
| `/settings` | Workspace | Yes | Settings | Save |
| `/settings/plan` | Workspace | Yes | Plan | Change plan |
| `/settings/privacy` | Workspace | Yes | Data & privacy center | Export my data |
| `/settings/security` | Workspace | Yes | Security | Sign out other sessions |
| `/admin` | Internal | Platform admin | Admin console | Save plan catalog |

## 4. The recipient surface

The recipient has no account, did not ask for anything, and may be standing in a noisy room. Design for them first.

- **Loads fast on mobile data.** No heavy scripts, no app-install wall.
- **"What you're viewing" banner** at the top of every recipient screen: who shared, which kind of capsule, when it expires.
  - Example: *"Maya shared a limited Event profile. Available until 18:00 today."*
- **Actions, in order of commitment:** Learn more → Save to phone → Connect → Keep in ORYN.
- **Always available, never hidden:** "Not interested" (silent) and "Report."
- **Unavailable states** use neutral wording and never reveal why: *"This share is no longer available."* (covers revoked, expired, one-time claimed, out of scope).
- **App offer** appears only after the recipient has seen useful content (e.g. after saving), is dismissible, and never blocks content.

## 5. Screen-by-screen purpose and primary action

Each screen has **one** primary action. Secondary actions use quieter styling.

| # | Screen | Purpose | Primary action |
|---|---|---|---|
| 1 | Landing | Explain ORYN in one sentence and show a live sample capsule. | Create your capsule |
| 2 | Sign in / Sign up | Get into the workspace with minimum friction. | Continue |
| 3 | Today | What happened since you last looked: new requests, follow-ups due, recent shares. | Share |
| 4 | My Capsules | See all capsules, which is default, which are active. | New capsule |
| 5 | Capsule editor | Name, mode, fields, private notes. | Save changes |
| 6 | Visibility & layers | Assign each field to Instant / Expanded / Hidden; duration; interaction; one-time; expiry. Live recipient preview. | Save visibility |
| 7 | Share | Show the code for the chosen capsule, with scope controls and a live status. | Stop sharing (the code is shown automatically) |
| 8 | Instant View | Show Layer 1 to the recipient. | Learn more |
| 9 | Expanded View | Show Layer 2. | Save to phone |
| 10 | Connection request | Recipient offers name + one way to reach them. | Send request |
| 11 | Keep in ORYN | Recipient signs in to keep a private copy in their own workspace. The sender only sees an anonymous "saved" count. | Keep in ORYN |
| 12 | Connections & requests | People you are connected with; pending requests. | Accept (on requests) |
| 13 | Contact detail | Their shared info, your private notes, follow-ups, history. | Add follow-up |
| 14 | Follow-ups | What you said you'd do, by due date. | Mark done |
| 15 | Events | Create and manage events and field rules. | New event |
| 16 | Event participants | Who is part of the event and their capsule status. | Add participant |
| 17 | Stations | Fixed QR codes and what each currently points to. | New station |
| 18 | Teams | Members, roles, shared brand. | Invite member |
| 19 | Insights | Anonymous counts per capsule and share: opened, expanded, saved, requests. | View capsule details |
| 20 | Settings | Plan, privacy center, security. | Save |

## 6. UX rules

1. **One primary action per screen.** One filled button; everything else is secondary or text.
2. **Touch targets ≥ 48×48 px**, with at least 8px spacing between targets.
3. **One-handed reach.** Primary actions sit in the lower half of the screen on mobile. Share is in the bottom bar.
4. **Plain language.** No jargon ("capsule" is the only product term users must learn; explain it once).
5. **Visible public/private indicators.** Every field shows its layer badge: *Instant*, *Expanded*, or *Hidden*. Private notes carry a lock and "Only you can see this."
6. **Distinct treatment for the four recipient actions:**

| Action | Treatment | Meaning |
|---|---|---|
| **Share** (sender) | Filled accent button, share icon | Makes something visible now |
| **Learn more** | Outlined button, chevron | See more of what was already shared |
| **Save** | Neutral button, download icon | Keep a copy on your phone, anonymously |
| **Connect** | Filled secondary colour, handshake/person-plus icon | Tell the sender who you are |

7. **Confirm before exposing, not before hiding.** Moving a field from Hidden to Instant asks for confirmation; moving it the other way does not.
8. **Revocation is one tap** from Share, Insights, and the capsule editor.
9. **Accessible by default.** Color contrast ≥ 4.5:1 for text; layer badges use text, not color alone; all actions reachable by keyboard and screen reader.

## 7. Content and voice

**Short. Direct. Human.** No pressure, no urgency tricks, nothing that makes the recipient feel watched.

### Principles
- Say what happens, then stop.
- Tell the sender facts in aggregate; never describe a recipient as an individual unless they introduced themselves.
- Recipients are never told they are being measured, because they are not being identified.
- Declines and "not interested" are silent. Copy never hints at them.

### Do / Don't

| Context | Do | Don't |
|---|---|---|
| Sender insights | "Opened 3 times" | "Someone at Acme viewed you" |
| Sender insights | "2 people tapped Learn more" | "Jordan is interested in you!" |
| Recipient banner | "Maya shared a limited profile with you." | "Maya wants to connect with you!" |
| Recipient connect | "Want Maya to know who you are? Share your name and one way to reach you." | "Connect now before it expires!" |
| Unavailable share | "This share is no longer available." | "Maya revoked access to you." |
| App offer | "Keep this in ORYN? It's optional." | "Download the app to continue." |
| Declined request (sender side) | "Declined. They won't be notified." | "Rejected" |
| Not interested (recipient) | "Done. Nothing was sent." | "Are you sure? Maya will be disappointed." |
| Field layer | "Shown after 'Learn more'" | "Semi-private mode enabled" |
| Revoke | "Stop sharing" / "Stopped. The link no longer works." | "Terminate session" |
| Plan limit | "Multiple capsules are part of Pro." | "Upgrade now! You're missing out." |
| Private note | "Only you can see this." | "Secret note" |

### Terms

| Use | Avoid |
|---|---|
| Capsule | Card, profile (for the shared object) |
| Share / Stop sharing | Broadcast, publish, terminate |
| Opened, Learned more, Saved | Viewed you, stalked, visited |
| Connection request | Lead, capture |
| Follow-up | Task, deal |
