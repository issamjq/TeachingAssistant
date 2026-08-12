# 10 — Roadmap

What is genuinely still open, verified against the code on 2026-08-12. The
previous version of this file predated auth, Supabase, Next.js and the AI
studio, and nearly every line of it had since shipped; it was misleading
enough to be harmful. This one lists only what is **not** done.

For the full picture of what exists, trust the code and
[11 — Next.js migration](11-nextjs-migration.md); every studio section in the
sidebar is a real screen now, including the bulletin board (the last
`<ComingSoon />` stub, replaced 2026-08-11).

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
- **Wire `quiz-tweak` and `regenerate`.** Both routes are live and
  verified on the service; nothing in `src/` calls them. Natural homes:
  the quiz builder and a per-section rewrite in the studio viewers.
- **Consolidate studio streaming on `src/shared/lib/apiStream.ts`.**
  `src/features/studio-ai/StudioChat.jsx` hand-rolls its own SSE parser:
  it drops any frame that doesn't begin with `data:` (keep-alive comments
  and `event:` lines break it, where `apiStream` scans lines correctly)
  and silently ignores `artifact_start` / `artifact_end` / `scope` and
  non-`unread_materials` `batch` frames — all of which the service now
  documents on `/api/studio/generate`. Single-kind generation works;
  multi-kind batches won't render until this is fixed.
- **CSV roster import fails silently per-row.** The funnel flush
  (`src/views/Landing.jsx`, `handleChoosePlan` area) only
  `console.warn`s a failed `POST /api/students` — a partial import looks
  identical to a complete one to the teacher.
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
  persist), and per-field parse confidence:
  [todo/backend-integration.md](../todo/backend-integration.md) and the
  specs in [todo/backend/](../todo/backend/).

## Deliberately not done

- **A toast system.** Errors are inline banners; action failures are
  `alert()`. Ugly but consistent — replace app-wide or not at all.
- **`/api/bulletin` on the backend service.** The bulletin board is fully
  browser-side; see [todo/backend/07-bulletin-board.md](../todo/backend/07-bulletin-board.md)
  for the one optional endpoint (AI-composed notices) if it is ever wanted.
