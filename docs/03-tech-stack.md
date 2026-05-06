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

## Backend (dev-only)

| Tool | Version | Why |
|---|---|---|
| **pg** | ^8.20.0 | Postgres client. Connects to Neon over SSL. |
| **dotenv** | ^17.4.2 | Loads `DATABASE_URL` from `.env` for both Vite and `db/init.js`. |

The "backend" today is a small Vite middleware plugin defined in `vite.config.js` — it intercepts `/api/*` requests during `npm run dev` and queries Postgres. This is not a separate process. See [API](07-api.md).

## Database

**Neon Postgres** (serverless Postgres). Connection string in `.env`. Schema is two tables (`templates`, `drafts`); see [Database](06-database.md).

## Why these picks

- **Vite + React + Tailwind v4** — fast iteration, minimal config, Tailwind v4 keeps brand tokens in one place (`src/index.css` `@theme`).
- **No router** — single-screen studio with in-component view switching is enough; adding React Router is unjustified complexity right now.
- **Vite middleware for API** — keeps dev-time everything in one process. Production will need a real backend; the middleware is intentionally a temporary shape.
- **Neon Postgres** — managed, free tier, connects over plain `pg` driver, no ORM ceremony for a small schema.

## What is *not* in the stack

- No ORM (raw SQL via `pg`).
- No state library (React state only).
- No router.
- No auth / sessions yet.
- No test framework yet.
- No CI yet.
