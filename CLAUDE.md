# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

# Murchid — Teacher Studio

AI lesson director for teachers (KG–G12), UAE-first, bilingual EN/AR. React 18 + Vite 5 frontend, Express 5 + Neon Postgres backend, Firebase Auth, Anthropic for generation.

**One bundle, three surfaces** — `src/main.jsx` picks by pathname:

| Pathname | Surface |
|---|---|
| `/` | `src/views/Landing.jsx` + `src/landing.css` — marketing |
| `/dev`, `/superadmin`, `/admin`, `/owner`, `/moe` | `src/views/PortalSignIn.jsx` — privileged staff sign-in, deliberately unlinked from the nav |
| anything else | `src/App.jsx` — the studio workspace |

**One Express app, two hosts.** `backend/app.js` exports `buildApp()`, consumed twice: `vite.config.js` mounts it as dev middleware (so `npm run dev` alone is a full stack), and `backend/index.js` runs it standalone on Render. Never add an endpoint to `vite.config.js` — add a router under `backend/routes/` and mount it in `app.js`.

The user (Issa) calls the project "murchid" — that's the **product** name, not the assistant.

## Current priority — read these first

- [`docs/13-architecture.md`](docs/13-architecture.md) — **target system design.** Roles, data model, 5-layer security, AI gateway, performance architecture, migration path. What we are building toward
- [`docs/14-roadmap.md`](docs/14-roadmap.md) — **the active build plan.** 18 days, day-by-day, with files and done-criteria. Day 12 is the shippable milestone
- [`docs/12-findings.md`](docs/12-findings.md) — running list of what's broken. **Mark findings ✅ Observed only after seeing them in the running app**; code-read inferences stay 📖 until confirmed
- [`docs/11-plan.md`](docs/11-plan.md) — earlier 2-week plan, unit economics, cut list. Superseded by 13/14 but the economics still hold

### Where we are right now

**Days 1–5 of [`docs/14-roadmap.md`](docs/14-roadmap.md) are done and pushed to `dev`** (`dev` tracks `origin/dev`; `main` is untouched at `b4e92ab` and still what deploys). Last session ended 2026-07-31.

Days 1–3 shipped error boundaries, three-layer rate limiting, the AI usage ledger, row-level security, keyset pagination (`backend/lib/pagination.js`, all 11 crudRouter resources), the cache layer (`backend/lib/cache.js`) and route-level code splitting (initial payload **271 → 92 KB gzip**).

Day 4 — **wire the orphans**, all six items:
- Attendance + Gradebook are tabs under My students; Reports, Schedule and Library are in the sidebar (F30, F31, F33)
- `student_grades.published_at` — a grade is a draft until released through `POST /api/grades/publish`. Added *now* so the day-16 parent portal drops in without a migration and a mistyped mark never reaches a parent
- **The bulletin board is new** — `announcements` table, `backend/routes/announcements.js` on crudRouter, `src/views/BulletinBoard.jsx` (F32). Same `published_at` gate, plus an `audience` column. **Its layout is a deliberate placeholder**: the product wants a real pinned-notes board, and that is the incoming front-end developer's job. The data model, API and draft-then-post workflow do not change when it is redesigned
- Studio's `activity` kind is exposed and saves to `/api/activities`

Day 5 — **fix the funnel**, four of six:
- Consent box is never pre-ticked (F16); consent text translated to Arabic (F17)
- Popup-blocked sign-in falls back to redirect instead of failing silently (F23); no Firebase SDK string reaches a teacher (F18)
- `/signin` and `/signup` are real URLs; a bounced deep link explains itself and returns you (F19, F20)
- **Deferred to Sunday 2026-08-02:** the Outlook claim (item 3 — needs a decision: remove it, or add Microsoft OAuth, which needs the PM) and the device list (item 6 — see below)

Also fixed this session, all found by measuring rather than reading: the dashboard ran seven queries serialised on one client (F51 — **1058 ms → 483 ms**), two Day 5 features shared one sessionStorage key and cancelled each other (F54), the Planner tour replayed on every sign-in (F57 — took three attempts, the flag now lives on `accounts.tour_planner_seen_at`), and Planner could not scroll on a maximised window (F58).

### Pick up here

