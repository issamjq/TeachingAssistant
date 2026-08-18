# 02 — Getting started

## Prerequisites

- **Node.js** 18+ (Vite 5 requires it)
- **npm** 9+
- A **Supabase** project. `NEXT_PUBLIC_SUPABASE_*` go in `.env.local` for the app;
  the Supabase **transaction pooler** connection string goes in `.env` as
  `DATABASE_URL`, read only by the migration scripts. *(Was Neon before the
  Supabase migration — an old `.env` will fail `db:tune` on its first statement.)*

## Environment

Create `.env` at the project root:

```
DATABASE_URL=postgresql://USER:PASSWORD@HOST/DB?sslmode=require&channel_binding=require
```

`.env` is gitignored. Do not commit it. If a connection string ever leaks into a shared archive, rotate the database password in the Supabase dashboard immediately.

## Install

```bash
npm install
```

## One-time database setup

Creates the `templates` and `drafts` tables and seeds them. Idempotent — safe to re-run.

```bash
npm run db:init
```

You should see:

```
Creating schema...
Seeding 8 templates...
Seeding 7 drafts...
Done.
```

If the tables already have rows, the script skips seeding and reports the existing counts.

## Run the app

```bash
npm run dev
```

Vite serves on **http://localhost:5173** and the React studio loads directly. The same Vite process also serves the API endpoints (see [07 — API](07-api.md)) — no separate backend.

## Build / preview

```bash
npm run build     # outputs to dist/
npm run preview   # serves dist/ locally
```

**Heads up:** the build output has **no API**. The dev API is mounted as a Vite middleware plugin that does not ship with `vite build`. Production deployment needs a real backend (serverless functions, a small Node server, or similar). See [07 — API](07-api.md).

## Scripts reference

| Script | What it does |
|---|---|
| `npm run dev` | Vite dev server on :5173, with API middleware. |
| `npm run build` | Production bundle to `dist/` (no API). |
| `npm run preview` | Serves `dist/` locally for a sanity check. |
| `npm run db:init` | Creates schema + seeds. Idempotent. |
