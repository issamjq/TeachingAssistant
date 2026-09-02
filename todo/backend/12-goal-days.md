# 12 · Phase 2 — a plan the service can place

> **Status (2026-09-02): 🟡 ENHANCEMENT, not a blocker.** The frontend
> half shipped today and **works without any service change**: the
> browser materialises a plan's days from the jsonb you already return,
> dates them, and writes the timetable. What you can add is better dates
> and real outcomes — and, later, drafting a day in place.
>
> Please read [11 · The lesson trio](11-lesson-row-shape.md) first; that
> one is still open and this phase makes it more visible, because placing
> a term means drafting a lot of lessons.

---

## §1 · What changed on our side

`goals` gained five columns and there is a new table (`db/tune.sql`
§97, applied):

```
goals.grade  goals.subject  goals.section  goals.start_date  goals.periods_per_week

goal_days(
  id, goal_id, faculty_id, week, day_index, date,
  title, outline, outcomes text[],
  schedule_entry_id → schedule_entries,   -- where it landed
  draft_id          → ai_studio,          -- what was written for it
  status  planned|scheduled|drafted|taught|skipped
)
```

`goal_days` has the standard four owner policies and a unique index on
`(goal_id, week, day_index)` — **writes are upserts on that key**, so
re-materialising a plan corrects the rows rather than orphaning the
slots and drafts already attached to them. Keep that property if you
start writing these.

**Why a table and not more jsonb.** A day now has to remember two
things: the timetable slot it was given and the lesson drafted for it.
Neither can be a position in an array. The narrative — a week's focus,
its assessment, the risks — stays in `goals.plan`, which is prose about
a week and belongs there.

## §2 · What the browser does today

`src/features/goals/placePlan.ts`, which is pure and unit-tested:

1. Flattens `plan.weeks[].days[]` (and the older `lessons[]` shape) into
   teaching order.
2. Walks forward from `start_date`, handing out the weekdays she picked
   and wrapping into the next calendar week when the pattern runs out.
3. Upserts `goal_days`, then creates one `schedule_entries` row per
   dated day and writes `schedule_entry_id` back.

Deliberately **not** using the plan's own week numbers as an offset: a
plan that calls its first week "week 3" would otherwise start a
fortnight late, and her start date is the more trustworthy statement.

## §3 · What we would like from `POST /api/studio/goal-plan`

**Accept the class and the calendar:**

```json
{ "goal_id": "<uuid>",
  "class": { "grade": "Grade 7", "subject": "Science", "section": "B" },
  "start_date": "2026-09-06",
  "periods_per_week": 2,
  "material_ids": ["<uuid>"] }
```

Today it receives only `{ goal_id }` and infers everything from prose,
which is why the timeline is parsed out of a sentence.

**Write `goal_days` yourself**, one row per teaching day, with:

- a real `date`, computed from `start_date` and the period pattern;
- **`outcomes[]` per day** — this is the part the browser genuinely
  cannot produce. It has the day's title and outline and nothing else.
  Specific, checkable outcomes are what make the drafted lesson good and
  what Phase 3's weak-spot signal will key on.

Keep writing the plan to the goal row before replying — the proxy still
cuts at ~30s and the frontend still polls afterwards.

**Response:** `{ goal, days: [...], unread_materials?: [] }`.

### Prompt guidance

Each day must be independently draftable: a title a teacher would
recognise on a timetable, an outline, and the specific outcomes that day
covers. Ground it in the attached materials when there are any. Where
pacing is uncertain, prefer fewer, fuller days over more, thinner ones —
a teacher can always split one, and a plan padded to fill a term reads
as filler immediately.

## §4 · Later: `POST /api/studio/goal-materialise`

Not needed yet. "Draft this" on a day currently parks the day's brief
and opens the Studio, which works and costs you nothing.

What it would improve: drafting in place, without leaving the plan. If
you build it, take `{ goal_day_id, kinds[], skill_ids? }`, reuse the
generation pipeline exactly, stamp the goal's audience and a `batch_id`,
persist before the stream ends, and set `goal_days.draft_id`. Same frame
protocol as `/api/studio/generate`.

The one thing worth doing early, whenever a day is drafted: **set
`goal_days.draft_id`**. It is what lets the plan show "Drafted" against
a day instead of offering to write it a second time.

## §5 · Not asked for

- **Don't move the narrative into `goal_days`.** Week focus, assessment
  and risks are prose about a week; splitting them across day rows would
  lose the thing the drawer renders.
- **Don't add a recurrence rule.** Schedule entries are expanded to
  ordinary dated rows on purpose (`shared/lib/repeatWeekly.ts`), so
  delivery, attendance and both calendars only ever see one shape.

---

## Definition of done

- A teacher describes a unit, picks 7B and a start date, and gets a
  fourteen-week plan whose days carry real dates and real outcomes.
- Pressing "Put N lessons on my timetable" fills her week, and each day
  remembers its slot.
- Drafting a day marks it drafted, and the plan stops offering to write
  it again.
