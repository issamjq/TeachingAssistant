import "dotenv/config";
import pg from "pg";
import { GRADE_LEVELS, NATIONALITIES } from "../../src/lib/enums.js";
import { UAE_SCHOOLS, EMIRATES, SCHOOL_TYPES, SCHOOL_CURRICULA } from "../../src/lib/schools.js";
import { ROLES, SUB_ROLES, resolveReservedRole } from "../lib/roles.js";

// Build a SQL fragment that validates the (role, sub_role) tuple.
// Roles with no sub-roles must have sub_role IS NULL. Roles with
// sub-roles allow NULL (no sub-role assigned yet) or one of the
// permitted values.
const subRoleCheckSql = () => {
  const clauses = [];
  for (const [role, subs] of Object.entries(SUB_ROLES)) {
    if (subs.length === 0) {
      clauses.push(`(role = '${role}' AND sub_role IS NULL)`);
    } else {
      const list = subs.map((s) => `'${s}'`).join(", ");
      clauses.push(`(role = '${role}' AND (sub_role IS NULL OR sub_role IN (${list})))`);
    }
  }
  return clauses.join("\n    OR ");
};

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Build a Postgres ARRAY[...]::text[] literal from a JS list, escaping single quotes.
const sqlArr = (vals) =>
  `ARRAY[${vals.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")}]::text[]`;

// =============================================================================
// MIGRATION — rename legacy `teachers` table to `accounts`.
// The table holds every account (teacher, admin, dev, super_admin, moe,
// owner) — `teachers` was a misleading name from when only teachers
// signed in. This block:
//
//   1. Renames the table itself if it's still named `teachers`
//   2. Renames every FK column `teacher_id` → `account_id` (auto-discovered
//      from information_schema so we don't have to enumerate every table)
//   3. Renames the matching constraints/indexes for hygiene
//
// Idempotent — safe to run on a fresh DB (everything is no-op) or on a
// legacy DB (one-time rename). MUST run BEFORE every other DDL block in
// this file so the rest of the schema can reference `accounts` directly.
// =============================================================================
const SCHEMA_RENAME_TEACHERS_TO_ACCOUNTS = `
DO $$
DECLARE
  rec RECORD;
  teachers_count INT;
  accounts_count INT;
BEGIN
  -- 1. Table rename. Three states we recover from:
  --   a) only teachers exists                 - rename to accounts
  --   b) only accounts exists                 - no-op (already migrated)
  --   c) both exist (half-applied migration)  - if accounts is empty,
  --      drop it then rename teachers; if teachers is empty, drop it;
  --      if both have rows, RAISE - manual cleanup needed.
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teachers')
     AND EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounts') THEN
    EXECUTE 'SELECT COUNT(*) FROM teachers' INTO teachers_count;
    EXECUTE 'SELECT COUNT(*) FROM accounts' INTO accounts_count;
    IF accounts_count = 0 THEN
      DROP TABLE accounts CASCADE;
      ALTER TABLE teachers RENAME TO accounts;
    ELSIF teachers_count = 0 THEN
      DROP TABLE teachers CASCADE;
    ELSE
      RAISE EXCEPTION 'Both teachers (%) and accounts (%) have data — manual cleanup required',
        teachers_count, accounts_count;
    END IF;
  ELSIF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'teachers')
        AND NOT EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'accounts') THEN
    ALTER TABLE teachers RENAME TO accounts;
  END IF;

  -- 2. FK column renames. Scans every table for a column named teacher_id
  -- and renames it to account_id. If a table has BOTH columns (also from
  -- a half-applied migration), the empty account_id is dropped first.
  FOR rec IN
    SELECT table_name FROM information_schema.columns
    WHERE table_schema = 'public' AND column_name = 'teacher_id'
  LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = rec.table_name AND column_name = 'account_id'
    ) THEN
      EXECUTE format('ALTER TABLE %I DROP COLUMN account_id', rec.table_name);
    END IF;
    EXECUTE format('ALTER TABLE %I RENAME COLUMN teacher_id TO account_id', rec.table_name);
  END LOOP;

  -- 3. Rename teachers_* constraints to accounts_* (cosmetic).
  FOR rec IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.accounts'::regclass
      AND conname LIKE 'teachers\\_%' ESCAPE '\\'
  LOOP
    EXECUTE format(
      'ALTER TABLE accounts RENAME CONSTRAINT %I TO %I',
      rec.conname,
      'accounts_' || substring(rec.conname FROM 10)
    );
  END LOOP;

  -- 4. Rename teachers_* indexes to accounts_* (also cosmetic).
  FOR rec IN
    SELECT indexname FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'accounts'
      AND indexname LIKE 'teachers\\_%' ESCAPE '\\'
  LOOP
    EXECUTE format(
      'ALTER INDEX %I RENAME TO %I',
      rec.indexname,
      'accounts_' || substring(rec.indexname FROM 10)
    );
  END LOOP;
END $$;
`;

// =============================================================================
// SCHEMA — base tables (kept compatible with the original schema)
// =============================================================================
const SCHEMA_BASE = `
CREATE TABLE IF NOT EXISTS accounts (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  email TEXT UNIQUE,
  phone TEXT,
  staff_id TEXT UNIQUE,
  majors TEXT[] DEFAULT '{}',
  grade_levels TEXT[] DEFAULT '{}',
  languages TEXT[] DEFAULT '{}',
  sections TEXT[] DEFAULT '{}',
  nationality TEXT,
  hire_date DATE,
  bio TEXT,
  role TEXT NOT NULL DEFAULT 'teacher',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS templates (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  subject TEXT NOT NULL,
  duration INT NOT NULL,
  grade TEXT NOT NULL,
  flow TEXT,
  tags TEXT[] DEFAULT '{}',
  used_count INT DEFAULT 0,
  starred BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS drafts (
  id SERIAL PRIMARY KEY,
  name TEXT NOT NULL,
  note TEXT,
  warning TEXT,
  subject TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'In progress',
  progress INT DEFAULT 0,
  last_edited TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS students (
  id SERIAL PRIMARY KEY,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  student_id TEXT UNIQUE,
  date_of_birth DATE,
  gender TEXT,
  grade TEXT NOT NULL,
  section TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  nationality TEXT,
  address TEXT,
  primary_guardian_name TEXT,
  primary_guardian_relationship TEXT,
  primary_guardian_email TEXT,
  primary_guardian_phone TEXT,
  secondary_guardian_name TEXT,
  secondary_guardian_relationship TEXT,
  secondary_guardian_email TEXT,
  secondary_guardian_phone TEXT,
  enrollment_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS students_grade_section_idx ON students (grade, section);
CREATE INDEX IF NOT EXISTS students_section_idx ON students (section);
`;

