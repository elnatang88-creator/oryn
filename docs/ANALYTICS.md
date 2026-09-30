# ORYN — Analytics and Value Metrics

| | |
|---|---|
| Status | Draft for founder review |
| Last updated | 2026-09-30 |
| Related | [01 PRD](PRD.md) · [07 Research plan](RESEARCH_PLAN.md) |

We measure whether ORYN is **useful**, not whether it is busy. Every metric below should answer: did someone share with less friction, did the recipient get to decide, and did something meaningful happen afterwards?

---

## 1. Privacy rules for analytics (non-negotiable)

0. **Exception by founders' decision (2026-09-30):** a signed-in ORYN member's view is stored in `capsule_views` (owner product data, not analytics) and shown to Pro owners, with notice and an opt-out. `analytics_events` still never carry recipient identity. Detail taps (`interactions.kind = 'field_clicked'`, `field_kind`) are anonymous.
1. **Recipient events are anonymous counts.** `share_viewed`, `share_expanded`, `share_saved_vcard`, `app_offer_shown`, and `app_offer_accepted` carry no recipient identity.
2. **No IP address storage** for recipient events, including in logs retained for analytics.
3. **No device fingerprinting** and no persistent recipient identifiers for analytics. (The one-time claim cookie exists only to enforce one-time access and is not used for analytics.)
4. **No cross-site tracking**: no third-party analytics pixels or ad SDKs on recipient pages.
5. **Identifiable recipient data exists only after the recipient chooses it** (`connect_requested`). "Keep in ORYN" stays anonymous to the sender. See the Consent Ladder in the PRD.
6. **No customer data is used to train external models** without explicit authorization from the customer.
7. Team and event analytics are **aggregates**; admins do not see which individual recipient did what.
8. Small counts are shown as-is to the capsule owner (it's their share) but aggregated views for teams/events suppress breakdowns with fewer than 5 events.

## 2. Event catalogue

Events are stored in `analytics_events` with `name` and `props` (JSON), plus a timestamp and, for workspace events only, the acting `user_id`.

| Event | Props | Actor | Notes |
|---|---|---|---|
| `signup_completed` | — | User | |
| `capsule_created` | — | User | |
| `capsule_edited` | — | User | |
| `share_started` | `channel` (link, qr, web_share, nfc_tag, wallet_pass, shortcut, station) | User | One per share session |
| `share_viewed` | `layer: "instant"` | Anonymous | Recipient opened Layer 1 |
| `share_expanded` | — | Anonymous | Recipient opened Layer 2 |
| `share_saved_vcard` | — | Anonymous | Save to phone |
| `app_offer_shown` | — | Anonymous | |
| `app_offer_accepted` | — | Anonymous | |
| `connect_requested` | — | Recipient (self-identified) | |
| `connect_accepted` | — | User | |
| `connect_declined` | — | User | Silent to recipient |
| `note_added` | — | User | Note content is never in props |
| `followup_created` | — | User | |
| `followup_completed` | — | User | |
| `share_revoked` | — | User | |
| `privacy_control_used` | `control` | User | e.g. layer change, expiry, one-time |
| `event_created` | — | User | |
| `participant_added` | — | User | |
| `station_created` | — | User | |
| `plan_gate_hit` | `capability` | User | |
| `plan_changed` | — | User | |
| `export_requested` | — | User | |
| `deletion_requested` | — | User | |

Notation below: `count(e)` = number of events named `e` in the window; `users(e)` = distinct users with at least one `e`; `sessions(e)` = distinct share sessions with at least one `e`.

## 3. Value metrics

### Activation

**Time to create first capsule**
- *Definition:* Median time from signup to the user's first capsule.
- *Formula:* `median( first(capsule_created).ts − signup_completed.ts )` per user.
- *Why:* Measures whether the capsule concept is understandable without help. Target: under 3 minutes.

**Time to first share**
- *Definition:* Median time from signup to the first share session started.
- *Formula:* `median( first(share_started).ts − signup_completed.ts )`.
- *Why:* The core promise is "instant." If first share takes long, onboarding is in the way.

### Sharing and the recipient experience

**Successful share rate**
- *Definition:* Share sessions that were opened at least once.
- *Formula:* `sessions(share_viewed) / count(share_started)`.
- *Why:* A share that is never opened failed (bad code, poor scanning, wrong channel). Split by `channel` to compare activation methods.

**Recipient view rate**
- *Definition:* Average number of anonymous opens per share session.
- *Formula:* `count(share_viewed) / count(share_started)`.
- *Why:* Shows reach per share; high values on station/event channels, ~1 on one-time.

**Expanded view rate**
- *Definition:* Share of opens where the recipient tapped Learn more.
- *Formula:* `count(share_expanded) / count(share_viewed)`.
- *Why:* Validates progressive disclosure. Too low: Instant View isn't inviting enough. Near 100%: Instant View may be too thin.

**Save rate**
- *Definition:* Share of opens that ended in Save to phone.
- *Formula:* `count(share_saved_vcard) / count(share_viewed)`.
- *Why:* An anonymous, low-commitment signal that the share was worth keeping.

**Connection request rate**
- *Definition:* Share of opens where the recipient chose to identify themselves.
- *Formula:* `count(connect_requested) / count(share_viewed)`.
- *Why:* The main measure of recipient-chosen value. Read together with acceptance: `count(connect_accepted) / count(connect_requested)`.

### After the first share

**Follow-up completion rate**
- *Definition:* Follow-ups completed out of follow-ups created (cohort by creation week).
- *Formula:* `count(followup_completed) / count(followup_created)`.
- *Why:* Distinguishes ORYN from a card exchange: did the relationship move forward?

**Meaningful connections per user**
- *Definition:* Accepted connections that also received a note or follow-up, per active user per month.
- *Formula:* `count(distinct connection with connect_accepted AND (note_added OR followup_created)) / users(share_started)` per month.
- *Why:* A connection someone bothered to annotate or follow up on is a relationship, not a number.

**Event connection rate**
- *Definition:* Accepted connections per event participant.
- *Formula:* `count(connect_accepted where session is event-scoped) / count(participant_added)` per event.
- *Why:* The organizer's value metric; supports Business plan conversations.

### Retention and habit

**Repeat usage**
- *Definition:* Users who started shares on 3+ distinct days in their first 30 days.
- *Formula:* `users with ≥3 distinct days of share_started in [signup, signup+30d] / users(signup_completed)`.
- *Why:* ORYN should be used whenever people meet, not once.

**7-day return %**
- *Definition:* Users who return and take any workspace action between day 1 and day 7 after signup.
- *Formula:* `users with any user-actor event in (signup+1d, signup+7d] / users(signup_completed)`.
- *Why:* Early signal that Today, requests, and follow-ups bring people back.

### Trust and control

**% shared sessions revoked or edited**
- *Definition:* Share sessions revoked, or whose capsule was edited while the session was live.
- *Formula:* `(sessions with share_revoked + sessions with capsule_edited during live window) / count(share_started)`.
- *Why:* Some rate is healthy (people use control). A sharp rise may indicate regret or confusing defaults.

**Privacy control usage**
- *Definition:* Share of active users who used at least one privacy control in the period; broken down by `control`.
- *Formula:* `users(privacy_control_used) / users(share_started)`.
- *Why:* Tells us whether layers, expiry, and one-time access are understood and valued, and which ones.

### Business

**Subscription conversion**
- *Definition:* Free users who moved to a paid plan within 60 days; also conversion after a gate.
- *Formula:* `users(plan_changed to paid) / users(signup_completed)`; gate-driven: `users(plan_changed within 7d of plan_gate_hit) / users(plan_gate_hit)`, by `capability`.
- *Why:* Shows which capabilities people actually pay for; informs pricing (no prices are set yet).

**Business workspace activation**
- *Definition:* Business workspaces that, within 14 days, created an event or station and added at least 3 participants/members.
- *Formula:* `workspaces with (event_created OR station_created) AND count(participant_added) ≥ 3 in 14d / new Business workspaces`.
- *Why:* A business that never set up an event or station has not reached value.

**Support issues caused by confusion**
- *Definition:* Support tickets tagged "confusion" (vs. bug or request), per 100 active users.
- *Formula:* `tickets tagged confusion / (users(share_started) / 100)` per month. Tagged manually in the support tool; not an analytics event.
- *Why:* Plain language and one-primary-action are core principles; this tells us when they fail.

## 4. Not tracked on purpose

- Which recipient opened what (no identity before consent).
- Recipient location, IP, device, or browser fingerprint.
- Time spent by a recipient on a capsule.
- Contents of private notes, follow-ups, or connection messages in analytics props.
- "Recipient not interested" as a sender-visible event.

## 5. Reporting cadence

- **Weekly:** activation, successful share rate, connection request rate, 7-day return %.
- **Monthly:** follow-up completion, meaningful connections, privacy control usage, conversion, support confusion rate.
- **Per event:** event connection rate, share rate by channel, for the organizer and for us.
