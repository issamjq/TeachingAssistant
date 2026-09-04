# Murchid

A focused, teacher-first LMS: one coherent pipeline (curriculum in → AI-drafted
term material → teacher approval → scheduled and notified) instead of the
feature-pile most LMS products become. Full concept, roles, and the Goal
Planner pipeline: [docs/00-concept.md](docs/00-concept.md). Deferred features
live in [docs/FUTURE-SCOPE.md](docs/FUTURE-SCOPE.md) — add to that instead of
scope-creeping current work.

The user (Issa) calls the project "murchid" — that's the **product** name, not the assistant.

**Next.js (App Router) frontend on Supabase.** The app is being rebuilt from a
blank slate as of the v2 concept — there is no legacy SPA, no pre-migration
views, and no design system doc yet. `app/` is the whole routing surface.

- **New work goes in `src/features/<feature>/`** with a matching route segment under `app/`. Feature modules own their components, `api.ts`, and `types.ts`.
- **There is no backend in this repo.** The browser reads and writes Supabase directly through `src/lib/data/`, with Row Level Security doing the authorisation an API used to do in middleware. The handful of endpoints that need a secret — AI generation, CV parsing, the assistant, the privileged consoles — live in a separate project, deployed at `https://murchid-backend-no24.onrender.com`. Reach it by setting `API_PROXY_TARGET` (**in Vercel too**, or production 404s every AI path); `next.config.ts` then rewrites `/api/*` there server-side. What works, what is blocked, and the exact fixes: [todo/backend-integration.md](todo/backend-integration.md).

## Frontend conventions

- **TypeScript for everything new.** `strict` is on — the codebase is starting clean, so there's no `.jsx` backlog to accommodate.
- **Styling, three non-overlapping tiers:** design tokens + reset in `app/globals.css`; layout/spacing/colour via Tailwind utilities; keyframes and complex selectors in a co-located `Component.module.css`. No new global CSS.
- **Client env vars go through `src/config/env.ts`** — never read `process.env` in a component. `import.meta.env` no longer exists (that was Vite); `NEXT_PUBLIC_*` values are public and inlined into the browser bundle.
- **`app/**` files stay thin** — resolve params, set metadata, render one feature component. No business logic.
- **Keep `"use client"` at the feature-component boundary**, not in layouts, so layouts stay server components.

## Data access

`src/lib/data/` is the whole data layer. `index.ts` maps a path to a
Supabase query and is the only file that knows what is served locally and
what still needs the separate backend (`SERVER_ONLY`). Screens keep
calling `api("/api/students")`; they do not know the difference.

Authorisation is RLS, not application code. Read paths do **not** filter
by owner — the policies already do, and a redundant `.eq("faculty_id", …)`
would only be a second place to get it wrong. Inserts DO supply the owner
id, because a policy checks it rather than filling it in.

`credits`, `subscriptions`, `usage_logs`, `feature_flags` and `audit_log`
are deliberately not writable from the browser. That is the security
argument for going direct at all — a teacher cannot top up their own
balance or extend their own plan.

## Where to find things

- [docs/00-concept.md](docs/00-concept.md) — roles, auth/verification flow, the Goal Planner pipeline, storage recommendation, route map.
- [docs/FUTURE-SCOPE.md](docs/FUTURE-SCOPE.md) — deferred features. Add to it rather than scope-creeping current work.

There is no design-system doc yet — the v2 visual direction hasn't been defined. Don't assume the old cream/Fraunces/red-italic aesthetic carries over; ask before committing to a visual direction for anything user-facing.

## Hard rules when working in this repo

1. **Marketing waits for visual sign-off** (see deploy policy below) — everything else doesn't need a visual direction confirmed before building functionally, but ask before treating any one screen's look as the template for the rest.
2. **`app/layout.tsx` is the shell** (fonts + `globals.css`). It's a server component — keep it one. Marketing markup belongs in its own feature component, not the layout.
3. **Don't commit `.env`.** It's gitignored. Connection strings stay local.
4. **Routing is the App Router only.** Don't add a router library.

## Quickstart

```bash
npm install
cp .env.example .env   # NEXT_PUBLIC_SUPABASE_* for the app; DATABASE_URL only for migrations
npm run db:tune        # schema, indexes, policies   (idempotent)
npm run db:seed        # schools catalog + feature flags
npm run dev            # http://localhost:3000
```

One process. Data comes from Supabase over PostgREST — there is no API to start.

Checks: `npm run typecheck` · `npm run build` · `npm run test:e2e`

Want data on screen? `npm run db:demo` fills the account in
`TEST_ACCOUNT_EMAIL` with a term — roster, timetable, marks, attendance,
a nine-week library — and creates a second, deliberately empty account
for looking at empty states. It rewrites only those two accounts. See
[db/seed-demo.js](db/seed-demo.js).

## Deploy policy — push without asking, except the public site

When a unit of work is finished, ship it. Do **not** ask for confirmation first. The deploy story is:

- **`git push origin main`** → Vercel auto-deploys. There is no backend here to deploy.

  Two settings the deploy depends on, both easy to break:

  - **`vercel.json` pins `outputDirectory` to `.next`.** It looks redundant
    next to `"framework": "nextjs"` and it is not. The Vercel project still
    carries an **Output Directory of `dist`** in its dashboard settings,
    left from the Vite build — and a dashboard override beats the framework
    default, so builds failed with *"The Next.js output directory `dist` was
    not found"* while building perfectly well locally. `vercel.json` beats
    the dashboard, so this line is what actually decides it. Don't remove it
    unless the dashboard field has been cleared first.
  - **`API_PROXY_TARGET` must be set in the Vercel project environment**, or
    every AI path 404s in production. It is deliberately not `NEXT_PUBLIC_`:
    the rewrite is resolved on the server and the target never ships in the
    browser bundle. See [todo/backend-integration.md](todo/backend-integration.md).
- **`npm run db:tune`** → applies `db/tune.sql` to Supabase: structure, indexes, RLS policies, CHECK constraints, storage policies. One transaction, idempotent, skips anything the schema no longer has.
- **`npm run db:seed`** → reference data only (the UAE schools catalog from `src/lib/schools.js`, and the feature flags). Idempotent.

Neither runs automatically. Migrations are applied deliberately, from a
machine that can read the output — an API that rebuilt the schema on
every boot is exactly what this replaced.

Two carve-outs:

- **Marketing and the landing page wait for approval.** The hero,
  `src/features/marketing/*`, and anything else a visitor sees before signing
  in. Build it, run it, and show
  it — `localhost:3000/?home=1`, which is the URL that bypasses the
  signed-in redirect to the dashboard — then wait for a yes. This is the
  public face of the product and its owner signs off on how it looks. Everything
  behind the login (studio, admin, database, backend) still ships without
  asking.

  If something marketing-related is already pushed and it is rejected, back it
  out with a **revert commit** and park the work on a local branch. Don't
  force-push a branch that has been shared.

- Actions that **delete or rewrite live data** on Supabase (`TRUNCATE`,
  dropping columns, destructive migrations) still need explicit
  confirmation. Idempotent re-init does not.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
