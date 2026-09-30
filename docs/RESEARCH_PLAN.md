# ORYN — User Research Plan

| | |
|---|---|
| Owners | Founders (Elnatan, Orian, Shoval) |
| Duration | 6 weeks |
| Status | Draft |
| Last updated | 2026-09-30 |
| Related | [01 PRD](PRD.md) · [06 Analytics](ANALYTICS.md) · [09 Founder decisions](PRODUCT_DECISIONS.md) |

---

## 1. Goals

1. Learn whether selective, layered sharing solves a real problem in crowded or awkward settings.
2. Find out which fields people show immediately, which they hold back, and which they never share.
3. Understand which activation method works in the moment (QR, NFC, Wallet, shortcut, other).
4. Find the conditions under which recipients trust ORYN and when it feels invasive.
5. Decide whether and how the Personal (romantic/social) scenario can ship safely.
6. Identify which capabilities justify payment, for individuals and for teams/organizers.
7. Understand what people need after the first share.

## 2. Hypotheses

| # | Hypothesis | Signal that supports it | Signal that refutes it |
|---|---|---|---|
| H1 | People want to show less at first and more later. | Most participants put ≤4 fields in Instant View. | Participants put everything in Instant View. |
| H2 | Recipients will open a capsule without an account if it loads instantly. | High open rate in prototype tests; no complaints about sign-in. | Recipients hesitate to scan unknown QR codes. |
| H3 | Anonymous counts are enough for senders. | Senders do not ask "who opened it?" as a need. | Senders strongly want individual viewer identity. |
| H4 | QR is the default at events; shortcuts matter for speed. | QR chosen first; interest in one-tap shortcut. | NFC or Wallet strongly preferred. |
| H5 | A useful limited profile earns an optional app install. | Participants say they'd install after seeing value. | Install is rejected regardless. |
| H6 | Organizers and teams will pay for event mode and stations. | Organizers describe current spend or pain for this. | No budget owner identified. |
| H7 | The store scenario can feel safe for the recipient. | Recipients feel in control with silent ignore, block, report. | Recipients consistently describe it as unwanted or intimidating. |
| H8 | Follow-ups and notes drive return visits. | Participants describe forgetting people after events. | Participants already solve this well elsewhere. |

## 3. Recruiting

**Target: 24 interviews + 1 contextual event + 12 prototype tests.**

| Segment | Interviews | Notes |
|---|---|---|
| Professionals who attend events | 4 | Mix of seniority |
| Salespeople | 3 | Field and inside sales |
| Event organizers | 3 | Conferences, meetups, trade shows |
| Recruiters | 2 | In-house and agency |
| Creators | 2 | Mid-size audience; share selectively |
| Business owners | 3 | Retail, venue, or service with a team |
| Conference attendees (not organizers) | 3 | Recent attendance within 3 months |
| People who wanted to start a personal conversation but couldn't interrupt | 4 | Balanced by gender; include people who have **received** unwanted approaches |

Screening: attended an in-person event or had a relevant encounter within the last 6 months; mix of iOS and Android; mix of ages; include at least 3 participants who rely on accessibility features.

Incentive: a gift card of equal value per session. Consent form covers recording, note-taking, and deletion of recordings after synthesis.

## 4. Methods

### 4.1 Interviews (45 minutes, remote or in person)
Semi-structured, using the guide in §5. One facilitator, one note-taker.

### 4.2 Contextual observation at a real event
Attend one event (conference or meetup). Observe how people exchange contact details: time taken, what's said, what fails. With organizer permission, offer a live ORYN station and short intercepts (5 minutes) with consenting attendees. No recording of people who have not consented.

### 4.3 Prototype tests on the live demo
Participants complete tasks on the live v1 demo:
1. Create a capsule for a conference.
2. Move one field from Instant to Expanded; hide one field.
3. Share it with the facilitator via QR.
4. As a recipient: open, learn more, save, then send a connection request.
5. Revoke the share and confirm it no longer opens.
6. Find and add a follow-up for the new connection.

Measure: task success, time on task, errors, and think-aloud comments. Compare against analytics definitions in [ANALYTICS.md](ANALYTICS.md).

### 4.4 Pricing probe (no prices committed)
Use Van Westendorp price sensitivity questions (too cheap / cheap / expensive / too expensive) for Pro (individual) and Business (per team or per event). Follow with a capability ranking: "Which three of these would you pay for?" Results inform the plan catalog; **no price is announced or promised to participants.**

## 5. Interview guide (45 minutes)

**Intro (3 min).** Purpose, consent, no right or wrong answers, they can skip any question.

