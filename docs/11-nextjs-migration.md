# 11 — Next.js Migration Plan

Migrating the frontend from **Vite + React 18 (JS)** to **Next.js (App Router) + TypeScript + Tailwind v4 + CSS Modules**.

**Scope:** frontend only. `backend/` (Express + Neon + Firebase Admin) is **untouched** and keeps running on Render. Auth stays Firebase-client-side. Backend modernisation is a later, separate project.

---

## 1. Starting point

| | Today |
|---|---|
| Build | Vite 5, `@vitejs/plugin-react` |
| Language | JavaScript + JSX, no types |
| Routing | Hand-rolled `pushState` router (`src/lib/route.js`), no library |
| Styling | Tailwind v4 (`@theme` tokens in `index.css`) + two large global stylesheets |
| Rendering | 100% client-side SPA |
| API | Express mounted as Vite middleware in dev; Render in prod via `vercel.json` rewrite |
| Size | ~45,500 lines across ~110 files in `src/` |

**Concentration of risk:**

| File | Lines |
|---|---|
| `src/views/Landing.jsx` | 7,266 |
| `src/views/Studio.jsx` | 5,199 |
| `src/landing.css` | 2,674 |
| `src/views/SlideBuilder.jsx` | 2,603 |
| `src/index.css` | 2,142 |
| `src/lib/i18n.jsx` | 2,018 |

**SSR hazards** — browser globals touched outside effects, which break server rendering:
`lib/account.js`, `lib/route.js`, `lib/export.js`, `lib/i18n.jsx`, `lib/role.js`, `lib/portal.js`, `lib/firebaseAuth.js`, `lib/session.js`, plus 10 view files using `localStorage`.

---

## 2. Strategy: strangler, not big-bang

A 45k-line rewrite-in-one-go has no working intermediate state and no way to bisect a regression. Instead:

**Next.js takes over the build on day one, wrapping the entire existing app in a single catch-all client route. Then routes are peeled off that catch-all one at a time.**

```
Phase 1 ──────────────────────────────────────────────► Phase 4
app/[[...slug]]/page.tsx  ("use client" → legacy <Root/>)
        │
        ├─ peel /dev,/admin,…  → app/(portal)/*
        ├─ peel /quizzes       → app/(studio)/quizzes/*
        ├─ peel /homework      → app/(studio)/homework/*
        ├─ …
        └─ peel /              → app/(marketing)/*
                                          catch-all deleted
```

Why this works:
- **The app is shippable at every commit.** Deploy after any phase.
- **Regressions are bisectable** — one route changes at a time.
- The migration can pause indefinitely without leaving a broken tree.
- The existing `route.js` router and the App Router **coexist**: peeled routes use `next/navigation`, unpeeled ones keep `pushState`. A compatibility shim (§5.3) bridges them.

---

## 3. Target architecture

```
Murchid/
├── app/                            # App Router — routing + layouts ONLY, thin files
│   ├── layout.tsx                  # <html>, fonts, providers, globals.css
│   ├── globals.css                 # @import tailwindcss + @theme tokens + reset
│   ├── not-found.tsx
│   ├── error.tsx
│   │
│   ├── (marketing)/                # public, SEO-relevant, statically rendered
│   │   ├── layout.tsx
│   │   └── page.tsx                # /
│   │
│   ├── (portal)/                   # privileged-role sign-in surfaces
│   │   ├── layout.tsx
│   │   ├── dev/page.tsx
│   │   ├── admin/page.tsx
│   │   ├── superadmin/page.tsx
│   │   ├── owner/page.tsx
│   │   └── moe/page.tsx
│   │
│   └── (studio)/                   # authenticated workspace
│       ├── layout.tsx              # sidebar + header + rail shell
│       ├── planner/page.tsx
│       ├── lesson-plans/[[...slug]]/page.tsx
│       ├── quizzes/[[...slug]]/page.tsx
│       ├── homework/[[...slug]]/page.tsx
│       ├── presentations/[[...slug]]/page.tsx
│       ├── activities/[[...slug]]/page.tsx
│       ├── database/[[...tab]]/page.tsx
│       ├── account/page.tsx
│       └── (admin)/…               # admin-dashboard, dev-console, etc.
│
├── src/
│   ├── features/                   # ← the real code lives here
│   │   ├── landing/
│   │   ├── planner/
│   │   ├── lesson-plans/
│   │   ├── quizzes/
│   │   ├── homework/
│   │   ├── presentations/
│   │   ├── activities/
│   │   ├── students/
│   │   ├── account/
│   │   ├── onboarding/
│   │   ├── studio-ai/
│   │   └── admin/ superadmin/ owner/ moe/ dev/
│   │
│   ├── shared/
│   │   ├── ui/                     # Button, Card, Skeleton, ExportMenu
│   │   ├── components/             # Avatar, MurchidLogo, BrandLoader, MiniCharts
│   │   ├── hooks/
│   │   ├── lib/                    # apiClient, firebase, export, markdown
│   │   ├── i18n/                   # provider + en/ + ar/ (split by namespace)
│   │   ├── styles/                 # shared .module.css, mixins, tokens.css
│   │   └── types/                  # api.d.ts, domain types
│   │
│   └── config/                     # enums, plans, permissions, roles, nav
│
├── backend/                        # UNCHANGED
├── public/
├── next.config.ts
├── tsconfig.json
├── postcss.config.mjs
└── eslint.config.mjs
```

