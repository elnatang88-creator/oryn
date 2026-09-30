# ORYN — Product decisions

| | |
|---|---|
| Decision owners | Elnatan, Orian, Shoval |
| Status | **Part A: awaiting approval. Part B: open.** |
| Last updated | 2026-09-30 |
| Related | [PRD](PRD.md) · [MVP scope](MVP_SCOPE.md) · [Security model](SECURITY_MODEL.md) · [Research plan](RESEARCH_PLAN.md) · [Invention record](INVENTION_RECORD.md) |

**Part A** lists decisions already built into the product. Each needs your approval, or a change request. **Part B** lists decisions only you can make. Record every outcome in the log at the end.

---

# Part A — Decisions built into v1 (approve or change)

| # | Decision | Why | Main alternative | Cost to reverse |
|---|---|---|---|---|
| A1 | **Web first.** The recipient experience is a web page. No app is needed to view, save or ask to connect. | The recipient must never be forced to download anything; the web works on every phone today. | Native app first | Low. Native apps can be added on top of `/api/v1`. |
| A2 | ~~**The sender sees counts, never who.**~~ **Changed by the founders on 2026-09-30, see below and the decision log.** Original text: Opening, "Learn more", saving and keeping are counted anonymously. A recipient becomes identifiable only by sending a connect request. | This is the core promise: the other person decides. It also avoids tracking people who never agreed. | Show senders who viewed (a common category pattern) | Medium. It would break the privacy promise and need a consent flow. |
| A3 | **Declining is silent.** "Not now" on a request is never communicated; closing the capsule is never reported. | No pressure, no awkwardness; especially important in personal moments. | Notify on decline | Low |
| A4 | **Recipients see the live capsule.** Edits and revocation apply to links already shared. | "Always reversible" requires it. | A snapshot at share time | Medium |
| A5 | **One-time capsules open only on a deliberate tap.** Link previews and prefetch can never use up the single view. | Chat apps pre-open links; without this, "opens once" would silently fail. | Open on first page load | Low |
| A6 | **Safety and privacy are never paywalled.** Stopping shares, expiry, "opens once", export and deletion are on every plan. | Trust. Safety cannot depend on payment. | Gate expiry and one-time behind Pro | Low, but not recommended |
| A7 | **Plans are capability sets. Prices stay unset until research.** Limits and price labels are data editable in `/admin`. Billing is simulated until a provider is chosen. | You asked not to lock prices before user research. | Hard-coded tiers | — |
| A8 | **"Double press" is not promised.** Activation is one tap on Share, a home-screen shortcut, a QR, an NFC tag or a station. OS-level triggers are validated per device before being claimed. | Honesty about what the operating systems allow. | Market "double press" now | — |
| A9 | **Portable infrastructure.** Standard Node.js + standard PostgreSQL. Our own sessions and authorization. No vendor-specific auth or queue. | Full company ownership of code, data and infrastructure, and freedom to move hosts. | A backend-as-a-service (like the legacy Supabase setup) | High once real users exist |
| A10 | **No IP addresses stored.** Rate limiting uses a keyed hash. | Privacy by default; the legacy code stored raw IPs. | Store IPs for fraud analysis | Low |
| A11 | **Personal/romantic capsules default to "open for 1 day"** and show a gentle tip to share little. | Safety in the store scenario. | Same defaults as professional | Low |
| A12 | **Legacy code preserved, not deleted.** It lives in `legacy/` plus the backup branch `backup/pre-oryn-v1-2026-09-30`. See [LEGACY_AUDIT](LEGACY_AUDIT.md). | Nothing destructive without approval. | Delete it | — |
| A13 | **Demo data is fictional, local only, and always labelled.** It lives on the `.local` domain, shows a "Demo account" banner, is never seeded in production, and has no password in the repo. | Never present invented data as real product data. | — | — |
| A14 | **Proposed, not yet applied: MVP = the 8-step vertical slice** in [MVP_SCOPE](MVP_SCOPE.md). On approval, the already-built events, stations, teams and insights screens will be hidden behind one feature flag. Their code stays. | Ship a polished core first. | Launch everything built | Low |

---

# Part B — Open decisions (only the founders can make these)

