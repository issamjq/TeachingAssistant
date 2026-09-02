# What is still open

> **Updated 2026-09-02.** Work orders 09–12 are done and have been
> deleted — the specs served their purpose and a folder of finished
> requests is a folder nobody reads. This file is the whole outstanding
> list. If it is not here, it is not waiting on anyone.

## Waiting on the backend

| # | What | Spec |
|---|---|---|
| 13 | Weak spots in the generation prompt — lessons that scaffold what the class actually got wrong | [13](13-performance-context.md) |
| 14 | `POST /api/curriculum/derive` — a sequence read off her own syllabus, for the classes nobody has authored | [14](14-curriculum-derive.md) |
| 08 | `POST /api/studio/skill-profile` — the interview compiled into a written profile, and `skill_ids` honoured during generation | [08](08-skills-refinement.md) |
| — | The corpus: embedding pipeline + `/api/corpus/search`. Schema and the scope wall are already in place — see §3 below | this file |

Everything else the frontend needs has shipped. The three specs above
are self-contained; nothing in them depends on anything else in this
list.

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
- **A curriculum specialist** to verify and extend
  `src/lib/curriculum.js`. The 12 seeded units carry `source: 'starter'`
  and the UI says they are our draft. That is honest, but it is not a
  ministry sequence, and it should not be shown as one.

## §1 · The 14 files nobody has read

There are still real teacher uploads sitting at `status: 'uploaded'`
with no `extracted_text`. Extraction exists now, but nothing has gone
back for the files that predate it, and each one silently costs the
3-credit reading surcharge on every generation that attaches it.

The shelf's **Read it now** button does one at a time. A server-side
sweep would be kinder, and the query is the whole job:

```sql
select id from public.materials
 where status = 'uploaded' and extracted_text is null and deleted_at is null;
```

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
- **Weekday placement**: the browser has her real pattern because she
  picks the days, so it overwrites the service's even spread through the
  shared `(goal_id, week, day_index)` key. Both sides upsert; whichever
  runs second corrects the first.

## §3 · Before writing the corpus ingest

`db/tune.sql` §100 is applied. `pgvector` is on, `corpus_chunks` exists,
and the HNSW index is built while the table is empty.

The table holds two populations that must never mix, and the separation
is a CHECK constraint rather than a convention:

```
scope='global'   MUST have faculty_id IS NULL     -- ours to publish
scope='faculty'  MUST have faculty_id NOT NULL    -- one teacher's own
```

Both illegal shapes are refused at insert — verified against the live
schema, not assumed. So a bug in the pipeline fails loudly at write time
instead of silently at read time, months later, as one school's textbook
appearing in another school's lesson.

For the ingest:

- A chunk from a teacher's `materials` row is **always**
  `scope='faculty'` with her `faculty_id`. There is ~2MB of third-party
  textbook text in `materials` on one account already; publishing that
  to every teacher is the line drawn in §99 and §100.
- `scope='global'` is only for material **we wrote or licensed**.
- `(material_id, chunk_no)` is unique, so re-ingesting replaces rather
  than doubles.
- `curriculum_code`, `grade` and `subject` are on the chunk so retrieval
  filters **before** the vector scan. Post-filtering a
  nearest-neighbour result cannot stop a Grade 4 lesson pulling a
  Grade 10 passage.
- `heading` and `page` are what turn a citation into something she can
  check against her own book. Please fill them.
- `embedding` is `vector(768)` — Gemini `text-embedding-004`. Changing
  the dimension later means re-embedding everything.
- **Chunk on meaning, not length.** Respect headings and paragraph
  boundaries. This is the one decision here that is expensive to redo.

## §4 · Verifying a real run

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

**A placed term has dated days with real outcomes:**

```sql
select count(*) days, count(date) dated, count(nullif(outcomes,'{}')) with_outcomes
  from public.goal_days where goal_id = '<goal_id>';
```

`days` should equal the days in `plan.weeks[].days[]`. `with_outcomes`
at zero across the board means the model omitted `objectives` rather
than renaming it — worth telling them.
