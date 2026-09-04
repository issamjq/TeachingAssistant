# The core generation endpoint — spec for a from-scratch build

Scoped deliberately to **one endpoint**: the thing every studio composer
bar in the frontend is actually waiting on. Chat, curriculum derive,
corpus/grounding, materials extraction, template library, and billing
are real, separate pieces — each needs its own spec once this one is
built and the patterns it establishes (auth, content ownership, error
shape) are proven. Speccing all of them shallowly in one document would
serve none of them well.

## What the frontend already has, that this plugs into

- **Schema:** `profiles` (role/status), `classes` → `class_materials` →
  `materials` (a class's attached reference documents — syllabus,
  curriculum, notes), `goal_items` (lesson_plan/slide_deck/activity/
  homework/notes, one row per drafted item), `assessments`
  (quiz/exam). Full definitions in `db/tune.sql`.
- **The gate that already exists:** a class needs at least one attached
  material before generation is allowed at all — enforced today by
  `hasReferenceMaterial()` disabling the composer's Send button
  client-side. The backend doesn't need to re-check this; it's a UX
  gate, not a security boundary, and the class's materials are what
  ground the generation anyway (see below).
- **Seven feature kinds**, the same vocabulary already used by
  `analytics_events.feature` and `feature_costs.feature`:
  `lesson_plan`, `slide_deck`, `activity`, `homework`, `note`, `quiz`,
  `exam`.
- **The composer bar** (`src/features/studio-legacy/StudioComposerBar.tsx`)
  is one shared component across all seven tabs. It already logs a
  real `analytics_events` row on every submit; it does not yet call
  anything real — `onSubmit` currently runs a `setTimeout` and writes
  simulated content straight to Supabase.
- **One writer per table, kept from the old backend's own principle:**
  the backend generates and returns content; the browser writes the
  row to `goal_items`/`assessments`/`materials` itself, under its own
  RLS-scoped session. This endpoint should not hold or need a
  service-role key, and should not write anything to Supabase itself.

## Recommendation: skip SSE for v1

The old backend streamed every generation over SSE (see
`todo/backend-integration.md`'s frame vocabulary). For a from-scratch
build, a single-document generation (one lesson plan, one quiz) is a
few seconds of latency — a plain synchronous JSON response is simpler
to build, simpler to consume, and has no heartbeat/timeout/cut-stream-
recovery machinery to get right before anything works at all. Streaming
is a real UX improvement worth adding later, once a non-streaming
version is proven — not a v1 requirement.

## Proposed contract

```
POST /api/studio/generate
Authorization: Bearer <supabase access token>

→ {
    "feature": "lesson_plan" | "slide_deck" | "activity" | "homework"
             | "note" | "quiz" | "exam",
    "classId": "<uuid>",
    "prompt": "A 45-minute lesson plan on cellular respiration…"
  }

← 200 {
    "title": "Cellular Respiration — Grade 10 Biology",
    "content": "## Objectives\n…markdown…",
    "usage": { "input_tokens": 812, "output_tokens": 1204 }
  }
```

### What the backend needs to do per request

1. **Verify the token** (already solved — `requireAuth` on
   `final/backend` reads `profiles` correctly now).
2. **Verify the class belongs to the caller.** `select 1 from classes
   where id = $classId and owner_id = $callerId` — reject with `403
   forbidden` otherwise. This is the one authorization check RLS can't
   do for you here, since the backend reads with its own pooler
   connection, not the caller's session.
3. **Read the class's attached materials for grounding**, same
   ownership-scoped query: join `class_materials` → `materials` where
   `class_materials.class_id = $classId`. Concatenate their `body_md`
   (capped at whatever prompt budget makes sense — several are likely
   to exist per class) into the system prompt as the source of truth.
   Prefer the class's own material over generic knowledge; say in the
   response if nothing in the attached materials was relevant to the
   prompt, rather than silently inventing content.
4. **Generate** with whichever provider gets chosen (`final/backend`'s
   reset removed Gemini/Anthropic/OpenRouter-for-chat entirely — only
   the OpenRouter key pool exists now, for the Keys console. This
   route needs its own provider decision; the key pool already built
   could plausibly serve it, or a new dedicated key/provider — that
   choice belongs to whoever builds this, not this spec).
5. **Return the shape above.** No writes to Supabase from this route.

### Errors

Same envelope as Keys: `{ "error": "…", "code": "…", "errorId": "…" }`.

| Status | Code | When |
|---|---|---|
| 400 | `bad_request` | Missing/invalid `feature`, `classId`, or empty `prompt` |
| 403 | `forbidden` | `classId` doesn't belong to the caller |
| 404 | `not_found` | Route not deployed yet — already correct, see `10-remaining-after-keys.md` §1 |
| 429 | `rate_limited` / `quota_exhausted` | Real distinction, not one generic 429 — the frontend can tell a teacher "try again in a minute" vs "we're out of capacity today" if it knows which |
| 503 | `no_ai_key` | No usable provider right now (mirrors the old `NO_AI_KEY` pattern, which the frontend's error handling already expects the shape of) |

### What the frontend will do once this exists

Wire `StudioComposerBar`'s `onSubmit` (currently one `setTimeout` per
page — `app/(dashboard)/classes/[classId]/{page,presentations,
activities,homework,notes,exams,quizzes}.tsx`) to call this endpoint
via the existing `backendFetch` helper (`src/lib/data/backend.ts`,
already handles the bearer token and the `/api/*` proxy — no new
frontend infra needed), then write the returned `title`/`content` into
whichever table the feature maps to (`goal_items` for lesson_plan/
slide_deck/activity/homework, `assessments` for quiz/exam, `materials`
for note) instead of the current simulated placeholder text. Falls back
to the current simulation only on a confirmed `404 not_found` (see
`10-remaining-after-keys.md`'s note on why that fallback isn't built
speculatively ahead of a real route existing).

## Not in this spec, on purpose

- **Chat / studio assistant** (`/api/chat`) — a different interaction
  model (multi-turn, tool calls), deserves its own contract once this
  one's patterns (auth, grounding, error shape) are settled.
- **Curriculum derive, corpus/grounding, materials extraction** — each
  depends on infrastructure decisions (an embedding provider, a real
  extraction pipeline) this document doesn't make.
- **Credits/billing metering** — gated on the Stripe decision, tracked
  separately.