// =============================================================================
// SCHEMA — multi-tenancy: every owned row gets teacher_id.
// Postgres 9.6+ supports ADD COLUMN IF NOT EXISTS, so this is idempotent.
// We backfill nulls in BACKFILL below before applying NOT NULL.
// =============================================================================
const SCHEMA_MULTITENANT = `
ALTER TABLE templates ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE drafts    ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE;
ALTER TABLE students  ADD COLUMN IF NOT EXISTS account_id INT REFERENCES accounts(id) ON DELETE CASCADE;

ALTER TABLE accounts  ADD COLUMN IF NOT EXISTS role      TEXT NOT NULL DEFAULT 'teacher';
ALTER TABLE accounts  ADD COLUMN IF NOT EXISTS sub_role  TEXT;
ALTER TABLE accounts  ADD COLUMN IF NOT EXISTS status    TEXT NOT NULL DEFAULT 'active';
ALTER TABLE accounts  ADD COLUMN IF NOT EXISTS languages TEXT[] DEFAULT '{}';
ALTER TABLE accounts  ADD COLUMN IF NOT EXISTS sections  TEXT[] DEFAULT '{}';

ALTER TABLE quizzes   ADD COLUMN IF NOT EXISTS language   TEXT;
ALTER TABLE quizzes   ADD COLUMN IF NOT EXISTS difficulty TEXT;
`;

// =============================================================================
// SCHEMA — drafts as full lesson-plan rows + templates as rich starting points.
// =============================================================================
const SCHEMA_LESSON_FIELDS = `
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS planned_date     DATE;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS grade            TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS section          TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS duration_minutes INT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS objectives       JSONB DEFAULT '[]'::jsonb;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS materials        JSONB DEFAULT '[]'::jsonb;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS intro            TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS main_activity    TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS conclusion       TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS assessment_method TEXT;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS attachments      JSONB DEFAULT '[]'::jsonb;
ALTER TABLE drafts ADD COLUMN IF NOT EXISTS tags             TEXT[] DEFAULT '{}';

-- Templates carry a rich enough payload that "Use template" can clone the
-- full lesson plan, not just the title.
ALTER TABLE templates ADD COLUMN IF NOT EXISTS objectives JSONB DEFAULT '[]'::jsonb;
ALTER TABLE templates ADD COLUMN IF NOT EXISTS stages     JSONB DEFAULT '[]'::jsonb;
`;

// Schedule entries: start_time / end_time used to be required; we now
// allow undated drop-ins where the teacher hasn't committed a slot
// yet, so both columns are nullable. Runs AFTER SCHEMA_NEW so the
// table exists. Idempotent — safe to re-run.
const SCHEMA_SCHEDULE_TIMES_NULLABLE = `
ALTER TABLE schedule_entries ALTER COLUMN start_time DROP NOT NULL;
ALTER TABLE schedule_entries ALTER COLUMN end_time   DROP NOT NULL;
`;

// Presentations and Activities didn't carry a scheduled date originally;
// the calendar rail wants one so every teaching surface can pin a slot
// the same way quizzes (scheduled_for) and homework (due_date) already do.
// Presentations also needed a `section` column for the teacher's
// section dropdown.
const SCHEMA_PRES_ACT_SCHEDULED = `
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS scheduled_for DATE;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS section TEXT;
ALTER TABLE activities    ADD COLUMN IF NOT EXISTS scheduled_for DATE;
`;

// Teaching profile gets a hierarchical class_map — array of
//   { major, grades: [], sections: [] }
// so a teacher can express "Math for Grades 6 and 8, sections A & B"
// instead of three flat lists that don't connect. Old flat columns
// (majors / grade_levels / sections) stay populated as a denormalised
// union so existing dropdowns keep working.
//
// grade_sections is the per-grade section breakdown:
//   { "Grade 3": ["Section A", "Section B"], "Grade 4": ["Section C"] }
// Captured in the onboarding form so the teacher can say "I teach
// Grade 3 in sections A and B but Grade 4 in section C". The flat
// teachers.sections column stays populated as the union of all
// values, so legacy dropdowns keep working.
const SCHEMA_CLASS_MAP = `
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS class_map      JSONB DEFAULT '[]'::jsonb;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS grade_sections JSONB DEFAULT '{}'::jsonb;

-- Lock the JSONB columns to their expected shape. Without these,
-- the validation layer becomes the only line between a malformed
-- payload and a corrupted DB. With them, even direct SQL access
-- can't break the invariant.
UPDATE accounts SET grade_sections = '{}'::jsonb WHERE grade_sections IS NULL;
ALTER TABLE accounts ALTER COLUMN grade_sections SET NOT NULL;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_grade_sections_object;
ALTER TABLE accounts ADD  CONSTRAINT accounts_grade_sections_object
  CHECK (jsonb_typeof(grade_sections) = 'object');

UPDATE accounts SET class_map = '[]'::jsonb WHERE class_map IS NULL;
ALTER TABLE accounts ALTER COLUMN class_map SET NOT NULL;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_class_map_array;
ALTER TABLE accounts ADD  CONSTRAINT accounts_class_map_array
  CHECK (jsonb_typeof(class_map) = 'array');
`;

// Soft-delete columns. Every teaching-surface table gets deleted_at so
// the trash / recovery UI can list and restore items, and the backend
// can auto-purge anything older than 30 days. Idempotent.
const SCHEMA_SOFT_DELETE = `
ALTER TABLE quizzes       ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE homework      ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE presentations ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE activities    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE drafts        ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE templates     ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS quizzes_deleted_at_idx       ON quizzes (deleted_at);
CREATE INDEX IF NOT EXISTS homework_deleted_at_idx      ON homework (deleted_at);
CREATE INDEX IF NOT EXISTS presentations_deleted_at_idx ON presentations (deleted_at);
CREATE INDEX IF NOT EXISTS activities_deleted_at_idx    ON activities (deleted_at);
CREATE INDEX IF NOT EXISTS drafts_deleted_at_idx        ON drafts (deleted_at);
CREATE INDEX IF NOT EXISTS templates_deleted_at_idx     ON templates (deleted_at);
`;

