# Murchid — Teacher Studio

An AI lesson director for teachers (KG–G12). React-only, standalone studio app.

## Quick start

```bash
cp .env.example .env       # then paste your Neon DATABASE_URL into .env
npm install
npm run db:tune            # schema, indexes and policies on Supabase
npm run db:seed            # UAE schools catalog + feature flags
npm run dev                # Vite on http://localhost:5173
```

## Deploying

The repo deploys as **two services**:

- **Frontend** → Vercel (static `dist/`, configured by `vercel.json`).
- **Backend** → Render (Express app in [`backend/`](backend/), one source of truth shared with the dev-mode Vite middleware via `backend/app.js`).

### Backend on Render

1. https://dashboard.render.com → **New** → **Web Service** → connect this GitHub repo.
2. Settings:
   - **Environment**: Node
   - **Branch**: `main`
   - **Build command**: `npm install`
   - **Start command**: `npm run start:backend`
   - **Instance type**: Free
3. **Environment variables**:
   - `DATABASE_URL` — your Neon connection string (same one in your local `.env`).
   - `ALLOWED_ORIGINS` — `https://<your-vercel-app>.vercel.app` (comma-separated if you have multiple). Leave unset only while testing.
   - `PORT` — Render sets this automatically; do not add it.
4. Deploy. Render gives you a URL like `https://murchid-api.onrender.com`. Hit `/healthz` to confirm it's up.

> Free-tier Render web services sleep after 15 min idle and cold-start in ~30 s on the first request after waking.

### Frontend on Vercel

1. https://vercel.com/new → import the same repo.
2. Vercel auto-detects Vite from `vercel.json`. No build override needed.
3. **Environment variables**:
   - `VITE_API_URL` — the Render URL from above (no trailing slash).
4. Deploy. The landing page + studio both work end-to-end.

If you change `VITE_API_URL` later, redeploy the frontend (Vite bakes env vars into the build at compile time).

## Documentation

Full project docs live in [`docs/`](docs/README.md). Start there for anything beyond running the app:

- [Overview](docs/01-overview.md) — what Murchid is and who it's for
- [Getting started](docs/02-getting-started.md) — prerequisites, env, scripts
- [Tech stack](docs/03-tech-stack.md) — Vite 5, React 18, Tailwind v4, Neon Postgres
- [Architecture](docs/04-architecture.md) — file layout, boot flow, view router
- [Design system](docs/05-design-system.md) — brand tokens, fonts, component patterns
- [Database](docs/06-database.md) — schema, seeds, init
- [API](docs/07-api.md) — current endpoints, dev-only middleware
- [Views](docs/08-views.md) — what each screen does
- [Conventions](docs/09-conventions.md) — rules to follow when adding code
- [Roadmap](docs/10-roadmap.md) — what's built, what's not, what's next
