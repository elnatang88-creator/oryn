# MedFlow AI — Monetization Model (v1)

**Workstream:** Business

**Objective:** Define who pays MedFlow AI, for what, and under what packaging and pricing mechanics, so the founder can run a paid discovery → paid pilot → production SaaS motion without giving away real PHI work for free.

**Assumptions (illustrative, to validate with design partners — none of these are market facts):**

- ICP is small-to-mid RCM outsourcers / billing companies (not yet large health systems), because one signed customer brings multiple provider accounts and claim volume.
- Buyer has budget authority in the $5K–$50K/year range without a lengthy enterprise procurement cycle.
- Direct/founder-led sales for the first 90 days; no channel partners signed yet.
- All dollar figures below are placeholders for modeling the *mechanics* of pricing and margin — they are not validated market prices.
- A verified-recovery ("success fee") pricing line is included only as a framework; it must not be quoted to a customer before qualified healthcare counsel reviews it for fee-splitting / anti-kickback / referral-inducement exposure (see master prompt § Security/Compliance).

**Decision summary:**
1. Sell in three sequential tiers — paid assessment → paid pilot → production SaaS — never open-ended free work.
2. Production revenue is base subscription + per-claim-opportunity usage, not a headcount seat price, because value scales with claim volume, not user count.
3. Treat any success/recovery-based fee as a *pending* line item, gated on counsel review, never the primary pitch.
4. Add a separately priced managed-operations tier for customers who want human-assisted follow-up rather than pure software.
5. First 90 days optimize for signed paid pilots and a citable case study, not maximum ACV.

---

## 1. ICP and Buyer

| | Description |
|---|---|
| **ICP** | U.S. medical billing / RCM outsourcing companies managing multiple physician practices or outpatient facilities, roughly $25M–$300M in annual billed charges under management, with a denial/underpayment worklist run manually today. |
| **Secondary ICP** | Mid-size specialty physician groups (ortho, cardiology, oncology, imaging, multi-specialty ASCs) with an in-house billing team of 3–15 FTEs. |
| **Buyer** | VP of Revenue Cycle, Director of Billing Operations, or (at smaller RCM firms) the owner/principal directly. |
| **Economic sponsor** | Whoever owns the "days in A/R" and "denial recovery rate" KPI — usually the same buyer. |

## 2. Pain and Current Workaround

- Denial/underpayment worklists live in the PM system or spreadsheets; triage is manual and size-based, not value-based.
- No reliable, defensible estimate of "what's actually still recoverable" — teams work the biggest dollar claims, not the highest expected-value ones.
- Appeals are written from generic templates; evidence gathering is manual and slow.
- Timely-filing and appeal deadlines get missed under staff turnover/volume spikes.
- No clean before/after ROI story to show their own clients (for RCM outsourcers) or leadership (for in-house teams).

**Current workaround:** more headcount, overtime, or simply writing off aged denials.

## 3. Value Proposition

"Work the claims worth working, in the order that matters, with the evidence and draft documents already assembled — so your team recovers more legitimate dollars per hour and misses fewer deadlines, with every number and every claim traceable back to source."

This is a productivity and recovery-rate lever for an existing team, not a headcount replacement pitch — frame it that way to reduce buyer defensiveness.

## 4. Offer and Packaging

### Tier 1 — Paid Data-Readiness Assessment
- **What:** Fixed-scope review of a customer-supplied sample (e.g., up to ~2,000 claim lines / 90 days of denials and remits) from 1–2 payers.
- **Deliverable:** Quantified opportunity map (claims by category, estimated defensible recoverable range, confidence, missing-evidence list) + a scoped pilot proposal.
- **Price (illustrative):** flat fee, e.g. **$5,000–$10,000**, due before work starts.
- **Rule:** never open-ended; scope, sample size, and turnaround (e.g., 2–3 weeks) are fixed in a one-page SOW.

### Tier 2 — Paid Pilot
- **What:** Implementation + live use of the platform against a defined, narrow scope (1–3 payers, 3–5 denial/underpayment categories, a volume ceiling).
- **Term:** fixed, e.g. 60–90 days, with pre-agreed success metrics (see § 8).
- **Price (illustrative):** implementation/setup fee **$10,000–$20,000** one-time + **$2,000–$4,000/month** platform fee during the term.
- **Success fee during pilot:** none by default. A small success component may be considered later only after counsel review — never assumed.