// Append-only audit log. Every sensitive action (sign-in, sign-up,
// renew, plan change, role change, school removal, account suspension)
// inserts a row here. Reads are admin-only via /api/admin/audit (TODO
// — surface a viewer later). Schema kept narrow on purpose: don't
// store PII (names, emails) — link by ids and let a forensic query
// join back to the source rows.
//
// Retention: not auto-pruned. Audit logs are evidence; deletion is a
// conscious operations decision.
const SCHEMA_AUDIT = `
CREATE TABLE IF NOT EXISTS audit_log (
  id           BIGSERIAL PRIMARY KEY,
  account_id   INT REFERENCES accounts(id) ON DELETE SET NULL,
  action       TEXT NOT NULL,
  target_table TEXT,
  target_id    BIGINT,
  ip           TEXT,
  user_agent   TEXT,
  detail       JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS audit_log_account_idx  ON audit_log (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_action_idx   ON audit_log (action, created_at DESC);
CREATE INDEX IF NOT EXISTS audit_log_target_idx   ON audit_log (target_table, target_id);
CREATE INDEX IF NOT EXISTS audit_log_ip_idx       ON audit_log (ip, created_at DESC);
-- Hard guard against forgotten action strings — every audit row must
-- carry one. Action vocab is documented in backend/lib/audit.js.
ALTER TABLE audit_log DROP CONSTRAINT IF EXISTS audit_action_nonempty;
ALTER TABLE audit_log ADD  CONSTRAINT audit_action_nonempty
  CHECK (action <> '');
`;

// Auth-related indexes that improve middleware lookups under load.
// firebase_uid lookups are the hot path (every authed request goes
// through one); email lookups feed the ON CONFLICT upsert in
// /api/auth/firebase.
const SCHEMA_AUTH_INDEXES = `
CREATE INDEX IF NOT EXISTS accounts_email_idx ON accounts (email);
CREATE INDEX IF NOT EXISTS accounts_subscription_idx
  ON accounts (subscription_status, subscription_ends_at);
CREATE INDEX IF NOT EXISTS accounts_last_login_idx
  ON accounts (last_login_at DESC NULLS LAST);
`;

// Firebase Auth wiring: teachers get a stable firebase_uid (the Google/
// Firebase user id), three light-weight login-audit fields used to spot
// suspicious activity ("who logged in from where, when") and two
// subscription fields so we can gate access without standing up Stripe
// just yet. Idempotent.
const SCHEMA_AUTH = `
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS firebase_uid TEXT;
CREATE UNIQUE INDEX IF NOT EXISTS accounts_firebase_uid_uniq
  ON accounts (firebase_uid) WHERE firebase_uid IS NOT NULL;

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_login_at  TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_login_ip  TEXT;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS last_user_agent TEXT;

-- subscription_status: trial (default — 14 days from sign-up) / active /
-- expired / suspended. A nullable subscription_ends_at lets a manual
-- admin extension be open-ended.
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_status TEXT NOT NULL DEFAULT 'trial';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_ends_at TIMESTAMPTZ;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS subscription_plan TEXT;
`;

// Schools: a catalog of UAE schools + a many-to-many link from teachers
// to the schools they work at. Students point at a single school so a
// teacher who works in two schools can keep their rosters apart.
//
// schools          — UAE catalog. Read-only for teachers (seeded from
//                    src/lib/schools.js). Admin can extend later.
// teacher_schools  — join table. `is_primary` flags the default school
//                    used as the auto-pick when adding a student.
// students.school_id — nullable, references schools(id) ON DELETE SET NULL.
//                      Nullable so existing seed students don't break
//                      until a teacher assigns them.
// Idempotent.
const SCHEMA_SCHOOLS = `
CREATE TABLE IF NOT EXISTS schools (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  name_ar     TEXT,
  emirate     TEXT NOT NULL,
  city        TEXT,
  type        TEXT,
  curriculum  TEXT,
  website     TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS schools_emirate_idx ON schools (emirate);
-- Dedupe key so re-running the seed is idempotent.
CREATE UNIQUE INDEX IF NOT EXISTS schools_name_emirate_uniq ON schools (name, emirate);

CREATE TABLE IF NOT EXISTS teacher_schools (
  account_id  INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  school_id   INT NOT NULL REFERENCES schools(id)  ON DELETE CASCADE,
  is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (account_id, school_id)
);
CREATE INDEX IF NOT EXISTS teacher_schools_account_idx ON teacher_schools (account_id);

-- Per-school grade_sections: each (teacher, school) pair carries its
-- own {grade -> [sections]} map so a teacher who works in two schools
-- can keep their rosters cleanly separated (Grade 3 sections A/B at
-- one school, Grade 6 sections C/D at the other).
-- jsonb_typeof check rejects array / number / bool — only objects are
-- valid shapes for this column.
ALTER TABLE teacher_schools ADD COLUMN IF NOT EXISTS grade_sections JSONB NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE teacher_schools DROP CONSTRAINT IF EXISTS teacher_schools_gs_object;
ALTER TABLE teacher_schools ADD  CONSTRAINT teacher_schools_gs_object
  CHECK (jsonb_typeof(grade_sections) = 'object');

ALTER TABLE students ADD COLUMN IF NOT EXISTS school_id INT REFERENCES schools(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS students_school_idx ON students (school_id);
`;

// Teacher-uploaded images for the slide builder. Stored as base64 text
// (no data: prefix) + mime so it survives Render's ephemeral filesystem
// without an external object store. Served by GET /api/images/:id.
// Idempotent.
const SCHEMA_IMAGES = `
CREATE TABLE IF NOT EXISTS uploaded_images (
  id          SERIAL PRIMARY KEY,
  account_id  INT REFERENCES accounts(id) ON DELETE CASCADE,
  mime        TEXT NOT NULL,
  data        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS uploaded_images_account_idx ON uploaded_images (account_id);
`;

