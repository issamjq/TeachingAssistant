# Mudir — Teacher Studio

AI lesson director for teachers (KG–G12). **Standalone React app.** Two surfaces, one bundle:

- **Landing page** — marketing site, the default view at `/`. Lives in `src/views/Landing.jsx` + `src/landing.css` (extracted from the original static HTML). Includes an interactive demo (`LandingDemo.jsx`).
- **Studio** — the teacher workspace. Lives in `src/App.jsx` + `src/views/*`. Opened by clicking "Lesson Planner →" in the landing nav. The studio's header × button returns to landing.

`main.jsx` holds a top-level `view: "landing" | "studio"` state and switches between the two. There's no client router yet.

The user (Issa) calls the project "mudir" — that's the **product** name, not the assistant.

## Where to find things

Full documentation lives in [`docs/`](docs/README.md). Read it before making non-trivial changes:

- [01 — Overview](docs/01-overview.md) — what Mudir is, who it's for
- [02 — Getting started](docs/02-getting-started.md) — env, scripts, prereqs
- [03 — Tech stack](docs/03-tech-stack.md) — Vite 5, React 18, Tailwind v4, Neon Postgres
- [04 — Architecture](docs/04-architecture.md) — file layout, boot flow, view router
- [05 — Design system](docs/05-design-system.md) — brand tokens, fonts, patterns
- [06 — Database](docs/06-database.md) — schema, status / subject values, seeds
- [07 — API](docs/07-api.md) — Vite-middleware endpoints (dev-only)
- [08 — Views](docs/08-views.md) — what each screen does
- [09 — Conventions](docs/09-conventions.md) — rules to follow when adding code
- [10 — Roadmap](docs/10-roadmap.md) — what's stubbed, what's missing, what's next

## Hard rules when working in this repo

1. **Visual quality matters.** The user compares against polished editorial design references. Match the Mudir aesthetic precisely: cream paper bg, Fraunces serif titles with red italic accents, JetBrains Mono eyebrows in uppercase tracking, Inter Tight body. See [Design system](docs/05-design-system.md).
2. **Don't override `bg-*` / `text-*` on `<Button>` via `className`** — class collisions cause invisible buttons. Add a variant in `src/components/ui/button.jsx` instead.
3. **`index.html` is the Vite shell only** (`<div id="root">` + Google Fonts: Fraunces, Inter Tight, JetBrains Mono, Amiri). All marketing markup lives in `src/views/Landing.jsx`, all marketing CSS in `src/landing.css`. Don't put marketing content in `index.html`.
4. **Don't commit `.env`.** It's gitignored. Connection strings stay local.
5. **No router, no state library** for now. Top-level Landing/Studio toggle is in `main.jsx`. Studio sub-view state is in `App.jsx`. Both plain `useState`. See [Architecture](docs/04-architecture.md).
6. **The landing page CSS is global and class-scoped** (`.hero`, `.lesson-card`, `.dash-mock`, etc.) — it coexists with the studio's Tailwind. Don't reuse those class names in studio components.

## Quickstart

```bash
npm install
npm run db:init   # one-time
npm run dev       # http://localhost:5173
```
