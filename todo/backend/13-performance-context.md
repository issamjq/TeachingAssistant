# 13 · Phase 3 — what the class found hard, in the prompt

> **Status (2026-09-02): 🟡 ENHANCEMENT, not a blocker.** The frontend
> half shipped today and needs nothing from the service: the signal is
> computed in Postgres and shown to the teacher directly. What is left is
> the other half of the loop — letting a generation *know* what the class
> found hard, so a recap is written into the lesson rather than asked for
> by hand.

**Read §2 before writing any code. It is a hard constraint, not a
preference.**

---

## §1 · What exists now

`db/tune.sql` §98 added one function, applied:

```sql
public.class_weak_spots(
  p_grade text, p_subject text, p_section text DEFAULT NULL,
  p_since date DEFAULT NULL, p_min_n int DEFAULT 5, p_below numeric DEFAULT 0.6
) RETURNS jsonb
```

SECURITY DEFINER, gated on `current_faculty_id()` by hand, executable by
`authenticated` only. It returns an array, worst first:

```json
[ { "question": "Explain why a skydiver reaches terminal velocity.",
    "quiz": "Forces and motion — end of unit",
    "last_set": "2026-08-21", "n": 8, "mean_pct": 31 } ]
```

It reads both mark shapes, which is the fiddly part and is already done:

| Source | Where | Meaning |
|---|---|---|
| teacher | `quiz_attempts.question_marks ->> key` | marks earned |
| automatic | `quiz_attempts.flags->'marking'->key` | `{correct, marks}` where `marks` is what was earned |

`key` is `COALESCE(q->>'qid', q->>'id', q->>'position', (ord-1)::text)`,
the same resolution the graders and readers use.

**A merely pending question is excluded.** Its breakdown entry is
`{pending: true, marks: <max>}` — `marks` there is the maximum, not what
was earned, so counting it would read as a full score for work nobody has
looked at yet.

**No model was involved and none should be.** It is counting; it is
exact; it costs nothing; and a teacher can check it against her own
gradebook. A sentence a model wrote about numbers it was shown would be
a worse version of this, and would cost credits to be worse.

## §2 · The privacy constraint

**Aggregate only. Never a student's name, id, or individual score in a
model request. Enforce it in code, not in a prompt.**

These are children, the terms already cite UAE PDPL, and the difference
between "8 of 24 missed the mole-ratio question" and a named list is the
difference between a teaching aid and a disclosure. `class_weak_spots`
is built so that the shape it returns cannot identify anyone — please
keep that property on the way through your side, and do not join back to
`quiz_attempts` for detail before building a prompt.

Please also add a line to the privacy policy in this repo
(`src/lib/legal.ts`) when this ships: class-level performance shapes
generated material; individual results never leave the database.

## §3 · What we would like

When a generation carries a class — the composer sends the pick, and
`/api/studio/generate` and `/api/studio/agent` both receive it — call
`class_weak_spots` for that class with the service credential and add a
short paragraph to the prompt.

Suggested shape, kept to the two or three worst:

```
This class recently scored poorly on: "Explain why a skydiver reaches
terminal velocity" (8 answered, average 31%); "Calculate the braking
force…" (8 answered, average 31%). Where the new material touches these,
scaffold them rather than assume them.
```

### Prompt guidance

- **Scaffold, do not lower the ceiling.** A weak spot is a reason to
  re-teach the sticking point inside the new lesson, not to replace the
  lesson with revision or to aim the whole thing lower.
- **Say why, in the document.** If a recap is there because of last
  week's marks, the lesson plan should say so in a line the teacher can
  read and delete. Silent adaptation is the failure mode this whole
  feature is built to avoid — she has to be able to see the reasoning to
  trust it or overrule it.
- **Ignore it when it does not fit.** If the new material has nothing to
  do with the weak spots, say nothing and write the lesson asked for. A
  forced callback to terminal velocity in a lesson on cells is worse
  than no callback at all.
- **Never name a child**, even if you somehow have the data.

## §4 · Also worth doing, cheaply

**Set `goal_days.draft_id` when a day is drafted** (from
[12 · goal days](12-goal-days.md) §4). Independent of this phase, one
line, and it is what stops a placed term offering to write the same
lesson twice.

## §5 · A note on the demo account

`npm run db:demo` now writes a per-question breakdown on graded attempts,
because it previously wrote only a total and this feature had nothing to
read on a demo account. Two questions per quiz are deliberately weak
across the cohort, so the signal has something true to find. If you are
testing against the demo teacher, that is why the numbers look like a
class that struggled with the same two things.

---

## Definition of done

- A lesson generated for a class that recently scored 31% on terminal
  velocity opens with a scaffolded recap of it, and says in the plan
  that it did so because of the last quiz.
- The same request for a class with no marks yet is written exactly as
  it is today.
- No student name or id appears in any model request, verified by
  reading the code path rather than by testing outputs.
