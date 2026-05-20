# 08 — Views

What each screen does, what it fetches, and what it doesn't yet do.

The app has two surfaces: the **Landing** (marketing) and the **Studio** (workspace). `main.jsx` toggles between them.

## `Landing.jsx`

The marketing landing page. Default view at `/`. Sections in order:

1. **Top nav** — `Murchid` logomark, anchor links to each section, and a red "Lesson Planner →" CTA that calls `onOpenStudio` (passed from `main.jsx`) to switch into the studio.
2. **Hero** — "Lesson prep in *thirty* seconds." Three rotated lesson cards + a spinning "30s to ready" badge + a 4-stat strip.
3. **Problem** — "Teachers don't have a *time* problem. They have a *prep* problem." Three big-number stats + a quote card.
4. **Solution** (dark section) — Four flow steps: Tell Murchid → It generates → You refine → You teach.
5. **Studio map** — Eight tool cards (Lesson Plans, Scheduling, Quizzes & Exams, Homework, Student Data, Subjects, Presentations, Activities) under the "Murchid Studio" hub badge.
6. **Hub** — Static dashboard mockup mirroring the real studio dashboard.
7. **Studio collab** — Side-by-side "Murchid's draft" / "Your version" panes showing inline edits, additions, and strikethroughs.
8. **Screens** — AI Generator mockup + Lesson Library mockup + a six-card "What's included" feature grid.
9. **Try it** — embeds `LandingDemo` (see below) and a link to open the real studio.
10. **Footer** — `المُدير` Arabic mark, big "Murchid" logo, tagline, credit.

A reveal-on-scroll `IntersectionObserver` adds the `visible` class to each section as it enters the viewport.

The CSS is in [`src/landing.css`](../src/landing.css), extracted verbatim from the original static index.html. It's loaded globally but uses class-scoped selectors (`.hero`, `.lesson-card`, `.dash-mock`, etc.) that don't collide with studio Tailwind utilities.

## `LandingDemo.jsx`

The interactive prototype embedded in the "Try it" section. Three modes:

- **Input** — Topic (text), Grade / Subject / Duration / Curriculum (selects).
- **Generating** — Spinner + 5-step progress list. Each step ticks done at +600ms intervals; transition to result at +3500ms.
- **Result** — Header (title + meta pills + New / Export / Save actions) + four-tab body: Lesson Plan / Timeline / Slides / Materials.

Result data comes from a hardcoded `lessonTemplates` object keyed by subject (Science, Mathematics, English, Arabic, Islamic Studies, Social Studies, Art). The Library tab shows nine hardcoded `libLessons` entries. No API calls.

Cleanup: timers are tracked in a ref and cleared on unmount or when "↺ New" is pressed.

## Studio views

The screens below are the studio surface, opened by clicking "Lesson Planner →" on the landing.

## `Dashboard.jsx`

## `Dashboard.jsx`

Default landing when `active === "dashboard"`.

- Greeting: "Good morning, Sara." with date and class count.
- Search bar (no behavior).
- 4 KPI cards: This week / Today / Pending / Students.
- "Today's schedule" card — 4 hardcoded classes with status pills (`DONE`, `LIVE NOW`, `NEXT`, time).
- "Recent AI activity" card — 4 hardcoded items with **bold** segments rendered via accent color (the `HighlightedText` helper splits on `**...**`).
- "Pending review" card — 2 items with "Review →" affordance.

**All data is hardcoded.** Wiring to real DB tables is on the [roadmap](10-roadmap.md).

## `TemplatesLibrary.jsx`

`active === "lesson-plans"` && `view.name === "templates"`.

- Fetches `/api/templates` on mount.
- Header with eyebrow + "Templates library" italic accent heading + "Pick a starting point" subtitle.
- Toolbar: search input (live filter on name / subject / tags), grade dropdown (built from the loaded data), subject dropdown (union of `MAJORS` + loaded subjects), and a **sort** dropdown (most used / recently updated / name A→Z / name Z→A). All four wired up.
- Loading and error states render as paper cards with mono eyebrows.
- Grid of template cards — `SubjectBadge`, name, metadata (`subject · duration min · grade {grade}`), flow text, tags, `Updated {timeAgo(updated_at)}`, **edit / delete** row actions on the card header, and a "Use template →" affordance.
- "Create blank template" dashed-border placeholder card at the end.
- Delete uses the shared `ConfirmDelete` modal and DELETEs `/api/templates/:id`.

`onUseTemplate(t)` from `App.jsx` jumps the user to `EditDraft` with a synthesized draft (`{ name: '${t.name} (from template)', progress: 25 }`). It does **not** persist — when DB writes land, this should `INSERT` a new draft and route to its `id`.

## `NewTemplate.jsx`

`view.name === "newTemplate"`.

A form for creating a new template. Manual flow today; AI-assisted toggle is shown as "soon." Save just navigates back; nothing is persisted yet.

## `ReusableDrafts.jsx`

`view.name === "drafts"`.