### A2 as changed (2026-09-30)

- **Signed-in ORYN member opens a capsule:** the owner can see that member's ORYN profile (display name, one-line headline, chosen field), which capsule, how many times, and whether they chose "Learn more".
- **The member is always told first.** A note above the card reads "You're signed in as X. Y can see that you viewed this." with a link to change it.
- **Opt-out:** Settings → Your ORYN profile → "View privately". The owner then gets only an anonymous count.
- **No account:** unchanged, anonymous counts only. No IP, device or location is stored.
- **Detail taps** (a phone, email, link) are recorded only as the *kind* of detail, never by whom, and only for details that person could see.
- **Plan:** names, fields and interest analytics are Pro/Business/Enterprise (`insights.viewers`). Free owners see the counts and how many were members.
- **Open for counsel:** this is personal data about the viewer; the privacy policy must describe it and the lawful basis (notice + opt-out vs. opt-in) must be confirmed for EU/IL users before launch.

## 1. Final logo asset

**Status (2026-09-30): partly resolved.** The founders supplied a logo file. Its symbol (two interlocking blue shapes) is used as ORYN's mark. The file's wordmark reads **"ORIAN", not "ORYN"**, so, by founder instruction, the app uses:

- **Symbol:** vectorised from the supplied PNG (`public/brand/oryn-mark.svg`), colour `#0053FD`.
- **Wordmark:** "ORYN" built from the same file's letterforms. O, R and N are traced from it; **Y was constructed** to match the stroke width and cap height, because the source has no Y. Colour `#011441`.
- **Files:** `oryn-logo.svg` (navy text), `oryn-logo-white.svg` (for dark backgrounds), `oryn-mark.svg`; app icons `icon-192/512.png` and `app/apple-icon.png`. The UI palette now matches the logo exactly (electric `#0053FD`, navy `#011441`).
- The "ORIAN" source file is **not** committed to the repository, to avoid confusion about the product name.

**Still needed.**
- The designer's original vector files (SVG/AI/Figma) and font name, so the tracing is replaced with the source artwork.
- Confirm or redraw the Y.
- A written assignment of the logo's IP to the company.
- Check that the name and mark are free to use (trademark search, with counsel).

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

**Recommendation.** Decide after week 6 of research. Start with a small number of prices, set within the acceptable range found, and revisit after 90 days of conversion data (see [ANALYTICS.md](ANALYTICS.md)).

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

**Recommendation.** Have **qualified counsel** draft the privacy policy, terms of service, acceptable use policy (including harassment rules), and data processing terms for Business/Enterprise. Do not publish self-written legal text or make compliance claims until counsel approves. Share the analytics privacy rules ([ANALYTICS.md](ANALYTICS.md) §1) with counsel as input.

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
- [ ] Invention record ([08](INVENTION_RECORD.md)) kept in the company repo and reviewed with counsel.

## 13. Decision log

| # | Decision | Chosen option | Date | Decided by |
|---|---|---|---|---|
| A1–A14 | Part A decisions (approve / change each) | | | |
| A2 (changed) | Who viewed you | Signed-in ORYN members who open a capsule are shown to the owner by profile (name, one line, field) unless they chose "view privately". They are told on the capsule page before the content, every time. People without an account stay anonymous counts. Names, fields and tap analytics are Pro (`insights.viewers`); Free sees counts. | 2026-09-30 | Founders (via chat): "מי שצפה בפרופיל והוא חלק מהאפליקציה אז רואים את הפרופיל שלו" |
| 1 | Logo | Founders' symbol + reconstructed ORYN wordmark (interim) | 2026-09-30 | Founders (via chat) |
| 6a | Phone-to-phone | #1 ORYN-to-ORYN Nearby first; #3 Apple/Google Wallet as part of the same identity. No physical NFC cards or native Android NFC now. See [NEARBY_AND_WALLET](NEARBY_AND_WALLET.md). | 2026-09-30 | Founders (via chat) |
| — | Nearby location data | **Open for legal review:** coarse ~150 m cell computed on the phone, kept ≤2 minutes while Share/Nearby is open, opt-in. Confirm notice/consent wording and lawful basis per region before launch. | | |
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
