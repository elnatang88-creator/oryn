# ORYN v1 — MVP QA report

| | |
|---|---|
| Date | 2026-09-30 |
| Branch | `oryn-v1` |
| Build tested | Production build (`next build` + `next start`), fresh embedded Postgres per run, demo data seeded and labelled |
| Devices | **iPhone profile:** 390×844 px, 3× pixel density, touch, iPhone user agent, rendered by Chromium. **Android phone:** Pixel 7 profile. **Desktop:** 1360×900. WebKit (Safari's engine) is not installed in this environment. |
| Final result | **48 tests (29 unit/integration + 19 end-to-end), each run on two databases = 96 runs: 96 passed, 0 failed.** Typecheck, lint and production build clean. Deployment smoke check: 13/13 against a local production-mode server. See §7. |
| Verdict | **Ready for a local demo only** (a laptop, or two phones once there's an online link). **Not verified for staging, and not production-ready.** No isolated staging environment has been checked yet (environment variables, database permissions, TLS, deployment protection). See §7. |

Screenshots: `docs/screenshots/qa-*.png` (iPhone), `phone-*.png`, `desktop-*.png`. Tests: `tests/e2e/qa.spec.ts`, `tests/e2e/demo.spec.ts`, `tests/unit/*`.

## 1. The 14-step flow

"First run" is the result the first time the scenario ran after this QA pass began. "Final" is after fixes.

| # | Scenario | Test | First run | Final | Evidence |
|---|---|---|---|---|---|
| 1 | Sign up / sign in | QA-01, demo.spec | Pass | **Pass** | Sign-up with a Hebrew name → capsule creation |
| 2 | Create an Identity Capsule | QA-01 | Pass | **Pass** | `qa-01-editor-hebrew.png` |
| 3 | Choose exactly which details are visible | QA-01 | Pass | **Pass** | Email set to "On Learn more", website and phone "Not shared" |
| 4 | Create a Shared Session | QA-01 | Pass | **Pass** | Tap → live QR in **175–206 ms**. The QR decoded from the screen's pixels equals the link. `qa-02-share-screen.png` |
| 5 | Open on another device, no forced sign-up | QA-01, QA-M2 | Pass | **Pass** | Separate browser context, never signed in |
| 6 | Recipient sees only the approved Layer 1 | QA-01 | **Fail** (RTL) | **Pass** | Exactly `role, company, social`. Raw HTML contains none of the hidden details. `qa-03-recipient-layer1-hebrew.png` |
| 7a | Learn more | QA-01 | Pass | **Pass** | Adds exactly `email`; hidden phone still absent |
| 7b | Save | QA-01 | **Fail** (file name) | **Pass** | vCard `נועה אדלר.vcf` contains only permitted details |
| 7c | Connect | QA-01, QA-M2 | Pass | **Pass** | Works with and without JavaScript. `qa-04-recipient-request-sent.png` |
| 7d | Keep for later ("Keep in ORYN") | QA-01 | Pass | **Pass** | Recipient signs up in their own browser → kept → **still there after refresh** |
| 8 | Sender sees the connection in the Workspace | QA-01 | Pass | **Pass** | Today → "Waiting for you" → Connect → contact page; **persists after refresh**. `qa-05-today.png` |
| 9 | Private note + follow-up | QA-01 | Pass | **Pass** | Hebrew note and follow-up persist after refresh; note shown right-to-left. `qa-06-contact-note-followup.png` |
| 10 | Recipient never sees private data | QA-01 | Pass | **Pass** | Checked in HTML, the public JSON API and the vCard, before and after the sender added notes |
| 11 | Expired Shared Session is blocked | QA-11 + unit | Pass | **Pass** | "This capsule has closed" after the event ends; forged expiry refused. `qa-07-expired.png` |
| 12 | One organization can't read another's data | QA-12 + unit | Pass | **Pass** | 6 direct URLs → "Nothing here"; lists never show the other org; API 404 |
| 13 | Plan gates enforced on the server | QA-13 + unit | Pass | **Pass** | Direct API call → **402** "More than one capsule is part of Pro." |
| 14 | Account deletion leaves no access | QA-14 + unit | **Fail** (security) | **Pass** | See SECURITY_TEST_REPORT SEC-1…3. Wrong password refused; afterwards signed out, API 401, sign-in fails, link dead |

## 2. Mobile checks

| Check | Test | First run | Final | Result |
|---|---|---|---|---|
| iPhone screen size (390×844), no sideways scrolling | QA-01, QA-M4 | **Fail** | **Pass** | Checked on 11 screens |
| One-handed use | QA-01, QA-M4 | Pass | **Pass** | Share button bottom-centre (y ≈ 752–844 of 844). Learn more / Save / Connect visible without scrolling. All action buttons ≥ 40 px (see §5 for small text links) |
| Slow loading | QA-M2, demo.spec | Pass | **Pass** | Throttled to 400 kbps / 400 ms latency: Instant View visible in **0.6–1.5 s** |
| Link opened without signing in | QA-01, QA-M1, QA-M2 | Pass | **Pass** | |
| No-registration mode | QA-M2 | **Fail** (rate limit) | **Pass** | View, Learn more and Connect all work **without JavaScript** |
| Clear, non-technical errors | QA-M3 | **Fail** (form cleared) | **Pass** | 6 messages checked against a list of technical terms; see §4 |
| RTL and Hebrew | QA-01 | **Fail** | **Pass** | Hebrew names, messages, notes and fields are right-to-left in display and while typing. **The interface itself is English** (see §5) |
| Real Share button | QA-01 | Pass | **Pass** | "Send link" calls the system share sheet with the exact link. "Copy" is the fallback |
| QR destination | QA-01, QA-M1 | Pass | **Pass** | Share QR and station QR decoded from pixels. `/q/harbordemo` opens the booth's capsule with the demo label. `qa-08-station-demo.png` |
| Connection saved after refresh | QA-01 | Pass | **Pass** | Sender side and recipient ("Keep") side |

## 3. Failures found and what was done

| # | Failure | Severity | What we saw | Fix | Status |
|---|---|---|---|---|---|
| F1 | **Account deletion could delete a different user, or other users' data in an org, and wasn't re-authenticated** | Critical | Unit reproductions `REPRO-1/2/3` failed. User B was deleted by A's request. | Rewritten deletion; password required; full-coverage tests. Details: SECURITY_TEST_REPORT | Fixed |
| F2 | **Hebrew displayed left-to-right** | High (Hebrew-speaking market) | Recipient name had computed `direction: ltr`. Punctuation and mixed text were misplaced. | `dir="auto"` on every piece of user-written text and on all text inputs. Direction follows the content. | Fixed |
| F3 | **Share screen scrolled sideways on phones** | Medium | Page 392 px wide on a 390 px screen. Failure screenshot: the pulsing ring around the QR grew to 150% and crossed the screen edge. | Pulse capped at 112%; share screen clips horizontally | Fixed |
| F4 | **A failed form erased what the person typed** | Medium | After "Add one way to reach you.", the name field was empty (React 19 resets forms after every action). | `ActionForm` submits in a transition, so values persist on error; fields clear only on success where intended | Fixed (with JavaScript). Without JavaScript the page reloads empty; see §5 |
| F5 | **Real people blocked at a venue** | Medium | Screenshot: "Too many attempts" on the connect form. Every test phone shared one IP, just like a conference Wi-Fi. | Per-browser-per-link limit; venue-scale per-IP ceilings; new test with 30 phones on one IP | Fixed |
| F6 | **Hebrew contact file name lost** | Low | Hebrew letters were stripped, so the file was `contact.vcf`. | Unicode-safe name + RFC 5987 `filename*` header. (The test machine also needed a UTF-8 locale for Chromium to save Hebrew file names; real phones have one.) | Fixed |
| F7 | Demo people shown to recipients without a label | Low | The station capsule showed a fictional "Noa Adler" as if real | "Demo capsule — this is a fictional person" banner; excluded from metrics | Fixed |
| F8 | Template labelled a social link "LinkedIn" by default | Low | A user typing an Instagram link saw "LinkedIn" | Neutral "Profile link" label | Fixed |
| F9 | English quote marks around a Hebrew message landed at odd ends | Low | Visual | Quotes removed; the message box sets it apart | Fixed |
| T1–T4 | Test-script errors (ambiguous selector, reading a message too early, signed-in tester, shared demo link) | — | Not product bugs | Tests corrected | Fixed |

## 4. Error messages checked (all plain language)

- "That email and password don't match."
- "“Work email” needs to be an email address."
- "“Profile link” needs to be a web address."
- "Add one way to reach you."
- "This link doesn't open a capsule — It may be mistyped, or it no longer exists."
- "Nothing here — This page doesn't exist, or you don't have access to it."
- Also seen in tests: "That password isn't right.", "More than one capsule is part of Pro.", "Too many attempts. Please wait a moment and try again."

## 5. Still missing — before a demo, and before real users

| # | Item | Severity | When |
|---|---|---|---|
| R1 | **Real-device pass** on a physical iPhone (Safari) and Android (Chrome): scanning the QR with the camera app in bright and dim light, the share sheet, saving the contact file, one-handed use, Hebrew keyboard input | High | **Before demo** |
| R2 | **Hebrew interface.** All buttons, labels and messages are English. Hebrew *content* works fully and right-to-left. A Hebrew UI (translation + `dir="rtl"` layout) is new work that needs your approval. | High for an Israeli audience | Before demo, if the demo is in Hebrew |
| R3 | WebKit/Safari engine not tested automatically | Medium | Covered by R1 for the demo |
| R4 | Deletion gaps from MVP_SCOPE: deleting a single connection (today it's archived), a follow-up, a capsule (archived), a received request | Medium | Before real users |
| R5 | Without JavaScript, a form with an error reloads empty (with JavaScript it keeps values) | Low | Later |
| R6 | Small text links under 44 px tall: "All requests", "Everyone", "Share now" (on Today), "Report a problem", the notification link, "Privacy notice"; the note delete button is 40×40 | Low | Before real users |
| R7 | Dates show in US format (10/01/2026) | Low | With R2 |
| R8 | "Where are you?" on the share screen needs a scroll on a small iPhone; Stop sharing is below it | Low | Later |
| R9 | Items from SECURITY_TEST_REPORT §4 (pen test, production Postgres, proxy IP trust, RLS, 2FA) | — | Before real users / business data |

## 6. Command failures during QA — none hidden

Every command that exited non-zero while this QA was being done (tool runs, not only tests), with a classification and the re-run.

| # | Command (what it was for) | Exit / error | Classification | Re-run after fix |
|---|---|---|---|---|
| C1 | `grep … .next/server/app/today/page.js.nft.json` (check SQL migrations ship in the build) | 2: no such file | **Wrong command.** The pages live under `app/(app)/…`, so the build path is `.next/server/app/(app)/today/…` | Correct path: `db/migrations/0001_init.sql` is in the trace. **Pass.** No product change needed |
| C2 | `initdb -D /tmp/claude-0/pg/data` (start a real PostgreSQL for testing) | 1: Permission denied | **Environment.** `/tmp/claude-0` is `root`-only (mode 700), so the `postgres` user can't enter it | Re-run in `/var/tmp/orynpg`: PostgreSQL 16.13 running. **Pass** |
| C3 | `npm run verify:env` (first run of the new deployment check) | 1: TypeScript syntax error | **Real bug in my new script** (`if … else` on one line) | Fixed; typecheck and lint clean; check runs. **Pass** |
| C4 | `pkill -f …` inside a combined command (twice, earlier in QA) | 144 | **Tooling.** The pattern also matched the shell running it, which killed itself | Replaced by `fuser -k <port>`; later runs clean |
| C5 | Ad-hoc download probe using `.tap()` | Error: page does not support tap | **Wrong command** (context created without touch) | Re-run with click and touch: file name correct. **Pass** |
| C6 | Chromium download of a Hebrew file name | Saved as `download` | **Environment.** The container has no UTF-8 locale | With `LANG=C.UTF-8` (as on real phones): `נועה אדלר.vcf`. Test browser configured accordingly |
| C7 | Test failures F1–F9 and T1–T4 (§3) | Test assertions | Real product bugs (F) and test-script errors (T) | All fixed and re-run; see §3 |
| C8 | Nearby E2E (2 tests), 2026-09-30 | Never became visible | **Real bug:** our own `Permissions-Policy: geolocation=()` blocked location on every page | Changed to `geolocation=(self)`; 5/5 Nearby E2E pass |
| C9 | Deletion scan after adding Nearby | `rate_limits` had 3 rows with the deleted id | **Real bug:** new Nearby limiter keys contain the user id and survived deletion | Deletion now removes every limiter key containing the id; scan passes |
| C10 | Nearby unit test "Learn more fields exchanged" | Assertion | **Test error:** Free test users don't share the Learn-more layer (plan rule); website is stored with `https://` | Test uses Pro users and matches the stored URL; product behaviour was correct |
| C11 | Card-design unit test | Deep-equal mismatch | **Expected:** the design gained a `back` field | Test covers `back: 'brand'` |
| C12 | QA-01 on iPhone after the Share redesign | Timeout on "Where are you?" | **Test out of date:** the field moved into collapsed "Link settings" | Test opens Link settings; 9/9 pass |
| C13 | Re-starting the local PostgreSQL 16 | `pg_ctl` wrong directory | **Wrong command** (cluster is in `/var/tmp/orynpg/data`) | Started from the right path; 52/52 on PostgreSQL 16 |

The run of `npm run verify:env` against the local demo setup **exits 1 on purpose**: it reports 5 production failures (demo data on, superuser database role, no TLS, no `CRON_SECRET`, `DATABASE_SSL=disable`). That is the check doing its job. These are exactly the items staging must get right.

## 7. Final results and readiness

**Latest run (2026-09-30, product pass: card object, double-tap flip, relationship memory, Today intelligence, analytics v2, offline Present):** unit 62/62 on PGlite and 62/62 on PostgreSQL 16; browser 28/28 incl. QA flows A (first card → first-run → double-tap flip), B (Nearby → connect → moment → People with context, tag, reminder, timeline, search), C (Present → flip → QR → recipient), D (Wallet pending states), E (permission change reflected publicly), F (location denied → event fallback), G (nobody nearby), H (Not now is silent). Failures found and fixed during the pass: migration comments broke the SQL splitter (C14); duplicated company in Nearby rows; "Nearby · Nearby" repeated in People; tests updated for text that now also appears on card backs and in the timeline (C15).

**Previous run (after Share / Nearby / Present / Wallet):** unit 53/53 on PGlite (52/52 on PostgreSQL 16 before the last added test); browser 28/28 (Android phone 7, desktop 7, two-phone Nearby 5, iPhone QA 9); typecheck, lint and production build clean. Measured: tap → my card ~0.25 s; Nearby A tap → B sees the request ~0.9–1.9 s; A sees "connected" ~2.4–3.5 s including B's tap. What is working, simulated or still needs integration: [NEARBY_AND_WALLET](NEARBY_AND_WALLET.md). The table below is the earlier baseline.


| Suite | Database | Tests | Passed | Failed |
|---|---|---|---|---|
| Unit / integration (Vitest) | Embedded Postgres (PGlite) | 29 | 29 | 0 |
| Unit / integration (Vitest) | **PostgreSQL 16 server** | 29 | 29 | 0 |
| End-to-end browser (Playwright: Android phone 5, desktop 5, iPhone QA 9) | Embedded Postgres | 19 | 19 | 0 |
| End-to-end browser, same suite, production mode | **PostgreSQL 16 server** | 19 | 19 | 0 |
| **Total** | | **96 runs of 48 tests** | **96** | **0** |
| Cold-start concurrency (8 servers at once) | PostgreSQL 16 | 1 | 1 | 0 |
| `verify:http` smoke check | local production-mode server | 13 checks | 13 (2 warnings: no https locally, demo data on) | 0 |

**Readiness**

| Level | Status | Why |
|---|---|---|
| Local demo | **Yes**, with the local demo account | Full flow verified end to end in the browser tests |
| Demo from real phones (online link) | **Not yet** | Needs a deployment (docs/DEPLOY_VERCEL.md) and a pass on a real iPhone and Android phone (R1) |
| Staging | **Not verified** | No isolated staging environment exists yet. To verify it: (1) `npm run verify:env` with staging's variables must show 0 failures; (2) `npm run verify:http <staging-url>` must show 0 failures; (3) run the E2E suite against staging's database copy; (4) confirm deployment protection, the least-privilege DB role, TLS, backups and the cron secret |
| Production | **No** | Also requires SECURITY_TEST_REPORT §4 (external pen test, 2FA, RLS, proxy IP trust, restore drill) and the legal documents |

## 8. How to reproduce

```bash
npm install
npm run typecheck && npm run lint && npm test     # 29 unit/integration tests
npm run build
npm run test:e2e                                  # 19 end-to-end tests (phone, desktop, iPhone QA)
npx playwright test --project=iphone              # the QA suite only

# Same suites on a real PostgreSQL server:
TEST_DATABASE_URL=postgres://user@host/db npm test
E2E_DATABASE_URL=postgres://user@host/empty_db npm run test:e2e

# Deployment checks (never print secret values):
npm run verify:env                                # run with the target environment's variables
npm run verify:http https://your-staging-url
```
