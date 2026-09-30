# ORYN — Founder Decisions

| | |
|---|---|
| Decision owners | Elnatan, Orian, Shoval |
| Status | Open |
| Last updated | 2026-09-30 |
| Related | [01 PRD](01-product-requirements.md) · [07 Research plan](07-research-plan.md) · [08 Invention record](08-invention-record.md) |

Each item lists context, options, and a recommendation. Record the final decision, the date, and who decided in the table in §13.

---

## 1. Final logo asset

**Context.** No logo file was supplied in the repository. v1 uses a **placeholder text wordmark** ("ORYN") in the app and on recipient pages.

**Options.**
- A. Keep the wordmark for launch.
- B. Commission a logo from a designer (company holds full rights via written assignment).
- C. Design in-house.

**Recommendation.** B, with a written IP assignment to the company. Deliver SVG + PNG in light/dark variants, a square app icon (512px, maskable), and a favicon. Keep the wordmark until then.

## 2. Production hosting and database provider

**Context.** v1 runs on Next.js with Postgres (an embedded Postgres is used for local development). Production needs a managed host and a managed Postgres database, both in **company-owned accounts**.

**Options.**
- A. Managed Next.js host + separate managed Postgres provider.
- B. A single cloud provider for both (more setup, more control).
- C. Self-managed servers (not recommended at this stage).

**Recommendation.** A, created under a company email and company billing, with automated backups, point-in-time recovery, and a region chosen with data-residency needs in mind. Separate staging and production databases.

## 3. Email provider (sign-in and notifications)

**Context.** Sign-in links, connection request notifications, and follow-up reminders need reliable transactional email.

**Options.** Any established transactional email provider with a sending domain verified via SPF, DKIM, and DMARC.

**Recommendation.** Choose one provider, send from a subdomain (e.g. `mail.<domain>`), keep templates in the repo, and never send marketing email from the transactional stream. Recipients who are not users never receive email unless they sent a connection request and asked for a reply by email.

## 4. Payment provider

**Context.** Plans are capability levels; prices live in a plan catalog editable by admins.

**Options.**
- A. Stripe (subscriptions, invoices, tax tooling, customer portal).
- B. A merchant-of-record provider (handles sales tax/VAT as reseller; higher fees).
- C. Other regional providers.

**Recommendation.** A for speed of integration, unless counsel/accountant advise that a merchant-of-record model is simpler for your tax situation — in which case B. Map provider products to plan catalog entries; the catalog stays the source of truth for capabilities.

## 5. Pricing (after research)

**Context.** No prices are set. The research plan runs a Van Westendorp pricing probe and capability ranking.

**Options.** Per-user monthly for Pro; per-seat or per-event for Business; custom for Enterprise.

**Recommendation.** Decide after week 6 of research. Start with a small number of prices, set within the acceptable range found, and revisit after 90 days of conversion data (see [06-analytics.md](06-analytics.md)).

## 6. Wallet pass certificates

**Context.** Wallet passes are **simulated in v1**. Real Apple Wallet passes require a pass type ID and signing certificate from an Apple Developer account; Google Wallet requires an issuer account.

**Options.** Enroll now; enroll after launch; skip wallet passes.

**Recommendation.** Enroll the **company** (not an individual founder) in the Apple Developer Program as an organization (requires a legal entity and D-U-N-S number) and create a Google Wallet issuer account under the company. Store certificates in the company secret manager. Ship real passes in v1.x once research confirms demand.

## 7. Native app timing

**Context.** v1 is a PWA. Some activation methods (quick-settings tile, deeper NFC, reliable background features) need native apps.

**Options.** Native at launch; native after product-market signals; wrapper app first.

**Recommendation.** Stay PWA through research and early launch. Revisit when 7-day return and repeat usage are stable and activation research shows a native-only method matters.

## 8. Domain

**Context.** Recipient links (`/c/[token]`, `/q/[code]`) will be printed on stations and shared widely; changing the domain later breaks printed codes.

**Recommendation.** Register the primary domain and a short domain for links, both in a **company-owned registrar account** with 2FA, auto-renew, and registrar lock. Decide the final domain before printing any station codes.

## 9. Legal: privacy policy and terms

**Context.** ORYN handles personal data of users and, when they choose, of recipients.

**Recommendation.** Have **qualified counsel** draft the privacy policy, terms of service, acceptable use policy (including harassment rules), and data processing terms for Business/Enterprise. Do not publish self-written legal text or make compliance claims until counsel approves. Share the analytics privacy rules ([06-analytics.md](06-analytics.md) §1) with counsel as input.

## 10. Data retention defaults

**Context.** The Free plan shows 30 days of history; Enterprise offers custom retention.

**Options (proposal).**

| Data | Proposed default |
|---|---|
| Anonymous share counts | Aggregated; raw events kept 13 months |
| Expired / revoked share sessions | Deleted 30 days after end |
| Connection requests declined | Deleted after 30 days |
| Accepted connections, notes, follow-ups | Until the user deletes them or their account |
| Abuse reports | Kept per counsel's advice |
| Deleted accounts | Removed within 30 days, except backups rolling off within 35 days |

**Recommendation.** Adopt the table above as a starting point, confirm with counsel, and expose it in the Data & privacy center.

## 11. Personal / romantic mode at launch

**Context.** The store scenario can help someone start a conversation without interrupting, but carries real risk of unwanted attention and harassment. The research plan includes a dedicated safety track.

**Options.**
- A. Ship at launch with the full safety set.
- B. Ship later, after safety research and a limited beta.
- C. Do not offer it.

**Minimum safety set if shipped:** Instant View only; one-time access and short duration by default; no sender-visible "opened" count (to be decided by research); silent "Not interested"; report on every recipient screen without an account; block for signed-in recipients; rate limits per sender; minimum age requirement; abuse review process with named owner and response time.

**Recommendation.** B. Launch with Professional, Business, Event, Social, Creator, Hiring, and Custom modes. Enable Personal mode only after the research go/no-go criteria are met.

## 12. Company ownership checklist

Everything that runs ORYN must belong to the company, not to individuals.

- [ ] Company legal entity formed; founders' IP assigned to the company in writing.
- [ ] Source repositories in a company-owned organization; founders as members, not owners of personal repos.
- [ ] Hosting, database, email, payment, analytics, and error-monitoring accounts registered with company email and billing.
- [ ] **No production database in any personal account.**
- [ ] Domains in a company registrar account, 2FA, auto-renew, lock enabled.
- [ ] Secrets (token signing keys, API keys, certificates) in a company secret manager; none in the repo or personal password managers only.
- [ ] Apple Developer and Google Wallet issuer accounts under the company.
- [ ] At least two founders with admin access to every critical account; recovery codes stored securely.
- [ ] Contractor agreements with IP assignment for any designer or engineer.
- [ ] Invention record ([08](08-invention-record.md)) kept in the company repo and reviewed with counsel.

## 13. Decision log

| # | Decision | Chosen option | Date | Decided by |
|---|---|---|---|---|
| 1 | Logo | | | |
| 2 | Hosting & database | | | |
| 3 | Email provider | | | |
| 4 | Payment provider | | | |
| 5 | Pricing | | | |
| 6 | Wallet certificates | | | |
| 7 | Native app timing | | | |
| 8 | Domain | | | |
| 9 | Legal documents | | | |
| 10 | Retention defaults | | | |
| 11 | Personal mode at launch | | | |
| 12 | Ownership checklist complete | | | |
