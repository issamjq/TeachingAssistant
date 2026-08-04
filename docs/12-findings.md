# 12 — Findings

Running list of what's broken or risky. Started 2026-07-28.

**Status meaning:**
- ✅ **Observed** — seen happen in the running app or in a command's output
- 📖 **Code-read** — inferred from source, **not yet confirmed live**
- 🔧 **Fixed** — resolved, with the date

Rule: a finding is not trustworthy until it's Observed. Code-read items are a checklist of what to confirm, not conclusions.

---

## Withdrawn

### F1 — *withdrawn*
Logged as "`.env.example` is missing required variables", then withdrawn on 2026-07-28: the omission is **deliberate**. Local credentials are shared out-of-band by Issa, not documented in the repo. Not a bug — do not "fix" it.

---

## Architecture / DX

### F2 — Landing page can't be viewed without backend credentials ✅ Observed
`vite.config.js` calls `validateEnv()` in `configureServer`, before mounting anything. On failure it's `process.exit(1)` — no dev bypass, no skip flag. So one missing backend credential kills the **whole Vite server**, including the marketing landing page, which uses no auth, no database and no AI.

**Impact:** a designer or marketer can't run the site to work on the landing page.
**Fix option:** in dev, downgrade a missing backend credential to a warning and fail on the first `/api/auth/*` call instead. Keep the hard failure in production.

### F3 — `pg` SSL semantics change is coming 📖 Code-read *(warning observed)*
Observed on connect:
```
SECURITY WARNING: The SSL modes 'prefer', 'require', and 'verify-ca' are treated
as aliases for 'verify-full'. In the next major version (pg-connection-string v3 /
pg v9), these modes will adopt standard libpq semantics.
```
`DATABASE_URL` uses `sslmode=require`. Not broken today; will change behaviour on the next major `pg` upgrade.
**Fix:** pin intent explicitly — `sslmode=verify-full` to keep current behaviour.

### F4 — Render free tier sleeps ✅ Observed *(documented in README)*
`README.md` states: *"Free-tier Render web services sleep after 15 min idle and cold-start in ~30 s."*
**Impact:** the first teacher of the morning waits ~30 seconds staring at a spinner and assumes the product is broken.
**Fix:** upgrade Render off free tier (~$7/mo) before real teachers use it. Add to launch checklist.

---

## Commercial

### F5 — No payment integration exists 📖 Code-read
`POST /api/auth/renew` sets `subscription_ends_at` directly with no payment step. Its own comment calls it "Pre-Stripe". No Stripe/Telr/PayTabs dependency in `package.json`.
**Impact:** there is currently no way for anyone to pay. → Plan Week 2, Day 9–10.

### F6 — No AI usage metering 📖 Code-read
`backend/routes/studio.js` calls Anthropic on four endpoints and discards `response.usage`. No cost is recorded anywhere.
**Impact:** unknown COGS; unbounded per-user spend the moment `ai_studio` is enabled. → Plan Week 1, Day 1.

### F7 — Rate limiting is per-IP, not per-account ✅ Observed *(upgraded from code-read — see F14)*
`backend/lib/security.js` `buildGlobalRateLimit()` keys on IP. A whole school behind one NAT shares a 300-request bucket, while a single abusive account has no individual limit.
**Impact:** wrong in both directions — punishes schools, fails to stop abuse. → Plan Week 1, Day 4.

### F8 — No `max_tokens` ceiling on generation 📖 Code-read
Studio routes don't appear to cap output length. Output tokens are the dominant cost driver.
→ Plan Week 1, Day 3.

---

## UX

### F9 — Email OTP runs on top of already-verified social sign-in 📖 Code-read
`backend/routes/auth.js` `/email-verify/send` reads the email from the Firebase token. Google and Microsoft already assert `email_verified`.
**Impact (if it fires for social sign-ins):** an unnecessary funnel step, a Resend bill, and a 30-second cooldown for zero security gain. **Confirm live** whether the client actually calls this after a Google sign-in.

### F10 — Single-device sign-in force-logs-out legitimate users 📖 Code-read
`backend/lib/auth.js` rejects any request whose `X-Session-Id` doesn't match `accounts.active_session_id`; the client then signs out and `window.alert()`s.
**Impact:** a teacher on a classroom desktop is kicked out when they open their iPad — mid-lesson. Likely the #1 future support ticket. Also uses a raw `window.alert`, which is not the product's design language.
→ Plan Week 2, Day 8.

### F11 — Permission matrix is built but not enforced 📖 Code-read
`src/lib/permissions.js` header says the studio reads `account.permissions` *"when feature-gating is wired in"* — it isn't. 24 keys and a super-admin editing UI exist with no enforcement behind them.
**Impact:** an admin can toggle permissions that do nothing. Worse than not having the UI.

---

## Documentation

### F12 — `docs/` describes a version of the app that no longer exists 📖 Code-read
`docs/04-architecture.md` and `docs/07-api.md` predate the Express backend, Firebase auth, roles/portals and pathname routing. `docs/09-conventions.md` still says *"don't add a router — view state in App.jsx is enough"* and *"share the existing pool in vite.config.js"* — both now false. `docs/README.md` still calls the project a standalone app with "no marketing landing".
**Fix:** update per section as we touch it, not as a separate project.

### F13 — Stale comments in source 📖 Code-read
- `src/lib/account.js` opens with *"There is NO real auth yet"* — Firebase has since landed.
- `src/lib/currentUser.js` claims it's imported by `vite.config.js` — it isn't. Looks like dead code.

---

## Live walkthrough — 2026-07-28

Server booted clean (`firebase=admin-ok`, `db=neon`). No console errors on the landing page. Backend auth gates all verified correct: `/healthz` open, `/api/me` 401 without a token, unknown `/api/*` paths return 401 rather than leaking which endpoints exist, `/api/schools` readable unauthenticated (by design, for onboarding), `/api/admin/*` 401 without a token.

### F14 — The rate limiter throttles static assets, not just the API ✅ Observed
**This is the highest-impact finding so far.**

`buildGlobalRateLimit()` is mounted with `app.use()` ahead of the routers, and the Express app is also what serves the site in dev. It therefore counts **every** request — HTML, JS modules, images — not just `/api/*`. Only `/healthz` is skipped.

Observed after ~12 page navigations in a few minutes:
```
HTTP/1.1 429 Too Many Requests
RateLimit-Policy: 300;w=300
RateLimit: limit=300, remaining=0, reset=107
```
The whole site returned `{"error":"Too many requests. Please slow down."}` — including the HTML document. Pages rendered blank white until the window reset.

**Impact — dev:** Vite serves each module as its own request, so a single landing-page load is 100+ requests. About three page loads exhausts the five-minute budget and the app becomes unusable. Anyone working on this hits it constantly.

**Impact — production:** static assets come from Vercel, so only `/api/*` counts against Render. But the limit is still **per-IP**: a school of 50 teachers behind one NAT gateway shares 300 requests / 5 minutes. At ~6 API calls per page load that is roughly 50 page loads for the entire school per five minutes. A normal school day would trip it repeatedly, and every teacher would be locked out at once.

**Fix:** key the limiter on `account_id` for authenticated routes; scope the IP limiter to `/api/*` only; raise the ceiling and add a separate, much tighter limit on the expensive AI routes. → Plan Week 1, Day 4.

### F15 — Sign-in/sign-up copy contradicts the actual buttons ✅ Observed
Three statements on the same screen disagree:
- Buttons offered: **Google** and **Email**
- Body copy: *"Sign up with your school's Google or Outlook account"*
- Footnote: *"Only Google and Outlook accounts are supported for now."*

There is **no Microsoft/Outlook button** on the teacher sign-up screen — but the staff portal at `/dev` **does** show one ("المتابعة بحساب Microsoft"). So the teacher funnel and the staff portal offer different providers, and the teacher copy describes neither accurately.

**Impact:** a teacher whose school runs on Microsoft reads "Outlook supported", finds no Outlook button, and leaves.

### F16 — Legal consent checkbox is pre-ticked ✅ Observed — 🔧 Fixed Day 5
On the sign-up screen the box is **already ticked** on arrival:
> *"I have read and agree to the Terms & Conditions and the Privacy Policy, including the processing of my data under UAE Federal Decree-Law No. 45 of 2021 (PDPL)."*

A pre-ticked box is not valid consent under PDPL-style regimes — consent must be a clear affirmative action. The notice cites the PDPL by name, which makes the defect worse, not better.

**Impact:** the exact clause a school's procurement or legal reviewer will check.

**Fixed 2026-07-31 — and it was not one line, because the cause was not what it looked like.** The state was already declared `useState(isSignin)`, which reads correctly: unticked for sign-up, irrelevant for sign-in. The defect was in how the screen is mounted. `MarketingPage` renders `<AuthPage mode={page}/>` in the same position for both modes, so React reuses the component instead of remounting it — and a `useState` initialiser only runs on mount. A visitor who opened **Sign in first and then switched to Sign up** carried `accepted = true` across, and the box rendered already ticked.

So the fix separates two questions that had been sharing one boolean:

- `accepted` now means only **"this user ticked the box"**, and starts `false` always
- `consentSatisfied = isSignin || accepted` is what actually gates submission

Plus an effect that clears the tick on every mode change, so arriving at Sign up is always a fresh affirmative act — even for someone who ticked it, bounced to Sign in and came back.

Verified in the browser along the path that used to fail:

| | |
|---|---|
| Sign up on arrival | unticked |
| Sign in | no box at all |
| Sign in → Sign up | unticked |
| Tick → Sign in → Sign up | reset to unticked |
| Provider click while unticked | blocked, error shown, box highlighted |
| Email route while unticked | blocked |
| Create-account button | disabled |

### F54 — Two Day 5 features silently cancelled each other 📖 Code-read — 🔧 Fixed same day
Found 2026-07-31 during a post-change audit, not by a test — no test would have caught it, because each feature works perfectly on its own.

`route.js` stores "where the teacher was headed" under `sessionStorage["murchid.auth.returnTo"]` (F20). The popup-to-redirect fallback added the same day (F23) stored "where the tab was" under **the same key**, then consumed it on return.