**Current behaviour (10 min).**
- Tell me about the last time you met someone new at an event or in public and wanted to stay in touch. What happened?
- What did you share? What did you wish you hadn't? What did you wish you had?
- What happened after that first exchange?

**Show the concept (2 min).** One-sentence description plus the live demo Instant View.

**Core test questions (20 min) — ask exactly as written:**
1. Would you use ORYN in a crowded event?
2. What information would you show immediately?
3. What would you hide?
4. Would you prefer QR, NFC, Wallet, app shortcut, or another method?
5. Would you download an app after seeing a useful limited profile?
6. What would make you trust the system?
7. What would make the experience feel invasive?
8. Which features justify payment?
9. Would a team or event organizer pay for this?
10. What happens after the first share?

Probe after each: "Why?" "Can you give an example?" "What would change your answer?"

**Recipient perspective (5 min).**
- Imagine a stranger shows you a code. What would make you willing to scan it?
- After opening it, what would you want to be able to do? What would you want to be sure *didn't* happen?

**Wrap-up (5 min).** Anything we should have asked? Pricing probe (if in the pricing subset).

## 6. Safety research: the personal / romantic (store) scenario

This scenario can help someone start a conversation without interrupting, but it can also enable unwanted attention or harassment. It gets its own research track and a go/no-go decision.

### Risks to study
- Unwanted attention: recipient feels pressured or watched, even if they don't respond.
- Harassment: repeated approaches from the same sender, or escalation after being ignored.
- Power imbalance: e.g. staff approached while working, who cannot easily walk away.
- Screenshots and resharing of personal capsules.
- Misuse of one-time links to test whether someone opened them.
- Minors: people under the minimum age receiving a personal capsule.

### Recipient controls to test
- **Ignore silently** ("Not interested" or simply closing) — sender learns nothing beyond an anonymous open count.
- **Block** — the sender can no longer send requests to this recipient if they later identify (for signed-in recipients).
- **Report** — reachable from every recipient screen, no account needed, with a short reason list.
- Personal capsules limited to Instant View only, one-time access, and short duration by default.
- Whether even the anonymous "opened" count should be hidden from the sender in Personal mode.

### Questions (asked separately, with a facilitator of the participant's choice where possible)
- How would you feel if a stranger in a store showed you this? What would make it OK, if anything?
- What would you want to be able to do without the other person knowing?
- Should the sender know you opened it? Why or why not?
- What would you expect to happen if you reported it?
- Have you had an experience where someone approached you in a way that felt unwanted? What would have helped? (Optional; participants may skip.)

### Safeguards during research
Participants may stop at any time; no pressure to share personal experiences; signpost to support resources; the note-taker records no identifying details about third parties.

### Decision output
A written go/no-go on Personal mode at launch, with the minimum safety feature set (feeds [PRODUCT_DECISIONS.md](PRODUCT_DECISIONS.md)).

## 7. Synthesis plan

1. Notes captured in a shared template within 24 hours of each session.
2. Affinity mapping weekly: observations → themes → insights.
3. Each insight tagged with hypothesis (H1–H8), segment, and strength (how many participants, how consistent).
4. Quotes stored without names; participant IDs only.
5. Recordings deleted after synthesis, per consent.
6. Final readout: one page per hypothesis (supported / refuted / unclear), top 5 product changes, and pricing probe ranges.

## 8. Decision criteria

| Decision | Go if… |
|---|---|
| Layered disclosure as the core | ≥ 70% of participants assign fields across at least two layers without prompting. |
| No-account recipient flow | ≥ 80% of recipient tasks completed with no confusion about sign-in. |
| Anonymous-only sender insights | Fewer than 25% of senders describe individual viewer identity as a must-have, and recipients strongly prefer anonymity. |
| Default activation method | The channel chosen first by the majority becomes the default on the Share screen. |
| Personal mode at launch | Recipients (especially those who have experienced unwanted approaches) rate the minimum safety set as adequate, and no severe misuse path is left unmitigated. Otherwise defer. |
| Business plan focus | At least 2 of 3 organizers and 2 of 3 business owners identify a budget owner and a current cost. |
| Pricing | Van Westendorp acceptable range identified for Pro and Business; founders set initial catalog prices within it. |

## 9. Timeline (6 weeks)

| Week | Activities |
|---|---|
| 1 | Finalize guide and screener; recruit; pilot 2 interviews; fix guide. |
| 2 | Interviews 1–10; set up prototype test script on live demo. |
| 3 | Interviews 11–18; contextual observation at an event. |
| 4 | Interviews 19–24; prototype tests 1–6; safety research sessions. |
| 5 | Prototype tests 7–12; pricing probe analysis; ongoing synthesis. |
| 6 | Final synthesis, readout to founders, decisions recorded in 09. |
