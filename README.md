# Murchid — Teacher Studio

An AI lesson director for teachers (KG–G12). Next.js App Router frontend
on Supabase, with a marketing site and the teacher studio in one bundle.

## Quick start

```bash
npm install
cp .env.example .env.local   # NEXT_PUBLIC_SUPABASE_* — what the app reads
cp .env.example .env         # DATABASE_URL — migrations only
npm run db:tune              # structure, indexes, RLS policies  (idempotent)
npm run db:seed              # UAE schools catalog + feature flags
npm run dev                  # http://localhost:3000
```

One process. Data comes from Supabase over PostgREST — there is no API
server to start.

**`DATABASE_URL` is a Supabase string**, from the dashboard → Connect →
**Transaction pooler** (port 6543). Not the direct host: `db.<ref>.supabase.co`
resolves to IPv6 only. Do not append `sslmode=require` — TLS is handled in
[db/client.js](db/client.js) by pinning the Supabase root CA, and this `pg`
version reads `sslmode=require` as `verify-full`, which then fails.

> This project ran on **Neon** before Supabase. If you have an older `.env`,
> that connection string is still in it and `db:tune` will fail on its first
> statement — `relation "public.users" does not exist`. The scripts now warn
> when the host is not Supabase.

Checks: `npm run typecheck` · `npm run lint` · `npm run build` · `npm run test:e2e`

Want data on screen? `npm run db:demo` fills the account in
`TEST_ACCOUNT_EMAIL` with a term — roster, timetable, marks, attendance, a
nine-week library — and creates a second, deliberately empty account for
looking at empty states.

## How it fits together

- **Frontend** → Vercel. Next.js App Router; `vercel.json` pins
  `outputDirectory` to `.next` (the project's dashboard still carries `dist`
  from the Vite era, and a dashboard override beats the framework default).
- **Data** → Supabase, read and written **from the browser** through
  [`src/lib/data/`](src/lib/data/). Authorisation is Row Level Security, not
  application code. `credits`, `subscriptions`, `usage_logs`,
  `feature_flags` and `audit_log` are deliberately not writable from the
  client — a teacher cannot top up their own balance.
- **The few endpoints that need a secret** — AI generation, CV parsing, the
  assistant — live in a **separate repository**, deployed to Render. Set
  `API_PROXY_TARGET` (**in Vercel too**) and `next.config.ts` rewrites
  `/api/*` there server-side, so the browser stays same-origin. Leave it
  unset and those paths 404 as themselves, which is the truth. See
  [todo/backend-integration.md](todo/backend-integration.md).

Migrations are never applied automatically. `db:tune` and `db:seed` are run
deliberately, from a machine that can read the output.

## Documentation

Full project docs live in [`docs/`](docs/README.md).

- [11 — Next.js migration](docs/11-nextjs-migration.md) — **current**: plan, phases, architecture
- [12 — Super admin](docs/12-super-admin.md) — the privileged console, roles, and who gets them
- [13 — Student invites](docs/13-student-invites.md) — the invite gate, the mail, and the Supabase settings it needs

⚠️ **Docs 01–10 predate the migration** and describe a Vite + Neon +
Firebase stack that no longer exists. Trust the code and docs 11–13 until
they are rewritten.