The interaction: a teacher is bounced off `/quizzes/new` → route.js stores it → they land on `/signin` → their browser blocks the popup → the redirect fallback overwrites the key with `/signin` and removes it on the way back. The deep-link return dies **exactly in the popup-blocked case the redirect fallback exists to serve**.

Fixed by deleting the storage from `firebaseAuth.js` entirely. It never needed it: `route.js` owns the destination, and coming back from a redirect is already handled by the landing page's silent session-restore, which picks up the persisted Firebase session on mount. The same audit found `completeRedirectSignIn()` and the `REDIRECTING` symbol were dead code — written, exported, never called — and removed both.

**The lesson worth keeping:** two correct features, shipped in one sitting, sharing one storage key. Grep for a new key's name across the whole repo before using it.

### F18/F19/F20/F23 — funnel fixes, Day 5 detail 🔧 Fixed 2026-07-31

**F23 — popup-blocked no longer fails silently.** `firebaseAuth.js` now tries the popup and falls back to `signInWithRedirect` when the browser refuses it (`auth/popup-blocked`, `auth/operation-not-supported-in-this-environment`, `auth/web-storage-unsupported` — the last covers in-app browsers like Teams). Redirect is the fallback, not the default: it unloads the page and loses any half-filled form, so it is only worth it when the popup cannot work at all. The caller gets a `murchid/redirecting` code and shows nothing rather than an error, because the tab is about to navigate away.

**F18 — no SDK strings reach a teacher.** The fallback used to be `e?.message`, which produced `Firebase: Error (auth/configuration-not-found).` on screen. It is now a generic sentence, with the raw error going to the console where it is useful. The three configuration faults (`operation-not-allowed`, `unauthorized-domain`, `invalid-credential`) deliberately share one message: the distinction matters to us and to nobody else, and spelling it out tells an attacker how the project is configured.

**F19 — `/signin` and `/signup` are real URLs.** Added to `route.js` as marketing paths so `parsePath()` returns null for them, exactly like the portals — otherwise `main.jsx` would read `/signin` as a studio section and render the app shell to a signed-out visitor. The landing seeds its page state from the pathname and pushes history on switch, with a `popstate` listener so back/forward move the screen too. Verified: `/signup` renders sign-up, switching moves the URL to `/signin`, back returns to `/signup`.

**F20 — a bounced deep link explains itself and comes back.** A signed-out visit to a studio URL now stores the intended path, replaces the URL with `/signin` and shows *"Sign in to continue — we'll take you straight back to where you were."* (EN + AR). After sign-in the stored path is consumed and the teacher lands where they meant to.

The stored path is a **security-relevant value**, because something later navigates to it. Both `rememberReturnTo` and `takeReturnTo` accept same-origin paths only — a value must start with `/` and must not start with `//`. Without that, sign-in becomes an open redirect. Verified with real page loads: `//evil.example`, `https://evil.example/x`, `http://evil.example` and `javascript:alert(1)` are all refused. It also lives in `sessionStorage`, not `localStorage`, so it is scoped to the tab and cannot be a stale intent from last week.

### F17 — Legal consent text is not translated into Arabic ✅ Observed — 🔧 Fixed Day 5
Fixed 2026-07-31. The consent sentence is now six i18n keys rather than hardcoded English, because two of its words are clickable links inside the sentence and Arabic word order differs from English — a single string with placeholders would have to be parsed at render time.

`lp.auth.consent.pre / tc / mid / privacy / post / error`, present in both dictionaries. The decree is named as it appears in the official Arabic text. The connective is `وعلى` rather than a bare `و`: the latter is a prefix that attaches to the following word, and the link sits in its own element with a space before it.

**⚠️ This is binding legal text and has NOT had a native-speaker review.** It should get one before launch. The English is unchanged, so nothing has regressed either way.

**Not covered by this fix, and deliberate:** the full Terms and Privacy documents stay English-only, with a banner saying an Arabic version is available on request. That is a legal-drafting decision, not an oversight — but the banner itself is also hardcoded English, so an Arabic reader is told in English that the document is in English. Worth translating that one paragraph.


With the site switched to Arabic, the whole page localises correctly — except the consent sentence, which stays in English inside an RTL layout.

**Impact:** an Arabic-speaking teacher is asked to consent to data processing in a language the rest of the page has just demonstrated it can translate. Compounds F16 — pre-ticked *and* not in the user's language.

### F18 — Raw provider errors are shown to users ✅ Observed — 🔧 Fixed Day 5
Clicking "Continue with Google" surfaced this directly in the UI:
```
Firebase: Error (auth/configuration-not-found).
```
That is the SDK's internal error string. A teacher cannot act on it. (Root cause here was just the dev Firebase project not having Google enabled — the finding is the *presentation*, not the cause.) In Arabic mode the trailing full stop also renders on the wrong side.

**Fix:** map provider error codes to human sentences, with a generic fallback.

### F19 — Auth screens are not routable ✅ Observed — 🔧 Fixed Day 5
Sign-in and sign-up render as state inside the landing page — the URL stays `http://localhost:5173/` throughout.

**Impact:** you can't link anyone straight to sign-up, marketing can't measure funnel steps, refreshing loses your place, and the back button behaves unexpectedly.

### F20 — Deep links bounce to marketing with no explanation ✅ Observed — 🔧 Fixed Day 5
Visiting `/planner` while signed out silently redirects to the landing page. Correct security behaviour, but no message.

**Impact:** a teacher clicking a bookmark lands on the marketing site with no idea why. Should show "please sign in to continue" and return them to the page they wanted afterwards.

### F21 — Scroll-reveal leaves large blank areas ✅ Observed — minor
Scrolling quickly showed full-viewport blank sections that filled in a moment later. Content is fine once settled; on a slower device the blank window will be longer and reads as broken.

### F22 — 🔴 The language toggle crashes the landing page to a white screen ✅ Observed
Reproduced 5 times (13:32, 13:37, 13:38, 13:42, 13:43). Clicking EN ⇄ ع throws, React unmounts the whole tree, page goes blank. Only a full reload recovers.

```
NotFoundError: Failed to execute 'insertBefore' on 'Node'
The above error occurred in the <FileText> component:
    at Showreel      (src/views/Showreel.jsx:146)
    at LandingHome   (src/views/LandingHome.jsx:1354)
    at Landing       (src/views/Landing.jsx:11812)
    at LanguageProvider (src/lib/i18n.jsx:1920)
```

**Cause:** switching language flips `dir` LTR↔RTL. `Showreel` animates its own DOM, so React tries to `insertBefore` against a node that has moved, and throws during commit.

**Why the whole page dies:** React says it outright — *"Consider adding an error boundary."* **There is none anywhere in the app.** One throwing icon destroys the entire product.

**Impact:** Arabic is the strongest differentiator, and the ع button is the first thing a UAE teacher presses. Note the language state *does* persist — only the render crashes — so a reload comes back in the chosen language.

**Two fixes:** stop `Showreel` mutating React-owned DOM (or remount with `key={lang}`), **and** add error boundaries around the landing sections and the studio shell.

> **⚠️ Did not reproduce 2026-07-28 (second walkthrough).** 18 toggles in the in-app browser — idle, scrolled into `Showreel` while its typewriter was mid-cycle, and a 12-click burst at 120 ms intervals. The tree stayed mounted every time, `dir`/`lang` flipped correctly, console clean. Note `Showreel.jsx:185` already carries a `langRef` guard that swaps the title word instantly on a language flip, and `git log` shows that file last changed 2026-06-05 — **before** the original observation. So this is not a fix that landed since; the crash is **intermittent or browser-specific**, not deterministic. Downgraded from 🔴 to ⚠️ intermittent.
>
> **This does not lower the priority of the error boundary.** The boundary is the fix that matters: it neutralises this *and* every other unreproducible throw, without needing to win a race we can't reliably trigger. Chase the boundary, not the repro.
>
> **🔧 Contained 2026-07-28 (day 1).** `src/components/ErrorBoundary.jsx` added and wired at three depths: per surface (`main.jsx` — landing / studio / portal isolated from each other), per route (`App.jsx`, auto-clearing on navigation), and around `Showreel` itself (`LandingHome.jsx`, reset on `lang`). Verified by forcing `Showreel` to throw: the landing page stayed up, pricing and testimonials kept rendering, and only the film panel was replaced by a recoverable card — in EN and in Arabic RTL. The underlying race is still unfixed and still unreproduced; it can no longer take the page down. The test throw was reverted and `Showreel.jsx` confirmed byte-identical to HEAD.

### F23 — 🔴 Sign-in fails silently ✅ Observed — 🔧 Fixed Day 5
Clicking "Continue with Google" with the popup blocked produces **no message, no console error, nothing** — the button flickers to "Opening sign-in…" and stops. We only diagnosed it by inspecting Firebase and response headers.

**Impact:** worse than a visible failure — it fails invisibly at the very top of the funnel, and wouldn't even appear as a failed signup in analytics. School-managed laptops routinely block popups.

**Fixes:** catch `auth/popup-blocked` and `auth/popup-closed-by-user` and show a real message; fall back to `signInWithRedirect`.

### F24 — 🔴 COOP header broke Google sign-in entirely 🔧 Fixed 2026-07-28
`buildHelmet()` inherited Helmet's default `Cross-Origin-Opener-Policy: same-origin`, which severs `window.opener` between the page and the Firebase popup. The popup completed the Google flow, closed, and could never post the credential back — the user saw it vanish with nothing happening.

The file already had `crossOriginEmbedderPolicy: false, // would block Firebase popups` — COEP was handled, COOP was missed.

**Fix applied:** `crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" }`. Verified: sign-in now completes. All other headers unchanged (CSP, X-Frame-Options, nosniff, CORP, Referrer-Policy).

**Scope:** blocks sign-in in local dev, where Express serves the HTML. In production the HTML comes from Vercel, so the header isn't applied — which is why this was invisible until someone tried to run it locally.