### Feature module shape

Every feature folder is self-contained and has one public entry point:

```
src/features/quizzes/
├── components/
│   ├── QuizList.tsx
│   ├── QuizList.module.css
│   ├── QuizBuilder.tsx
│   └── QuizBuilder.module.css
├── hooks/useQuizzes.ts
├── api.ts                # typed fetchers, the only place quizzes call the network
├── types.ts
└── index.ts              # public surface — everything else is private
```

**Rule:** `app/**` files are thin. A `page.tsx` resolves params, sets metadata, and renders one feature component. No business logic in `app/`.

---

## 4. Key decisions

### 4.1 Styling: three tiers, non-overlapping

| Tier | Where | Used for |
|---|---|---|
| **Global** | `app/globals.css` | `@import "tailwindcss"`, `@theme` design tokens, CSS reset, `@font-face`, `:root` vars |
| **Tailwind utilities** | JSX `className` | Layout, spacing, flex/grid, type scale, brand colours |
| **CSS Modules** | `Component.module.css` | Keyframes, complex selectors, `:has()`/`:nth-child` compositions, anything the landing page does |

The existing `@theme` block in `index.css` moves to `globals.css` verbatim — **the design tokens do not change**, so Tailwind utilities (`bg-paper`, `text-accent`, `font-serif`) keep working everywhere untouched.

`src/landing.css` (2,674 lines of global `.hero`, `.lesson-card`, `.dash-mock` classes) is the main CSS-Modules conversion target. Splitting it by component also kills [CLAUDE.md](../CLAUDE.md) hard-rule #6 (the "don't reuse landing class names" hazard) — scoping makes collisions impossible.

Tailwind v4 under Next uses `@tailwindcss/postcss`, not the Vite plugin.

### 4.2 TypeScript: gradual, then strict

- `allowJs: true`, `checkJs: false` — `.jsx` and `.tsx` coexist during migration.
- Start `strict: false` + `noImplicitAny: false`; **flip to `strict: true` in Phase 5** once no `.jsx` remains.
- A file becomes `.tsx` when it is peeled, never speculatively.
- **`tsc --noEmit` is a CI gate from Phase 1** so the typed surface never regresses.

### 4.3 Types come from the backend's zod schemas

The backend already validates with **zod v4** (`backend/lib/validate.js`). Rather than hand-writing frontend types, export the schemas and infer:

```ts
// src/shared/types/api.ts
import type { z } from "zod";
import type { quizCreateSchema } from "@backend/lib/validate";
export type QuizCreate = z.infer<typeof quizCreateSchema>;
```

One source of truth for request/response shapes, and a compile error the moment the API contract drifts. This is the single highest-leverage part of adding TypeScript.

### 4.4 Client/server boundary

Everything is a client component initially — `"use client"` sits at the **top of each feature component**, not in `app/layout.tsx`. That keeps layouts and pages as server components from day one, so server-side data fetching can be introduced later route-by-route without re-plumbing.

Firebase Auth stays client-side. Studio routes render a client shell that gates on auth state — identical to today's behaviour, no SSR auth work in this project.

Marketing (`/`) is the exception and the prize: it is a genuinely static page that should be **statically rendered for SEO**, which is a real gain over the current SPA.

### 4.5 API access unchanged

- `next.config.ts` `rewrites()` replaces the `vercel.json` rewrite → `/api/*` still proxies to Render.
- Dev no longer mounts Express in the bundler (Next has no Vite middleware equivalent). Instead: `npm run dev` runs **Next and `backend/index.js` concurrently**, with the rewrite pointing at `localhost:3001`. Same Express app, same `buildApp()`, no behaviour drift.
- **No Next.js Route Handlers.** All API surface stays in Express.

### 4.6 Routing compatibility shim

`src/lib/route.js` is reimplemented on top of `next/navigation` while keeping its exact public API (`navigate`, `replace`, `clearRoute`, `useRoute`, `setNavGuard`). Unpeeled legacy views keep calling it and keep working; peeled views use `next/link` and `useRouter` directly. The shim is deleted in Phase 4.

