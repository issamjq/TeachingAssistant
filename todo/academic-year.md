# The academic year — what shipped, and what the app still needs

> **Applied to Supabase 2026-09-02** via `npm run db:tune`
> (`db/tune.sql` §102). This file is the app-side half, which is *not*
> done. The database is ready for it and nothing in the product reads
> the column yet except `/preview`.

## What is now in the database

`public.classes` already carried `academic_year` and `is_archived` — the
console created them and nothing ever used them. Five rows existed; two
had a year written with an en dash, three had none. §102 made that
column load-bearing:

| Object | What it is |
|---|---|
| `academic_year_of(timestamptz)` | The year containing a moment. **September starts the year** — change this one function for a school on a different calendar, and nothing else. |
| `current_academic_year()` | `academic_year_of(now())`. The browser must never compute this. |
| `academic_year text` | Added to `students`, `goals`, `schedule_entries`, `ai_studio`. Defaulted to `current_academic_year()`, backfilled from each row's `created_at`. |
| `copied_from uuid` | On `ai_studio` and `goals` — where a carried-over copy came from. |
| `roll_class_year(...)` | The rollover. SECURITY DEFINER, ownership-checked, idempotent. |
| Five indexes | `(owner, academic_year, …)` on each of the four tables plus `classes`. |

**`materials` deliberately has no year.** A syllabus is not re-uploaded
every August. The shelf is keyed on `(grade, subject)`, which is already
year-independent, and §101 holds one row per stored file — copying a row
would collide with that index for no gain.

**Format is `2026-2027`.** A plain hyphen, because this value ends up in
a URL. The two en-dash rows were normalised; that was the only existing
data rewritten.

### What the backfill produced

Rows were stamped from `created_at`, not from today — work written last
November belongs to last November's year, and stamping it with the
current one would drag a finished term into this one.

```
ai_studio          2025-2026 · 114    2026-2027 ·  6
schedule_entries   2025-2026 ·  72    2026-2027 · 83
students           2025-2026 ·  32    2026-2027 · 26
goals              2025-2026 ·  15    2026-2027 ·  1
classes                               2026-2027 ·  5
```

### `roll_class_year(p_class, p_year, p_carry, p_goals, p_archive)`

Copies the named `ai_studio` rows and (optionally) every goal into the
new year, creates or finds the `classes` row for it, and archives the old
one. Returns `{class_id, academic_year, carried_work, carried_goals,
archived, left_behind}`.

It never touches **students, attendance, marks, submissions or the
timetable** — those belong to the people who left, and `left_behind` says
so in the response rather than leaving a caller to assume it.

Idempotent twice over: rolling into a year that already has the class
lands on it, and a row already carrying `copied_from` pointing at the
source is not copied again.

## What the app still needs (Node / Next)

None of this is started. In rough order of how much it matters.

1. **Reads have no year filter.** `listSchedule`, `listStudents`,
   `listGoals` and the `ai_studio` list in `src/lib/data/artifacts.ts`
   return every year at once. That is why the demo account shows
   2025-2026 material under a 2026-2027 class. Each needs an optional
   `academic_year` parameter, and the screens need a year to pass.
   *Until this lands, "this year" means nothing in the UI.*

2. **No write path for `roll_class_year`.** Add
   `POST /api/classes/:id/roll` to `src/lib/data/index.ts` calling the
   RPC, and wire `/preview`'s **Start a new year** button to it. The
   preview prints the exact call it would make; it is one line.

3. **No write path for `classes` at all.** `GET /api/classes` and
   `GET /api/classes/current-year` were added for the preview. Creating a
   class — subject, grade, division, year — still has no endpoint, so
   "Add a class" in the preview links to `/database` and a teacher whose
   work predates the table has no `classes` row for it. RLS policies for
   insert/update/delete already exist on the table.

4. **Archived classes are not filtered anywhere.** `is_archived` is
   readable and ignored. Every class listing should default to
   `is_archived = false` with an explicit way to see past years.

5. **The studio's `ClassPicker` derives classes from the roster**
   (`distinctClasses(roster)` in `src/shared/lib/classMatch.ts`). Once
   `classes` is authoritative it should read that table instead — a class
   with no students yet is still a class, and today it is invisible to
   the picker.

6. **Nothing stamps a year on insert from the app.** Nothing needs to:
   the column default does it. But do not start sending
   `academic_year: null` explicitly from a form, which would defeat it.

## Unrelated, but `db:tune` reports it every run

```
materials: 15 duplicated file_path(s) still present — index not created.
```

§101's uniqueness guard cannot be applied while the duplicates from
18–21 August are still there. `tune.sql` prints the exact `UPDATE` that
resolves it, keeping the earliest row of each pair, and deliberately does
not run it — removing rows is a decision about a teacher's own shelf.
