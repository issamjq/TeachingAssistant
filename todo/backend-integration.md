# Backend integration — what works, and what needs fixing

Against `https://murchid-backend.onrender.com`, probed **2026-08-10** with a
real Supabase access token for `test.teacher@murchid.com`.

The frontend is wired and deployed-ready. Everything below that is marked
BLOCKER is on the backend side; nothing in this repo is waiting on itself.

---

## How the two are connected

`API_PROXY_TARGET=https://murchid-backend.onrender.com` in the environment
makes `next.config.ts` rewrite `/api/*` to the service **server-side**. The
browser therefore only ever talks to its own origin.

That is not a convenience — the service sends no
`Access-Control-Allow-Origin` header at all, so a direct browser call would
be blocked by CORS before it left the page. Two ways out, either is fine:

- **Keep the proxy** (what is configured now). Nothing to change on the
  backend. This is the recommended shape: no preflight, no origin list to
  maintain, and the token never crosses an origin boundary.
- **Or add CORS** if you ever want the browser to call the service directly:
  `Access-Control-Allow-Origin` for the Vercel domain plus `localhost:3000`,
  `Access-Control-Allow-Headers: authorization, content-type`, and a
  `204` on `OPTIONS`.

**⚠️ Set `API_PROXY_TARGET` in the Vercel project environment** as well as
locally, or production keeps 404ing these paths. It is a server-side
variable — deliberately not `NEXT_PUBLIC_`, so the target never ships in
the browser bundle.

Streaming was verified through the rewrite: chunks arrive incrementally
(380 ms, 13.9 s, 14.3 s on a three-event reply), not buffered into one lump.
Next does not break SSE here.

---

## Verified working

| Endpoint | Result |
|---|---|
| `GET /healthz` | `{"ok":true,"uptimeSeconds":…}` |
| `POST /api/studio/generate` | streams `text/event-stream`, kinds `lesson_plan · quiz · homework · presentation · activity` |
| `POST /api/chat` | streams, **with working tool-calling** — asked "how many students do I have", it called `get_overview` + `get_schedule` and answered "You have **26 students**" |
| `POST /api/auth/renew` | `{plan}` → `{plan,status,currentPeriodEnd}`; accepts `trial · monthly` (rejects unknown) |
| `POST /api/images/upload` | `410 use_storage` — deliberately retired in favour of browser→Storage upload. Correct; the app already uploads that way. |
| `/api/admin/*`, `/api/superadmin/*`, `/api/owner/*`, `/api/moe/*`, `/api/dev/*`, `/api/teachers` | `403` for a teacher token — correctly gated |
| single-device enforcement | `401 session_superseded` when the token's `session_id` is not `users.active_session_id` |

Credits and usage are metered correctly: a generation moved `credits.balance`
1337 → 1336 and added a `usage_logs` row.

The SSE vocabulary the frontend now reads:

```
data: {"type":"session","sessionId":"…"}      chat only, first frame
data: {"type":"tool","name":"get_schedule"}   chat only, zero or more
data: {"type":"delta","text":"…"}             the answer, in pieces
data: {"type":"done","kind":…,"usage":{…}}    generation adds kind + usage
data: {"type":"error","message":"…"}          in-band, inside an HTTP 200
```

---

## BLOCKER 1 — the model quota is exhausted (highest priority)

Every model-backed route now returns, in-band:

```
data: {"type":"error","message":"The assistant has hit its usage limit. Try again in a minute."}
```

**This is not a per-minute window.** The first ~6 calls of the session
succeeded; it then locked out and had **not** recovered after 15 minutes
fully idle. That is the shape of an exhausted upstream credit balance or a
hard daily cap, not a sliding rate limit.

What to check, in order:

1. The model provider's dashboard — is the API key out of credit, or on a
   free tier with a daily cap?
2. Whether your own limiter is per-day rather than per-minute. If it is, the
   message is wrong and should say so: a teacher told "try again in a
   minute" who is still blocked an hour later stops trusting the product.
3. Whether `/api/chat` costs more than it looks. Each tool call is another
   model round trip, so one question can be four billed calls; a limiter
   counting *requests* will behave very differently from one counting calls.

Please also surface the real reason distinctly — `quota_exhausted` vs
`rate_limited` as separate `code`s. The frontend already renders whatever
`message` you send, so better copy lands with no change here.

---

## BLOCKER 2 — `POST /api/onboarding/parse` always 502

```
{"error":"The model service returned an error.","code":"upstream_error"}
```

Reproduced 3× across both accepted body shapes, ~20 s apart:

- `{"documents":[{"name":"cv.pdf","text":"…"}]}` → 502
- `{"documents":[{"name":"cv.pdf","mediaType":"application/pdf","dataBase64":"…"}]}` → 502

Validation passes (a missing `documents` correctly 400s with
`documents: Invalid input: expected array, received undefined`), so the
failure is inside the model call. Since `/api/studio/generate` works, the
two routes are probably not using the same model name or the same client —
worth diffing them. A pinned model id that has since retired is the usual
cause; a rolling alias (`gemini-flash-latest`, or the equivalent for
whichever provider) survives that.

**The frontend is already correct and needs no change.** It sends exactly
the shape above and expects `{ fields: { first_name, last_name, staff_id,
email, phone, school, majors[], grade_levels[], languages[], nationality,
bio } }` — every key optional, only what the document actually stated.

---

## BLOCKER 3 — `POST /api/studio/goal-plan` does not exist (404)

The Goal planner is a headline feature: a teacher attaches a syllabus, names
a timeline, and gets a week-by-week teaching plan. The button calls this and
currently shows "not connected yet".

