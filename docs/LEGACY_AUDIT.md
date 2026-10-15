# Legacy audit — business-card prototype (v0)

| | |
|---|---|
| Audited | 2026-09-30 |
| Code audited | `legacy/business-card-v0/` (identical to commit `6ae925a`) |
| Untouched backup | Branch `backup/pre-oryn-v1-2026-09-30` → exactly commit `6ae925a`, before any ORYN v1 change |
| Status of the code | Preserved unchanged. It is **not** compiled, linted, deployed or imported by ORYN v1 (`tsconfig.json` excludes `legacy/`). |
| Stack | Next.js 15, Supabase (auth + Postgres + RLS), Tailwind, framer-motion, recharts, qrcode |

Nothing in this audit has been deleted. The "must be deleted" list below is a **recommendation** for the founders. Deletion should happen only after approval, and only if the legacy Supabase project ever held real data.

## 1. What exists and works

| Area | Files | Works? | Notes |
|---|---|---|---|
| Sign up / sign in | `app/(auth)/login`, `app/(auth)/signup`, `lib/supabase/*` | Yes, with a configured Supabase project | Uses Supabase Auth (email + password). |
| Profile row on sign-up | `supabase/schema.sql` → `handle_new_user()` trigger | Yes | Generates a username from the email prefix. |
| Public card page | `app/[username]/page.tsx` | Yes | Shows **every** profile field publicly (see security §5). |
| Lead form on the public card | `components/leads/LeadCapture.tsx`, `app/api/leads/route.ts` | Yes | Anyone can submit; no rate limit. |
| Dashboard, card editor, leads list, analytics charts, settings | `app/(dashboard)/*` | Yes, reading real rows | Auth checked in the layout and pages. |
| QR image for a username | `app/api/qr/[username]/route.ts` | Yes | Stateless PNG; cached publicly for a day. |
| Admin page | `app/admin/page.tsx` | Yes | Checks `profiles.is_admin` (which users can set themselves — see §5). |
| Middleware | `middleware.off.ts` | **Disabled** | Renamed to switch it off in the last commits. |

## 2. What is demo or fake data

These parts show numbers or people that do not exist, presented as if they were real product activity.

| Where | What is fake |
|---|---|
| `components/onboarding/OnboardingFlow.tsx` (the `/create` page) | `FAKE_VIEWERS`: seven invented people with real-company names (Blackstone, LVMH, Sequoia, ADIA, Barclays, Ferrari, SoftBank), shown as live "viewed your card" notifications on timers. Also a fake view counter, a fake lead counter, and a "wallet UI mockup". |
| Same flow | **Nothing is saved.** The onboarding never writes to the database. It animates "Publishing your profile…" and then sends the user to `/dashboard`. |
| `app/page.tsx` (landing) | `DEMO_PROFILE` (a fictional managing director at a named capital firm) presented as a card, plus floating stats "↑ 2,847 views this month" and "12 new leads today". Also "Join thousands of executives…" with no user base behind it, and fixed prices ($12 / $49) that were never researched. |
| `app/api/wallet/apple/route.ts`, `app/api/wallet/google/route.ts` | Return a JSON description of a pass instead of a real pass. There is no signing and no certificates. |

## 3. What must be deleted (recommendation — needs founder approval)

1. **The fake-activity code** in `OnboardingFlow.tsx`, including the fake viewers, counters and notifications. It misrepresents product activity and names real companies without permission. It is already out of the running product. Recommendation: keep it only in the backup branch and remove `legacy/business-card-v0/components/onboarding/` from the main line.
2. **The landing claims** in `app/page.tsx` ("2,847 views", "12 new leads today", "thousands of executives", prices). Same treatment.
3. **Any stored `card_views.viewer_ip` data**, if the legacy Supabase project was ever used with real visitors. Delete the column's data, or the whole table, in that project. This is the most important item if real data exists.
4. **The legacy Supabase project itself**, if it was created in a personal account. Company data must not live in personal accounts. Export anything needed first, then shut it down.
5. The legacy **Vercel project and environment variables**, if they belong to a personal account. Recreate them under the company.

## 4. What can be reused

