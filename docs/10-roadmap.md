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

*(Pruned 2026-08-12, afternoon: the teaching-skills interview shipped at
`/teaching-skills` — conversation UI, voice in/out, Markdown profile into
`teaching_skills` via the new `/api/skills` data path; `quiz-tweak` and
`regenerate` are wired (quiz-builder tweak bar, per-section rewrite in
studio prose artifacts); StudioChat now streams through
`src/shared/lib/apiStream.ts` and handles the full batch protocol; and a
partial CSV roster import now names its failed rows.)*

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
  persist), and per-field parse confidence:
  [todo/backend-integration.md](../todo/backend-integration.md) and the
  specs in [todo/backend/](../todo/backend/).

## Deliberately not done

- **A toast system.** Errors are inline banners; action failures are
  `alert()`. Ugly but consistent — replace app-wide or not at all.
- **`/api/bulletin` on the backend service.** The bulletin board is fully
  browser-side; see [todo/backend/07-bulletin-board.md](../todo/backend/07-bulletin-board.md)
  for the one optional endpoint (AI-composed notices) if it is ever wanted.