- Fetches `/api/drafts` on mount.
- Header: eyebrow + "Reusable drafts" italic accent heading + "Only you can see these" copy.
- Toolbar: search (filters on name / subject / status), subject dropdown (union of `MAJORS` + loaded), status dropdown (`In progress` / `Ready to use` / `Blocked` / `Paused`), **+ New draft** → `onNewDraft()`.
- **Clear all drafts** button opens a `ConfirmDelete` modal and DELETEs every draft (parallel `Promise.all`).
- Table: `SubjectBadge` + name + note (+ optional gold "warning" pill), Subject, `StatusBadge`, last-edited (relative), progress bar (sage if 100%, ink otherwise), "Resume →" → `onEditDraft(d)`, plus an **edit / delete** action column.
- All column headers are sortable via `useSortable` (default sort: `last_edited` desc).
- Footer info card reminding the user that drafts are private.

## `NewDraft.jsx`

`view.name === "newDraft"`.

Four-section form:

1. **Basic information** — name, subject, grade, class, duration, planned date.
2. **Learning objectives** — add/remove list.
3. **Lesson flow** — add/remove stages, each with name, duration, note. Drag-handle is decorative.
4. **Notes & resources** — textarea + file pills.

Right rail: 65% complete progress + checklist + tags + "Private to you" + "Reuse this later" hint.

Footer actions: Discard (calls `onCancel`), "Save & close" (calls `onSave`), "Open in full editor →" (calls `onOpenFull` which routes to `EditDraft`).

The Save handlers do **not** persist — they navigate back. Hooking up real saves needs a `POST /api/drafts` and a state update.

## `EditDraft.jsx`

`view.name === "editDraft"`. Receives `draft` from `view.draft`.

The full editor for an existing draft. More room than `NewDraft` for content, materials, and AI suggestions. Save / Mark ready navigate back; no persistence yet.

## `Database.jsx`

Top-level studio view when `active === "database"` (sidebar **Data → Database**). Wraps two sub-views in a tab strip styled like the Lesson Plans inner tabs. Sub-tab state is local to this component (`useState`) — not lifted to `App.jsx`, since none of the breadcrumbs or other studio chrome cares which sub-tab is open.

| Sub-tab key | Renders |
|---|---|
| `"profile"`  | `<DatabaseProfile />` — just the current teacher |
| `"students"` | `<DatabaseStudents />` — only kids in the current teacher's grades |

The "current teacher" is resolved server-side from `CURRENT_TEACHER_STAFF_ID` in [`src/lib/currentUser.js`](../src/lib/currentUser.js). When real auth lands, swap that constant for a session lookup.

## `DatabaseProfile.jsx`

Fetches `/api/me` on mount. Renders a single profile card for the logged-in teacher: avatar, name, majors, bio, and a stats grid (staff ID, hire date, email, phone, nationality, grades covered). An **Edit profile** button opens a modal that PATCHes `/api/me`. Editable fields: name, email, phone, nationality, hire date, bio, majors (chip multi-select), grade_levels (chip multi-select). The teacher's own record is intentionally not deletable from this screen.

Changing `grade_levels` directly affects which students show up in the Students tab — see below.

## `DatabaseStudents.jsx`

Fetches `/api/students?teacher=me` on mount. The server resolves "me" to the current teacher's `grade_levels` array and returns only students whose `grade` is in that set. So Sara (grades 6–9) sees ~26 students; a KG teacher only sees the KG students.

Toolbar: free-text search (name / student ID / guardian / section) + grade dropdown (`GRADE_LEVELS`) + section dropdown (derived from loaded data) + **+ New student**.

Sortable column headers (asc → desc → cleared) on every column. `useSortable` from `_shared.jsx` handles state and stable comparison; `getValue` is overridden so name sorts on `"first last"` and age sorts on the computed years.

Each row has an **Edit** / **Delete** action. Edit opens the same modal used for create — POST when new, PATCH when editing, with a CHECK-constraint-friendly error path (the API surfaces `23514` violations as a 400 with the Postgres message).

## `_shared.jsx`

Shared building blocks. Imported as `import { ... } from "./_shared"` from views.

| Export | What it is |
|---|---|
| `SubjectBadge` | 2-letter mono badge with subject-tinted border. |
| `StatusBadge` | Status pill — dot + uppercase mono text — colored by status. |
| `Section` | Numbered form section ("Section 2 of 4 — Learning objectives") wrapper. |
| `Field` | Label + child input wrapper, applies the standard label style. |
| `FilePill` | File chip with name / type / size. |
| `inputClasses` | Shared input className string. Use on plain inputs/textareas to match the system. |
| `selectClasses` | Same, for `<select>`. |
| `timeAgo(date)` | "2m" / "1h" / "3d" relative-time formatter. |
| `useSortable(rows, opts)` | Hook returning `{ sorted, sort, toggle }`. Click → asc → desc → cleared. `getValue` overrides field access for derived columns. |
| `SortHeader` | `<th>` that renders the mono header label + an arrow reflecting current sort state. |
| `Modal` | Centered modal with backdrop dismissal, Escape-to-close, optional eyebrow / title / footer. |
| `ConfirmDelete` | Yes/No confirmation modal styled for destructive actions. |
| `RowActions` | Inline edit/delete icon buttons for tables and cards. |
| `ChipMultiSelect` | Tag-style multi-select used for teacher majors and grade_levels. |
| `api(path, opts)` | Throw-on-not-2xx fetch wrapper that surfaces the API's error string. |

If you need a new shared visual primitive, add it here rather than copy-pasting between views.

## `components/ui/`

- `button.jsx` — `<Button variant="primary|secondary|outline|danger" />`. See [Conventions](09-conventions.md) for the no-override rule.
- `card.jsx` — `<Card>` + `<CardContent>`. Paper-cool background, line border, rounded.
