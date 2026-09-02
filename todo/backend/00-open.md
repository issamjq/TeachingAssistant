# What is still open

> **Updated 2026-09-02.** Work orders 09–14 are done and have been
> deleted — the specs served their purpose and a folder of finished
> requests is a folder nobody reads. This file is the whole outstanding
> list. If it is not here, it is not waiting on anyone.

## 🔴 Do this first: production is running a known bug

Everything the service has built sits on **`backendv2`**. Production is
**`main`**, and `main` still pins `temperature: 0` on structured Gemini
calls — which on a long enough input degenerates into a repetition loop:
65,520 output tokens of garbage, then *"Couldn't read that response."*
The teacher sees a failure and the noise is billed.

It hits **every** structured call: the goal planner, the quiz
structurer, the CV parse. A term plan that fails on a big syllabus and
works on a small one is this, and it has been true for as long as the
pin has existed.

One commit to cherry-pick, and it touches nothing in the wire contract.
Do that, or deploy `backendv2` — but until one of them happens, none of
the work below §2 is reachable by a teacher, because it is all on the
branch that is not serving anyone.

## Waiting on the backend

| # | What | Spec |
|---|---|---|
| 08 | `POST /api/studio/skill-profile` — the interview compiled into a written profile, and `skill_ids` honoured during generation. Open since August and not mentioned in any release since | [08](08-skills-refinement.md) |
| — | **Grounded generation** — inject retrieved passages into lesson and quiz prompts, prefer her material over ours, cite which source a section drew on. The corpus and `/api/corpus/search` now exist; this is the step that uses them | this file, §3 |

Everything else the frontend needs has shipped. The two items above are
self-contained; nothing in them depends on anything else in this list.

### One line still owed on our side

