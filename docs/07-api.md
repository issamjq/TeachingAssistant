# 07 — API

## Approach

The API is a single **Express app** under [`server/`](../server/). Two transports plug it in:

- **Production** — `node server/index.js` listens on `PORT` (Render).
- **Dev** — `vite.config.js` mounts the same `buildApp()` instance as Vite middleware, so `npm run dev` keeps the SPA + API on the same origin (no CORS, no proxy).

```
server/
  index.js              # bootstrap (express + listen) — used by Render
  app.js                # buildApp() — same instance used by Vite middleware
  lib/
    db.js               # shared pg.Pool
    helpers.js          # buildPatch, handleErr
    crud.js             # crudRouter() — list / create / get / patch / delete
    currentTeacher.js   # cache for the no-auth "logged-in teacher"
  routes/
    me.js               # GET / PATCH /api/me
    teachers.js         # crudRouter('teachers')
    students.js         # crudRouter('students') with ?teacher=me filter
    templates.js        # crudRouter('templates')
    drafts.js           # crudRouter('drafts')
```

The Pool is process-scoped — long-running on Render, dev-server-scoped under Vite.

## Why this shape

- **One source of truth.** Both transports share the same Express app, so dev and prod can't drift.
- **Dev stays simple.** `npm run dev` mounts the API automatically; no second process to start, no CORS to configure.
- **Render-friendly.** Just `npm install` + `npm run start:server`.

## Current endpoints

Each entity supports the same four-verb shape:

| Method | Path | Notes |
|---|---|---|
| GET | `/api/<entity>` | List. Server-side ordering (see below). |
| POST | `/api/<entity>` | Create. Body: subset of allowed fields. Empty strings → NULL. |
| PATCH | `/api/<entity>/:id` | Partial update. Only fields present in the body are written. Empty strings → NULL. |
| DELETE | `/api/<entity>/:id` | Hard delete. 404 if id missing. |

Entities: `templates`, `drafts`, `teachers`, `students`. All respond JSON, errors return `{ error: <msg> }` with HTTP 400 for `CHECK` / `UNIQUE` violations and 500 otherwise.

Default GET ordering:

- `/api/templates` — `used_count DESC NULLS LAST, id`
- `/api/drafts` — `last_edited DESC NULLS LAST, id`
- `/api/teachers` — `last_name, first_name`
- `/api/students` — `grade, section, last_name, first_name`

### Special routes

| Method | Path | Returns |
|---|---|---|
| GET | `/api/me` | The single teacher row matching `CURRENT_TEACHER_STAFF_ID` (see [`src/lib/currentUser.js`](../src/lib/currentUser.js)). 404 if missing. |
| PATCH | `/api/me` | Update the current teacher's row. Same allowed-field set as `/api/teachers/:id` minus `staff_id`. |
| GET | `/api/students?teacher=me` | Students whose `grade` is in the current teacher's `grade_levels[]`. The teacher's grades are looked up once and cached for the process lifetime — restart to pick up changes. |

## Field allowlists

The mutation handlers don't trust unknown body keys. Each entity has an explicit allowed-field list (`TEMPLATE_FIELDS`, `DRAFT_FIELDS`, `TEACHER_FIELDS`, `STUDENT_FIELDS` in `vite.config.js`). Keys outside that list are silently dropped — protects against client-side typos quietly polluting columns and against client code accidentally trying to set `id` or `created_at`.

## Caveats still in effect

- Still dev-only — `vite build` does not bundle the middleware. See **Caveat: dev-only** above.
- No pagination — fine while seed data is small.
- No auth — `/api/me` uses a hardcoded staff ID. Replace `currentUser.js` with a session lookup when auth lands.
- The `teacherGrades` cache invalidates only on server restart. If you change a teacher's `grade_levels` via the UI and want the Students view to reflect it immediately, restart `npm run dev`. Acceptable while there's one teacher; revisit when multi-tenant.

## Calling from React

Use the shared `api(path, opts)` helper from [`_shared.jsx`](../src/views/_shared.jsx) — it sets the right `Content-Type`, parses JSON, and throws on non-2xx with the server's error message:

```jsx
import { api } from "./_shared";

// list
const rows = await api("/api/students?teacher=me");

// create
const created = await api("/api/students", { method: "POST", body: form });

// update
const saved = await api(`/api/students/${id}`, { method: "PATCH", body: patch });

// delete
await api(`/api/students/${id}`, { method: "DELETE" });
```
