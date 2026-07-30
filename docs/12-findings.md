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

### F16 — Legal consent checkbox is pre-ticked ✅ Observed — compliance risk
On the sign-up screen the box is **already ticked** on arrival:
> *"I have read and agree to the Terms & Conditions and the Privacy Policy, including the processing of my data under UAE Federal Decree-Law No. 45 of 2021 (PDPL)."*

A pre-ticked box is not valid consent under PDPL-style regimes — consent must be a clear affirmative action. The notice cites the PDPL by name, which makes the defect worse, not better.

**Impact:** the exact clause a school's procurement or legal reviewer will check. **Fix is one line** — default it unticked and keep the submit button disabled until it's ticked.

### F17 — Legal consent text is not translated into Arabic ✅ Observed
With the site switched to Arabic, the whole page localises correctly — except the consent sentence, which stays in English inside an RTL layout.

**Impact:** an Arabic-speaking teacher is asked to consent to data processing in a language the rest of the page has just demonstrated it can translate. Compounds F16 — pre-ticked *and* not in the user's language.

### F18 — Raw provider errors are shown to users ✅ Observed
Clicking "Continue with Google" surfaced this directly in the UI:
```
Firebase: Error (auth/configuration-not-found).
```
That is the SDK's internal error string. A teacher cannot act on it. (Root cause here was just the dev Firebase project not having Google enabled — the finding is the *presentation*, not the cause.) In Arabic mode the trailing full stop also renders on the wrong side.

**Fix:** map provider error codes to human sentences, with a generic fallback.

### F19 — Auth screens are not routable ✅ Observed
Sign-in and sign-up render as state inside the landing page — the URL stays `http://localhost:5173/` throughout.

**Impact:** you can't link anyone straight to sign-up, marketing can't measure funnel steps, refreshing loses your place, and the back button behaves unexpectedly.

### F20 — Deep links bounce to marketing with no explanation ✅ Observed
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

### F23 — 🔴 Sign-in fails silently ✅ Observed
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

### F30 — 🔴 Attendance and Gradebook are fully built but unreachable ✅ Observed
**The highest-impact finding of this pass.**

`src/views/DatabaseAttendance.jsx` and `src/views/DatabaseGrades.jsx` are complete, working views that are **imported by nothing**. `App.jsx` contains zero references to either — no route, no nav entry, no section key.

Both halves either side of the gap are finished:
- **Backend:** `/api/attendance` (GET roster+status by date/grade/section, PUT upsert, DELETE) and `/api/grades` (full `crudRouter` + `GET /summary`) — both teacher-scoped and ownership-checked.
- **Database:** `attendance` with `UNIQUE(student_id, date)` and an `attendance_status_valid` CHECK; `student_grades` with score/max_score/term/category.
- **Frontend views:** written and functional.

Only the wiring in `App.jsx` is missing.

**Impact:** attendance and grade entry are the two things a teacher touches *every single day* — far more often than lesson generation. Neither can be reached. It also strands a third surface: **Reports** renders "Per-student averages" and reports *"No grades recorded yet"*, reading a table that no teacher has any way to write to. `Reports.jsx` even says grades recorded "elsewhere flow into Reports automatically" — there is no elsewhere.

**Fix:** register both in `NAV_BY_ROLE` and `SECTIONS_BY_ROLE` and add them as tabs in `Database.jsx` (which today hardcodes only `students` and `scores`). Likely a small change for a very large gain — verify the views actually work once reachable before assuming they're complete.

### F31 — Reports and Schedule are reachable by URL only ✅ Observed
Both render correctly at `/reports` and `/schedule`, and both are in `SECTIONS_BY_ROLE`, but neither appears in `NAV_BY_ROLE` — so no teacher will ever find them. Schedule is a working week/list calendar with a New-entry flow; Reports has CSV and PDF export.

**Impact:** finished features with real value, invisible in the product.

### F32 — Bulletin board is a dead nav entry ✅ Observed
The inverse of F31: `bulletin-board` sits in the teacher sidebar under Planning, has no branch in the `App.jsx` render switch, and falls through to the placeholder. Clicking it renders **"BULLETIN BOARD / Coming soon"**.

**Impact:** the second item in the sidebar is a dead end. Either build it or drop it from the nav until it exists.

### F33 — `Library.jsx` is orphaned ✅ Observed
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

### F46 — Redis code paths are written but never run against a real Redis 📖 Code-read — open
Day 3 added `REDIS_URL` support for the cache and the rate-limit store. **Neither has been exercised against a live Redis** — no instance is provisioned and there is no Docker on the dev machine. What *is* verified:

- with `REDIS_URL` unset: memory cache + memory limiter store, app behaves exactly as before
- with `REDIS_URL` pointing at a dead port: one warning line, `/healthz` 200, `/api/*` served, requests pass **unlimited** while the store is down (`passOnStoreError: true` — deliberate, see `security.js`)

What is **not** verified: that `RedisStore` counts correctly, that cross-instance invalidation actually propagates, and that the `ready` handler re-arms the log. Provision Redis and re-check before relying on either. Until then, treat multi-instance deploys as unsupported.

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

Verified: a row changed directly in Postgres is still served from cache (proving it caches), and is re-read immediately after `invalidateAccountById()` (proving eviction works).

### F37 — PlannerTour measure() is unthrottled 📖 Code-read — deferred
`src/views/onboarding/PlannerTour.jsx` re-measures on every `scroll`/`resize` event with no rAF throttle, and each call does a `querySelectorAll` plus `getBoundingClientRect`. Only runs while the tour is open (max two sessions per teacher), so impact is bounded — but it should be rAF-throttled. Raised and deliberately deferred 2026-07-28.

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
