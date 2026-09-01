# 03 — Tech stack

## Frontend

| Tool | Version | Why |
|---|---|---|
| **Vite** | ^5.4.10 | Fast dev server, simple plugin model, doubles as an API host in dev via middleware. |
| **React** | ^18.3.1 | UI. Strict mode on. |
| **Tailwind CSS** | ^4.2.4 | Styling. v4 with `@theme` brand tokens directly in CSS. |
| **@tailwindcss/vite** | ^4.2.4 | Vite plugin for Tailwind v4. |
| **lucide-react** | ^1.14.0 | Icon set. |

No router. View state lives in `src/App.jsx` as a plain `useState` machine. See [Architecture](04-architecture.md).

## Backend

| Tool | Version | Why |
|---|---|---|
| **express** | ^5.x | Single Express app under [`backend/`](../backend/) — standalone on Render in prod, mounted as Vite middleware in dev. |
| **cors** | ^2.x | Enables Vercel → Render cross-origin requests. Open by default; lock down with `ALLOWED_ORIGINS`. |
| **pg** | ^8.20.0 | Postgres client — **migration scripts only**. Connects to Supabase over TLS with the root CA pinned (`db/supabaseCa.js`). The app never uses it. |
| **dotenv** | ^17.4.2 | Loads `DATABASE_URL` from `.env` for both Vite and `backend/db/init.js`. |

`backend/app.js` exports `buildApp()` so the same routes serve both transports. See [API](07-api.md).

## Database

**Supabase** (Postgres + Auth + Row Level Security). The browser talks to it directly through `src/lib/data/`; `DATABASE_URL` in `.env` is for migrations only.

## Why these picks

- **Vite + React + Tailwind v4** — fast iteration, minimal config, Tailwind v4 keeps brand tokens in one place (`src/index.css` `@theme`).
- **No router** — single-screen studio with in-component view switching is enough; adding React Router is unjustified complexity right now.
- **Vite middleware for API** — keeps dev-time everything in one process. Production will need a real backend; the middleware is intentionally a temporary shape.
- **Supabase** — managed Postgres with Auth and RLS, which is what let the API layer be deleted: authorisation moved into policies rather than middleware.

## What is *not* in the stack

- No ORM (raw SQL via `pg`).
- No state library (React state only).
- No router.
- No auth / sessions yet.
- No test framework yet.
- No CI yet.