**Blocked on credentials — Sunday 2026-08-02.** Issa adds these to `.env` himself; they never go in chat.
- `ANTHROPIC_API_KEY` → then flip `ai_studio` on and test Studio's activity generate-and-save (Day 4 item 6's last hop)
- `REDIS_URL` → F46. Needs the **project manager**: Render's managed Redis is their "Key Value" product and Issa has no Render access

**Next work, in the order it is worth doing:**
1. **F56 — Planner costs 25 database round-trips.** Planner and TeachingRail each fetch the same five lists as five separate `withTenant()` transactions. Nothing aborts on unmount, so they keep holding pool connections after the teacher navigates away, and the pool holds 10. The biggest remaining performance win: one `/api/planner` endpoint plus an `AbortController` in `apiList`
2. **Day 5 item 6 — the device list** (F10, F26). Stops evicting a teacher when they open a second device. **This is an auth-path change and it collides with the Day 3 account cache**: `requireAuth` currently reads one `active_session_id` that rides along in the cached row, so a naive device list reintroduces F38's per-request query. Design it deliberately
3. **`/dashboard` has no nav item** — reachable by URL, never registered in `TEACHER_NAV`. The third orphan, missed on Day 4
4. Day 6 — polish + i18n sweep

**Open findings worth knowing:** F50 (attendance is recorded but nothing reads it), F52 (Studio still saves homework and presentations into the drafts table), F55 (`withTenant` costs four round-trips per request — 5–10 ms on Render, fine, but the largest fixed cost), F45 (`/api/teachers` mutates accounts with no audit trail), F37 (PlannerTour `measure()` unthrottled).

### Three facts that shape most decisions

1. **No payment integration exists.** `/api/auth/renew` is a placeholder — nobody can pay yet. → Day 10.
2. **AI spend is now measured, but not yet capped.** `ai_usage_ledger` records cost per call in integer nano-USD, so COGS is knowable. There is still no per-account quota — that lands with the AI gateway on Day 7, and until then `ai_studio` shipping disabled is the only ceiling.
3. **The AI budget is ~$1.40/user/month** (AED 29.99/mo ≈ $8.17; annual plan $6.12 after 25% off). Output tokens dominate. Measured on the ledger's own pricing table: a lesson plan is ~$0.019 and a quiz ~$0.037 — a quiz bills **two** Anthropic calls (stream + forced-tool restructure). At three artifacts per school day a teacher already exceeds the budget, so model routing and `max_tokens` caps matter more than caching.

## Where to find things

Full documentation lives in [`docs/`](docs/README.md). Read it before making non-trivial changes:

- [01 — Overview](docs/01-overview.md) — what Murchid is, who it's for
- [02 — Getting started](docs/02-getting-started.md) — env, scripts, prereqs
- [03 — Tech stack](docs/03-tech-stack.md) — Vite 5, React 18, Tailwind v4, Neon Postgres
- [04 — Architecture](docs/04-architecture.md) — file layout, boot flow, view router
- [05 — Design system](docs/05-design-system.md) — brand tokens, fonts, patterns
- [06 — Database](docs/06-database.md) — schema, status / subject values, seeds
- [07 — API](docs/07-api.md) — Vite-middleware endpoints (dev-only)
- [08 — Views](docs/08-views.md) — what each screen does
- [09 — Conventions](docs/09-conventions.md) — rules to follow when adding code
- [10 — Roadmap](docs/10-roadmap.md) — what's stubbed, what's missing, what's next
- [11 — Plan](docs/11-plan.md) — **active** 2-week plan, unit economics, cut list
- [12 — Findings](docs/12-findings.md) — **active** bug/issue log

⚠️ **Docs 04, 07, and parts of 09 are stale** — they predate the Express backend, Firebase auth, roles/portals and pathname routing. `09-conventions.md` still says "don't add a router" and "share the pool in vite.config.js"; both are now false. Trust the code over those docs, and fix the doc for whichever section you're touching. The design-system content (05, and the styling half of 09) is still accurate and worth reading before UI work.

## Hard rules when working in this repo

