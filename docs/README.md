# Murchid docs

Full project documentation. Read in order if you're new; jump around once you have the shape.

| # | Doc | What's inside |
|---|-----|---------------|
| 01 | [Overview](01-overview.md) | What Murchid is, who it's for, the product idea |
| 02 | [Getting started](02-getting-started.md) | Prerequisites, install, env, scripts |
| 03 | [Tech stack](03-tech-stack.md) | Vite 5, React 18, Tailwind v4, Neon Postgres, Lucide |
| 04 | [Architecture](04-architecture.md) | File layout, boot flow, view router, sidebar nav |
| 05 | [Design system](05-design-system.md) | Brand tokens, fonts, headings, eyebrows, pills, buttons |
| 06 | [Database](06-database.md) | Schema, status/subject values, seed data, init script |
| 07 | [API](07-api.md) | Vite middleware approach, current endpoints, prod story |
| 08 | [Views](08-views.md) | Dashboard, Templates, Drafts, NewTemplate, NewDraft, EditDraft |
| 09 | [Conventions](09-conventions.md) | Rules to follow when adding code |
| 10 | [Roadmap](10-roadmap.md) | What's built, what's stubbed, what's next |
| 11 | [Plan](11-plan.md) | **Active** — 2-week plan, unit economics, cut list, feature ranking |
| 12 | [Findings](12-findings.md) | **Active** — running bug/issue log |

> ⚠️ **Docs 04, 07, and parts of 09 are stale.** They predate the Express backend, Firebase auth, the roles/portals system and pathname routing. `09-conventions.md` still says "don't add a router" and "share the pool in `vite.config.js`" — both false now. Trust the code over those docs, and fix the doc for whichever section you're working in. Docs 05 and the styling half of 09 are still accurate.

## Project status

Three surfaces in one bundle, chosen by pathname in `src/main.jsx`: the marketing **landing** at `/`, the privileged **portal** sign-in at `/dev`, `/superadmin`, `/admin`, `/owner`, `/moe`, and the **studio** everywhere else.

One Express app (`backend/app.js` → `buildApp()`) serves `/api/*`, mounted twice: as Vite dev middleware in `vite.config.js`, and standalone on Render via `backend/index.js`. Frontend deploys to Vercel, backend to Render, database is Neon Postgres, auth is Firebase, generation is Anthropic.

**Not yet built:** payment collection, AI usage metering, retention analytics. See [11 — Plan](11-plan.md).

**Local setup:** `.env.example` covers the non-sensitive variables only. The remaining credentials are shared out-of-band — ask Issa; they are deliberately not documented in the repo.