// =============================================================================
// SCHEMA — new tables
// =============================================================================
const SCHEMA_NEW = `
CREATE TABLE IF NOT EXISTS schedule_entries (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  draft_id INT REFERENCES drafts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  section TEXT,
  date DATE NOT NULL,
  start_time TIME,
  end_time TIME,
  location TEXT,
  notes TEXT,
  status TEXT NOT NULL DEFAULT 'planned',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS schedule_entries_teacher_date_idx
  ON schedule_entries (account_id, date);

CREATE TABLE IF NOT EXISTS quizzes (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  section TEXT,
  language TEXT,
  difficulty TEXT,
  duration_minutes INT,
  total_marks INT,
  status TEXT NOT NULL DEFAULT 'Draft',
  scheduled_for DATE,
  instructions TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS quizzes_teacher_idx ON quizzes (account_id);

CREATE TABLE IF NOT EXISTS quiz_questions (
  id SERIAL PRIMARY KEY,
  quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  position INT NOT NULL,
  type TEXT NOT NULL,
  prompt TEXT NOT NULL,
  choices JSONB,
  correct_answer JSONB,
  marks INT NOT NULL DEFAULT 1
);
CREATE INDEX IF NOT EXISTS quiz_questions_quiz_idx ON quiz_questions (quiz_id, position);

CREATE TABLE IF NOT EXISTS quiz_scores (
  id SERIAL PRIMARY KEY,
  quiz_id INT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  score NUMERIC,
  max_score INT,
  feedback TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (quiz_id, student_id)
);

CREATE TABLE IF NOT EXISTS homework (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  section TEXT,
  instructions TEXT,
  due_date DATE,
  status TEXT NOT NULL DEFAULT 'Open',
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS homework_teacher_due_idx ON homework (account_id, due_date);

CREATE TABLE IF NOT EXISTS homework_submissions (
  id SERIAL PRIMARY KEY,
  homework_id INT NOT NULL REFERENCES homework(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending',
  submitted_at TIMESTAMPTZ,
  score NUMERIC,
  max_score INT,
  feedback TEXT,
  UNIQUE (homework_id, student_id)
);

CREATE TABLE IF NOT EXISTS attendance (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  status TEXT NOT NULL,
  notes TEXT,
  UNIQUE (student_id, date)
);
CREATE INDEX IF NOT EXISTS attendance_teacher_date_idx ON attendance (account_id, date);

CREATE TABLE IF NOT EXISTS student_grades (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  subject TEXT NOT NULL,
  term TEXT,
  category TEXT,
  score NUMERIC NOT NULL,
  max_score INT NOT NULL DEFAULT 100,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  notes TEXT
);
CREATE INDEX IF NOT EXISTS student_grades_teacher_idx ON student_grades (account_id, student_id);

CREATE TABLE IF NOT EXISTS presentations (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  draft_id INT REFERENCES drafts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  subject TEXT,
  grade TEXT,
  slides JSONB DEFAULT '[]'::jsonb,
  status TEXT NOT NULL DEFAULT 'Draft',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS presentations_teacher_idx ON presentations (account_id);

CREATE TABLE IF NOT EXISTS activities (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  draft_id INT REFERENCES drafts(id) ON DELETE SET NULL,
  title TEXT NOT NULL,
  type TEXT,
  subject TEXT,
  grade TEXT,
  duration_minutes INT,
  instructions TEXT,
  materials JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS activities_teacher_idx ON activities (account_id);

CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  kind TEXT NOT NULL,
  message TEXT NOT NULL,
  link TEXT,
  is_read BOOLEAN NOT NULL DEFAULT FALSE,
  ref_table TEXT,
  ref_id INT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ref_table TEXT;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS ref_id INT;
-- Dedup key for /api/notifications/refresh: one row per (teacher, kind, target).
-- Postgres treats NULLs as distinct, so legacy rows without a ref aren't
-- collapsed.
DROP INDEX IF EXISTS notifications_dedup_idx;
CREATE UNIQUE INDEX notifications_dedup_idx
  ON notifications (account_id, kind, ref_table, ref_id)
  WHERE ref_table IS NOT NULL AND ref_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS notifications_teacher_unread_idx
  ON notifications (account_id, is_read, created_at DESC);

CREATE TABLE IF NOT EXISTS activity_completions (
  id SERIAL PRIMARY KEY,
  activity_id INT NOT NULL REFERENCES activities(id) ON DELETE CASCADE,
  student_id INT NOT NULL REFERENCES students(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'Pending',
  notes TEXT,
  recorded_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (activity_id, student_id)
);

CREATE TABLE IF NOT EXISTS library_resources (
  id SERIAL PRIMARY KEY,
  account_id INT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  type TEXT,
  subject TEXT,
  grade TEXT,
  url TEXT,
  notes TEXT,
  tags TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS library_resources_teacher_idx ON library_resources (account_id);

CREATE TABLE IF NOT EXISTS feature_flags (
  key TEXT PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT FALSE,
  description TEXT,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);
`;

// =============================================================================
// CHECK constraints — refresh from JS enums.
// =============================================================================
const NORMALIZE = `
UPDATE accounts SET nationality = 'Saudi Arabia' WHERE nationality = 'Saudi';
UPDATE students SET nationality = 'Saudi Arabia' WHERE nationality = 'Saudi';
`;

const CONSTRAINTS = `
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS teachers_majors_valid;
ALTER TABLE accounts DROP CONSTRAINT IF EXISTS teachers_grade_levels_valid;

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_nationality_valid;
ALTER TABLE accounts ADD  CONSTRAINT accounts_nationality_valid
  CHECK (nationality IS NULL OR nationality = ANY(${sqlArr(NATIONALITIES)}));

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_role_valid;
ALTER TABLE accounts ADD  CONSTRAINT accounts_role_valid
  CHECK (role = ANY(${sqlArr(ROLES)}));

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_sub_role_valid;
ALTER TABLE accounts ADD  CONSTRAINT accounts_sub_role_valid
  CHECK (
    ${subRoleCheckSql()}
  );

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_status_valid;
ALTER TABLE accounts ADD  CONSTRAINT accounts_status_valid
  CHECK (status IN ('active', 'suspended', 'deleted'));

ALTER TABLE accounts DROP CONSTRAINT IF EXISTS accounts_sub_status_valid;
ALTER TABLE accounts ADD  CONSTRAINT accounts_sub_status_valid
  CHECK (subscription_status IN ('trial', 'active', 'expired', 'suspended'));

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_grade_valid;
ALTER TABLE students ADD  CONSTRAINT students_grade_valid
  CHECK (grade = ANY(${sqlArr(GRADE_LEVELS)}));

ALTER TABLE students DROP CONSTRAINT IF EXISTS students_nationality_valid;
ALTER TABLE students ADD  CONSTRAINT students_nationality_valid
  CHECK (nationality IS NULL OR nationality = ANY(${sqlArr(NATIONALITIES)}));

ALTER TABLE attendance DROP CONSTRAINT IF EXISTS attendance_status_valid;
ALTER TABLE attendance ADD  CONSTRAINT attendance_status_valid
  CHECK (status IN ('Present', 'Absent', 'Late', 'Excused'));

ALTER TABLE quiz_questions DROP CONSTRAINT IF EXISTS quiz_questions_type_valid;
ALTER TABLE quiz_questions ADD  CONSTRAINT quiz_questions_type_valid
  CHECK (type IN ('mcq', 'tf', 'short', 'essay'));

ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_emirate_valid;
ALTER TABLE schools ADD  CONSTRAINT schools_emirate_valid
  CHECK (emirate = ANY(${sqlArr(EMIRATES)}));

ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_type_valid;
ALTER TABLE schools ADD  CONSTRAINT schools_type_valid
  CHECK (type IS NULL OR type = ANY(${sqlArr(SCHOOL_TYPES)}));

ALTER TABLE schools DROP CONSTRAINT IF EXISTS schools_curriculum_valid;
ALTER TABLE schools ADD  CONSTRAINT schools_curriculum_valid
  CHECK (curriculum IS NULL OR curriculum = ANY(${sqlArr(SCHOOL_CURRICULA)}));
`;

