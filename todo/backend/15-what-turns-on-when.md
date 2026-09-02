# 15 · What turns on when

> **Status (2026-09-02): the frontend is waiting, not blocked.** Every
> item below is built, shipped and live behind a graceful degradation.
> None of it needs a release when your endpoint lands — the button is
> already on the screen, and it starts working the moment the route
> answers.

This is the short version of the queue. Each row names the one endpoint
that flips a feature from "explains itself politely" to "works".

| Ship this | …and this starts working | Spec |
|---|---|---|
| `POST /api/materials/:id/extract` | The shelf's **Read it now**, the backfill of every file uploaded so far, and the reading surcharge disappearing from the quote for files already read | [10](10-phase1-materials.md) |
| One row per **deliverable**, not per document | Lessons stop appearing four times | [11](11-lesson-row-shape.md) |
| `goal-plan` accepting a class + start date, writing `goal_days` with **outcomes** | Placed terms get real per-day outcomes instead of a title and an outline | [12](12-goal-days.md) |
| `goal_days.draft_id` set when a day is drafted | A placed term stops offering to write the same lesson twice | [12 §4](12-goal-days.md) |
| Weak spots in the generation prompt | Lessons scaffold what the class actually got wrong | [13](13-performance-context.md) |
| `POST /api/curriculum/derive` | **Build one from my syllabus**, for every class nobody has authored | [14](14-curriculum-derive.md) |
| The embedding pipeline + `/api/corpus/search` | Retrieval. The schema is already there — see §2 below | this file |

---

## §1 · The one that unblocks the most

**`POST /api/materials/:id/extract`.** Right now there are **14 real
teacher uploads sitting at `status: 'uploaded'` with no text**, and
nothing will ever ask for them again on its own. Every generation that
attaches one of those re-downloads the file and pays the 3-credit
reading surcharge, every time.

The shelf now carries a **Read it now** button on any file that is not
`ready`. It is deliberately both things at once: the retry for a file
that failed, and the only backfill path those 14 rows have. It reports
`no_backend` as *"Reading documents isn't switched on yet — the file is
safe and can still be attached"*, so it is harmless until you ship.

When you do ship it, those 14 can be swept server-side rather than
waiting for someone to press a button 14 times. `status = 'uploaded' AND
extracted_text IS NULL` is the whole query.

## §2 · Retrieval: the schema is done, the wall is asserted

`db/tune.sql` §100 is applied. `pgvector` is **on**. `corpus_chunks`
exists with its indexes, including the HNSW index — built while the
table is empty, which is the cheap moment.

**Read this part before writing the ingest.** The table holds two
populations that must never mix, and the separation is a CHECK
constraint rather than a convention:

```
scope='global'   MUST have faculty_id IS NULL     -- ours to publish
scope='faculty'  MUST have faculty_id NOT NULL    -- one teacher's own
```

Both illegal shapes are refused at insert — verified, not assumed. A
private chunk cannot be ownerless and a public one cannot be owned, so a
bug in the pipeline fails loudly at write time instead of silently at
read time. The read policy has one arm per population and no write
policy at all: chunks come from the ingest service with the service
credential, never from a browser.

**Practically, for the ingest:**

- A chunk from a teacher's `materials` row is **always**
  `scope='faculty'` with her `faculty_id`. There is already ~2MB of
  third-party textbook text in `materials` on one account — NCERT and
  Vedantu. Publishing that to every teacher is the copyright line drawn
  in §99 and §100, and the constraint is what stops it happening by
  accident.
- `scope='global'` is only for material **we wrote or licensed**.
- `(material_id, chunk_no)` is unique, so re-ingesting a document
  replaces its chunks rather than doubling them.
- `curriculum_code`, `grade` and `subject` are on the chunk so retrieval
  can filter **before** the vector scan. A Grade 4 lesson pulling a
  Grade 10 passage is not fixable by post-filtering a
  nearest-neighbour result.
- `heading` and `page` exist so a generated lesson can cite where a
  passage came from and she can check it against her own book. Please
  fill them — it is the difference between a citation and a claim.
- `embedding` is `vector(768)` — Gemini `text-embedding-004`, the family
  you already hold a key for. Changing the dimension later means
  re-embedding everything.

**Chunk on meaning, not on length.** Respect headings and paragraph
boundaries rather than fixed windows. This is the one decision in the
whole plan that is expensive to redo: re-chunking a few thousand books
is a re-index, not an edit.

## §3 · What is already handled on our side

So you do not build these twice:

- **Timeouts** on every AI call — 45s to first byte, 90s idle. Send a
  `:` keep-alive more often than 90 seconds while thinking.
- **Retry** carries the original brief, its materials and the full kind
  set, and is suppressed for `quota_exhausted`, `insufficient_credits`,
  `material_not_found`, `material_has_no_file` and `NO_AI_KEY`.
- **Cut-stream recovery**: a dropped connection polls the library for the
  announced `batch_id` for 60s before failing — which is why rows must be
  persisted before the response ends.
- **`no_backend`**: any server-only path that 404s without a `code`
  renders as "not connected yet". Always send a `code` on a real 404.
- **Credit quoting** mirrors your `estimateCredits()`; a material already
  `ready` adds nothing to the quote.
- **`/healthz`** is what `/api/keepwarm` pings, and it reports the real
  status rather than treating a 404 as success.

## §4 · Still not ours, still open

Not code, and not the backend team's either — flagging so nothing waits
on the wrong person:

- Gemini off the free tier (~20 generations/day for the whole product).
- A verified mail sending domain.
- A scheduled pinger on `/api/keepwarm`, every ~10 minutes.
- A curriculum specialist to verify and extend `src/lib/curriculum.js`
  before the starter sequences are shown to real teachers as anything
  more than a draft.
