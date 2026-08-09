> **Out of date.** This describes the pre-Supabase schema built by
> `backend/db/init.js`, which has been deleted. The schema is now authored
> in Supabase directly; `backend/db/tune.sql` (`npm run db:tune`) adjusts
> it and `backend/db/seed.js` (`npm run db:seed`) loads reference data.
> Trust the database and those two files over anything below.

# 06 — Database

Four tables in Neon Postgres, created and seeded by `backend/db/init.js`. Idempotent — safe to re-run.

## Reference data — single source of truth

Allowed values for `majors`, `grade_levels`, and `nationality` live in **[`src/lib/enums.js`](../src/lib/enums.js)**. That file is imported by:

- `backend/db/init.js` — to build `CHECK` constraints from the same lists
- studio views — to populate dropdowns and chip multi-selects

To add a value, edit `src/lib/enums.js` and re-run `npm run db:init`. The init script drops and re-adds the relevant `CHECK` constraints, so they always match the JS lists.

The enforced enums today:

- **`MAJORS`** — what a teacher can list under `majors`. Multi-select. 19 entries (English, Arabic, Math, Science, Biology, Physics, Chemistry, History, Geography, Social Studies, Islamic Studies, Art, Music, Drama, Physical Education, Computer Science, Business Studies, Economics, Psychology).
- **`GRADE_LEVELS`** — both `teachers.grade_levels` (multi) and `students.grade` (single). 14 entries from `KG 1` to `Grade 12`.
- **`NATIONALITIES`** — both `teachers.nationality` and `students.nationality`. Single-select. 41 entries — GCC + wider Arab world + South & SE Asia + UK/US/EU + a few more, ending in `Other`.

Bad inserts are rejected at the DB level — Postgres returns a `CHECK` violation error before the row lands.

## Connection

`DATABASE_URL` in `.env`. The same string is consumed by:

- `backend/lib/db.js` — the shared `pg.Pool` used by every `/api/*` route (both standalone Express and the Vite middleware mount)
- `backend/db/init.js` — for schema creation and seeding

Both use the `pg` Pool client.

## Schema

### `templates`

Reusable lesson skeletons.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | TEXT NOT NULL | "Reading comprehension", etc. |
| `subject` | TEXT NOT NULL | One of the subject values below |
| `duration` | INT NOT NULL | Minutes |
| `grade` | TEXT NOT NULL | Free-form: "6", "6–8", "7", "8–10" |
| `flow` | TEXT | Plain-text outline of the lesson stages |
| `tags` | TEXT[] | Free tags. Default `'{}'`. |
| `used_count` | INT | Default 0. Sort key on the templates list. |
| `starred` | BOOLEAN | Default false |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ | Default `NOW()` |

### `drafts`

Work-in-progress lesson plans.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `name` | TEXT NOT NULL | |
| `note` | TEXT | Sub-line shown under the name |
| `warning` | TEXT | Optional (e.g. "missing slides") — drives the gold warning pill |
| `subject` | TEXT NOT NULL | |
| `status` | TEXT NOT NULL | Default `'In progress'` — see status values below |
| `progress` | INT | 0–100. Default 0. |
| `last_edited` | TIMESTAMPTZ | Default `NOW()`. Sort key on the drafts list. |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |

### `teachers`

Teaching staff. The hardcoded "Sara Al-Mansoori" in the studio sidebar will eventually be replaced by a row from this table once auth lands.

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `first_name` | TEXT NOT NULL | |
| `last_name` | TEXT NOT NULL | |
| `email` | TEXT UNIQUE | Login identifier when auth lands |
| `phone` | TEXT | |
| `staff_id` | TEXT UNIQUE | School-issued (e.g. `STF-001`) |
| `majors` | TEXT[] | Subjects taught — must be a subset of `MAJORS`. e.g. `['Science', 'Biology']` |
| `grade_levels` | TEXT[] | Grades taught — must be a subset of `GRADE_LEVELS`. e.g. `['Grade 6', 'Grade 7']` |
| `nationality` | TEXT | Single value, must be in `NATIONALITIES` (or null) |
| `hire_date` | DATE | |
| `bio` | TEXT | Free-form description shown on the teacher profile |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ | Default `NOW()` |

### `students`

Enrolled students with two guardian contact slots (primary + secondary).