// =============================================================================
// SEEDS
// =============================================================================
const TEMPLATES = [
  ["Reading comprehension", "English", 45, "6–8", "Warm-up → guided reading → 5 questions → exit ticket.", ["Comprehension", "Quiz attached"], 42, true],
  ["Problem-solving session", "Math", 60, "7", "Concept recap → worked example → pair practice → reflection.", ["Problem solving", "Pair work"], 38, true],
  ["Lab experiment", "Science", 90, "8", "Hypothesis → procedure → observation → conclusion writeup.", ["Hands-on", "Worksheet"], 27, false],
  ["Creative writing workshop", "Art", 45, "6–9", "Prompt → free write → peer share → revise → publish.", ["Group work", "Activity"], 19, false],
  ["Source analysis", "History", 50, "8–10", "Read source → identify bias → compare → discuss.", ["Critical thinking", "Discussion"], 14, false],
  ["Map reading basics", "Geography", 45, "6", "Intro → key & legend → guided exercise → quiz.", ["Foundations", "Quiz attached"], 11, false],
  ["Vocabulary review", "English", 30, "7", "Recap list → games → mini test → flashcards.", ["Review", "Games"], 9, false],
  ["Geometry intro", "Math", 60, "6", "Shapes → angles → guided practice → exit ticket.", ["Foundations", "Worksheet"], 7, false],
];

// [first_name, last_name, email, phone, staff_id, majors, grade_levels, nationality, hire_date, bio, role]
const TEACHERS = [
  ["Sara", "Al-Mansoori", "sara.almansoori@murchid.school", "+971 50 123 4567", "STF-001", ["Science", "Biology"], ["Grade 6", "Grade 7", "Grade 8", "Grade 9"], "UAE", "2019-08-15", "Lead science teacher for the middle school. Passionate about hands-on labs and inquiry-based learning.", "teacher"],
  ["Ahmed", "Khalifa", "ahmed.khalifa@murchid.school", "+971 50 234 5678", "STF-002", ["Math", "Physics"], ["Grade 9", "Grade 10", "Grade 11", "Grade 12"], "UAE", "2017-09-01", "Senior maths teacher and IB DP coordinator.", "teacher"],
  ["Layla", "Hassan", "layla.hassan@murchid.school", "+971 55 345 6789", "STF-003", ["English", "Drama"], ["Grade 6", "Grade 7", "Grade 8"], "Lebanon", "2021-08-20", "English language teacher with a focus on creative writing and reading comprehension.", "teacher"],
  ["Mohammed", "Al-Suwaidi", "mohammed.alsuwaidi@murchid.school", "+971 50 456 7890", "STF-004", ["Arabic", "Islamic Studies"], ["KG 1", "KG 2", "Grade 1", "Grade 2", "Grade 3"], "UAE", "2015-09-15", "Early years Arabic and Islamic studies specialist.", "teacher"],
  ["Priya", "Menon", "priya.menon@murchid.school", "+971 56 567 8901", "STF-005", ["Art", "History"], ["Grade 4", "Grade 5", "Grade 6", "Grade 7"], "India", "2020-09-01", "Art teacher and humanities cross-curricular collaborator.", "teacher"],
  // Operational accounts (no teaching content). Discoverable via the role-switcher.
  ["Murchid", "Admin", "admin@murchid.school", null, "ADM-001", [], [], null, null, "Administrative account — manages teachers and system stats.", "admin"],
  ["Murchid", "Dev",   "dev@murchid.school",   null, "DEV-001", [], [], null, null, "Engineering account — read-only inspector, logs, feature flags.", "dev"],
  // Project owner — pre-seeded so signing in with this Google account
  // immediately attaches the existing dev row via ON CONFLICT (email).
  // The role is also reconciled at login from DEV_EMAILS env.
  ["Issa", "Marwan", "issa.mjq@gmail.com", null, "DEV-002", [], [], null, null, "Project owner — full dev access.", "dev"],
  // Super admin — pyramid top. Manages account access for admin / moe /
  // owner. Reconciled at login from SUPER_ADMIN_EMAILS env.
  ["Karaali", "Issa", "karaaliissa@gmail.com", null, "SAD-001", [], [], null, null, "Super admin — manages account access across the pyramid.", "super_admin"],
];

