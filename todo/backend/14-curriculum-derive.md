# 14 · Phase 4 — deriving a sequence from her own syllabus

> **Status (2026-09-02): 🟡 ENHANCEMENT, not a blocker.** The curriculum
> spine shipped today: schema, seed, and a "Start from your curriculum"
> picker in the goal planner. What it cannot do is cover a combination
> nobody has authored — and it never will, because the matrix is too big
> to author. That is what this endpoint is for.

---

## §1 · What exists now

`db/tune.sql` §99, applied, plus `npm run db:seed`:

```
curricula(code, name, name_ar, region)                 -- 5 rows
curriculum_units(curriculum_code, grade, subject, seq,
                 title, outcomes text[], typical_weeks, source)
```

Both are **reference data**: a read policy for `authenticated` and **no
write policy at all**, asserted at the end of the section. A teacher must
never be able to edit the sequence another teacher is shown.

Unique on `(curriculum_code, grade, subject, seq)`, so re-seeding
corrects a title or an outcome rather than appending a second copy.

**Structure only, never content.** A unit is a title, a position and its
outcomes — the shape a ministry or board publishes. Textbook text is
copyrighted and is not stored here; her own book lives in her own private
bucket bound to her own class (§96).

### What is actually seeded, and what that means

**12 units across two classes** — Grade 7 Science and Grade 7 Maths —
carrying `source: 'starter'`. These are the near-universal topics of
lower-secondary science and maths in the usual order. **They have not
been checked against any ministry or exam-board document**, and the UI
says so in as many words wherever they are shown.

That honesty is deliberate and worth keeping: a sequence presented with
more confidence than it has earned makes a veteran audit every week
before she can trust any of it, which costs her more than building it
herself would have. When someone who reads the real documents verifies
and extends `src/lib/curriculum.js`, they should flip `source` to the
board it came from, and the UI's provenance note follows automatically.

## §2 · What we would like — `POST /api/curriculum/derive`

Coverage is a trap: five boards × KG–12 × nineteen subjects is thousands
of cells, and nobody is going to author them. The curated table is the
**fast path**; this is the **general case**, so coverage never blocks a
launch.

**Request**

```json
{ "curriculum": "moe", "grade": "Grade 9", "subject": "Chemistry",
  "material_ids": ["<uuid>"] }
```

`material_ids` are rows in `materials` — usually the syllabus she has
already uploaded, which after Phase 1 is likely `status: 'ready'` with
`extracted_text` sitting on the row. Prefer that text over re-reading the
file, and do not charge the reading surcharge for a file you did not
open.

**Response**

```json
{ "units": [ { "seq": 1, "title": "…", "outcomes": ["…"], "typical_weeks": 3 } ],
  "source": "derived",
  "confidence": "high" | "low" }
```

**Do not write `curriculum_units`.** It is reference data shared between
teachers, and one teacher's uploaded document is not evidence about
everyone else's syllabus. Return the units; the browser will use them for
her goal. If a derived sequence looks good enough to publish, that is a
human decision and a seed-file edit.

### Prompt guidance

- **Extract the sequence as the document states it.** Do not invent
  units, do not reorder to match a different board, and do not pad to
  fill a term. Returning six honest units beats twelve invented ones.
- **Outcomes must be checkable** — "calculate the mean, median and mode
  from a list" rather than "understand averages". They are what a lesson
  gets drafted against and what Phase 3's weak-spot signal keys on.
- **Say when it is a guess.** If the document is not a syllabus, or the
  order had to be inferred rather than read, return
  `confidence: "low"` — the UI will show it as a draft to check rather
  than a sequence to trust. An honest low-confidence answer is far more
  useful than a confident wrong one.

## §3 · Not asked for

- **Do not store textbook content anywhere**, derived or uploaded, in
  any shared table. Her copy, her bucket, her class.
- **Do not merge derived units into the catalog** (see above).
- **No new nav or screen** — this feeds the picker that already exists.

---

## §4 · The other thing this unlocks

Once a goal starts from a unit, it carries `grade` and `subject` from the
first save, so placement already knows the class. The chain then reads:

> curriculum unit → a goal that knows its class → a dated week-by-week
> plan → lessons on the timetable → drafted material → and, after a
> quiz, the weak-spot signal feeding the next lesson.

Every link exists today except the one this file asks for: a sequence
for the classes nobody has authored.

---

## Definition of done

- A teacher picking Grade 9 Chemistry, which nobody has authored, uploads
  her syllabus and gets a sequence she recognises.
- A document that is not a syllabus is reported as such rather than
  turned into six plausible units.
- Nothing derived from one teacher's upload appears in another teacher's
  picker.