### F25 — 🔴 Studio's prompt placeholder looks like real content ✅ Observed
The Studio prompt box shows *"A 45-minute Grade 7 science lesson on photosynthesis…"* styled identically to typed text. It is a **placeholder** — the field is empty.

So a teacher sees text in the box, sees **"✓ ALL SET"**, sees the hint change to *"Murchid will fill the rest"*, clicks **Make it** — and **nothing happens.** No error, no console output, no request. The button is disabled but doesn't look it.

Confirmed: typing real text immediately turned the button dark and enabled.

**Impact:** on the flagship feature, the product appears ready and then silently ignores the click. Third silent failure of the day, and this one is on the feature the whole business rests on.

**Fix:** style the placeholder as placeholder (muted/italic), and when the button is disabled say *why* next to it.

> **⚠️ Partly retracted 2026-07-28 (second walkthrough).** Measured in the running app: the placeholder is **already muted** — computed `::placeholder` colour is `rgb(107, 99, 84)` against `rgb(26, 24, 20)` for real input. The disabled reason **is** shown next to the button ("Choose every setting to continue"). What survives is narrower: `Make it` carries the native `disabled` attribute, so a click produces no event at all — no feedback, no explanation surfaced on the action itself. Severity drops from 🔴 to minor. The real friction on this screen is F27.

### F26 — 🔴 Single-device lockout fires on one person, one laptop ✅ Observed *(confirms F10)*
Signing in manually and then again through automation — **same person, same machine, minutes apart** — rotated `active_session_id` and invalidated the first session. The next Studio action returned:

> **Could not generate**
> You've been signed out because this account was used on another device.

Two things make this worse than the code suggested:
1. **The message is wrong in context.** The teacher asked for a lesson plan and was told something about devices.
2. **The app keeps looking signed in.** The sidebar still showed *afras rahim · T-TEST-01 · Teacher*. Every subsequent action fails the same way with no route back to signing in.

**Impact:** a teacher on a classroom desktop who opens their iPad lands in this dead state mid-lesson. → Plan Week 2, Day 8.

### F27 — Studio requires 5 dropdowns before it will do anything ✅ Observed
"Make it" stays disabled until Grade, Major, Language, Section and Duration are all set — even when a field has exactly **one** possible value. This teacher had 1 grade, 1 language, 1 section, 2 majors, and still had to open five menus.

The placeholders (*"Any grade"*, *"Auto"*, *"All sections"*) read like working defaults but are rejected.

**Fix:** auto-select when only one option exists; treat "Any/Auto" as genuine defaults.

### F28 — `class_map` is never populated ✅ Observed
After completing the wizard, the account row shows `class_map` with **0 entries**, while `grade_sections` holds `{"Grade 7": ["Section A"]}`.

`class_map` is documented in `backend/db/init.js` as the hierarchical `[{major, grades, sections}]` structure — the thing that expresses *"Math for Grades 6 and 8, sections A & B"*. Onboarding never writes it.

**Impact:** the subject↔grade relationship is lost. A teacher covering Math for Grade 7 and Science for Grade 9 gets all combinations offered rather than their real ones. Also, the flat `grade_levels` column can drift out of sync with the per-school `account_schools.grade_sections` after a second onboarding run.

### F29 — Pluralisation bugs in the wizard ✅ Observed — minor
Sidebar shows *"1 schools"* and *"1 languages"*.

### What's genuinely good (verified, worth protecting)
- **Arabic/RTL is excellent.** Full layout mirroring, translated nav and body copy, Amiri masthead with the Latin wordmark as watermark, and even the product mockup images are localised. Language choice persists across navigation. This is far beyond typical i18n and is a real differentiator.
- **Visual design holds up** at full size — the editorial system is consistent and distinctive.
- **Backend security behaves exactly as documented** — every auth gate tested returned the right status.
- **No console errors** on load.
- **The onboarding wizard is well built.** Five clear steps, each explaining *why* it's asking. The school picker searches the real UAE catalog with emirate filters and has a "don't see your school?" escape hatch. The student-import step is written for non-technical teachers ("No spreadsheet skills needed") and is skippable.
- **Onboarding data really does scope the Studio.** Checked directly: the Grade dropdown offered only *Grade 7* and Major only *Math / Science* — exactly what was entered in the wizard. Step 2's promise ("we use this to scope Studio prompts") is kept.
- **The empty state is good.** A brand-new teacher lands on *"Your month is open — pick a topic to start"* with Create Quiz / Assign Homework / Build Presentation actions, a Quick Actions rail, and a 5-step coachmark tour. Most products fail here; this doesn't.
- **Onboarding persists correctly.** Verified in Postgres: majors, languages, grade_levels, sections, `grade_sections`, staff_id, trial status and end date, and the school link with `is_primary` all written as entered.

### Checked and cleared — not bugs
- **Two schools linked to one account.** Looked like a duplicate-write bug; it wasn't. That Gmail already had an account from 2026-07-27 with a different school. Correct accumulation.
- **English nav over Arabic content.** Chrome's auto-translate, not the app.
- **Blank sections while scrolling fast.** Partly the scroll-reveal animation (F21), partly the rate limiter (F14) and partly the crash (F22) — but not a layout bug in its own right.
- **Firebase project misconfiguration.** Ruled out directly in the console: Google and Email/Password both enabled, `localhost` authorized. The cause was F24.

---

## Second walkthrough — 2026-07-28 (signed in, full teacher surface)

Signed in as `afras rahim · T-TEST-01 · teacher`. Walked every teacher surface: Planner, Studio, Lesson Plans, Quizzes, Homework, Presentations, Activities, Bulletin board, My students, Reports, Schedule, Settings, all four builders, and the trash panel. **Zero console errors across the entire session.**

### F31 — Reports and Schedule are reachable by URL only ✅ Observed — 🔧 Fixed Day 4
Both are in the sidebar as of Day 4 — Schedule under Planning, Reports under Data. Verified rendering. See F30 for the rest of the orphan sweep.

Both render correctly at `/reports` and `/schedule`, and both are in `SECTIONS_BY_ROLE`, but neither appears in `NAV_BY_ROLE` — so no teacher will ever find them. Schedule is a working week/list calendar with a New-entry flow; Reports has CSV and PDF export.

**Impact:** finished features with real value, invisible in the product.

### F33 — `Library.jsx` is orphaned ✅ Observed — 🔧 Fixed Day 4
Wired into the sidebar under Teaching, lazy-loaded, verified rendering. See F30 for the rest of the orphan sweep.

A complete resource-library CRUD view backed by the live `/api/library` router and the `library_resources` table — imported by nothing, reachable from nowhere. Same class of problem as F30, lower stakes.

### F27 — confirmed and quantified ✅ Observed *(strengthens the original)*
Measured the actual option counts behind the five mandatory Studio chips for this account:

| Chip | Real options |
|---|---|
| Grade | **1** — Grade 7 |
| Major | 2 — Math, Science |
| Language | **1** — English |
| Section | **1** — Section A |
| Duration | 5 — 30/45/60/75/90 min |

**Three of five fields have exactly one possible value**, and the teacher must still open each menu and click it. Five menus to express two real choices, before `Make it` will enable. Auto-selecting single-option fields removes 60% of the interaction outright.

### F34 — Studio's language gap reaches inside the product ✅ Observed
With the UI in Arabic, the Planner empty state renders in English: *"Your month is open — pick a topic to start."* — everything around it (nav, headings, quick actions, month grid) is correctly Arabic and RTL.

**Impact:** F17 logged untranslated consent text on the landing page; this shows the same gap inside the signed-in app. Consistent with the code read — 22 of ~50 views are still hardcoded English, including the whole My-students area and every privileged console.

### F35 — "My students" filter contradicts its own promise ✅ Observed — minor
The page states *"Only kids in the grades you teach. No one else's class is visible."* The grade filter directly beneath offers all fourteen values, KG 1 through Grade 12, for a teacher who teaches only Grade 7.

### F36 — Quizzes list is slow to first paint ✅ Observed — minor
`/quizzes` still showed **"LOADING…"** at 900 ms and resolved before 3 s, on an **empty** table against the dev Neon branch. Worth watching once real data exists; likely Neon round-trip latency rather than a client problem.

