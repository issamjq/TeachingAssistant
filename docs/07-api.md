# 07 — API

## Approach

There is no separate Express/Node process. API endpoints are mounted as a **Vite middleware plugin** inside the dev server. The full implementation is in `vite.config.js`:

```js
const apiPlugin = {
  name: "mudir-api",
  configureServer(server) {
    server.middlewares.use("/api/templates", async (req, res) => { /* SELECT ... */ });
    server.middlewares.use("/api/drafts",   async (req, res) => { /* SELECT ... */ });
  },
};
```

The plugin shares one `pg.Pool` for the lifetime of the dev process.

## Why this shape

- No second process to start. `npm run dev` is everything.
- No CORS or proxy config — Vite serves both the SPA and the API on the same origin.
- The middleware lives next to the rest of the dev tooling, so it's discoverable.

## Caveat: dev-only

`vite build` produces a static `dist/` bundle. The middleware plugin runs in `vite dev` only — it is **not** part of a production build. So `npm run preview` does not serve the API, and a deployed `dist/` will hit 404s on `/api/*`.

For production, replace this plugin with one of:

- A small Node/Express server.
- Serverless functions (Vercel/Netlify/Cloudflare). Each `/api/*` route becomes its own function.
- Neon's serverless driver + edge functions.

The query logic itself ports cleanly — only the transport changes.

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