`setNavGuard` (unsaved-changes protection) has no direct App Router equivalent and needs a bespoke implementation — flagged as a known risk in §7.

---

## 5. Phases

### Phase 0 — Baseline
Branch `feat/nextjs`. Capture screenshots of every route at 3 breakpoints as visual reference. Record current bundle size and Lighthouse scores. Inventory every route × role.

**Exit:** a reference set to diff against. Zero code change.

### Phase 1 — Next.js takes over the build
Install Next, `tsconfig.json`, `postcss.config.mjs`, `next.config.ts` with rewrites. `app/layout.tsx` + `app/globals.css` (tokens moved verbatim). `app/[[...slug]]/page.tsx` marked `"use client"` renders the existing `<Root/>`. Fonts move from `index.html` `<link>` to `next/font`. Remove Vite, update `vercel.json`, wire concurrent dev script. CI: `tsc --noEmit` + `next build`.

**Exit:** the whole app runs on Next.js, visually identical, deployable. **No component touched.**

### Phase 2 — Shared foundation
Port `src/lib/*` and `src/components/*` to TypeScript. Split `i18n.jsx` (2,018 lines) into `en/` + `ar/` namespace files. Build the typed `apiClient` + zod-inferred types. Build the routing shim. Create the `features/`/`shared/` skeleton and path aliases. Add ESLint import-boundary rules.

**Exit:** typed foundation in place; app still renders through the catch-all.

### Phase 3 — Peel routes (the bulk of the work)
One route per PR, easiest first so the pattern is proven cheaply:

1. **Portals** (`/dev`, `/admin`, `/superadmin`, `/owner`, `/moe`) — small, isolated, one shared component. Proves the pattern.
2. **Leaf studio sections** — quizzes, homework, presentations, activities, reports. Repetitive, similar shape.
3. **Data-heavy sections** — database/students/grades/attendance, planner, schedule.
4. **Role consoles** — admin, superadmin, owner, moe, dev.
5. **Studio shell** — `App.jsx` sidebar/header becomes `app/(studio)/layout.tsx`.
6. **`Studio.jsx`** (5,199) and **`SlideBuilder.jsx`** (2,603) — decompose into feature modules. Each is its own sub-project.
7. **Landing** (7,266 + 2,674 CSS) — last and largest. Section-by-section into `features/landing/components/*` with co-located CSS Modules. Ends as a statically rendered page.

Per-route checklist: JS→TS · global CSS→CSS Module · move into `features/` · replace `route.js` calls with `next/navigation` · minimise `"use client"` · visual diff vs Phase 0 · role-matrix smoke test.

**Exit:** catch-all serves nothing.

### Phase 4 — Remove scaffolding
Delete `app/[[...slug]]`, `src/main.jsx`, `src/App.jsx`, the routing shim, `src/views/`, `src/landing.css`. Confirm no `.jsx` remains.

### Phase 5 — Harden and scale
`strict: true`. Server Components + server-side fetching for read-heavy routes. `next/image` for `public/` assets. Route-level code splitting and bundle budgets. Error boundaries + `loading.tsx` per segment. Streaming/Suspense where it pays. Rewrite `docs/` to match.

---

## 6. Scaling mechanisms

These are what keep the codebase from re-accumulating 7,000-line files.

**Enforced module boundaries** — ESLint `import/no-restricted-paths`:
- `features/*` may **not** import from another `features/*` — shared code moves to `shared/`.
- `shared/*` may **not** import from `features/*`.
- `app/*` may import features; nothing may import from `app/*`.

Cross-feature needs become an explicit promotion to `shared/`, which is a visible, reviewable decision.

**File-size budget** — lint warning at 400 lines, error at 600, for `.tsx`. Directly prevents a second `Landing.jsx`.

**Typed API layer** — components never call `fetch`. Only `features/*/api.ts` does, through the shared typed client. Makes the network surface greppable and mockable.

**One feature template** — documented scaffold (`components/`, `api.ts`, `types.ts`, `index.ts`) so every new feature lands in the same shape.

**Design tokens are the only styling source of truth** — no raw hex outside `globals.css`; lint-enforced.

**CI gates** — `tsc --noEmit`, ESLint (boundaries + size), `next build`, bundle-size budget per route.

**Docs stay live** — `docs/` updated in the same PR as the change it describes. (The current `docs/` drifted ~6 months; that is the failure this rule targets.)

---

## 7. Risks