### Verified working this pass
- **Studio scoping is genuinely correct.** The chip menus offered exactly the onboarding data — Grade 7, Math/Science, English, Section A. Step 2's promise is kept.
- **All four builders render fully** — Quiz (8 inputs, questions, split-equally, scheduling), Homework (attachments, due date, status), Activity (type/duration/instructions), and Presentation, which is a rich slide editor with layouts, backgrounds and a font-family picker.
- **Settings works** with all three tabs — Personal details, Teaching profile, My schools — confirming `DatabaseProfile` and `DatabaseSchools` are reachable there (unlike F30's pair).
- **Empty states are consistently good** across Quizzes, Homework, Presentations, Activities and Planner.
- **Trash panel opens** on the soft-deleted surfaces.
- **Lesson Plans has a `.docx` import** (backed by the `mammoth` dependency) — undocumented anywhere in `docs/`.

### Still unverified after this pass
- **Create/edit round-trip** — nothing was saved, so persistence is untested. Requires writing rows to the dev Neon branch.
- **Studio generation** — `ANTHROPIC_API_KEY` is unset, so all four AI endpoints are untestable regardless of the `ai_studio` flag. `PEXELS_API_KEY` (presentation image search) and `RESEND_API_KEY` (email OTP) are also unset.
- **The five privileged consoles** — need a non-teacher role.
- **Mobile / tablet layout** — teachers will use iPads.

---

### F43 — 🔴 `POST /api/schools` accepted unauthenticated writes ✅ Observed — 🔧 Fixed Day 2
The route carried no auth gate; its own comment said *"No auth gate yet; tighten when Firebase lands."* Firebase landed. `schools` is **shared** data — every teacher sees this catalog in onboarding — so anyone on the internet could insert rows into it. Verified before the fix:

```
unauth POST /api/schools -> 201   (row created)
```

**Fix:** require an authenticated account inside the POST handler. The router stays mounted with `requireAuth({ optional: true })` because the GET catalog is legitimately readable during onboarding, so the write is gated rather than the whole router.

**Verified safe for onboarding:** `handleChoosePlan()` calls `POST /api/auth/firebase` (which provisions the account row) *before* it materialises custom schools, and all four client call sites go through `api()`, which attaches the token. After: anonymous → 401, authenticated → 201, GET catalog → 200.

Also given its own rate-limit bucket (120 / 5 min) — it is the only route anonymous callers can reach, and layer 1's generous ceiling exists for authenticated traffic (see F39).

### F39 — resolved ✅
Half of this was based on a wrong assumption of mine, corrected by reading `requireAuth`: a request with **no** `Authorization` header returns 401 at `backend/lib/auth.js:101` *before* any token verification. Unauthenticated probes were already cheap, so the "cheap-fail unmatched `/api/*`" work was unnecessary and was dropped rather than built. The real exposure was `/api/schools`, now handled above.

### F41 — 🔴 `GET /api/images/:id` leaked uploads across tenants ✅ Observed — 🔧 Fixed Day 2
`SELECT mime, data FROM uploaded_images WHERE id = $1` carried **no `account_id` clause**. Any authenticated teacher could walk the id space and read another teacher's uploads. Not theoretical — reproduced before the fix:

```
Teacher A (709) uploaded private image id 1
Teacher B (783) GET /api/images/1 -> 200 image/png 70 bytes
```

**Fix:** scope to the owner and return 404 (not 403) on a foreign id, so the response can't be used to probe which ids exist. Verified after: B → 404, A → 200.

**Why the fix was safe to apply immediately:** `resolveSrc` in `SlideBuilder.jsx` renders `<img src="/api/images/:id">`, a plain tag that cannot attach a Bearer token, while `/api/images` is mounted *after* `requireAuth()`. Uploaded images therefore **never render in the UI today** — scoping the query cannot break a path that is already broken by auth.

**Still open (separate problem):** image delivery needs a design that works from an `<img>` tag — a signed/opaque URL, or fetch-to-blob. That belongs with the object-storage move (files leave Postgres), not with a security patch. Until then, uploaded images remain non-functional in slides.

### F42 — Quiz score upsert accepted another teacher's student ✅ Observed — 🔧 Fixed Day 2
`PUT /api/quizzes/:quizId/scores/:studentId` checked quiz ownership but **not student ownership**, so a teacher could write a score row referencing a foreign `student_id` — polluting their own gradebook with another teacher's student and confirming that id exists.

The sibling route `POST /api/quiz-scores` has always checked **both** endpoints of the join, with a comment explaining exactly why. This route simply didn't. Fixed to match it. Verified: foreign student → 404, own student → 200.

### F40 — 🔴 BYPASSRLS makes naive row-level security silently inert ✅ Observed — Day 2
**The most dangerous thing found so far, because it fails silently and looks correct.**

The Neon connection user, `neondb_owner`, carries the `BYPASSRLS` role attribute. Verified experimentally against the live database: a table with `ENABLE ROW LEVEL SECURITY`, `FORCE ROW LEVEL SECURITY`, and a restrictive policy still returned **every row** to that user.

```
rows visible WITH force-RLS + policy(account_id = 100), as neondb_owner: 2
=> BYPASSRLS defeats FORCE. RLS is inert for this user.
```

So the obvious implementation — add policies, keep the existing connection — produces a schema that reads correctly, passes review, and enforces nothing. Worse than no RLS, because it looks finished.

**Fix applied (Day 2):** a separate `murchid_app` role with no bypass and DML-only grants (no DDL, no ownership). `withTenant()` in `backend/lib/db.js` opens a transaction, does `SET LOCAL ROLE murchid_app` and `set_config('app.current_account', …, true)`, and runs the handler's queries there. Both settings are transaction-local, so nothing leaks onto a pooled connection — verified: after `COMMIT` the connection is back to `neondb_owner` with the setting cleared.

Policies read `current_setting('app.current_account', true)`, which yields NULL when unset; NULL matches no row, so an unscoped query returns **zero rows**. Fails closed, never open.

**Verified isolation** (teacher A = 709, teacher B = 783), with queries carrying *no* `WHERE` scope at all:

| Attempt | Result |
|---|---|
| B reads A's draft by id | 0 rows |
| B `UPDATE`s A's draft (no scope in SQL) | 0 rows |
| B `DELETE`s A's draft (no scope in SQL) | 0 rows |
| B `INSERT`s a row owned by A (forged `account_id`) | blocked, `42501` |
| B reads A's `quiz_questions` (child policy via parent) | 0 rows |
| B writes a `quiz_scores` row on A's quiz | blocked, `42501` |

17 tables covered: 13 with a direct `account_id`, plus `quiz_questions`, `quiz_scores`, `homework_submissions` and `activity_completions` via an `EXISTS` on their parent — the last three hold per-student marks.

**Coverage is partial and that is deliberate.** `crud.js` is migrated, so all 11 `crudRouter` resources are enforced. The ~116 hand-written queries in other routers still run as the bypassing owner: unchanged behaviour, no regression, but no protection either. Rollout is non-breaking by design — each migrated path gains enforcement without risk to the rest. **Do not treat RLS as "done" until those are migrated.**

### F39 — IP flood-wall ceiling is loose for unauthenticated traffic 📖 Code-read — scheduled Day 2
Day 1 raised the IP-keyed limiter from 300 to 1000 per 5 min. That was deliberate: layer 1 runs *before* `requireAuth`, so it counts a whole NATed school's authenticated traffic, and per-account limiting (300) now does the fairness work. The side effect is that genuinely *unauthenticated* traffic has more headroom than before.

**Do not simply lower the 1000** — that reintroduces F14/F7. Narrow the exposure instead:

1. Tight IP bucket on the only publicly reachable route, `/api/schools` (~60 / 5 min). `/api/auth` already has its own 10 / 15 min brake.
2. Leave layer 1 at 1000 as a pure flood wall.
3. Cheap-fail unmatched `/api/*` so 401 probes cost a counter tick rather than a Firebase token verification.

Additive only — layers 2 and 3, the usage ledger, and the error boundaries are untouched. → Scheduled with Day 2 scope hardening in [`14-roadmap.md`](14-roadmap.md).

### F30 — Attendance + Gradebook were built but reachable by nobody ✅ Observed — 🔧 Fixed Day 4
`DatabaseAttendance.jsx` and `DatabaseGrades.jsx` were complete, their routes and tables existed, and `App.jsx` referenced neither. Both are now tabs under **My students**, lazy-loaded. Reports, Schedule and Library are in the sidebar too (F31, F33).

Exercised for the first time on 2026-07-31 — both work. Marked three students present/late/excused and the register persisted; recorded a grade and it reached Reports.

Three things were hardened on the way, because these are the first tables in the product describing a **child** rather than a teacher's own work:

- **`published_at` on `student_grades`.** A grade is a draft until released. Without it the parent portal (day 16) would have shown every mark the instant it was typed — including a mistyped one — or needed a migration plus a re-audit of every read path. NULL is the default, so the gate fails closed. Releasing is a dedicated `POST /api/grades/publish` (bulk, capped at 500), not a settable column, so it cannot be flipped by an ordinary PATCH.
- **Timestamps.** `attendance` had none at all and `student_grades` recorded creation but not edits. "When was this marked, and was it changed?" has no answer if it was never stored, and it is the first question a parent asks.
- **zod on both.** `student_grades` accepted unvalidated input — any score, any length of text — through the crud router. Now bounded.

Verified: 18-check cross-tenant suite passes (teacher B cannot read, write, retarget, delete or **publish** teacher A's rows; a mixed-id publish batch moves only the caller's own row), and the RLS backstop returns zero rows for an unscoped query. Plans at 300 students / 19,380 attendance / 3,230 grades: register 0.23 ms, grade list 0.05 ms, drafts filter 0.12 ms, bulk publish of 500 13.5 ms on the pkey index, Reports summary 3.1 ms.

**Left open deliberately:** the recorded attendance is not yet read by anything (F50), and `GET /api/grades/summary` has no pagination — bounded per teacher and 3 ms at the scale above, so a watch item rather than a bug.

### F53 — Bulletin board index direction silently disabled itself 📖 Code-read — 🔧 Fixed Day 4
`announcements_board_idx` was written as `pinned DESC NULLS LAST`, which reads naturally for a boolean that is never null. But `buildOrderSpec()` expands the router's `pinned DESC` to `pinned DESC NULLS FIRST` (Postgres' default for DESC), so the index did not match the sort and the board fell back to a full scan — 1.98 ms and a Seq Scan at 4,000 notes.

Corrected to `NULLS FIRST`: **0.06 ms on the index**, a 33× improvement, and the `?live=true` read dropped from 1.82 ms to 0.16 ms.

Worth recording because this is exactly the trap rule 10 in `CLAUDE.md` warns about, written by the person who wrote the rule. Reading the clause is not enough — only `EXPLAIN` catches it.

### F52 — Studio saves homework and presentations into the drafts table 📖 Code-read — open
Studio's save has a branch for quiz (its own table) and, as of Day 4, one for activity. Everything else falls through to `/api/drafts`, which is shaped around lesson plans — so a generated **homework** or **presentation** lands under Lesson Plans rather than on the Homework or Presentations screen built for it, even though both tables exist with full CRUD.

Studio's own comment admits it: *"everything else still saves there until per-kind tables exist"* — but the tables do exist. Found 2026-07-31 while wiring the activity kind, because exposing that kind without a save branch would have created the same disconnection.

**Fix:** two more branches following the activity one — map the generated markdown onto each table's fields the way `activityParams` maps onto `activities`.

### F51 — Dashboard ran seven queries on one client inside Promise.all ✅ Observed — 🔧 Fixed Day 5
[`backend/routes/dashboard.js:35`](../backend/routes/dashboard.js) wraps six queries in `Promise.all` on a **single** `withTenant` client. node-postgres cannot run concurrent queries on one connection, so it serialises them: six sequential Neon round-trips on the app's most-loaded endpoint, wearing the costume of a parallel fetch.

It also warns: `Calling client.query() when the client is already executing a query is deprecated and will be removed in pg@9.0`. So this is both a performance bug today and a breaking change on the next major `pg` upgrade.

