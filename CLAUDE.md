# Murchid — Teacher Studio

AI lesson director for teachers (KG–G12). **Next.js (App Router) frontend on Supabase.** Two surfaces:

- **Landing page** — marketing site at `/`. Lives in `src/views/Landing.jsx` + `src/landing.css`.
- **Studio** — the teacher workspace. Lives in `src/App.jsx` + `src/views/*`. Opened by "Lesson Planner →" in the landing nav; the studio's × button returns to landing.

The user (Issa) calls the project "murchid" — that's the **product** name, not the assistant.

## ⚠️ Mid-migration — read this first

The frontend is migrating **Vite → Next.js + TypeScript + Tailwind + CSS Modules**. Read [docs/11-nextjs-migration.md](docs/11-nextjs-migration.md) before touching frontend code.

**Phase 1 is complete.** Next.js owns the build. The whole pre-migration SPA currently renders inside a single catch-all route:

```
app/[[...slug]]/page.tsx → LegacyAppMount (ssr: false) → src/legacy/LegacyRoot.jsx → src/App.jsx + src/views/*
```

What this means in practice:

- **`src/views/*` and `src/App.jsx` are legacy.** They still ship, but they are being dismantled route by route. Don't build new features there.
- **New work goes in `src/features/<feature>/`** with a matching route segment under `app/`. Feature modules own their components, `api.ts`, and `types.ts`.
- **Peeling a route is additive** — create the real segment (e.g. `app/(studio)/quizzes/page.tsx`) and it automatically stops reaching the catch-all. Nothing needs removing.
- `src/legacy/` and `app/[[...slug]]/` are **scaffolding** and get deleted in Phase 4.
- **There is no backend in this repo.** The browser reads and writes Supabase directly through `src/lib/data/`, with Row Level Security doing the authorisation an API used to do in middleware. The handful of endpoints that need a secret — AI generation, CV parsing, the assistant, the privileged consoles — live in a separate project, deployed at `https://murchid-backend.onrender.com`. Reach it by setting `API_PROXY_TARGET` (**in Vercel too**, or production 404s every AI path); `next.config.ts` then rewrites `/api/*` there server-side. What works, what is blocked, and the exact fixes: [todo/backend-integration.md](todo/backend-integration.md).

## Frontend conventions (post-migration)

- **TypeScript for anything new.** `strict` is off while `.jsx` remains; it flips on in Phase 5. A file becomes `.tsx` when it's peeled, not speculatively.
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

Full documentation lives in [`docs/`](docs/README.md). Read it before making non-trivial changes:

- [01 — Overview](docs/01-overview.md) — what Murchid is, who it's for
- [02 — Getting started](docs/02-getting-started.md) — env, scripts, prereqs
- [03 — Tech stack](docs/03-tech-stack.md) — React 18, Tailwind v4 *(stale: says Vite + Neon; it's Next.js + Supabase now)*
- [04 — Architecture](docs/04-architecture.md) — file layout, boot flow, view router *(pre-migration)*
- [05 — Design system](docs/05-design-system.md) — brand tokens, fonts, patterns
- [06 — Database](docs/06-database.md) — schema, status / subject values, seeds
- [07 — API](docs/07-api.md) — endpoints
- [08 — Views](docs/08-views.md) — what each screen does
- [09 — Conventions](docs/09-conventions.md) — rules to follow when adding code
- [10 — Roadmap](docs/10-roadmap.md) — what's stubbed, what's missing, what's next
- [11 — Next.js migration](docs/11-nextjs-migration.md) — **current**: plan, phases, architecture

⚠️ **Docs 01–10 drifted badly** (roadmap still claims there's no auth and no production deploy — both long since shipped) and 03/04 describe the Vite build. Trust the code and doc 11 over them until they're rewritten in Phase 5.

## Hard rules when working in this repo

1. **Visual quality matters.** The user compares against polished editorial design references. Match the Murchid aesthetic precisely: cream paper bg, Fraunces serif titles with red italic accents, mono-styled uppercase tracked eyebrows, Inter Tight body. See [Design system](docs/05-design-system.md).
2. **Don't override `bg-*` / `text-*` on `<Button>` via `className`** — class collisions cause invisible buttons. Add a variant in `src/components/ui/button.jsx` instead.
3. **`app/layout.tsx` is the shell** (fonts + `globals.css`). It's a server component — keep it one. All marketing markup lives in `src/views/Landing.jsx`, all marketing CSS in `src/landing.css`. Don't put marketing content in the layout.
4. **Don't commit `.env`.** It's gitignored. Connection strings stay local.
5. **Routing is the App Router.** Peeled routes use `next/navigation`. Unpeeled legacy views still use `src/lib/route.js` (`pushState`-based) — that shim goes away in Phase 4. Don't add a router library.
6. **The landing page CSS is global and class-scoped** (`.hero`, `.lesson-card`, `.dash-mock`, etc.) — it coexists with the studio's Tailwind. Don't reuse those class names in studio components. *(Converting it to CSS Modules in Phase 3 removes this hazard.)*

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

## Deploy policy — push without asking

When a unit of work is finished, ship it. Do **not** ask for confirmation first. The deploy story is:

- **`git push origin main`** → Vercel auto-deploys. There is no backend here to deploy.
- **`npm run db:tune`** → applies `db/tune.sql` to Supabase: structure, indexes, RLS policies, CHECK constraints, storage policies. One transaction, idempotent, skips anything the schema no longer has.
- **`npm run db:seed`** → reference data only (the UAE schools catalog from `src/lib/schools.js`, and the feature flags). Idempotent.

Neither runs automatically. Migrations are applied deliberately, from a
machine that can read the output — an API that rebuilt the schema on
every boot is exactly what this replaced.

Carve-out: actions that **delete or rewrite live data** on Supabase (`TRUNCATE`, dropping columns, destructive migrations) still need explicit confirmation. Idempotent re-init does not.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