1. **Visual quality matters.** The user compares against polished editorial design references. Match the Murchid aesthetic precisely: cream paper bg, Fraunces serif titles with red italic accents, JetBrains Mono eyebrows in uppercase tracking, Inter Tight body. See [Design system](docs/05-design-system.md).
2. **Don't override `bg-*` / `text-*` on `<Button>` via `className`** — class collisions cause invisible buttons. Add a variant in `src/components/ui/button.jsx` instead.
3. **`index.html` is the Vite shell only** (`<div id="root">` + Google Fonts: Fraunces, Inter Tight, JetBrains Mono, Amiri). All marketing markup lives in `src/views/Landing.jsx`, all marketing CSS in `src/landing.css`. Don't put marketing content in `index.html`.
4. **Don't commit `.env`.** It's gitignored. Connection strings stay local.
5. **The landing page CSS is global and class-scoped** (`.hero`, `.lesson-card`, `.dash-mock`, etc.) — it coexists with the studio's Tailwind. Don't reuse those class names in studio components.
6. **No router library, no state library.** Routing is hand-rolled in `src/lib/route.js` — pathname-based, no `#` in URLs (`navigate(["quizzes","new"])`, `useRoute()`, `setNavGuard()` for unsaved work). `App.jsx` derives both the sidebar and the set of reachable sections from role (`NAV_BY_ROLE`, `SECTIONS_BY_ROLE`, `DEFAULT_ROUTE`) — **adding a view means registering it in both maps**, or the URL silently bounces to the role's default.
7. **`crud.js` carries the tenant boundary; Postgres RLS is the backstop under it.** `crudRouter({ teacherScoped: true })` appends `WHERE account_id = $1` to every read and stamps it on every insert — that is still the first line of defence and must not be weakened. Underneath it, `withTenant()` (`backend/lib/db.js`) runs each scoped handler in a transaction as the non-privileged `murchid_app` role with the tenant bound, so row-level policies apply: a query that forgets to scope returns **zero rows** instead of another teacher's data.
   - **Anything you hand-write that touches a tenant table must go through `withTenant(accountId, db => …)`.** A query sent on the shared `pool` runs as `neondb_owner`, which has `BYPASSRLS` — it works, but it is unprotected. Every tenant-touching route is now migrated; keep it that way. For a handler that must own its own transaction, `BEGIN` then call `bindTenant(client, accountId)`.
   - **Routes that are cross-tenant by design stay on `pool`** — `admin`, `superadmin`, `owner`, `moe`, `dev`, `auth`, `me`. They are gated by `requireRole()` at the mount point and must see across accounts; do not "fix" them with `withTenant`.
   - **Never "just enable RLS" and assume it works here.** `neondb_owner` carries `BYPASSRLS`, which defeats even `FORCE ROW LEVEL SECURITY` — policies applied while connected as the owner are silently inert. Verify enforcement with a real cross-tenant read; don't infer it from the schema.
8. **Never hardcode majors / grade levels / nationalities / quiz enums** outside `src/lib/enums.js`, and never let users free-type them. `backend/db/init.js` compiles those lists into SQL `CHECK` constraints, so a new value isn't insertable until `npm run db:init` re-runs.
9. **Client calls go through `api()`** from `src/views/_shared.jsx` — it attaches the Firebase token and `X-Session-Id` and throws on non-2xx. Don't call bare `fetch` for `/api/*`. **For a list endpoint use `apiList()`**, which follows the cursor and returns a plain array; pass `onPage` when the screen should paint the first page instead of waiting for all of them.
10. **Every `crudRouter` list is paginated and there is no opt-out.** `?limit=` defaults to 50 and is capped at 200; `?cursor=` is opaque and shape-checked. Adding a resource inherits this for free — but its `listOrderBy` must be plain `column [ASC|DESC] [NULLS FIRST|LAST]` terms, because `buildOrderSpec()` parses it to build the keyset predicate and **throws at boot** on anything it can't express. If you change a `listOrderBy`, change the matching composite index in `backend/db/init.js` with it (`SCHEMA_KEYSET_INDEXES`), or the list silently drops to a full sort.
11. **Cache reads through `backend/lib/cache.js`, and it always fails open.** Never let a cache miss or a Redis outage turn into an error — that is the one rule the module enforces for you. Caching anything authorisation-shaped means owning its invalidation on every write path; see the F38 table in [`docs/12-findings.md`](docs/12-findings.md) for the contract the account cache is held to.
12. **Comments explain *why*, not *what*.** The dense rationale blocks above the middleware stack in `backend/app.js` are the house style. Match that density; don't narrate self-evident code.

