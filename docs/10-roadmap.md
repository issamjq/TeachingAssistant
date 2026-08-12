# 10 — Roadmap

What is genuinely still open, verified against the code on 2026-08-12.
This file lists only what is **not** done; for the full picture of what
exists, trust the code and [11 — Next.js migration](11-nextjs-migration.md).

> The master status doc is `new-docs/STATUS.md`, which tracks the launch
> plan and feature roadmap against the code and the deployed backend.
> **It is not in the repo** — `new-docs/` is gitignored, because it holds
> commercial planning material. Ask the project owner for it. This file
> keeps the narrower, repo-technical list, and stands on its own.

## Open — this repo

- **Error tracking, logging, observability — none.** No Sentry/PostHog/
  anything in `package.json` or `src/`. The only genuinely-untouched item
  from the original roadmap.
- **Server-side filtering, sorting, and pagination.** Every list screen
  still pulls the full set and filters client-side (no `.range()`/`.limit()`
  anywhere in `src/lib/data/`). Fine at teacher scale; wrong for the admin
  consoles as accounts grow.
- **`scripts/verify-auth.mjs` needs a rewrite** before it can run at all —
  it targets the deleted Express server. Details in
  [todo/supabase-migration.md](../todo/supabase-migration.md), item 6.
- **Dead file:** `src/views/PortalSignIn.jsx` is unimported and describes
  the old popup auth flow. Delete it.
- **Docs refresh:** `docs/03-tech-stack.md` and `docs/04-architecture.md`
  still describe the Vite/Firebase/Neon stack, and `CLAUDE.md` still
  describes the removed `app/[[...slug]]` catch-all and `src/legacy/`.

## Open — dashboards and the backend service

- **Supabase / hosting dashboard configuration** that cannot be verified
  from the repo (email confirmation toggle, Azure provider, redirect URLs,
  secret-key rotation, Firebase decommission):
  [todo/supabase-migration.md](../todo/supabase-migration.md).
- **Backend service** (re-audited live 2026-08-12 — goal-plan, parse,
  `/api/images/search`, and structured `artifact` frames on `generate`
  have all shipped and were verified through the real UI): still open are
  **Stripe billing** (nothing even calls `/api/auth/renew`; the plan is
  written once at sign-up), Gemini billing (free tier caps out), Resend
  production mode, `id` on `generate`'s `done` frame (server-side
  persist), per-field parse confidence, and
  **`POST /api/studio/skill-profile` + `skill_ids` + assignment-aware
  generation** (specced in
  [todo/backend/08-skills-refinement.md](../todo/backend/08-skills-refinement.md);
  the frontend calls it and falls back gracefully until it exists).
  Full open list: [todo/backend-integration.md](../todo/backend-integration.md).
  *(The 00–07 build specs were deleted 2026-08-12 — everything in them
  shipped; the API reference site documents the live contracts.)*

## Deliberately not done

- **A toast system.** Errors are inline banners; action failures are
  `alert()`. Ugly but consistent — replace app-wide or not at all.
- **`/api/bulletin` on the backend service.** The bulletin board is fully
  browser-side (Supabase CRUD); the AI-composed notices it could ever want
  already exist via `/api/studio/bulletin`.