| Risk | Severity | Mitigation |
|---|---|---|
| **Visual regression on the landing page** — the brand bar is explicitly high | High | Phase 0 screenshot baseline; convert section-by-section, diff each |
| `Landing.jsx` + `Studio.jsx` are 12.5k lines combined | High | Own phases, decomposed incrementally, never in one PR |
| `setNavGuard` has no App Router equivalent | Medium | Bespoke `beforePopState` + custom modal; spike in Phase 2 |
| SSR crashes from module-scope `window`/`localStorage` | Medium | Catch-all is `"use client"` in Phase 1, so nothing SSRs until deliberately opted in |
| Global→scoped CSS changes cascade order | Medium | Convert whole components at once, never partially |
| **Zero automated tests exist** | High | Add Playwright smoke tests per route × role in Phase 1 — before peeling starts |
| Dev-server API change (no Vite middleware) | Low | Concurrent Next + Express; identical `buildApp()` |
| Migration stalls half-done | Medium | Strangler means half-done still ships; each phase is independently valuable |

---

## 8. Progress

### ✅ Phase 0 — Baseline (done)

Branch `feat/nextjs`. Pre-migration Vite build recorded:

| Asset | Raw | Gzip |
|---|---|---|
| `index-BweEL6Xm.js` | 980 KB | 267 KB |
| `mammoth.browser.js` | 499 KB | 125 KB |
| `index-CppOCefa.js` | 407 KB | 118 KB |
| `firebaseAuth.js` | 170 KB | 35 KB |
| CSS | 221 KB | 38 KB |
| **Total JS** | **2.06 MB** | **545 KB** |

One monolithic bundle, no route-level code splitting — every user downloads the entire studio to view the landing page. Fixing this is a Phase 5 deliverable.

### ✅ Phase 1 — Next.js owns the build (done)

- **Next 16.3 on React 18.** Next 16 still accepts React 18, so the framework migration doesn't also force a React 19 upgrade — one fewer variable.
- `tsconfig.json` (gradual: `allowJs`, `strict: false`), `next.config.ts`, `postcss.config.mjs` (Tailwind v4 via PostCSS, not the Vite plugin).
- `src/index.css` → `app/globals.css`, **`@theme` tokens moved verbatim**. Explicit `@source "../src"` so Tailwind still scans components outside `app/`.
- `app/layout.tsx` — server component, replaces `index.html`.
- `app/[[...slug]]/page.tsx` + `LegacyAppMount.tsx` (`ssr: false`) → `src/legacy/LegacyRoot.jsx`, holding the old `main.jsx` body.
- Removed: `index.html`, `vite.config.js`, `src/main.jsx`, `vite`, `@vitejs/plugin-react`, `@tailwindcss/vite`.
- `vercel.json` reduced to `framework: nextjs`; its `/api/*` rewrite moved into `next.config.ts` and its SPA-fallback rewrite deleted (the App Router resolves paths natively).
- `npm run dev` now runs Next + Express concurrently.
- CI at `.github/workflows/ci.yml`: typecheck → build → smoke tests. **The repo previously had no CI at all.**

**Verified:** production build passes with the TypeScript gate on · `tsc --noEmit` clean · 44/44 Playwright smoke tests green (desktop + mobile, 20 routes) · landing page screenshot-checked at 1440px, top and scrolled — fonts, gradient, scroll reveals, and all 2,674 lines of `landing.css` render identically.

**Client bundle: 2.4 MB** (vs Vite's 2.06 MB). The delta is the App Router runtime; it inverts in Phase 3 as routes gain code splitting.

#### Unplanned finding: Vite-only env API

`import.meta.env.VITE_*` is a Vite construct that resolves to `undefined` under Next — it fails **silently**, surfacing as `auth/invalid-api-key` at sign-in rather than as a build error. Found in 10 places across `lib/firebase.js`, `_shared.jsx`, `SlideBuilder.jsx`, `Studio.jsx`.

Fixed by introducing **`src/config/env.ts`** as the single place client env is read (pulled forward from Phase 2 — the scattered reads had to be touched anyway). `.env.example` now documents the Firebase variables, which it never did before.

> **Deploy blocker:** the Vercel project env vars must be renamed `VITE_FIREBASE_*` → `NEXT_PUBLIC_FIREBASE_*` before this branch ships, or sign-in breaks in production.

### ⏭ Next — Phase 2

Port `src/lib/*` and `src/components/*` to TypeScript · split `i18n.jsx` (2,018 lines) into `en/`+`ar/` namespaces · typed `apiClient` with zod-inferred types from `backend/lib/validate.js` · routing shim over `next/navigation` · `features/`/`shared/` skeleton · ESLint import-boundary + file-size rules.

Open question to spike early: `setNavGuard` (unsaved-changes protection) has no direct App Router equivalent.

---

## 9. Explicitly out of scope

- Backend rewrite, Supabase migration, Postgres/ORM changes
- Auth provider change (Firebase stays)
- Any feature work — this is a **like-for-like port**. New features from the PRD come after.
- Server-side auth / middleware-based route protection (Phase 5+, optional)
- Design changes. If a screen looks different after migration, that is a bug.