The privacy policy has to say that class-level performance now shapes
generated material — its old wording ("what is not sent: … marks or
submissions") stops being true the moment the weak-spot prompt
deploys. Written and sitting on branch `privacy-performance-line`,
waiting on the owner because it is visitor-facing legal text.

*(The service asked for this in `src/lib/legal.ts`. The rendered policy
is `src/features/marketing/legal/privacy.ts` — `legal.js` is the older,
shorter funnel copy and has no AI-providers section to correct.)*

## Waiting on nobody's code

These are the ones that keep getting missed because they are not a pull
request:

- **Gemini is still on the free tier.** ~20 generations a day for the
  whole product. This gates every AI feature above.
- **A verified mail sending domain.** Until then verification codes
  reach only the Resend account owner. (Supabase "Confirm email" is off
  — that half is done.)
- **A scheduled pinger on `/api/keepwarm`, every ~10 minutes.** Measured
  2 Sep: a cold first request took **22.6 seconds**; the next one took
  **0.16**. The route is built and reports the real status; it just
  needs any free monitor pointed at it. This is the cheapest
  perceived-speed win available and it has been open the longest.
- **A `backendv2` service block in the backend's `render.yaml`.** The
  blueprint describes `main`/starter/Singapore while the v2 service is
  Free/Oregon; that drift has already cost one failed deploy.
- **`EMBEDDING_API_KEY` and `GEMINI_EMBED_MODEL`** in the backend
  environment. The first falls back to `GEMINI_API_KEY`, so retrieval
  inherits whatever the Gemini tier decision above lands on.
- **A curriculum specialist** to verify and extend
  `src/lib/curriculum.js`. The 12 seeded units carry `source: 'starter'`
  and the UI says they are our draft. That is honest, but it is not a
  ministry sequence, and it should not be shown as one.

## §1 · The 14 files nobody has read — now one press

Solved, and the reason it could not be a cron job is worth keeping: the
service **holds no service-role key on purpose**, because that key mints
access to every teacher's files. Storage is read with the teacher's own
token, so a sweep of everyone's backlog is not something a scheduled job
can do without becoming a far more dangerous thing to run.

So it is an authenticated call she makes:
`POST /api/materials/extract-pending`, 25 files a batch. The shelf shows
**Read my unread files** whenever there is a backlog, one batch per
press — every successful read is charged, and a button that keeps
spending after she has stopped looking is not one she can trust.

## §2 · What is already handled on our side

So it is not built twice:

- **Timeouts** on every AI call — 45s to first byte, 90s idle. Send a
  `:` keep-alive more often than 90 seconds while thinking.
- **Retry** carries the original brief, its materials and the full kind
  set, and is suppressed for `quota_exhausted`, `insufficient_credits`,
  `material_not_found`, `material_has_no_file` and `NO_AI_KEY`.
- **Cut-stream recovery**: a dropped connection polls the library for
  the announced `batch_id` for 60s before failing — which is why rows
  must be persisted before the response ends.
- **`no_backend`**: any server-only path that 404s *without* a `code`
  renders as "not connected yet". Always send a `code` on a real 404.
- **Credit quoting** mirrors `estimateCredits()`; a material already
  `ready` adds nothing to the quote.
- **`goal_day_id`** is now sent on `/api/studio/generate` and
  `/api/studio/agent` whenever a lesson was started from a placed term.
- **The class pick** is sent on both studio routes, and on
  `goal-plan` along with `start_date` and `periods_per_week`.
- **Weekday placement**: the browser has her real pattern because she
  picks the days, so it overwrites the service's even spread through the
  shared `(goal_id, week, day_index)` key. Both sides upsert; whichever
  runs second corrects the first.

## §3 · The corpus exists; grounding does not

The ingest and `POST /api/corpus/search` shipped. Chunks are written by
the service with the teacher's own token — it holds no service-role key
on purpose — and the scope wall behaves: all four shapes were run against
the live table, and a planted-chunk search returned her chunk and ours
while excluding another teacher's and the wrong grade.

Worth knowing about the chunker, because it was written against a real
19,000-character syllabus rather than a sample, and all three of these
were bugs found by reading its output:

- A PDF text layer often has **no blank lines at all**, so
  paragraph-based scanning found zero headings. Headings are found per
  line now.
- A shouted line must **look like language** before it is believed —
  otherwise every passage gets labelled "TOTAL 80" or "CG-9", because a
  syllabus is mostly a table.
- A heading that labels **every** section names none of them, so a
  running header is dropped. On that document 1 chunk in 10 has a
  heading, because the document genuinely has one. A citation pointing
  at the wrong section is worse than one pointing at nothing.

PDFs are read page by page and merged afterwards, so each passage keeps
its page — that cannot be recovered from the merged string later.

**What is left is the use of it.** Retrieved passages are not yet
injected into generation. When that is built: prefer her material over
ours where both match, say in the document which source a section drew
on, and generate as today rather than forcing weak passages in when
retrieval finds nothing useful.

## §4 · Nothing has been run for real

Worth reading twice, and it is the service's own account rather than a
suspicion: every path below typechecks, builds, boots against the live
database and has had its logic verified in isolation — but **no teacher
session has exercised any of it end to end.** Driving the app needs a
signed-in teacher, which that side does not have.

| Path | Verified | Not verified |
|---|---|---|
| Row id on `done` | Insert against the live schema | That a real generation writes exactly one row |
| Trio merge | Full and partial trio, order, title | A real three-document lesson |
| 429 split | Classification against captured bodies | A live quota exhaustion |
| Extract | Mounted, auth-gated, insert shape | A real upload → ready → attach cycle |
| Goal days | Patterns 1–5, wrapping, mid-week starts | A real term plan |
| Weak spots | Real marked data, no id in the prompt | A lesson that opens with the recap |
| Derive | 15 units from a real CBSE syllabus | The HTTP route; the not-a-syllabus refusal |
| Corpus | Chunker on a real syllabus, scope CHECK, tenant isolation | A real embedding call; upload → index → search |

So the queries below are not a formality. They are the first time any
of this meets a teacher.

## §5 · Verifying a real run

Two queries settle almost everything, and neither needs a teacher
session beyond making one thing.

**A lesson is one row:**

```sql
select type, count(*) from public.ai_studio
 where batch_id = '<batch_id>' group by type;
-- lesson_plan | 1     ← whatever the trio produced
```

Any row typed `teaching_guide` or `student_notes`, or `lesson_plan`
above 1, means the merge is not live on the deployed branch.

**A lesson for a class with recent weak marks scaffolds them, and says
why** — ask for a Grade 9 Physics lesson adjacent to forces and the plan
should recap terminal velocity with a line explaining that it is there
because of a recent quiz. Ask for one on cells and it should not mention
it at all. A recap in the cells lesson is the failure mode worth
reporting fast.

**A placed term has dated days with real outcomes:**

```sql
select count(*) days, count(date) dated, count(nullif(outcomes,'{}')) with_outcomes
  from public.goal_days where goal_id = '<goal_id>';
```

`days` should equal the days in `plan.weeks[].days[]`. `with_outcomes`
at zero across the board means the model omitted `objectives` rather
than renaming it — worth telling them.