Contract the frontend already expects:

```
POST /api/studio/goal-plan
  { "goal_id": "<uuid of a row in public.goals>" }

→ 200 the UPDATED goal row, at minimum:
  {
    "id": "…",
    "status": "active",              // was 'processing'
    "ai_verdict": "Achievable in six weeks, but the practical work is the constraint…",
    "plan": {
      "weeks": [
        { "week": 1, "focus": "Forces as vectors",
          "lessons": ["Balanced and unbalanced forces", "Free-body diagrams"],
          "assessment": "Exit tickets" }
      ],
      "risks": ["Lab 2 is shared with Chemistry on Thursdays"]
    }
  }
```

Read `goals.title`, `goals.timeline_days` and `goals.material_ids`, and the
teacher's `teaching_skills.skill_profile` rows — the feature's whole promise
is that the plan is built around *how this teacher teaches*. Writing the
result back to `public.goals` server-side is fine; the frontend merges
whatever you return into the row it is showing.

`npm run db:demo` seeds one goal already planned and one still `processing`,
so you have both states to test against.

---

## BLOCKER 4 — `POST /api/auth/email-verify/send` returns 502

```
{"error":"Could not send the email. Try again in a moment.","code":"email_send_failed"}
```

SMTP (or the transactional-mail provider) is not configured on Render.
Low urgency — Supabase confirms addresses at sign-up, so nothing is blocked
by it today — but the route exists and will fail if anything routes to it.

---

## Gap 5 — generations never reach the library

`/api/studio/generate` streams prose and stops. It does **not** write a row
to `public.ai_studio`, verified: 19 rows before a successful generation, 19
after.

Right now the teacher clicks **Save to library** in the studio and the
browser writes the row itself (allowed under RLS), so nothing is lost. But
two things would be much better handled by you:

**5a. Return structured output alongside the prose.** The studio has real
viewers built for this — a slide deck with prev/next and a fullscreen
present mode, a quiz with its options laid out and the answer key marked.
They are dark right now because only markdown arrives, so a generated quiz
renders as a wall of text and saves with **no questions**, which then shows
"0 marks" on the card and raises an "add questions" task.

Send one extra frame before `done` and both light up with no frontend
change — the client already prefers structured content when it is present:

```
data: {"type":"artifact","kind":"quiz","content":{
  "title":"Forces and motion — end of unit",
  "subject":"Physics","grade":"Grade 9","duration_minutes":30,
  "questions":[
    {"position":1,"type":"mcq","marks":1,
     "prompt":"A car travels at a constant 60 km/h. The resultant force is:",
     "choices":["Zero","Forwards","Backwards","Increasing"],
     "correct_answer":"Zero"}
  ]}}

data: {"type":"artifact","kind":"presentation","content":{
  "title":"Forces around us","subject":"Physics","grade":"Grade 9",
  "slides":[{"title":"What is a force?",
             "bullets":["A push or a pull","Measured in newtons"],
             "notes":"Ask for three examples before the next slide."}]}}
```

Field names matter — the library screens read `total_marks`,
`duration_minutes` and `scheduled_for`, not `marks`/`duration`/`scheduled`.

**5b. Or persist it yourself** and put the id on the `done` frame
(`{"type":"done","kind":"quiz","id":"<ai_studio uuid>"}`). Then the studio
can link straight to the saved item instead of writing its own copy. Either
5a or 5b is a real improvement; both together is best.

---

## Smaller notes

- **`GET /api/auth/me` and `GET /api/me` 404.** Not a problem — the app
  reads its profile from Supabase directly and does not call these. Only
  worth adding if you want them for your own diagnostics.
- **Cold starts.** Render's free tier spins down; first byte on a cold
  `/api/studio/generate` was **6.2 s**, against ~175 ms warm on `/api/chat`.
  The studio shows a streaming placeholder so it does not look frozen, but
  if teachers will use this daily, a paid instance (or a keep-warm ping) is
  the single biggest perceived-speed win available.
- **`/api/studio/generate` ignores `materials`.** The studio sends
  `materials: [{id, name}]` for attached files. If the generator does not
  read them, "attach a chapter and plan from it" is not actually happening —
  worth confirming. The extracted text is in `materials.extracted_text`, and
  the file itself is in the `imports` Storage bucket at `materials.file_path`.
- **The single-device check treats NULL as superseded.** A token whose
  `users.active_session_id` is NULL (nobody has claimed the device yet) gets
  `401 session_superseded`. Postgres's own `is_current_device()` treats NULL
  as *unclaimed* and allows it. Harmless in practice, because sign-in claims
  before anything else runs — but the two definitions should agree, and
  yours is the stricter one.

---

## What changed in this repo for the integration

- `API_PROXY_TARGET` set, so `/api/*` reaches the service same-origin.
- `src/shared/lib/apiStream.ts` — a shared SSE reader. `api()` calls
  `res.json()`, which cannot consume a stream; the studio had its own
  parser inlined and the assistant had none.
- The studio assistant now answers from `/api/chat` in studio scope, with
  the tool it is using shown while it works ("Checking your timetable"), and
  falls back to the local knowledge base if the service is unreachable. The
  **landing** assistant deliberately stays local: visitors are not signed
  in, and a marketing bot that can invent a price is worse than one that
  cannot.
- A 404 carrying no `code` is now read as "this route is not built yet"
  rather than shown as a bare "Not found" — which is what the Goal planner
  button says today, and what it will stop saying the moment BLOCKER 3 is
  fixed, with no further frontend change.
