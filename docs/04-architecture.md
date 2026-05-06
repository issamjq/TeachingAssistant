# 04 — Architecture

## File layout

```
.
├── index.html              # Vite entry. <div id="root"> + Google Fonts links.
├── package.json
├── vite.config.js          # Vite config + the `mudir-api` middleware plugin.
├── .env                    # DATABASE_URL (gitignored)
│
├── db/
│   └── init.js             # Schema + seed for templates and drafts. Idempotent.
│
├── src/
│   ├── main.jsx            # React entry. Top-level Landing/Studio router.
│   ├── index.css           # Tailwind import + @theme brand tokens (studio).
│   ├── landing.css         # All marketing CSS. Class-scoped, ~1200 lines.
│   ├── App.jsx             # Studio shell: sidebar + header + view router.
│   │
│   ├── lib/
│   │   └── enums.js                # MAJORS, GRADE_LEVELS, NATIONALITIES — single source of truth.
│   │
│   ├── views/
│   │   ├── Landing.jsx             # Marketing landing page. Imports landing.css.
│   │   ├── LandingDemo.jsx         # Interactive prototype inside the landing.
│   │   ├── _shared.jsx     # Studio: SubjectBadge, StatusBadge, Section, Field,
│   │   │                   # FilePill, inputClasses, selectClasses, timeAgo.
│   │   ├── Dashboard.jsx           # Studio: KPIs + schedule + AI activity.
│   │   ├── TemplatesLibrary.jsx    # Studio: /api/templates → grid of cards.
│   │   ├── NewTemplate.jsx         # Studio: create template form.
│   │   ├── ReusableDrafts.jsx      # Studio: /api/drafts → table.
│   │   ├── NewDraft.jsx            # Studio: create draft form.
│   │   ├── EditDraft.jsx           # Studio: full draft editor.
│   │   ├── Database.jsx            # Studio: 3-tab wrapper (Teachers / Students / General info).
│   │   ├── DatabaseTeachers.jsx    # Studio: /api/teachers table with major filter.
│   │   ├── DatabaseStudents.jsx    # Studio: /api/students table with grade + section filters.
│   │   └── DatabaseGeneral.jsx     # Studio: read-only display of enums.js.
│   │
│   └── components/ui/
│       ├── button.jsx      # Studio: <Button variant="primary|secondary|outline|danger" />
│       └── card.jsx        # Studio: <Card> + <CardContent>.
│
└── docs/                   # You are here.
```

## Boot flow

```
index.html
  └─ <div id="root">
  └─ <script src="/src/main.jsx">
        └─ creates React root
        └─ renders <Root />
              ├─ if view === "landing" → <Landing onOpenStudio={...} />
              │                            (which embeds <LandingDemo />)
              └─ if view === "studio"  → <StudioApp onClose={...} />
```

`main.jsx`'s `<Root />` holds `view` state (`"landing" | "studio"`). The Landing's "Lesson Planner →" CTA flips to studio. The studio's × button flips back to landing.

`document.body.classList.toggle("studio-open", view === "studio")` is set as a side-effect — useful if any future styling needs to discriminate at the body level. Currently no CSS depends on it; it's left as a hook.

## Landing page

`src/views/Landing.jsx` renders the full marketing surface — top nav, hero, problem, solution, eight-tools section, dashboard mockup, "Mudir drafts / you direct" split, screen mockups, "Try it" prototype, footer. All styles in `src/landing.css` (extracted verbatim from the original static HTML; class-scoped so it doesn't collide with studio Tailwind).

Two effects to know about:

- **Reveal-on-scroll**: an `IntersectionObserver` adds the `visible` class to each `<section>` as it enters the viewport. Bound on mount, cleaned up on unmount.
- **Smooth scroll**: anchor links (`#problem`, `#solution`, `#try`, etc.) work via the global `html { scroll-behavior: smooth }` declaration in `landing.css`.

`LandingDemo.jsx` is the interactive prototype embedded in the "Try it" section. State machine with three modes — `input`, `generating`, `result` — plus a switchable Generate / Library main tab and a Plan / Timeline / Slides / Materials sub-tab inside the result. The lesson templates and library entries are hardcoded data — no API calls.

## Studio view routing (state-based, no router)

`App.jsx` holds two state pieces:

```jsx
const [active, setActive] = useState("dashboard");        // sidebar tab
const [view,   setView]   = useState({ name: "templates" }); // sub-view inside Lesson Plans
```

Top-level dispatch by `active`:

| `active` | Renders |
|---|---|
| `"dashboard"` | `<Dashboard />` |
| `"lesson-plans"` | Two-tab shell (Templates library / Reusable drafts), with sub-view by `view.name` |
| `"database"` | `<Database />` — three-tab shell (Teachers / Students / General info). Sub-tab state is internal to `Database.jsx`, not lifted to `App.jsx`. |
| anything else | `<ComingSoon />` placeholder |

Sub-view dispatch by `view.name` (only when `active === "lesson-plans"`):

| `view.name` | Renders |
|---|---|
| `"templates"` | `<TemplatesLibrary />` |
| `"newTemplate"` | `<NewTemplate />` |
| `"drafts"` | `<ReusableDrafts />` |
| `"newDraft"` | `<NewDraft />` |
| `"editDraft"` | `<EditDraft draft={view.draft} />` |

Navigation helpers in `App.jsx`:

- `goLessonPlans(subView)` — jump to Lesson Plans with a specific sub-view.
- `goNewTemplate()` / `goNewDraft()` — open the creation forms.
- `goEditDraft(draft)` — open the full editor with a draft object.

## Sidebar structure

Dark ink (#1a1814) sidebar, four sections, accent-red active state. Sections (defined in `App.jsx`'s `NAV` array):

```
WORKSPACE
  ◇ Dashboard       ← default landing
  + Studio
  ≡ Library

TEACHING
  L Lesson Plans
  S Schedule
  Q Quizzes & Exams
  H Homework
  P Presentations
  A Activities

DATA
  D Database        ← Teachers / Students / General info

ACCOUNT
  R Reports
```

Dashboard, Lesson Plans, and Database are the live tabs; the rest render `<ComingSoon />`. Letter badges are auto-generated from the `letter` field; icon items use the `icon` field (◇ + ≡).

## Header

Lives in `App.jsx`. Contains:

- Breadcrumbs — derived from `active` + `view.name`. Each crumb may have an `onClick` for navigation.
- Bell icon (no behavior yet).
- Avatar (`SA` placeholder).
- Close (×) button — **only renders if `onClose` prop is passed**. In the standalone build, `main.jsx` does not pass one, so the × never appears. The hook is left in place for embeddable contexts.

## API integration

`TemplatesLibrary` and `ReusableDrafts` each `fetch('/api/templates' | '/api/drafts')` on mount, with `loading` and `error` UI. Other views don't talk to the API yet — forms navigate back without persisting. See [API](07-api.md) and [Roadmap](10-roadmap.md).