// [first_name, last_name, student_id, dob, gender, grade, section, email, phone, nationality, address,
//  pg_name, pg_rel, pg_email, pg_phone, sg_name, sg_rel, sg_email, sg_phone, enrollment_date, notes]
const STUDENTS = [
  ["Ahmed",   "Al-Hashimi",  "STU-6A-001", "2013-03-12", "Male",   "Grade 6", "6A", null, null, "UAE",     "Al Wasl, Dubai",       "Khalid Al-Hashimi",  "Father", "khalid.alhashimi@mail.ae",  "+971 50 111 2233", "Mariam Al-Hashimi", "Mother", "mariam.alh@mail.ae", "+971 50 111 4455", "2022-09-05", null],
  ["Fatima",  "Al-Marri",    "STU-6A-002", "2013-05-04", "Female", "Grade 6", "6A", null, null, "UAE",     "Mirdif, Dubai",        "Nora Al-Marri",      "Mother", "nora.almarri@mail.ae",      "+971 50 222 3344", null, null, null, null, "2022-09-05", "Top of class in science."],
  ["Omar",    "Bin Saleh",   "STU-6A-003", "2013-01-20", "Male",   "Grade 6", "6A", null, null, "Saudi Arabia", "Jumeirah, Dubai", "Saleh Bin Saleh",    "Father", "saleh.bs@mail.com",         "+966 50 333 4455", null, null, null, null, "2022-09-05", null],
  ["Layla",   "Mahmoud",     "STU-6A-004", "2013-07-14", "Female", "Grade 6", "6A", null, null, "Egypt",   "Al Barsha, Dubai",     "Hassan Mahmoud",     "Father", "hassan.m@mail.com",         "+971 50 444 5566", "Aisha Mahmoud", "Mother", "aisha.m@mail.com", "+971 50 444 7788", "2022-09-05", null],
  ["Yousef",  "Khoury",      "STU-6A-005", "2013-09-30", "Male",   "Grade 6", "6A", null, null, "Lebanon", "Dubai Marina, Dubai",  "Rania Khoury",       "Mother", "rania.khoury@mail.com",     "+971 55 555 6677", null, null, null, null, "2023-01-10", "Joined mid-year from Beirut."],
  ["Aisha",   "Patel",       "STU-6A-006", "2013-04-22", "Female", "Grade 6", "6A", null, null, "India",   "Bur Dubai, Dubai",     "Vikram Patel",       "Father", "vikram.patel@mail.com",     "+971 50 666 7788", "Sunita Patel", "Mother", "sunita.p@mail.com", "+971 50 666 9900", "2022-09-05", null],
  ["Hamdan",  "Al-Falasi",   "STU-6B-001", "2013-02-18", "Male",   "Grade 6", "6B", null, null, "UAE",     "Al Khawaneej, Dubai",  "Mariam Al-Falasi",   "Mother", "mariam.alf@mail.ae",        "+971 50 777 8899", null, null, null, null, "2022-09-05", null],
  ["Maryam",  "Saeed",       "STU-6B-002", "2013-06-08", "Female", "Grade 6", "6B", null, null, "UAE",     "Deira, Dubai",         "Saeed Al-Suwaidi",   "Father", "saeed.als@mail.ae",         "+971 50 888 9900", null, null, null, null, "2022-09-05", "Needs extra scaffolding for written tasks."],
  ["Khaled",  "Mansour",     "STU-6B-003", "2013-08-25", "Male",   "Grade 6", "6B", null, null, "Jordan",  "Al Quoz, Dubai",       "Tariq Mansour",      "Father", "tariq.m@mail.com",          "+971 56 999 0011", "Lina Mansour", "Mother", "lina.m@mail.com", "+971 56 999 2233", "2022-09-05", null],
  ["Noor",    "Abdullah",    "STU-6B-004", "2013-11-02", "Female", "Grade 6", "6B", null, null, "UAE",     "JLT, Dubai",           "Abdullah Al-Nuaimi", "Father", "abdullah.aln@mail.ae",      "+971 50 100 2233", null, null, null, null, "2022-09-05", null],
  ["Rashid",  "Al-Maktoum",  "STU-7A-001", "2012-04-11", "Male",   "Grade 7", "7A", "rashid.alm@students.murchid.school", null, "UAE", "Umm Suqeim, Dubai", "Hind Al-Maktoum", "Mother", "hind.alm@mail.ae", "+971 50 200 3344", null, null, null, null, "2021-09-01", null],
  ["Salma",   "Tarek",       "STU-7A-002", "2012-09-18", "Female", "Grade 7", "7A", "salma.t@students.murchid.school",    null, "Egypt", "Al Garhoud, Dubai", "Tarek Mahmoud", "Father", "tarek.m@mail.com", "+971 50 300 4455", null, null, null, null, "2021-09-01", "Class representative."],
  ["Zayed",   "Al-Nuaimi",   "STU-7A-003", "2012-12-05", "Male",   "Grade 7", "7A", "zayed.aln@students.murchid.school",  null, "UAE", "Sharjah", "Mohammed Al-Nuaimi", "Father", "mohammed.aln@mail.ae", "+971 50 400 5566", null, null, null, null, "2021-09-01", null],
  ["Hessa",   "Al-Qassimi",  "STU-7A-004", "2012-06-23", "Female", "Grade 7", "7A", "hessa.alq@students.murchid.school",  null, "UAE", "Sharjah", "Sheikha Al-Qassimi", "Mother", "sheikha.alq@mail.ae", "+971 50 500 6677", null, null, null, null, "2021-09-01", null],
  ["Ibrahim", "Awad",        "STU-7B-001", "2012-03-09", "Male",   "Grade 7", "7B", "ibrahim.a@students.murchid.school", null, "Sudan", "Al Nahda, Dubai", "Yasmin Awad", "Mother", "yasmin.a@mail.com", "+971 56 600 7788", null, null, null, null, "2021-09-01", null],
  ["Amina",   "Al-Habsi",    "STU-7B-002", "2012-10-14", "Female", "Grade 7", "7B", "amina.alh@students.murchid.school", null, "Oman", "Discovery Gardens, Dubai", "Salim Al-Habsi", "Father", "salim.alh@mail.com", "+968 90 700 8899", "Mariam Al-Habsi", "Mother", "mariam.alh.om@mail.com", "+968 90 700 1010", "2021-09-01", null],
  ["Saif",    "Khan",        "STU-7B-003", "2012-07-27", "Male",   "Grade 7", "7B", "saif.k@students.murchid.school",    null, "Pakistan", "International City, Dubai", "Bilal Khan", "Father", "bilal.k@mail.com", "+971 56 800 9900", null, null, null, null, "2022-09-05", null],
  ["Reem",    "Al-Otaiba",   "STU-7B-004", "2012-11-19", "Female", "Grade 7", "7B", "reem.alo@students.murchid.school",  null, "UAE", "Abu Dhabi", "Saeed Al-Otaiba", "Father", "saeed.alo@mail.ae", "+971 50 900 0011", null, null, null, null, "2021-09-01", "Boards from Abu Dhabi during the week."],
  ["Tariq",   "Al-Suwaidi",  "STU-8A-001", "2011-05-30", "Male",   "Grade 8", "8A", "tariq.als@students.murchid.school", "+971 55 110 2233", "UAE", "Al Warqa, Dubai", "Latifa Al-Suwaidi", "Mother", "latifa.als@mail.ae", "+971 50 110 3344", null, null, null, null, "2020-09-01", null],
  ["Mariam",  "Bin Hammad",  "STU-8A-002", "2011-08-12", "Female", "Grade 8", "8A", "mariam.bh@students.murchid.school", "+971 56 220 3344", "UAE", "Al Twar, Dubai", "Khalid Bin Hammad", "Father", "khalid.bh@mail.ae", "+971 50 220 4455", "Hessa Bin Hammad", "Mother", "hessa.bh@mail.ae", "+971 50 220 5566", "2020-09-01", null],
  ["Ali",     "Hussein",     "STU-8A-003", "2011-02-04", "Male",   "Grade 8", "8A", "ali.h@students.murchid.school",     "+971 56 330 4455", "Iraq", "Al Mizhar, Dubai", "Zaynab Hussein", "Mother", "zaynab.h@mail.com", "+971 56 330 5566", null, null, null, null, "2020-09-01", null],
  ["Hamad",   "Al-Shamsi",   "STU-K2-001", "2018-05-15", "Male",   "KG 2", "KG2-A", null, null, "UAE", "Al Mizhar, Dubai", "Aisha Al-Shamsi", "Mother", "aisha.als@mail.ae", "+971 50 010 1122", null, null, null, null, "2024-09-01", null],
  ["Shaikha", "Al-Mehairi",  "STU-K2-002", "2018-08-22", "Female", "KG 2", "KG2-A", null, null, "UAE", "Al Barsha, Dubai", "Khalifa Al-Mehairi", "Father", "khalifa.alm@mail.ae", "+971 50 020 2233", null, null, null, null, "2024-09-01", null],
];