Observed 2026-07-31 while testing whether attendance reaches the dashboard — the warning fired on every request.

**Fixed 2026-07-31**, after Issa spotted the symptom in the UI: on Reports, the counts at the top appeared *after* the table below them. That is two independent fetches racing, and the slower one losing visibly.

Measured, dev machine to Neon:

| | before | after |
|---|---|---|
| `/api/dashboard` | **1,058 ms** | **483 ms** |
| `/api/grades/summary` (beside it) | 479 ms | 480 ms |

They now finish together, so the Reports page paints in one go.

The seven queries became **one round-trip**: each block is a scalar sub-select returning `json_agg`, evaluated in a single pass. The response shape is byte-identical, and `COALESCE(..., '[]')` means every list is still an array.

Not fixed by running them on separate clients, which was the obvious idea: every tenant-scoped query goes through `withTenant()`, and that costs four round-trips of its own. Seven parallel clients would be seven transactions — 28 round-trips to save six.

**Why it matters under load, not just to the eye.** The pool holds 10 connections. A dashboard request used to occupy one for a full second, so roughly ten concurrent teachers would saturate the pool and the eleventh would queue. That is the failure mode Issa was asking about — "if it is like this with no data, what happens with traffic".

### F58 — Planner could not be scrolled on a full screen ✅ Observed — 🔧 Fixed Day 5
Reported with a screenshot: on a maximised window the last week of the calendar is cut off and the page will not scroll. On a tablet-sized window it scrolls fine.

The cause was one class. `Planner.jsx`'s root carried `lg:h-full`, which pins the whole screen to the viewport height at the `lg` breakpoint and above — so when the month needed more room than was left, the last row was simply clipped, with nothing able to scroll. Below `lg` the class did not apply, which is exactly why a tablet behaved correctly and a full screen did not.

Changed to `lg:min-h-full`: the "fills the window" look is kept, but the page can grow past it, and App.jsx's `overflow-y-auto` takes over. The calendar frame also gained a floor (`lg:min-h-[34rem]`, replacing `lg:min-h-0`) so a six-week month stays readable rather than compressing.

Verified at 1660×760: the last cell sits at 829 px, off-screen; the page now scrolls (838 > 760) and scrolling to the bottom brings it fully into view at 751 px. Pure CSS — no measurement, no listener, no performance cost.

### F57 — The Planner tour replayed on every single sign-in ✅ Observed — 🔧 Fixed Day 5
Reported after signing out and in more than ten times and still being shown the tour, despite an earlier fix. The earlier fix was real; the gate was defeated by something else.

`accountKey()` fell back to the literal string `"anon"` when the account had not hydrated. Planner evaluated the gate with `useState(shouldShowPlannerTour)` — **at mount** — and on a fresh sign-in the profile arrives a moment later, because App.jsx fetches `/api/me` asynchronously. So:

- the **check** ran against bucket `"anon"`, which was always 0
- the **mark** ran seconds later when the teacher clicked Skip, by which time the profile had arrived, so it incremented `"t-test-01"`

`"anon"` was never incremented and never fell below the threshold. The stored value `{"t-test-01": 2}` was the fingerprint: written twice, read never.

Fixed by removing the fallback bucket entirely — `accountKey()` returns `null` when identity is unknown, `shouldShowPlannerTour()` refuses to decide, and Planner waits on `useAccount()` before deciding once. `MAX_VIEWS` is now 1: finishing or skipping both end it for good, which is what was asked for.

Verified: a reset browser shows the tour once; clicking Skip writes `{"t-test-01": 1}` under the real key; six simulated sign-in cycles afterwards never show it again.

**Known limit:** the record is per browser, in localStorage. A teacher on a new device or a cleared browser sees it once more. Storing it on the account row would fix that and is the better long-term answer, but it needs a column and an endpoint.

### F56 — The Planner screen costs 25 database round-trips ✅ Observed — open, scheduled
Found 2026-07-31 while sweeping every page for the load problem Issa reported. Measured in the browser, not inferred.

`Planner.jsx` and `TeachingRail.jsx` each fetch the same five lists — schedule, quizzes, homework, presentations, activities — as five separate requests. Every one is a separate `withTenant()` transaction, and each of those costs five round-trips (BEGIN, SET LOCAL ROLE, set_config, the query, COMMIT). Five requests × five round-trips = **25 round-trips for one screen**, and Planner is the teacher's default landing page.

Observed durations on that screen: **1,226–2,116 ms per call**, ten calls in flight at once (five, doubled by React StrictMode in dev).

Three separate things are tangled here, and only two are real:

| | real in production? |
|---|---|
| StrictMode firing every effect twice | **no** — dev only |
| Five requests where one would do | **yes** |
| Requests continuing after you navigate away | **yes** — nothing aborts on unmount |

The pool holds 10 connections. Ten concurrent requests from *one teacher opening one page* is the whole pool, and because nothing aborts on unmount they keep holding it after she has moved on. On Render a round-trip is 1–2 ms so the wall-clock is ~50 ms rather than 2 s — but the connection-holding is the same, and that is what breaks under concurrency.

**Fix:** one `/api/planner` endpoint returning all five lists in a single query, exactly as the dashboard now does (F51) — 25 round-trips become 5. Plus an `AbortController` in `apiList` so leaving a screen cancels its fetches. Studio already does this for generation; nothing else does.

Not done today: it is a new endpoint plus a change to the shared fetch helper, and the day's work is already large.

### F55 — withTenant costs four round-trips per request 📖 Code-read — open, watch
Measured while investigating F51. On this machine a bare query is 97 ms and `withTenant()` + one query is **482 ms** — the difference is `BEGIN`, `SET LOCAL ROLE`, `set_config` and `COMMIT`, four extra round-trips, on **every tenant-scoped request in the app**.

This is not a bug and it is not urgent: on Render the app and Neon sit in the same region, so a round-trip is 1–2 ms and the same four cost 5–10 ms. It looks alarming locally only because dev talks to Neon across the public internet.

Recorded because it is the single biggest fixed cost per request, and if latency ever rises it multiplies by four. If it needs addressing, the route is to fold `SET LOCAL ROLE` and `set_config` into the `BEGIN` as one multi-statement — which touches the RLS boundary and therefore deserves its own careful change, not a drive-by.



### F32 — Bulletin board was a nav item with nothing behind it ✅ Observed — 🔧 Fixed Day 4
`bulletin-board` sat in the sidebar with no render branch, falling through to "Coming soon" — while the onboarding tour actively promised it: *"Announcements for your classes — notices, reminders, and anything the whole class needs to see."*

Built rather than removed. It is modelled on the physical thing, because that is what a teacher already knows how to use: notes go up, important ones pin to the top, out-of-date ones come down on their own, and the board belongs to a class.

Two columns exist purely so the student and parent portals drop in without a migration — the same reasoning as `student_grades.published_at` (F30):

- **`published_at`** — a note is written first and put up second. Nothing is visible outside the account until the teacher posts it, so a half-typed reminder never reaches a child's screen. Posting is `POST /api/announcements/post` (bulk, capped at 200), not a settable column.
- **`audience`** — Students / Parents / Everyone. A physical board is read by whoever walks past; a digital one has to be told.

Plus `starts_on` / `expires_on` so a notice can be scheduled and drop off on its own, `pinned`, `priority`, and six `kind` values compiled into CHECK constraints from `enums.js`.

Built on `crudRouter` deliberately: cursor pagination, the tenant WHERE, the RLS transaction, soft delete and the 30-day trash all come for free and are already tested. A bespoke router would have been a second implementation of five things already right once.

**The board layout is deliberately provisional.** The current screen is a clean card grid — correct, fast and complete, but not the intended design. The product wants an actual board: notes and stickers spread across a surface and pinned the way they are in a classroom, where clicking a note opens it to read. That is a front-end job and waits for the developer joining the team (agreed 2026-07-31). Nothing about the data model, the API or the posting workflow changes when it is redesigned — the grid is a placeholder for the surface, not for the logic.