| Item | Reuse? | How |
|---|---|---|
| General ideas: public profile page, QR for a link, lead form, wallet pass intent | Concepts only | Already superseded by the Capsule / Share Session / Connection Request model. |
| `qrcode` dependency | Yes, already reused | ORYN v1 generates QR SVGs server-side. |
| Wallet pass field layout (`app/api/wallet/*`) | As a reference only | Useful when the company obtains Apple and Google issuer accounts. It must be rebuilt with proper signing and must not expose unlisted fields. |
| Supabase as a **Postgres host** | Optional | ORYN v1 works on any Postgres, Supabase included, through `DATABASE_URL`. Supabase Auth and the RLS policies below should **not** be reused as they are. |
| Visual design (gold/obsidian "luxury card") | No | ORYN's visual language is electric blue / navy / white / soft blue, and the product is no longer a card. |
| UI components (`Button`, `Input`, `Badge`, `BusinessCard`) | No | Replaced by the v1 components. |

## 5. Security and privacy risks in the legacy code

Ordered by severity. None of these exist in ORYN v1. The last column says how v1 avoids each one.

| # | Risk | Where | Impact | ORYN v1 |
|---|---|---|---|---|
| 1 | **Privilege escalation to admin.** The RLS policy "Users update own profile" allows `UPDATE` on the user's own row with no column limit, so any user can set `is_admin = true` and `plan = 'elite'` from the browser with the anon key. | `supabase/schema.sql` | Full admin console access; free paid plans | Admin flag and plan are server-only columns. Every action is authorized on the server; there is no client-side database key. |
| 2 | **IP address logging of every card visitor.** `viewer_ip` is taken from `x-forwarded-for` and stored in plain text, together with device, browser and referrer. | `app/[username]/page.tsx` (`trackView`), `app/api/analytics/track/route.ts`, `card_views` table | Personal data collected about people who never agreed to it | No IP, fingerprint or location is stored for recipients. Rate-limit buckets use a keyed hash of the IP that is never stored as an IP. |
| 3 | **All profile fields are public.** The policy "Public profiles viewable" plus `select('*')` expose email, phone, `is_admin`, plan and counters for every active user. The owner can't choose what is visible. | `supabase/schema.sql`, `app/[username]/page.tsx` | Contact details can be scraped by username | Per-field layers. Only the chosen fields leave the server, through one projection function, and this is tested. |
| 4 | **Anyone can write analytics and leads.** `INSERT` policies are `WITH CHECK (true)`, `/api/analytics/track` accepts any `profile_id`, and there is no rate limiting. | `schema.sql`, `app/api/analytics/track`, `app/api/leads` | View counts can be inflated; lead-form spam or harassment | Postgres-backed rate limits; counters change only through signed share links; reporting and silent decline exist. |
| 5 | **Wallet endpoint leaks full profiles.** `GET /api/wallet/apple?id=<uuid>` returns name, title, company, email and phone for any profile ID, and uses `base64(profile_id)` as its "authentication token". | `app/api/wallet/apple/route.ts`, `google/route.ts` | Data exposure; a predictable token | Wallet passes are behind a flag that is off until real certificates exist. |
| 6 | **Middleware disabled.** Route protection lives only in individual pages. | `middleware.off.ts` | Easy to add an unprotected page by mistake | The workspace layout enforces sign-in for every page, and each server action re-checks it. |
| 7 | **Permanent, guessable links.** Cards live at `/<username>` (derived from the email prefix), with no expiry and no way to revoke a share. | routing | Anyone who once had the link keeps access; usernames reveal email prefixes | Signed, expiring, revocable share links; one-time links. |
| 8 | **No security headers** (CSP, frame, nosniff) and a public 24-hour cache on the QR route. | `next.config.ts`, QR route | Clickjacking and XSS hardening missing | Full header set; `no-store` + `noindex` on capsule links. |
| 9 | **Real company names in fake data** (see §2). | `OnboardingFlow.tsx` | Misleading; possible trademark and false-endorsement exposure | No real-company names; demo data is fictional and labelled. |

**Secrets check.** I searched the full git history for private keys, API tokens and service-role keys. None were committed. `.env.example` contains placeholders only. If a legacy Supabase project exists, rotate its keys anyway before shutting it down, because they may have been shared outside git.

## 6. Recommended actions (for founder approval)

1. Confirm whether the legacy Supabase project ever held **real** users or visitors. If yes: export what is needed, delete `card_views.viewer_ip` data, rotate keys, and decide whether to notify affected users (ask counsel).
2. Confirm who owns the legacy Supabase and Vercel accounts. Move them to company ownership or shut them down.
3. Approve removing the fake-data files from the main line (they stay in the backup branch).
4. Keep `legacy/` read-only until those decisions are made.
