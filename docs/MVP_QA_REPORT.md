# ORYN v1 — MVP QA report

| | |
|---|---|
| Date | 2026-09-30 |
| Branch | `oryn-v1` |
| Build tested | Production build (`next build` + `next start`), fresh embedded Postgres per run, demo data seeded and labelled |
| Devices | **iPhone profile:** 390×844 px, 3× pixel density, touch, iPhone user agent, rendered by Chromium. **Android phone:** Pixel 7 profile. **Desktop:** 1360×900. WebKit (Safari's engine) is not installed in this environment. |
| Final result | **19/19 end-to-end scenarios pass · 29/29 unit/integration tests pass · typecheck, lint and build clean** |
| Verdict | The full flow works end to end in the browser tests. **It is not yet "demo-ready"** until the items in §5 marked *Before demo* are done: above all, a pass on a real iPhone and a real Android phone. |

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

## 6. How to reproduce

```bash
npm install
npm run typecheck && npm run lint && npm test     # 29 unit/integration tests
npm run build
npm run test:e2e                                  # 19 end-to-end tests (phone, desktop, iPhone QA)
npx playwright test --project=iphone              # the QA suite only
```