Verified: 16 API checks (draft-by-default, post/unpost, `?live=true` honouring the date window, expiry dropping a note by itself, soft delete → trash → restore), 13 cross-tenant checks (teacher B cannot read, edit, take down, un-post, restore or hard-delete teacher A's note; RLS returns zero for an unscoped read and changes nothing on an unscoped write), and a browser pass writing, posting, pinning and filtering. Plans at 4,000 notes: board page 0.06 ms, `?live=true` 0.16 ms, one class's live board 0.11 ms — all index-backed after F53.

### F50 — Attendance is recorded and then read by nothing ✅ Observed — open, scheduled
A teacher can now mark a register (F30), and that data goes nowhere. Verified 2026-07-31 by writing attendance and then reading every surface that could plausibly show it:

| Consumer | Reads attendance? |
|---|---|
| Reports | no — averages come from grades, quizzes, homework only |
| Dashboard | no — `counts` covers students, drafts, templates, quizzes, homework, presentations, activities |
| Planner / TeachingRail | no — schedule, quizzes, homework, presentations, activities |

Worth recording how this nearly got missed: the first check reported that the dashboard *did* show attendance. It was a false positive — the substring `present` matching **`presentations`** in the counts payload. A grep is not a test.

Contrast with the two that ARE connected, both confirmed with live data: a schedule entry written on the Schedule page appears in Planner, TeachingRail and Dashboard (one `/api/schedule` table behind all four), and a grade written in the Gradebook lands in the Reports average immediately.

**Fix:** attendance rate per student in Reports, beside the grade averages. Day 16's parent portal needs exactly that ("child progress, attendance, homework"), so it is the same work whenever it is done.

### F49 — A failed route chunk could not be recovered without a reload ✅ Observed — 🔧 Fixed Day 3
Route-level code splitting makes every screen a network request, so a teacher on school wifi will sometimes fail to load one. The error boundary caught that correctly from the start — but `React.lazy` caches the *rejected* promise on the component, so the section stayed broken for the rest of the session and the fallback's "Try again" button could not help. Only "Reload page" worked.

Observed for real on 2026-07-30, unscripted: restarting the dev server mid-session made `TemplatesLibrary.jsx` and `Quizzes.jsx` genuinely fail to fetch, and both sections were stuck behind the error card until a reload.

**Fixed** with [`src/lib/lazyRoute.js`](../src/lib/lazyRoute.js) — `React.lazy` plus a single retry after 500 ms, used by all 27 split routes. Deliberately one retry, not a loop: a momentary drop or a wifi handover recovers invisibly, while a chunk that is genuinely gone (a stale hashed filename after a deploy) still reaches the error card quickly, where "Reload page" is the only real fix.

Verified by simulating both: a route that fails once renders normally with no error card; a route that always fails still reaches the card and does not hang. Costs 0.1 kB gz.

### F47 — Trash panel showed "Invalid Date · NaN days left" ✅ Observed — 🔧 Fixed Day 3
Found 2026-07-30 while reviewing the pagination change, by exercising `/trash` for the first time with real soft-deleted rows.

`TrashPopup` in [`src/views/_data-view.jsx`](../src/views/_data-view.jsx) renders `Deleted {new Date(r.deleted_at).toLocaleDateString()} · {daysLeft(r.deleted_at)} days left`, but **not one of the six soft-delete routers listed `deleted_at` in its `selectCols`**, so the column never reached the client. Every trash panel in the product rendered `Deleted Invalid Date · NaN days left`. Pre-existing — the `/trash` route always projected `selectCols` — and invisible until someone actually deleted something and opened the panel.

**Fixed** in `crud.js` rather than in the six routers: the `/trash` route only exists because `softDelete` is on, so the column it needs is now derived from that same switch and cannot be forgotten by a router added later. The normal list is untouched, where `deleted_at` is NULL on every row by definition.

Verified on all six resources, and in the browser: the panel now reads `Deleted 7/26/2026 · 26 days left` for a quiz soft-deleted four days earlier.

### F46 — Redis code paths are written but never run against a real Redis 📖 Code-read — open
Day 3 added `REDIS_URL` support for the cache and the rate-limit store. **Neither has been exercised against a live Redis** — no instance is provisioned and there is no Docker on the dev machine. What *is* verified:

- with `REDIS_URL` unset: memory cache + memory limiter store, app behaves exactly as before
- with `REDIS_URL` pointing at a dead port: one warning line, `/healthz` 200, `/api/*` served, requests pass **unlimited** while the store is down (`passOnStoreError: true` — deliberate, see `security.js`)

What is **not** verified: that `RedisStore` counts correctly, that cross-instance invalidation actually propagates, and that the `ready` handler re-arms the log. Provision Redis and re-check before relying on either. Until then, treat multi-instance deploys as unsupported.

**Blocked on access, not on work (2026-07-30).** Render's managed Redis is their "Key Value" product, and only the project manager holds the Render account — Issa cannot create it or set `REDIS_URL` in the production environment. Nothing else is outstanding: the code path, the fallback and the failure behaviour are all written and reviewed.

When it is provisioned, use **two separate instances, not one**. Both environments would otherwise share `murchid:*` keys and `murchid:rl:*` rate-limit counters, so a dev restart or a `cacheFlush()` would clear production's buckets and a dev account id could collide with a production one. The free tier covers two comfortably — we need well under 1 MB.

  - dev  → `REDIS_URL` in the local `.env` (gitignored)
  - prod → `REDIS_URL` in the Render web service's environment variables

Nothing depends on this to ship. One Render instance runs correctly on the in-process cache; Redis is what makes a **second** instance correct.

### F48 — Keyset tiebreaker forced ASC, disabling the fast path on DESC lists ✅ Observed — 🔧 Fixed Day 3
`buildOrderSpec()` appended the `id` tiebreaker as a hardcoded `ASC`. On an all-`DESC` sort that made the clause mixed-direction, which disqualified it from the row-value index predicate in `keysetWhere()` — so a "newest first" list would have been pinned to the slower predicate permanently, for no reason.

Not triggered by anything in the repo today: every `listOrderBy` either names `id` explicitly or leads `ASC`. Found on 2026-07-30 by deliberately testing a `DESC` clause during the pagination review. The tiebreaker now inherits the direction of the term before it, which is also the more natural tie order (newest first → highest id first). Verified: the DESC path now matches both the unpaged query and the safe predicate byte for byte across 140 rows.

### F45 — `/api/teachers` can mutate accounts without an audit trail 📖 Code-read — open
`teachers.js` mounts the generic `crudRouter` on the `accounts` table, giving admin / super_admin / dev a `POST`, `PATCH` and `DELETE` on any account. The dedicated routes in `admin.js` do the same jobs but additionally: refuse self-suspension and self-deletion, enforce `canGrantRole()`, and write an `audit_log` row. The `crudRouter` copies do none of that — a hard `DELETE /api/teachers/:id` leaves no trace.

Noticed 2026-07-30 while wiring account-cache invalidation into every `accounts` write path (the cache made the duplicate surface obvious). Not exploited by the frontend — `AdminConsole` uses `/api/admin/teachers` — so this is a latent gap, not a live one.

**Fix option:** drop `POST`/`DELETE` from the `/api/teachers` router and leave it read-only, since `admin.js` already owns account lifecycle. Left alone for now: it is a behaviour change, not a Day 3 performance concern.

### F38 — Every authenticated request costs two DB round-trips ✅ Observed — 🔧 Fixed Day 3
Measured 2026-07-28 (dev machine → Neon):

| Path | Median |
|---|---|
| `/healthz` (no auth, no DB) | 3.0 ms |
| `/api/me` unauthenticated (rate limiter, no DB) | 2.7 ms |
| Neon round-trip (`SELECT 1`) | **96 ms** |
| `/api/me` authenticated, end to end | **213 ms** |

213 ms decomposes as ~96 ms for `requireAuth`'s `findAccountByUid`, ~96 ms for the handler's own `SELECT`, and ~20 ms of Firebase verification and overhead. **Every** authenticated request pays the first 96 ms, because `requireAuth` re-reads the account row from Postgres on each call.

`/api/me` is the clearest case — `requireAuth` has already loaded the row into `req.account`, then the handler selects the same row again. Note it is *not* a free fix: `ME_SELECT` returns `class_map`, `grade_sections`, `nationality`, `hire_date` and `bio`, which `ACCOUNT_COLS` does not carry, so reusing `req.account` would silently change the profile payload.

**Do not optimise against this number yet.** 96 ms is dev-machine-to-Neon latency; Render and Neon are co-located in production, so the real figure is far lower and tuning against the dev number would target the wrong bottleneck. The correct fix is a short-TTL account cache in `requireAuth`, which belongs with the shared-cache work — it is security-sensitive (role changes, suspension, and single-device session revocation all go stale for the TTL window) and should be done once, deliberately.

**Rate limiting is not the cost.** Confirmed above: the limiter adds no measurable overhead — an `/api` path carrying it came in marginally *faster* than `/healthz` carrying none, i.e. within noise. The limiters are in-memory Map operations.

**Fixed 2026-07-30 (Day 3).** `findAccountByUid()` now reads through a 10-second cache (`backend/lib/cache.js`), so a page load's 3–8 calls collapse onto one row read instead of one each. The `/api/me` half of the finding is untouched and still stands — `ME_SELECT` returns columns `ACCOUNT_COLS` does not, so that handler still issues its own query by design.

The terms this was built under, because they are what keeps it safe:

| | |
|---|---|
| TTL | 10s (`ACCOUNT_CACHE_TTL_SECONDS`, set 0 to disable) — the worst-case delay on a revocation |
| Invalidated by | sign-in / session rotation (`claimSession`), `/api/auth/renew`, `PATCH /api/me`, admin suspend / role change / delete, superadmin permissions, `/api/teachers` PATCH+DELETE, and the expiry flip inside `requireAuth()` itself |
| Not cached | a verified uid with **no** account row — that user is mid-bootstrap and a cached "no such account" would 404 their first requests |
| Multi-instance | with `REDIS_URL` set, invalidation is global. On the in-process fallback it only clears the instance that served the write; the others stay stale until the TTL. **Set `REDIS_URL` before running more than one Render instance.** |

**Reviewed 2026-07-30 — 18 checks, all passing.** Every revocation path was driven through its real route handler, then read back through the same `findAccountByUid()` call `requireAuth()` makes:

| Path | Result |
|---|---|
| admin suspend | status change visible on the next request |
| admin role change | `requireRole()` sees the new role at once |
| superadmin permissions | evicted |
| `PATCH /api/me` | evicted, and the edit is live |
| `PATCH /api/teachers` | evicted, next read returns the new value |
| session rotation | old device's `active_session_id` no longer matches |

Also confirmed: the TTL really is a backstop — with the invalidation deliberately skipped, a direct Postgres change was still stale at T-2s and had refreshed by T+10s. The in-process map is bounded (6,000 writes → 5,000 entries held). `ACCOUNT_CACHE_TTL_SECONDS=0` bypasses the cache completely. An unknown uid is never cached, keeping the first-login bootstrap window open.

Measured dev→Neon: cold read 95 ms, warm read sub-millisecond. Note 95 ms is dev-machine-to-Neon latency — on Render, co-located with Neon, the saving is smaller. The shape of the win (one row read per 10s instead of one per request) is what matters, not that multiple.

**One known bound:** `npm run db:init` writes to `accounts` (role reconciliation) from a separate process, so it cannot clear a running server's in-memory cache. A role changed by `db:init` while the server is up is visible within the TTL. Deliberate — it is a deliberate admin action, and 10 seconds is immaterial.

### F37 — PlannerTour measure() is unthrottled 📖 Code-read — deferred
`src/views/onboarding/PlannerTour.jsx` re-measures on every `scroll`/`resize` event with no rAF throttle, and each call does a `querySelectorAll` plus `getBoundingClientRect`. Only runs while the tour is open (max two sessions per teacher), so impact is bounded — but it should be rAF-throttled. Raised and deliberately deferred 2026-07-28.

---

## Sweep — 2026-08-03

### F59 — `/dashboard` was built, routed, lazy-loaded, and in no menu ✅ Observed — 🔧 Fixed
The third orphan, missed by the Day 4 sweep that caught Attendance, Gradebook, Reports, Schedule and Library. `dashboard` was in `SECTIONS_BY_ROLE.teacher`, had a render branch in `App.jsx` and its own `lazyRoute` import — everything except an entry in `TEACHER_NAV`. So it worked perfectly and no teacher could reach it.

It is not a duplicate of Planner: `Dashboard.jsx` is the **today** view, picking the lesson the teacher is most likely in right now (`pickNowLesson` resolves live / next / done), while Planner is the month grid. Added to Planning above Planner.

Two things surfaced while wiring it:
- **`nav.dashboard` and `nav.library` did not exist in either dictionary.** `navLabel()` falls back to the hardcoded English `label` when a key is missing, so Library has been rendering "Library" in Arabic mode all along — a quiet instance of F34. Both keys added, EN + AR.
- **Bulletin board and Library both rendered the badge letter "B"** (Bulletin / Books). Library now uses the glyph `▤`, matching Planner's `▦` rather than inventing a third letter.

### F45 — closed 🔧 Fixed
`/api/teachers` is now read-only. `crudRouter` gained a `readOnly` option that registers the two GET routes and drops POST / PATCH / DELETE (and, where soft delete is on, restore / forever).

Verified by enumerating the mounted router's stack rather than by probing HTTP, because `requireAuth` runs before routing and answers 401 for every verb either way:

| Router | routes | write routes |
|---|---|---|
| `/api/teachers` | 2 | **0** |
| `/api/templates` (control) | 8 | 5 |

Account writes keep going to `admin.js`, which refuses self-suspension and self-deletion, enforces `canGrantRole()` and writes an `audit_log` row. Nothing in the frontend called the removed verbs — `AdminConsole` uses `/api/admin/teachers` — so this closes a latent path rather than changing behaviour. Worth stating plainly why it mattered: a hard `DELETE /api/teachers/:id` cascade-deletes 15 tables *and* sets that account's `audit_log.account_id` to NULL, so the delete erased its own evidence.

### F56 — closed 🔧 Fixed
New `GET /api/planner` returns all five calendar lists from one query, in the same shape as the F51 dashboard fix. `Planner.jsx` and `TeachingRail.jsx` both call it.

Measured dev-machine-to-Neon, median of three after a warm-up:

| | median |
|---|---|
| OLD — 5 separate `withTenant()` transactions | **3,273 ms** |
| NEW — 1 transaction, 1 query | **505 ms** |

6.5×, and that is per component: these two render together on the teaching sections, so the old cost landed twice.

The `scheduled_for IS NOT NULL` / `due_date IS NOT NULL` / `status <> 'done'` filters moved into SQL, since both consumers dropped those rows on arrival anyway — less payload, and the date indexes can work. `IS DISTINCT FROM` for the status filter because the column is nullable.

**Also the second half of the finding:** `api()` now accepts an `AbortSignal`, and both components abort on unmount. This is the part that mattered under concurrency — the pool holds 10 connections and nothing previously stopped a query for a screen the teacher had already left. An abort surfaces as `code: "aborted"` so callers ignore it in one check instead of string-matching DOMException messages.

One behaviour change worth recording: the old code used `Promise.allSettled`, so a single failing list degraded to a partly-filled calendar. One request cannot do that — it returns every list or none — so both call sites now log and leave the grid empty rather than throwing into an unhandled rejection.

### F52 — closed 🔧 Fixed
Studio's save has branches for homework and presentation, following the activity one.

- **Homework** maps cleanly: `instructions` is a text column, so the generated markdown goes straight in. `status` is left to the column default (`'Open'`), which is what HomeworkBuilder starts a new assignment with.
- **Presentations** needed a conversion, because the deck lives in `slides` jsonb while Studio produces markdown. Split on headings into `{title, body}` — deliberately the minimal shape, because `deckFromPresentation()` already splits `body` into bullets when `bullets` is absent and picks layout/background itself. Producing full slide objects would have put those defaults in two places.

Text before the first heading becomes the opening slide rather than being dropped. Both payloads were checked against the routers' `FIELDS` allowlists — nothing is silently discarded — and `slides` is already declared in `jsonFields`, so the array is stringified rather than sent as a Postgres array literal.

Also added `sectionToColumn()`: the Section chip can hold several values but both tables store one TEXT column, so it joins rather than keeping the first and quietly losing the rest.

### F27 — closed 🔧 Fixed
Chips with exactly one possible option are now filled in automatically once the profile arrives. On the measured account that is three of the five required chips, so `Make it` is reachable in two clicks instead of five.

Only ever fills a field the teacher left empty, and only when the list has literally one candidate — it cannot override or guess at a choice. A one-option list carries no information, so picking from it was never a decision the teacher was making; it was one onboarding already made.

The option lists are now `useMemo`d. They are effect dependencies, and rebuilt inline they carried a new array identity every render.

### F35 — closed 🔧 Fixed
The My-students grade filter is derived from the grades present in the roster, exactly as `sectionOptions` already was — instead of the full KG-1..Grade-12 catalog. The heading above it promises "Only kids in the grades you teach"; the filter was offering fourteen options, thirteen of which were guaranteed to return an empty table.

Sorted in curriculum order rather than alphabetically, so it reads KG 1, KG 2, Grade 2, Grade 10 — not Grade 1, Grade 10, Grade 11, Grade 2. A grade not in the catalog sorts last rather than being dropped.

### F29 — closed 🔧 Fixed
"1 schools" / "1 languages" came from plural nouns baked into the i18n strings (`"{n} schools"`). `t()` is a plain key-and-substitute with no plural support, and building one was more than this needed, so the two summaries now pick between a `_one` key and the plural at the call site. The subjects line is composed from two halves so each noun pluralises on its own count — "1 subject · 2 languages" is not expressible in a single template.

**⚠️ Arabic is singular/plural only.** Arabic also has a dual form and reverts to the singular noun above ten, so the counts still want a native-speaker review before launch — same standing caveat as F17.

### F13 — closed 🔧 Fixed
`src/lib/currentUser.js` deleted. It exported `CURRENT_TEACHER_STAFF_ID = "STF-001"` and claimed to be imported by `vite.config.js`; nothing in `src/`, `backend/` or the Vite config referenced it.

`src/lib/account.js`'s header said "There is NO real auth yet". Firebase landed and the module's shape was kept exactly as that comment intended, so only the description was wrong. Rewritten to say what it actually is: a localStorage cache of provider / plan / pending onboarding answers, explicitly **not** the authority on identity — `/api/me` and the server's `requireAuth()` / `requireRole()` are.

### F60 — 🔴 A lapsed trial ejects the teacher to marketing with no explanation and no way to renew ✅ Observed — 🔧 Fixed 2026-08-04
Found by hitting it: the test account's 7-day trial expired at 05:10 on 2026-08-03 and every studio URL began bouncing to the landing page, with the nav showing **SIGN IN** as though the session were gone. It was not — Firebase still held the user and `murchid.session.id` was intact. The only clue anywhere was one console line: `Your subscription has ended.`

`requireAuth` returns 403 `subscription_expired`, and `App.jsx:247` handles it by calling `clearAccount()` and `clearRoute()`. Its comment says both cases are "bounced back to landing so they can complete plan-pick / renew". They cannot:

- The landing renders its signed-out state, so the teacher is told they are logged out when they are not.
- **`grep -rn "auth/renew" src/` returns nothing.** `POST /api/auth/renew` exists, is tested, bypasses the subscription gate via `allowExpired: true` — and has no caller anywhere in the frontend.

So the renewal endpoint is unreachable from the product at the exact moment it is needed. This is the conversion moment for every trial user and it currently dead-ends in a screen that says "Sign in".

Distinct from F5 (no payment integration). F5 is "nobody can pay". This is "when the trial ends, the teacher is silently ejected and cannot even reach the thing that would extend them, payment or not". Fixing F5 does not fix this; the funnel still has no door.

**Also worth noting:** `requireAuth` flips `subscription_status` to `'expired'` on first detection, so the state is sticky — the row said `expired` even after the end date was pushed forward, until it was set back to `trial` explicitly.

**Fix:** a real lapsed state. Keep the teacher signed in, render an "Your trial ended" screen with the plan picker wired to `POST /api/auth/renew`, and stop clearing the local account on 403 — the account is not gone, only unpaid.

**Fixed 2026-08-04.** [`SubscriptionLapsed.jsx`](../src/views/SubscriptionLapsed.jsx) is that screen, raised by `App.jsx` as state rather than a route — nothing is cleared and nothing is navigated, so a renew returns the teacher to the exact screen they were on.

Three parts:

- **`App.jsx` no longer treats an expiry as an ejection.** `no_teacher_row` still bounces to landing (that teacher genuinely has no account); `subscription_expired` now sets `lapsed` and keeps everything.
- **The gate can be raised from anywhere, not just the boot check.** A trial that elapses mid-session surfaces on the teacher's *next action*, not at sign-in, so `api()` dispatches `murchid:subscription-expired` on any 403 and `App.jsx` listens. Deliberately an announcement and not a teardown — the mirror-image mistake to `handleSessionSuperseded()`, which *should* tear down, is exactly what caused this finding.
- **The 403 now carries `plan` and `endedAt`.** Once the gate closes every other route 403s too, so that response is the only account data the client can still reach; without it the screen cannot say what ended or when.

The 20s heartbeat pauses while lapsed — every beat would 403 and re-announce something already on screen.

**Verified in the running app, both paths:**

| | shows |
|---|---|
| `plan='trial'`, reload | "Your free trial has **ended.**" + "Your access ended on 2 August 2026" |
| `plan='quarterly'`, expired mid-session, no reload | "Your membership has **lapsed.**" raised on the next nav click |

Choosing Quarterly wrote `status=active, plan=quarterly, ends_at=+90d`, logged `auth.renew` with `prevStatus: 'expired'` (confirming the sticky flip and its recovery), dropped the gate, and returned to `/planner` with the sidebar identity intact. Test account restored to its original row afterwards.

**Still true, and not this finding:** nobody can actually pay (F5). The gate says "No card required yet" rather than implying a purchase, and `POST /api/auth/renew` is what the Checkout webhook will call once Stripe lands — so the screen does not change shape when it does.

### F61 — `/api/me` was fetched five times on one page load ✅ Observed — 🔧 Fixed
Measured on a clean Planner load: **five identical `/api/me` requests**. Eleven call sites fetch it independently — `App.jsx`, `Studio`, `TeachingRail`, `Dashboard`, `AccountProfile`, `DatabaseProfile`, `useTeacherClasses`, and `Planner` **three times on its own** (tour gate, tour close, form dropdowns).

The Day 3 account cache (F38) does not cover this: `/api/me` has its own handler with `ME_SELECT`, which returns columns `ACCOUNT_COLS` does not carry, so it issues a real query every time. Five requests were five round-trips and five queries for one screen's worth of the same unchanging row.

**Fixed** with a shared `getProfile()` in `_shared.jsx` — concurrent callers share the in-flight promise, and a 30s TTL covers the mount storm. TTL is deliberately short because the profile drives which grades and sections the forms offer, so a stale one shows the wrong dropdowns. `invalidateProfile()` is called by both `PATCH /api/me` sites and after the tour-seen write.

`App.jsx`'s boot check is deliberately **left uncached**: it is the call that detects `no_teacher_row` and `subscription_expired`, and caching it could mask a revoked account for the TTL window.

Measured on the same screen, before → after:

| | requests |
|---|---|
| Before F56 | 5 × `/api/me` + 10 list calls |
| After F56 | 5 × `/api/me` + 1 × `/api/planner` = **6** |
| After F61 | 2 × `/api/me` + 1 × `/api/planner` = **3** |

### F62 — Sidebar identity never recovers once the local account is cleared ✅ Observed — 🔧 Fixed 2026-08-04
After the F60 ejection the sidebar footer read **"Teacher"** with no name, while the Dashboard header on the same screen greeted **"Good morning, afras"**. The header reads `/api/me`; the sidebar reads the localStorage account, which `clearAccount()` had just emptied.

`App.jsx` does mirror `/api/me` back into the local account, but through `updateProfile(patch)`, which patches an existing account object — with nothing there it has nothing to patch, so the name never returns for the rest of the session. Any teacher who clears site data hits the same thing.

**Fix:** when `/api/me` succeeds and no local account exists, seed one from the response rather than only patching.

**Fixed 2026-08-04**, alongside F60 — which removed the eviction that caused it, but not the underlying fragility (clearing site data reproduces it identically). `App.jsx`'s `reseedLocalAccount()` rebuilds a whole account instead of patching a missing one. It needs a provider *and* a plan or `getAccount()` rejects the row on the next read, and `/api/me` carries neither — hence Firebase's `providerData` for the provider and a one-off `/api/auth/me` for the plan. It runs only when local storage is genuinely empty, and fails silently: a cosmetic re-hydrate must never interrupt a teacher whose session is working.

### F63 — 🔴 Opening a deleted presentation hung on the loading spinner forever ✅ Observed — 🔧 Fixed
Found by Issa on 2026-08-03: `/presentations/edit/15` sat on the brand loader and never resolved. The row had been deleted in another tab while that URL was still open.

The cause is two lines disagreeing in [`PresentationBuilder.jsx`](../src/views/PresentationBuilder.jsx). The fetch's `catch` cleared `loading`, which looks like correct error handling — but left `row` as `null`, and the render guard tested `loading || !deck`. With `row` null, `deck` is null, so `!deck` stayed true and the loader rendered **forever**. Clearing the flag achieved nothing because the other half of the condition was never false.

It is not an edge case: it fires whenever a deck is opened after being deleted — a stale tab, a bookmark, a browser restoring the session — and on any network drop mid-load. The screen offers no error, no retry and no way out except the browser's back button.

**Fixed** by making a failed load a distinct state rather than an absent one. `loadError` separates 404 ("This deck is no longer here", pointing at Recently deleted, which is where it actually is for 30 days) from a transport failure ("Something went wrong", with a Try again that re-runs the fetch via a `reloadKey` bump rather than a remount). Aborts are ignored — they are unmounts, not failures.

Verified on the exact URL: the not-found card renders, and "Back to presentations" returns to the list.

**Same class of bug, checked while here:** `QuizBuilder` has no loader guard at all, so a deleted quiz renders an *empty editor* instead of hanging — milder, but it silently invites a teacher to type into a row that no longer exists. Not fixed today; worth the same treatment.

---

## Sweep — 2026-08-04

### F64 — QuizBuilder rendered a blank editor for a quiz that was not there ✅ Observed — 🔧 Fixed
The tail of F63, now closed. Both loads ended in `.catch(() => {})`:

```js
api(`/api/quizzes/${quizId}`).then(...).catch(() => {});
api(`/api/quizzes/${quizId}/questions`).then(setQuestions).catch(() => {});
```

So opening a quiz that had been trashed in another tab produced a clean, empty, fully editable form — no message, no clue. Worse than F63's hang in one respect: a hang at least stops the teacher. This one invites them to retype a quiz into a row that no longer exists, and lose it on the first save.

Fixed the same way F63 was — a failed load is a *state*, not an absence. `loadError` separates 404 ("This quiz is no longer here", pointing at Recently deleted) from a transport failure ("Something went wrong", with Try again re-running the fetch via a `reloadKey` bump rather than a remount). Both requests now go through one `Promise.all`, because a quiz whose meta arrived but whose questions did not is the same empty editor by another route.

**`initialQuizId` is the subtlety.** `quizId` is state, not a prop, because `saveMeta()` assigns one after creating a brand-new quiz — which re-runs the load effect. Gating the render on that pass would blank the editor a teacher is actively typing in, so only the initial load raises the loader or the error card; a failed re-fetch of a row we already hold stays quiet.

**Found while verifying, and fixed with it: `QuizBuilder` was never keyed.** Because the id lives in state it is seeded exactly once, so changing `:id` in the URL left the editor bound to the *previous* quiz and its load guard never re-ran. `App.jsx` now passes `key={extraId}`. This surfaced by accident — a test navigation from `/quizzes/edit/abc` to `/quizzes/edit/142` kept rendering "New quiz".

**`HomeworkBuilder` and `ActivityBuilder` had the identical shape and were fixed in the same session** — both swallowed their load in `.catch(() => {})`, both hold the id in state, both were unkeyed. `PresentationBuilder` derives its id from the prop, so it re-fetches correctly and needs no key; F63's fix is sound as written.

**Extracted rather than pasted a fourth time.** Three near-identical copies of this guard was the signal: `useRowLoader()` and `LoadErrorCard` now live in [`_shared.jsx`](../src/views/_shared.jsx) and all three builders use them. The hook owns the `initialId` rule, the abort handling and the 404-vs-transport split, so the next builder inherits the fix instead of re-deriving it — and the error copy stays with each caller, because "this deck is no longer here" and "this quiz is no longer here" point at different places and will need translating separately.

**Verified in the running app**, all four states:

| State | Renders |
|---|---|
| `/quizzes/new` | the blank form, no loader |
| existing quiz | editor with title, meta and questions |
| trashed quiz (`deleted_at` set, opened by URL) | "This quiz is no longer here." — no Try again, since retrying a 404 cannot help |
| fetch rejected (injected `TypeError`) | "Something went wrong." + **Try again**, which recovered the quiz in place once the fault was lifted |

Creating a quiz and watching it transition `new → edit` confirmed the `initialQuizId` guard: no loader flash, no blanking, title and question intact. Test quiz deleted afterwards.

After the extraction, re-verified: `/quizzes/edit/999999`, `/homework/edit/999999` and `/activities/edit/999999` each render their own not-found card, and creating a homework transitioned `new → edit` through the shared hook with no loader flash and the title intact. Test rows deleted; the account is back to zero quizzes, homework and activities.

---

## To confirm once the app runs

Checklist for the live walkthrough — **do not report these as findings until observed:**

1. Does the OTP step actually fire after a Google sign-in? (F9) — **still open.** `RESEND_API_KEY` is unset, so it cannot fire today either way.
2. ~~Which teaching surfaces are real vs shells — Bulletin board, Library, Reports?~~ — **answered.** Bulletin board is a "Coming soon" stub (F32); Library is complete but orphaned (F33); Reports is complete but URL-only and starved of data (F31, F30).
3. ~~Does the Planner show anything useful on a brand-new account?~~ — **answered.** Good empty state: "Your month is open — pick a topic to start" plus four quick actions and a 0%/Planned/Completed/To-do strip.
4. What does Studio do with `ai_studio` off? — **still open.** Untestable while `ANTHROPIC_API_KEY` is unset: the key check would fail even with the flag on, so we can't tell the two error paths apart yet.
5. ~~Does the onboarding wizard's data reach the server?~~ — **answered** (first walkthrough, verified in Postgres) and reconfirmed indirectly: Studio's chip menus offer exactly the onboarding values.
6. Do the builders save correctly and round-trip on edit? — **still open.** All four *render* correctly, but nothing was saved. Needs write access to the dev Neon branch.
7. Does the trash / restore flow work? — **partial.** The trash panel opens on Quizzes; restore and delete-forever are untested (needs a deleted row, i.e. item 6 first).
8. Does Arabic (RTL) hold up across the studio? — **partial.** Chrome and layout mirror correctly; untranslated strings leak through (F34), and 22 views are hardcoded English including all of My students.
9. Mobile / tablet layout — **still open.** Teachers will use iPads.
10. ~~What happens on a second-device sign-in?~~ — **answered** (F26): same person, same machine, minutes apart is enough to trigger the lockout, and the app keeps looking signed in afterwards.

**New open questions from the second pass:**

11. Once F30 is wired up, do `DatabaseAttendance` and `DatabaseGrades` actually work, or have they rotted while unreachable? Nothing has exercised them — assume nothing.
12. Is F22 browser-specific? It reproduced 5× in the first pass and 0× in 18 attempts in the second, in a different browser. Worth one check in the browser where it originally crashed before spending time on the race itself.