const DRAFTS = [
  ["Poetry — figurative language", "For grade 7B · Friday lesson", "missing slides", "English", "In progress", 65, "2 minutes"],
  ["Algebra recap before unit test", "Grade 8A · review session", null, "Math", "Ready to use", 100, "1 hour"],
  ["States of matter — lab prep", "Needs lab booking confirmation", "needs lab time", "Science", "Blocked", 80, "1 day"],
  ["Vocabulary review — week 12", "Grade 7A · paused", null, "English", "Paused", 40, "2 days"],
  ["Industrial revolution intro", "First lesson of new unit", "missing handout", "History", "In progress", 50, "3 days"],
  ["Word problems Friday set", "Grade 7 · 5 problems drafted", null, "Math", "In progress", 30, "7 days"],
  ["Short story workshop pt. 2", "Continuation from Monday", null, "Art", "Ready to use", 100, "8 days"],
];

// Default flags. Toggleable from the Dev role.
const FEATURE_FLAGS = [
  ["ai_studio",         false, "AI lesson/quiz generation in Studio (placeholder)."],
  ["calendar_sync",     false, "Two-way Gmail / Outlook calendar sync (not built)."],
  ["bulk_attendance",   true,  "Allow bulk attendance entry per class section."],
  ["pdf_export",        true,  "Allow PDF export from Reports."],
];