### Tier 3 — Production SaaS
- **Base subscription:** tiered by claim-opportunity volume/month (not by seat), e.g.:

  | Tier | Claim opportunities / month | Illustrative base fee |
  |---|---|---|
  | Starter | up to 2,000 | $1,500/mo |
  | Growth | up to 10,000 | $4,000/mo |
  | Scale | up to 30,000 | $9,000/mo |
  | Enterprise | 30,000+ | custom |

- **Usage fee:** per claim opportunity processed beyond the tier's included volume, e.g. **$1.50–$3.00** per opportunity (price decreasing at higher committed volume).
- **Paid add-ons:** integration/connector setup, SSO, dedicated environment, premium SLA, advanced analytics — each priced and scoped separately, never bundled in "for free" to close a deal.

### Tier 4 — Verified-Recovery Add-on (counsel-gated; not yet offerable)
- **Concept only:** a fee tied strictly to *verified, incremental, attributable* payer recovery beyond a defined baseline, applied only after payment is confirmed and past the recoupment/refund window.
- **Explicit exclusions:** never applied to standard expected collections, valid patient responsibility, billed charges, or any amount the customer would have collected without MedFlow AI.
- **Status:** requires healthcare counsel sign-off on attribution methodology, baseline definition, and anti-kickback/fee-splitting exposure before it is ever quoted. Do not put this in a contract or a sales deck until that review is done.

### Tier 5 — Managed Operations Add-on
- **What:** optional human-assisted document QA, evidence follow-up, or submission support, sold as a capacity-bounded service (e.g., a monthly hour block), not unlimited support.
- **Price (illustrative):** $50–$75/hour, or a monthly block (e.g., 20 hours = $1,200/mo).

## 5. Pricing Mechanics — Summary

```text
Monthly revenue (production customer)
= base subscription (volume tier)
+ usage fee × (claim opportunities over tier allowance)
+ managed-ops hours × hourly rate (if purchased)
+ integration/SSO/SLA add-ons (if purchased)
+ verified-recovery fee (only once counsel-approved and contractually defined)
```

## 6. Illustrative Customer Invoice

**Customer:** Mid-size RCM outsourcer, Growth tier, month 4 of production (all figures illustrative).

| Line item | Detail | Amount |
|---|---|---|
| Platform subscription — Growth tier | up to 10,000 claim opportunities/mo included | $4,000.00 |
| Usage overage | 1,200 opportunities over allowance × $2.00 | $2,400.00 |
| Managed Operations add-on | 15 hours × $60/hr | $900.00 |
| SSO add-on | flat monthly | $250.00 |
| **Subtotal** | | **$7,550.00** |
| Verified-recovery fee | *not applicable — pending counsel review* | $0.00 |
| **Total due** | | **$7,550.00** |

Annualized run-rate for this one account: **~$90,600** before any recovery-fee line, before expansion, before add-on growth.

## 7. Unit Economics

```text
Gross profit  = revenue - variable AI/compute/storage/ops/integration costs
Gross margin  = gross profit / revenue
CAC payback   = CAC / monthly gross profit per customer
Cost per recovered dollar = variable cost / verified incremental recovery
Customer ROI  = (verified incremental recovery + labor savings - MedFlow fees) / MedFlow fees
```

**Illustrative scenarios for one Growth-tier account ($7,550/mo from § 6), gross-margin-only (excludes any recovery fee):**

| Scenario | Variable cost (compute/infra/support) as % of revenue | Gross margin | Notes |
|---|---|---|---|
| Conservative | 45% | 55% | Heavier managed-ops usage, higher LLM/infra cost per claim, more white-glove support in year 1. |
| Base | 30% | 70% | Typical SaaS+usage cost structure once workflows are templated. |
| Upside | 20% | 80% | Mature product, self-serve support, optimized inference cost. |

**CAC payback (illustrative):** assuming a $12,000 blended CAC (founder-led sales time + assessment discounting) and base-case monthly gross profit of ~$5,285 (70% × $7,550): payback ≈ **2.3 months** on this one account — but early CAC will likely be higher per logo while the motion is unproven, so treat 2–4 months as an optimistic base case and validate against actual sales-cycle cost.

