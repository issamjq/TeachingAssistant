# 07 · Bulletin board — nothing required, one optional endpoint

The bulletin board shipped as a browser-side feature. Everything it does
today is CRUD on the `bulletin_posts` table, which the browser reaches
directly through Supabase with RLS doing the authorisation — the same
path as the scheduler and the gradebook. `/api/bulletin` never leaves
the browser; it is answered by `src/lib/data/index.ts`, not by you.

**There is nothing to build here for the feature to work.** This file
exists so the pattern is recorded, and to spec the one endpoint worth
adding when the studio grows into it.

## What the frontend already owns

| Concern | Where it lives |
|---|---|
| Table + RLS | `db/tune.sql` §19b — `bulletin_posts`, four gated policies (device + subscription), `kind`/`status` CHECKs, `set_updated_at` trigger |
| Queries | `listBulletin` / `createBulletin` / `updateBulletin` / `deleteBulletin` in `src/lib/data/entities.ts` |
| Routing | `case "bulletin"` in `src/lib/data/index.ts` |
| UI | `src/features/bulletin-board/` behind `app/(studio)/bulletin-board/` |
| Demo data | `BULLETIN` in `db/demo-data.js`, written by `db/seed-demo.js` |

Do **not** add `/api/bulletin` to this service. If it ever answered,
the browser would still win — the data layer resolves the path before
`fetch` runs — but a second implementation would be a second idea of
the shape, drifting silently.

## Optional, later: AI-composed notices

`POST /api/studio/bulletin` — "write me a parents' notice about
Thursday's field trip". Only worth building once teachers ask for it.

Contract, matching the other studio endpoints (see
[01 · AI Studio](01-ai-studio.md) for the SSE frame details):

| Method | Path | Body |
|---|---|---|
| POST | `/api/studio/bulletin` | `{ prompt, kind?, grade?, section?, tone? }` |

- Stream `delta` frames, close with
  `{"type":"done","bulletin":{"title":"…","body":"…","kind":"notice"}}`.
- `kind` in the result must be one of `notice`, `event`, `reminder`,
  `celebration` — the CHECK constraint on the table will refuse
  anything else when the browser saves it.
- **You do not save the result.** The browser POSTs it to
  `/api/bulletin` itself (which is a Supabase insert), exactly as the
  studio's other artifacts are saved browser-side. Keep the writer
  count at one.
- Bill it like the other studio calls: same `requireAuth`, same credit
  decrement, same `usage_logs` row.

The path is already server-only in the data layer (`/api/studio/*` is
in `SERVER_ONLY`), so no frontend change is needed for the route to
reach you — only a "Compose with AI" affordance in the post editor,
which stays out of the UI until this endpoint exists.