// =============================================================================
// MAIN
// =============================================================================
export async function runInit() {
  console.log("Renaming legacy teachers→accounts (no-op if already migrated)...");
  await pool.query(SCHEMA_RENAME_TEACHERS_TO_ACCOUNTS);

  console.log("Creating base schema...");
  await pool.query(SCHEMA_BASE);

  console.log("Adding multi-tenancy columns...");
  await pool.query(SCHEMA_MULTITENANT);

  console.log("Extending drafts with lesson-plan fields...");
  await pool.query(SCHEMA_LESSON_FIELDS);

  console.log("Creating new feature tables...");
  await pool.query(SCHEMA_NEW);

  console.log("Relaxing schedule_entries time NOT NULLs...");
  await pool.query(SCHEMA_SCHEDULE_TIMES_NULLABLE);

  console.log("Adding scheduled_for to presentations and activities...");
  await pool.query(SCHEMA_PRES_ACT_SCHEDULED);

  console.log("Adding class_map to teaching profile...");
  await pool.query(SCHEMA_CLASS_MAP);

  console.log("Adding soft-delete columns to teaching surfaces...");
  await pool.query(SCHEMA_SOFT_DELETE);

  console.log("Creating uploaded_images table...");
  await pool.query(SCHEMA_IMAGES);

  console.log("Adding Firebase Auth + subscription columns...");
  await pool.query(SCHEMA_AUTH);

  console.log("Creating audit_log table + indexes...");
  await pool.query(SCHEMA_AUDIT);

  console.log("Adding auth-path indexes...");
  await pool.query(SCHEMA_AUTH_INDEXES);

  console.log("Creating schools + teacher_schools + students.school_id...");
  await pool.query(SCHEMA_SCHOOLS);

  console.log("Normalizing legacy values...");
  await pool.query(NORMALIZE);

  console.log("Refreshing CHECK constraints...");
  await pool.query(CONSTRAINTS);

  // --- Teachers seed ------------------------------------------------------
  const tch = await pool.query("SELECT COUNT(*)::int AS n FROM accounts");
  if (tch.rows[0].n === 0) {
    console.log(`Seeding ${TEACHERS.length} teachers...`);
    for (const row of TEACHERS) {
      await pool.query(
        `INSERT INTO accounts (first_name, last_name, email, phone, staff_id, majors, grade_levels, nationality, hire_date, bio, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
        row
      );
    }
  } else {
    // Backfill role for existing rows to satisfy the CHECK.
    await pool.query("UPDATE accounts SET role = 'teacher' WHERE role IS NULL OR role = ''");
    // Make sure ADM-001 / DEV-001 exist (idempotent insert).
    for (const row of TEACHERS.filter((t) => t[10] !== "teacher")) {
      await pool.query(
        `INSERT INTO accounts (first_name, last_name, email, phone, staff_id, majors, grade_levels, nationality, hire_date, bio, role)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
         ON CONFLICT (staff_id) DO NOTHING`,
        row
      );
    }
    console.log(`Teachers already populated (${tch.rows[0].n} rows). Ensured admin/dev exist.`);
  }

  // Reconcile privileged roles from env (DEV_EMAILS / ADMIN_EMAILS /
  // MOE_EMAILS / OWNER_EMAILS). Promotes any existing teacher row whose
  // email appears in a privileged list to the corresponding role.
  // Idempotent — emails already at the right role are no-ops. Demotion
  // only happens at login time (auth route) to avoid surprising side
  // effects when re-seeding.
  const allEmails = await pool.query("SELECT id, email, role FROM accounts WHERE email IS NOT NULL");
  for (const row of allEmails.rows) {
    const wanted = resolveReservedRole(row.email);
    if (wanted && wanted !== row.role) {
      await pool.query("UPDATE accounts SET role = $1, updated_at = NOW() WHERE id = $2", [wanted, row.id]);
      console.log(`  promoted ${row.email}: ${row.role} → ${wanted}`);
    }
  }

  // Resolve a default account_id once for backfills below.
  const defaultAccount = await pool.query(
    "SELECT id FROM accounts WHERE staff_id = 'STF-001' LIMIT 1"
  );
  const defaultAccountId = defaultAccount.rows[0]?.id;
  if (!defaultAccountId) throw new Error("No STF-001 account found — cannot backfill.");

  // Templates + Drafts no longer seed dummy rows. Teachers start with
  // an empty Lesson Plans surface and build their own library.

  // --- Students seed ------------------------------------------------------
  const stu = await pool.query("SELECT COUNT(*)::int AS n FROM students");
  if (stu.rows[0].n === 0) {
    console.log(`Seeding ${STUDENTS.length} students...`);
    for (const row of STUDENTS) {
      await pool.query(
        `INSERT INTO students (
           first_name, last_name, student_id, date_of_birth, gender, grade, section,
           email, phone, nationality, address,
           primary_guardian_name, primary_guardian_relationship, primary_guardian_email, primary_guardian_phone,
           secondary_guardian_name, secondary_guardian_relationship, secondary_guardian_email, secondary_guardian_phone,
           enrollment_date, notes, account_id
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22)`,
        [...row, defaultAccountId]
      );
    }
  } else {
    console.log(`Students already populated (${stu.rows[0].n} rows). Skipping seed.`);
  }

  // --- Backfill teacher_id on legacy rows + lock NOT NULL -----------------
  console.log("Backfilling teacher_id on legacy rows...");
  await pool.query(`UPDATE templates SET account_id = $1 WHERE account_id IS NULL`, [defaultAccountId]);
  await pool.query(`UPDATE drafts    SET account_id = $1 WHERE account_id IS NULL`, [defaultAccountId]);
  await pool.query(`UPDATE students  SET account_id = $1 WHERE account_id IS NULL`, [defaultAccountId]);

  await pool.query(`ALTER TABLE templates ALTER COLUMN account_id SET NOT NULL`);
  await pool.query(`ALTER TABLE drafts    ALTER COLUMN account_id SET NOT NULL`);
  await pool.query(`ALTER TABLE students  ALTER COLUMN account_id SET NOT NULL`);

  // --- UAE schools seed ---------------------------------------------------
  // Idempotent: ON CONFLICT (name, emirate) DO NOTHING. Re-running the
  // init never duplicates a row even if the catalog grows over time.
  console.log(`Seeding ${UAE_SCHOOLS.length} UAE schools...`);
  for (const s of UAE_SCHOOLS) {
    await pool.query(
      `INSERT INTO schools (name, name_ar, emirate, city, type, curriculum)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (name, emirate) DO NOTHING`,
      [s.name, s.name_ar || null, s.emirate, s.city || null, s.type || null, s.curriculum || null]
    );
  }

  // --- Feature flags ------------------------------------------------------
  for (const [key, enabled, description] of FEATURE_FLAGS) {
    await pool.query(
      `INSERT INTO feature_flags (key, enabled, description)
       VALUES ($1, $2, $3)
       ON CONFLICT (key) DO UPDATE SET description = EXCLUDED.description`,
      [key, enabled, description]
    );
  }

  // --- Sample schedule + notifications so dashboard has something --------
  const sch = await pool.query("SELECT COUNT(*)::int AS n FROM schedule_entries WHERE account_id = $1", [defaultAccountId]);
  if (sch.rows[0].n === 0) {
    console.log("Seeding sample schedule entries...");
    const today = new Date().toISOString().slice(0, 10);
    const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10);
    const samples = [
      [defaultAccountId, "Algebra recap before unit test", "Math",    "Grade 8", "8A", today,    "08:30", "09:30", "Room 204", "planned"],
      [defaultAccountId, "States of matter — lab prep",     "Science", "Grade 8", "8A", today,    "10:00", "11:30", "Lab B",    "planned"],
      [defaultAccountId, "Poetry — figurative language",    "English", "Grade 7", "7B", today,    "12:00", "12:50", "Room 211", "planned"],
      [defaultAccountId, "Vocabulary review — week 12",     "English", "Grade 7", "7A", tomorrow, "08:30", "09:20", "Room 211", "planned"],
      [defaultAccountId, "Industrial revolution intro",     "History", "Grade 8", "8A", tomorrow, "11:00", "11:50", "Room 204", "planned"],
    ];
    for (const row of samples) {
      await pool.query(
        `INSERT INTO schedule_entries (account_id, title, subject, grade, section, date, start_time, end_time, location, status)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        row
      );
    }
  }

  const nfn = await pool.query("SELECT COUNT(*)::int AS n FROM notifications WHERE account_id = $1", [defaultAccountId]);
  if (nfn.rows[0].n === 0) {
    console.log("Seeding sample notifications...");
    const samples = [
      [defaultAccountId, "lesson_upcoming", "Algebra recap starts in 30 minutes (8A · Room 204).", "/schedule"],
      [defaultAccountId, "homework_due",    "Vocabulary worksheet for 7A is due tomorrow.",        "/homework"],
      [defaultAccountId, "grade_reminder",  "3 quiz scores still need to be recorded.",            "/quizzes"],
    ];
    for (const row of samples) {
      await pool.query(
        `INSERT INTO notifications (account_id, kind, message, link) VALUES ($1, $2, $3, $4)`,
        row
      );
    }
  }

  await pool.end();
  console.log("Done.");
}

// Only run as CLI when the file is invoked directly via `node ...`.
// When imported (e.g. from backend/index.js so init runs on boot), the
// caller decides when / how to invoke runInit().
import { fileURLToPath } from "node:url";
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runInit().catch((err) => {
    console.error("Init failed:", err);
    pool.end();
    process.exit(1);
  });
}