| Column | Type | Notes |
|---|---|---|
| `id` | SERIAL PK | |
| `first_name` | TEXT NOT NULL | |
| `last_name` | TEXT NOT NULL | |
| `student_id` | TEXT UNIQUE | School-issued (e.g. `STU-6A-001`) |
| `date_of_birth` | DATE | Used to compute age in the UI |
| `gender` | TEXT | `'Male'`, `'Female'`, or null |
| `grade` | TEXT NOT NULL | Must be in `GRADE_LEVELS` (`'KG 1'` … `'Grade 12'`) |
| `section` | TEXT NOT NULL | `'6A'`, `'6B'`, `'7A'`, `'KG2-A'` — free-form, school-specific |
| `email` | TEXT | Student's own (older grades only) |
| `phone` | TEXT | Student's own (older grades only) |
| `nationality` | TEXT | Single value, must be in `NATIONALITIES` (or null) |
| `address` | TEXT | |
| `primary_guardian_name` | TEXT | |
| `primary_guardian_relationship` | TEXT | `'Mother'`, `'Father'`, `'Guardian'`, etc. |
| `primary_guardian_email` | TEXT | |
| `primary_guardian_phone` | TEXT | |
| `secondary_guardian_name` | TEXT | Optional — covers two-parent households |
| `secondary_guardian_relationship` | TEXT | |
| `secondary_guardian_email` | TEXT | |
| `secondary_guardian_phone` | TEXT | |
| `enrollment_date` | DATE | |
| `notes` | TEXT | Free-form teacher notes |
| `created_at` | TIMESTAMPTZ | Default `NOW()` |
| `updated_at` | TIMESTAMPTZ | Default `NOW()` |

Indexes:
- `students_grade_section_idx` on `(grade, section)` — fastest path for "show me 6A".
- `students_section_idx` on `(section)` — for cross-grade section lookups.

## Domain values

These are not enforced by enums in the DB (just `TEXT`), but the UI treats them as enums.

**Status** (drafts):

- `In progress` — the default. Ink-colored dot.
- `Ready to use` — green/sage dot. Progress should be 100.
- `Blocked` — red/accent dot. Pair with a `warning`.
- `Paused` — muted dot.

**Subject** (templates, drafts):

- `English`
- `Math`
- `Science`
- `Art`
- `History`
- `Geography`

**Grade** (templates, students, teachers.grade_levels):

- `KG 1`, `KG 2`
- `Grade 1` … `Grade 12`
- **Enforced** on `students.grade` and `teachers.grade_levels` via CHECK constraints from [`src/lib/enums.js`](../src/lib/enums.js).
- **Not enforced** on `templates.grade` — that column accepts ranges like `"6"`, `"6–8"`, `"8–10"` describing what a template covers, not a single year.

**Section** (students): free-form, but seed uses the convention `<grade-number><letter>` — `6A`, `6B`, `7A`, `7B`, `8A`, `KG2-A`.

**Guardian relationship** (students): `Mother`, `Father`, `Guardian` (no enforcement; UI accepts free text).

**Majors** (teachers.majors), **Nationality** (teachers + students): see "Reference data" at the top of this doc — values defined in [`src/lib/enums.js`](../src/lib/enums.js) and enforced by `CHECK` constraints.

`SubjectBadge` in `_shared.jsx` is the source of truth for the per-subject color mapping.

## Seed data

8 templates, 7 drafts, 5 teachers, 23 students. Highlights:

- Templates span all six subjects, with `used_count` ranging 7–42; the top two are starred.
- Drafts cover all four statuses; three carry a `warning`. `last_edited` is seeded with a relative interval (e.g. `NOW() - '2 minutes'::interval`) so `timeAgo()` displays a realistic "2m / 1h / 1d" spread.
- Teachers: Sara Al-Mansoori (Science/Biology lead, the hardcoded "current user" today) plus four colleagues spanning Math, English, Arabic/Islamic Studies, and Art/History.
- Students: distributed across **6A, 6B, 7A, 7B, 8A, KG2-A** — matches the section names that appear in the dashboard schedule. UAE-flavored names with realistic guardian contacts; some rows have only a primary guardian, others have both.

Seeding only runs if the table is empty. Re-running `npm run db:init` against a populated DB logs `Teachers already populated (N rows). Skipping seed.`, etc.

## How to wipe and reseed

The init script does **not** auto-truncate. To reseed:

```sql
TRUNCATE templates, drafts, teachers, students RESTART IDENTITY;
```

Then re-run `npm run db:init`.

## Where mutations would go

There are no `INSERT`/`UPDATE`/`DELETE` endpoints today. When wiring forms, the natural shape is:

- `POST /api/templates`, `PATCH /api/templates/:id`, `DELETE /api/templates/:id`
- Same for `/api/drafts`, `/api/teachers`, `/api/students`
- All implemented as additional Vite middleware handlers in `vite.config.js` (and later moved to a real backend — see [API](07-api.md)).
