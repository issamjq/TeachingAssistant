# 10 — Roadmap

A frank list of what's built, what's stubbed, and what's missing — so the next person (or future you) can pick up without re-deriving it.

## Built and working

- **Landing page** — full marketing site rendered in React. Hero, problem, solution, eight-tools map, dashboard mockup, studio collab split, screen mockups, footer. Reveal-on-scroll animation. CTA opens the studio.
- **Interactive prototype** on the landing — fake-generates a complete lesson package from hardcoded templates per subject. Generate / Library tabs.
- **Landing → Studio routing** in `main.jsx`. Studio's × button returns to landing.
- Standalone React studio app — Vite dev server boots into it (or into the landing first).
- Sidebar navigation with 4 sections; active-state styling correct.
- Dashboard view (visual only, hardcoded data).
- Templates library — fetches `/api/templates`, renders the grid, search filter works.
- Reusable drafts — fetches `/api/drafts`, renders the table, search filter works.
- Two-tab shell inside Lesson Plans (Templates / Drafts) with breadcrumb routing.
- New / Edit forms render correctly (NewTemplate, NewDraft, EditDraft).
- Tailwind v4 brand tokens via `@theme` in `src/index.css`.
- Button + Card primitives.
- Database schema and seed via `npm run db:init`.
- Dev API: GET `/api/templates`, GET `/api/drafts`.

## Stubbed (UI-only, no behavior)

- Save / Discard / Mark ready buttons in NewTemplate, NewDraft, EditDraft — they navigate back without persisting.
- "Use template →" — synthesizes a fake draft client-side instead of inserting.
- "Clear all drafts" button — no handler.
- Filter dropdowns on Templates and Drafts (All grades / All subjects / Sort) — present, no logic.
- Three-dot row menu on the drafts table.
- Bell icon in the header.
- "Import .docx" on Templates.
- AI-assisted toggle on NewDraft (labeled "soon").
- Draft auto-save copy ("Changes save automatically as you type") — copy only.
- Drag-to-reorder on lesson-flow stages.

## Missing entirely

### Data

- POST/PATCH/DELETE endpoints for templates and drafts.
- Server-side filtering, sorting, and pagination (currently client-side over the full list).
- A real "current user" — Sara Abadi is a hardcoded placeholder.

### App scope

- Auth and multi-user. No login page. No tenant separation.
- All sidebar items except Dashboard and Lesson Plans render `<ComingSoon />`: Studio, Library, Schedule, Quizzes & Exams, Homework, Presentations, Activities, Students, Grades, Reports.
- Mobile sidebar drawer — sidebar is `hidden md:flex`, so mobile has no nav.
- Dashboard data is hardcoded — should pull KPIs, today's schedule, and AI activity from real tables.
- Notifications system behind the bell icon.
- Real AI integration. The "AI activity" feed is decorative.

### Production

- Production deployment story. `vite build` produces a static bundle with no API. Need to choose: Node server, serverless functions, or edge functions, and port the Vite middleware queries to that runtime.
- Secrets management beyond `.env`. Today the connection string is plaintext locally; production needs a proper env source.
- Error tracking, logging, observability — none.

## Suggested next steps

If we want to keep momentum, a sensible order:

1. **Wire NewDraft Save → `POST /api/drafts`.** Smallest unit of real persistence; unlocks everything downstream.
2. **Then EditDraft → `PATCH /api/drafts/:id`** — same shape, plus `last_edited = NOW()`.
3. **Then Templates create + edit.**
4. **Then Dashboard data wiring** — pull the schedule and pending review from real tables (introduces a `schedule` table).
5. **Then auth.** Don't bolt it on later than this; it gets harder.
6. **Then production deployment.** Pick a host and port the API.

Everything past step 6 — AI integration, sharing, classes, students, grades — is product-shape decisions, not infrastructure.