**Customer ROI (illustrative):** if this customer's team recovers an estimated $35,000/month in incremental payer payments they'd have otherwise written off or recovered late, plus ~10 hours/week of staff time saved (~$2,000/month at a loaded rate), against $7,550/month in fees: ROI ≈ (35,000 + 2,000 − 7,550) / 7,550 ≈ **3.6x**. This number is illustrative only until a pilot produces a measured baseline.

## 8. Pilot Design

| Element | Definition |
|---|---|
| Term | 60–90 days, fixed end date |
| Scope | 1–3 named payers; 3–5 denial/underpayment categories; a claim-volume ceiling |
| Baseline | Customer's own last-90-days recovery rate, hours per case, and cycle time on the same claim population |
| Success metrics | Δ recovery rate, Δ hours/case, Δ time-to-resolution, appeal acceptance rate, false-positive rate on flagged opportunities |
| Support boundary | Defined hours of MedFlow implementation/support included; anything beyond is billed as Managed Operations |
| Exit criteria | Written conversion terms to production SaaS agreed *before* the pilot starts, so a good pilot has a pre-negotiated path to revenue |

## 9. Sales Process

1. **Outbound / warm intro** → RCM leaders, billing-software ecosystem contacts, healthcare ops consultants.
2. **Discovery call** — quantify their denial/underpayment volume, current workaround, and KPI ownership.
3. **Paid assessment** (Tier 1) — converts interest into a paid, evidence-backed opportunity map.
4. **Pilot proposal & contract** — scoped per § 8, priced per Tier 2.
5. **Paid pilot execution** — weekly check-ins against baseline metrics.
6. **Case study + conversion** — with customer permission, convert to annual Tier 3 production pricing.

## 10. 90-Day Commercial Plan

| Weeks | Focus | Target output |
|---|---|---|
| 1–3 | Customer discovery: 10–15 interviews with billing/RCM leaders | Validated pain ranking, refined ICP, message-testing notes |
| 3–5 | Build assessment offer collateral (one-pager, SOW template, pricing sheet) | Sellable Tier 1 offer |
| 4–8 | Sell and deliver 2 paid assessments to design-partner candidates | 2 completed opportunity maps; signed pilot proposals |
| 8–12 | Launch 1–2 paid pilots against § 8 design | Pilots underway with baseline metrics captured |
| Ongoing | Track funnel metrics (§ 11) weekly; adjust pricing/packaging from real objections | Weekly commercial scorecard |

## 11. Metrics to Track

Eligible dollars, predicted recoverable dollars, verified recovered dollars, recovery rate, time to resolution, hours per case, appeal acceptance rate, false-positive rate, cost per recovered dollar, gross margin, logo retention, net revenue retention, customer payback.

## 12. Risks and Validation Experiments

| Risk | Validation experiment |
|---|---|
| Billing companies won't share claims/remit data without a BAA and security review up front | Test willingness to sign a BAA and share a redacted sample during discovery calls, before building the assessment offer further |
| Verified-recovery fee model has fee-splitting / anti-kickback exposure | Get a qualified healthcare-counsel opinion before it ever appears in a proposal; do not let sales momentum outrun this |
| Healthcare buyers have long, risk-averse sales cycles | Measure actual cycle time on the first 3–5 assessment conversations; adjust the 90-day plan's cadence accordingly |
| Buyers distrust an AI's "recoverable $" number | Lead every assessment deliverable with source-traceable evidence per claim, not just a headline number, to build trust before asking for pilot budget |
| Assessment fee ($5K–$10K) is a barrier to first conversations | If the first 5 prospects all balk, test a lower-priced or narrower-scope assessment tier rather than making it free |

---

## What is decided

- Three-tier sequential motion: paid assessment → paid pilot → production SaaS.
- Production pricing = base subscription by volume tier + per-claim-opportunity usage, not per-seat.
- Managed Operations is a separately priced, capacity-bounded service, not included support.
- Verified-recovery fee is a framework only — not to be quoted or contracted until counsel review is complete.

## What is still unknown

- Actual willingness-to-pay at the $5K–$10K assessment price point (unvalidated).
- Real CAC and sales-cycle length for this specific ICP (founder has not yet run a full cycle).
- Whether counsel will permit any form of recovery-based fee, and under what structure.
- Which 1–3 payers and denial categories the first design partners will actually want scoped into a pilot.

## The single next action

Run 10–15 discovery calls with billing/RCM leaders in the next 2 weeks to pressure-test the ICP, the pain ranking, and reactions to the paid-assessment price point, before building further sales collateral.
