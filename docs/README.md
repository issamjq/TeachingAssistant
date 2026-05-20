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

## Project status

Standalone React app. No marketing landing, no overlay scaffolding — `npm run dev` boots directly into the studio. Earlier demo had `index.html` as a marketing page with the studio mounted as a fullscreen overlay; that's been stripped.
