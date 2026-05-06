# Mudir — Teacher Studio

An AI lesson director for teachers (KG–G12). React-only, standalone studio app.

## Quick start

```bash
cp .env.example .env       # then paste your Neon DATABASE_URL into .env
npm install
npm run db:init            # one-time: creates schema + seeds Neon Postgres
npm run dev                # Vite on http://localhost:5173
```

## Deploying

This repo has a `vercel.json` set up for **front-end-only** static hosting (build → `dist/`, SPA rewrites). The landing page works perfectly on a static deploy. The studio's `/api/*` routes are Vite middleware and are **dev-only** — on Vercel they will 404 unless you split the API into Vercel serverless functions or run it on a separate backend (Render, Fly, etc.). See [`docs/07-api.md`](docs/07-api.md) for the porting notes.

## Documentation

Full project docs live in [`docs/`](docs/README.md). Start there for anything beyond running the app:

- [Overview](docs/01-overview.md) — what Mudir is and who it's for
- [Getting started](docs/02-getting-started.md) — prerequisites, env, scripts
- [Tech stack](docs/03-tech-stack.md) — Vite 5, React 18, Tailwind v4, Neon Postgres
- [Architecture](docs/04-architecture.md) — file layout, boot flow, view router
- [Design system](docs/05-design-system.md) — brand tokens, fonts, component patterns
- [Database](docs/06-database.md) — schema, seeds, init
- [API](docs/07-api.md) — current endpoints, dev-only middleware
- [Views](docs/08-views.md) — what each screen does
- [Conventions](docs/09-conventions.md) — rules to follow when adding code
- [Roadmap](docs/10-roadmap.md) — what's built, what's not, what's next