## Commands

```bash
npm install
npm run db:init        # one-time, and after any enums.js / init.js change. Idempotent
npm run dev            # http://localhost:5173 — full stack, Express mounts as Vite middleware
npm run build          # static dist/ for Vercel
npm run start:backend  # standalone Express, what Render runs
```

**There is no test framework, no linter and no formatter in this repo** — no `test` script, no eslint/prettier config, no test directory. Don't invent a command for them; verification today means running `npm run dev` and exercising the app. Adding a test runner is scoped in [`docs/14-roadmap.md`](docs/14-roadmap.md) day 2 (a cross-tenant scope suite is the first thing worth testing).

`.claude/launch.json` defines the `murchid-dev` preview config — use the preview/browser tools to run and verify, not a bare `npm run dev` in a shell.

## Traps that cost time

Verified in the running app, 2026-07-28. Each of these looks like a bug in your change but isn't:

- **The dev rate limiter throttles static assets.** `buildGlobalRateLimit()` is mounted ahead of the routers, and in dev the same Express app serves Vite's module graph — so ~190 requests are burned by two page loads and the whole site starts returning 429 with blank white pages. `backend/lib/security.js` currently carries a `TEMP-DEV-REVIEW` skip for non-`/api/*` paths in dev. If pages go blank, check this first.
- **One view is still unreachable: `/dashboard`.** It renders and is reachable by URL, but was never registered in `TEACHER_NAV`, so nothing in the UI links to it. Attendance, Gradebook, Reports, Schedule, Library and the bulletin board were all wired on Day 4 — this is the one that was missed.
- **The bulletin board's layout is a placeholder.** `src/views/BulletinBoard.jsx` is a card grid; the product wants a real pinned-notes board and that is the incoming front-end developer's work. The table, the API and the draft-then-post workflow are final — only the surface changes.
- **List endpoints return an envelope, not an array.** Since Day 3 every `crudRouter` list answers `{ items, nextCursor }` and caps a page at 200 rows. On the client, call `apiList()` (from `_shared.jsx`) rather than `api()` — it follows the cursor and passes not-yet-paginated endpoints through untouched. A list screen that renders nothing is usually an `api()` call that should have been `apiList()`.
- **A cursor is tied to its query shape.** Change a router's `listOrderBy` and every cursor a client is holding starts returning 400 "reload the list". That is the intended behaviour, not a bug — but it means a sort change is a client-visible change.
- **The account row is cached for 10 seconds.** Anything you write to `accounts` must call `invalidateAccountById()` / `invalidateAccountByUid()`, or your change is invisible to that user's own session for up to a TTL. The existing call sites are listed under F38 in [`docs/12-findings.md`](docs/12-findings.md).
- **Local `.env` is partial.** `DATABASE_URL` is set; `ANTHROPIC_API_KEY`, `PEXELS_API_KEY` and `RESEND_API_KEY` are not. So AI generation, presentation image search and email OTP all fail locally regardless of feature flags. Missing keys are deliberate — credentials are shared out-of-band, never documented in the repo.
- **`ai_studio` ships disabled** (`backend/db/init.js`). Only a `dev` role can flip it via `PUT /api/dev/feature-flags/:key`.

## Branches

Active development happens on **`dev`**, not `main`. `main` is what deploys, so it stays clean until a unit of work is reviewed. Work lands on `dev` → reviewed → merged to `main` → auto-deploys.

## Deploy policy — push without asking

Applies to `dev`. Merging to `main` is a deliberate act, since it ships to production. When a unit of work is finished, ship it. Do **not** ask for confirmation first. The deploy story is:

- **`git push origin main`** → Vercel auto-deploys the frontend (static `dist/`) **and** Render auto-deploys the backend (`npm run start:backend`). One push covers both.
- **`npm run db:init`** → applies schema / seed / `CHECK` constraints to Neon Postgres. Run this whenever `backend/db/init.js` or `src/lib/enums.js` changes. The script is idempotent — re-running it against an already-seeded DB is safe and will not duplicate rows.

Carve-out: actions that **delete or rewrite live data** on Neon (`TRUNCATE`, dropping columns, destructive migrations) still need explicit confirmation. Idempotent re-init does not.
