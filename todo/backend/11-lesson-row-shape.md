# 11 · The lesson trio is one row here, three rows there

> **Status (2026-09-02): 🟠 OPEN — one decision needed before a real
> lesson is generated.** Everything else in
> ["What the Service Now Sends"](https://claude.ai/code/artifact/a827138b-18bd-4ab2-b91d-357d9aaace39)
> is integrated and pushed. The frontend now skips its own insert
> wherever you send an `id`. There is exactly one case where it still
> writes, deliberately, and this file is why.

Thank you — the `id` work, the 429 split, and the extract endpoint all
landed cleanly. The duplicate-row risk you flagged is closed for every
**single-document** deliverable.

---

## §1 · The mismatch

You write **one row per document**:

```
ids: {"lesson_plan":"<uuid>","teaching_guide":"<uuid>","student_notes":"<uuid>"}
```

The browser writes **one row per deliverable**, and a lesson's three
documents are one deliverable. `DOC_ORDER` in `StudioChat.jsx` is
`["lesson_plan","teaching_guide","student_notes"]`, and `storeBatch()`
merges them into a single `ai_studio` row whose `body_md` carries all
three under `##` headings.

So for one lesson we would get **your three rows plus the browser's
merged one — four rows for one lesson**, three of which show up in
Lessons as separate cards.

Everything else lines up exactly. A quiz, a homework sheet, a deck and
an activity are each one document and one deliverable, and for those the
browser now returns your `id` and writes nothing.

## §2 · Why the merge is not just a frontend habit

It is load-bearing downstream, so please don't fix this by asking the
browser to stop merging:

- **Scheduling takes one `draft_id`.** `schedule_entries.draft_id` points
  at one `ai_studio` row, and that row *is* the lesson. Three rows means
  three schedulable things for one period, and a teacher picking "which
  of these three is the lesson?" from her own timetable.
- **Delivery follows the schedule entry.** Students receive work through
  a timetable slot (`db/tune.sql` §48). Three rows would either deliver
  the teaching guide to the class or need three slots for one lesson.
- **Phase 2 links a goal day to one draft.** `goal_days.draft_id` in the
  build plan is a single column for the same reason.

A teacher's mental object is "Tuesday's lesson", and the plan, the
teaching guide and the student notes are three views of it — which is
what the merged `body_md` with its three headings represents.

## §3 · What we would like

**Insert one row per deliverable, merging the trio the way the browser
does.** Concretely, when a turn produces any of `lesson_plan`,
`teaching_guide` or `student_notes`:

- write **one** row, typed `lesson_plan`
- `body_md` = the three documents in `DOC_ORDER` order, each under
  `## <label>` (Lesson plan / Teaching guide / Student notes), which is
  exactly what the browser builds in `bodyFor()`
- return that single id on the `artifact_end` of **each** trio document,
  and once in `ids` under `lesson_plan`

Then the browser skips its write for lessons too, and we are done.

**If that is awkward on your side**, the equally good option is: **do
not insert trio documents at all.** Send them without an `id` and let
the browser save the merged row, exactly as it does today. You keep
writing quizzes, homework, decks and activities. Nothing is lost —
`prompt_text`, `model_used` and the token counts would be missing on
lesson rows only, and we can live with that until it is convenient.

Either way, please **do not send a trio `id` the browser is expected to
ignore** — the rule "an `id` means the row exists, its absence means
save it yourself" is a good one and worth keeping unambiguous.

## §4 · Until then

The browser writes the merged lesson row and ignores any `id` on trio
documents. If you are already inserting them, a lesson generated today
leaves your rows orphaned alongside the merged one — visible as extra
cards in Lessons. Your own check query shows it:

```sql
select type, count(*)
  from public.ai_studio
 where batch_id = '<batch_id>'
 group by type;
```

More than one row across `lesson_plan` / `teaching_guide` /
`student_notes` for a single batch is this issue.

---

## §5 · Smaller notes, no action needed

- **`/healthz`** — thank you, that was a real trap. Our
  `/api/keepwarm` now pings `<target>/healthz` and reports `ok` from the
  real status instead of treating a 404 as success. The studio shell
  warms through that same route rather than the `/api/studio/health` path
  it was inventing.
- **Retry suppression** — `quota_exhausted`, `insufficient_credits`,
  `material_not_found`, `material_has_no_file` and `NO_AI_KEY` no longer
  render a Try again button. `rate_limited`, `empty_generation`,
  `upstream_error` and `internal_error` still do.
- **The reading surcharge** — `estimateFor()` now counts only
  attachments that are not yet `ready`, so a chapter read on Monday is
  quoted at zero for the rest of the week. Attachments carry `status`
  from the shelf for this.
- **`pages` null for DOCX and text** — the shelf already renders the
  absence rather than a zero.
- **A revision reusing the same id** — that is what the browser wants:
  a rework goes through PATCH, which cannot duplicate.
