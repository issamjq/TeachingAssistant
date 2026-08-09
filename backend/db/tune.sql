-- =====================================================================
-- Align the live Supabase schema with what the product needs
--
-- The schema in Supabase was authored there directly, and it is a good
-- one: users mirrored off auth.users, faculty/students split off it,
-- work modelled as workflows -> generations -> assignments -> attempts,
-- RLS on every table. This file does not redesign any of that. It fixes
-- what is missing or broken around it.
--
-- Every statement is idempotent and additive. Nothing here drops a
-- table, drops a column, or deletes a row.
--
-- Run with:  npm run db:tune
-- =====================================================================


-- ── 1. Mirror the accounts that predate the trigger ───────────────────
--
-- handle_new_user() fires on INSERT into auth.users, so it only ever
-- populated rows created after it was installed. auth.users holds 13
-- accounts and public.users held none of them — every one of those
-- teachers would sign in successfully and then find nothing behind it,
-- because their profile row does not exist.
--
-- Same mapping the trigger uses, so a backfilled row is indistinguishable
-- from a triggered one.
INSERT INTO public.users (id, full_name, email, avatar_url, signup_provider)
SELECT
  au.id,
  COALESCE(au.raw_user_meta_data ->> 'full_name', au.raw_user_meta_data ->> 'name'),
  au.email,
  COALESCE(au.raw_user_meta_data ->> 'avatar_url', au.raw_user_meta_data ->> 'picture'),
  CASE au.raw_app_meta_data ->> 'provider'
    WHEN 'azure'         THEN 'microsoft'
    WHEN 'linkedin_oidc' THEN 'linkedin'
    WHEN 'linkedin'      THEN 'linkedin'
    ELSE au.raw_app_meta_data ->> 'provider'
  END
FROM auth.users au
ON CONFLICT (id) DO NOTHING;


-- ── 2. Names the application actually collects ────────────────────────
--
-- users.full_name is one string, but every source of a name here is
-- already split: the sign-up form asks for first and last separately,
-- LinkedIn OIDC returns given_name/family_name, and the CV parser
-- returns first_name/last_name. Joining them on the way in and splitting
-- them again on the way out loses the distinction for exactly the names
-- where it matters — "Al-Mansoori" is not a middle name, and a teacher
-- called "Amal C P" does not have the surname "P".
--
-- full_name stays. It is what a provider hands over and what a display
-- name should use; the parts are for greetings and for sorting.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS first_name text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_name  text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS locale     text;

UPDATE public.users u
SET first_name = COALESCE(u.first_name, au.raw_user_meta_data ->> 'given_name'),
    last_name  = COALESCE(u.last_name,  au.raw_user_meta_data ->> 'family_name'),
    locale     = COALESCE(u.locale,     au.raw_user_meta_data ->> 'locale')
FROM auth.users au
WHERE au.id = u.id
  AND (u.first_name IS NULL OR u.last_name IS NULL OR u.locale IS NULL);


-- ── 3. Somewhere to put what the CV reader finds ──────────────────────
--
-- /api/onboarding/parse extracts eleven fields. faculty already has a
-- home for staff_id, expertise, eligible_grades, languages and
-- qualification, and users has email and phone — but bio and nationality
-- had nowhere to land, so the two fields a teacher is least likely to
-- type by hand were the two being thrown away.
ALTER TABLE public.faculty ADD COLUMN IF NOT EXISTS bio              text;
ALTER TABLE public.faculty ADD COLUMN IF NOT EXISTS nationality      text;
ALTER TABLE public.faculty ADD COLUMN IF NOT EXISTS years_experience integer;


-- ── 4. Schools as rows, not as a string ───────────────────────────────
--
-- faculty.organization is free text, which cannot answer "which teachers
-- are at this school" — two teachers at the same school will not spell it
-- the same way. The app already ships a curated list (src/lib/schools.js,
-- by emirate), the sign-up flow picks from it, and school-scoped views
-- need to group by it.
--
-- organization is kept as the fallback for a teacher whose school is not
-- on the list, so nobody is blocked by an incomplete directory.
CREATE TABLE IF NOT EXISTS public.schools (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  emirate    text,
  curriculum text,
  type       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS schools_name_emirate_key
  ON public.schools (lower(name), COALESCE(lower(emirate), ''));

ALTER TABLE public.faculty
  ADD COLUMN IF NOT EXISTS school_id uuid REFERENCES public.schools(id) ON DELETE SET NULL;


-- ── 5. Tables the existing code already expects ───────────────────────

-- The AI Studio is gated on a flag read at request time, and the dev
-- console toggles it. Without this table the gate has nothing to read.
CREATE TABLE IF NOT EXISTS public.feature_flags (
  key         text PRIMARY KEY,
  enabled     boolean NOT NULL DEFAULT false,
  description text,
  updated_at  timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('ai_studio', false, 'AI Studio generation endpoints'),
  ('quizzes',   false, 'Quiz authoring and assignment')
ON CONFLICT (key) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  kind       text NOT NULL,
  title      text,
  body       text,
  link       text,
  read_at    timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Who did what, for the superadmin console. actor is SET NULL rather
-- than CASCADE on purpose: deleting an account must not erase the record
-- of what that account did, which is the one thing an audit log is for.
CREATE TABLE IF NOT EXISTS public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid REFERENCES public.users(id) ON DELETE SET NULL,
  action     text NOT NULL,
  entity     text,
  entity_id  uuid,
  meta       jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);


-- ── 6. updated_at on the new tables ───────────────────────────────────
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schools', 'notifications', 'feature_flags', 'audit_log'] LOOP
    -- audit_log is append-only and has no updated_at; a trigger there
    -- would assign to a field that does not exist, and only fail later,
    -- on the first UPDATE.
    CONTINUE WHEN NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t AND column_name = 'updated_at');
    IF NOT EXISTS (
      SELECT 1 FROM pg_trigger tg
      JOIN pg_class c ON c.oid = tg.tgrelid
      WHERE c.relname = t AND tg.tgname = 'set_updated_at' AND NOT tg.tgisinternal
    ) THEN
      EXECUTE format(
        'CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
           FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
    END IF;
  END LOOP;
END $$;


-- ── 7. Index every foreign key ────────────────────────────────────────
--
-- Nineteen foreign keys had no index. Postgres does not create one for
-- you, and the cost lands twice: "every class for this teacher" is a
-- sequential scan, and — less obviously — so is every ON DELETE CASCADE,
-- because deleting one faculty row makes Postgres scan every child table
-- looking for references. With ten tables cascading off faculty, removing
-- one account reads the entire database.
--
-- Where a composite index leads with the FK column it serves as that
-- key's index too, so the pairs below are deliberate rather than a
-- separate single-column index plus a composite.
-- Driven off a table rather than written as literal statements: the
-- schema is being edited in Supabase directly, and this file has already
-- been run once against a database that has since dropped two of the
-- tables it named. A literal CREATE INDEX on a table that no longer
-- exists aborts the whole transaction and takes every other fix with it.
-- Skipping what is gone keeps this runnable against a moving target.
DO $$
DECLARE
  r record;
BEGIN
  FOR r IN
    SELECT * FROM (VALUES
      ('classes', 'classes_faculty_idx', $i$(faculty_id) WHERE NOT is_archived$i$),
      ('classes', 'classes_faculty_all_idx', $i$(faculty_id)$i$),
      ('class_members', 'class_members_student_idx', $i$(student_id)$i$),
      ('invitations', 'invitations_class_idx', $i$(class_id)$i$),
      ('materials', 'materials_faculty_idx', $i$(faculty_id, status)$i$),
      ('teaching_skills', 'teaching_skills_faculty_idx', $i$(faculty_id)$i$),
      ('workflows', 'workflows_faculty_idx', $i$(faculty_id, created_at DESC)$i$),
      ('workflows', 'workflows_skill_idx', $i$(skill_id)$i$),
      ('generations', 'generations_faculty_idx', $i$(faculty_id, created_at DESC)$i$),
      ('generations', 'generations_workflow_idx', $i$(workflow_id)$i$),
      ('assignments', 'assignments_class_idx', $i$(class_id, starts_at DESC)$i$),
      ('assignments', 'assignments_generation_idx', $i$(generation_id)$i$),
      ('quiz_attempts', 'quiz_attempts_assignment_idx', $i$(assignment_id)$i$),
      ('quiz_attempts', 'quiz_attempts_student_idx', $i$(student_id)$i$),
      ('goals', 'goals_faculty_idx', $i$(faculty_id)$i$),
      ('subscriptions', 'subscriptions_faculty_idx', $i$(faculty_id)$i$),
      ('chatbot_sessions', 'chatbot_sessions_user_idx', $i$(user_id)$i$),
      ('chatbot_messages', 'chatbot_messages_session_idx', $i$(session_id, created_at)$i$),
      ('onboarding_documents', 'onboarding_docs_user_idx', $i$(user_id)$i$),
      ('usage_logs', 'usage_logs_user_idx', $i$(user_id, created_at DESC)$i$),
      ('faculty', 'faculty_school_idx', $i$(school_id)$i$),
      ('ai_studio', 'ai_studio_skill_idx', $i$(skill_id)$i$),
      ('ai_studio', 'ai_studio_faculty_created_idx', $i$(faculty_id, created_at DESC)$i$),
      ('notifications', 'notifications_user_idx', $i$(user_id, created_at DESC)$i$),
      ('audit_log', 'audit_log_actor_idx', $i$(actor_id, created_at DESC)$i$),
      ('notifications', 'notifications_unread_idx', $i$(user_id) WHERE read_at IS NULL$i$)
    ) AS v(tbl, idx, cols)
  LOOP
    IF to_regclass('public.' || r.tbl) IS NULL THEN
      RAISE NOTICE 'skipping %: table not in this schema', r.idx;
      CONTINUE;
    END IF;
    EXECUTE format('CREATE INDEX IF NOT EXISTS %I ON public.%I %s', r.idx, r.tbl, r.cols);
  END LOOP;
END $$;

-- ── 8. Constrain the status vocabularies ──────────────────────────────
--
-- Every status/role column is bare `text`, so a typo in application code
-- inserts happily and is only discovered when a filter silently matches
-- nothing. These are the values already implied by the column defaults
-- and by what the product does; NULL stays allowed wherever the column
-- is nullable.
--
-- Deliberately NOT constrained: generations.type and
-- workflows.selected_types. The set of things the studio can generate is
-- still growing, and a CHECK there would have to be edited every time
-- one is added — a constraint that gets in the way more than it helps.
DO $$
DECLARE
  c record;
BEGIN
  FOR c IN
    SELECT * FROM (VALUES
      ('users',                'role',              $q$role IN ('teacher','student','school_admin','superadmin')$q$),
      ('users',                'account_status',    $q$account_status IN ('active','suspended','deleted')$q$),
      ('users',                'onboarding_status', $q$onboarding_status IN ('pending','in_progress','complete')$q$),
      -- The real plan ids, read off src/lib/plans.js rather than guessed.
      -- The first pass invented ('starter','pro','school') and would have
      -- rejected every actual sign-up.
      ('subscriptions',        'plan',              $q$plan IN ('trial','monthly','quarterly','annual')$q$),
      ('subscriptions',        'status',            $q$status IN ('trialing','active','past_due','canceled','expired')$q$),
      ('workflows',            'status',            $q$status IN ('running','complete','failed','canceled')$q$),
      ('generations',          'status',            $q$status IN ('generating','complete','failed')$q$),
      ('ai_studio',            'status',            $q$status IN ('queued','generating','complete','failed','canceled')$q$),
      ('materials',            'status',            $q$status IN ('uploaded','processing','ready','failed')$q$),
      ('teaching_skills',      'status',            $q$status IN ('processing','ready','failed')$q$),
      ('goals',                'status',            $q$status IN ('processing','active','achieved','abandoned','failed')$q$),
      ('invitations',          'status',            $q$status IN ('sent','accepted','expired','revoked')$q$),
      ('onboarding_documents', 'status',            $q$status IN ('uploaded','processing','parsed','failed')$q$),
      ('onboarding_documents', 'doc_type',          $q$doc_type IN ('resume','id_card','certificate','other')$q$),
      ('chatbot_messages',     'role',              $q$role IN ('user','assistant','system')$q$)
    ) AS v(tbl, col, expr)
  LOOP
    CONTINUE WHEN to_regclass('public.' || c.tbl) IS NULL
                  OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                                 WHERE table_schema = 'public'
                                   AND table_name = c.tbl AND column_name = c.col);
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint
      WHERE conname = c.tbl || '_' || c.col || '_check'
        AND connamespace = 'public'::regnamespace
    ) THEN
      EXECUTE format('ALTER TABLE public.%I ADD CONSTRAINT %I CHECK (%s)',
                     c.tbl, c.tbl || '_' || c.col || '_check', c.expr);
    END IF;
  END LOOP;
END $$;


-- ── 8b. RLS on the tables this file adds ──────────────────────────────
--
-- Every table in the Supabase-authored schema has RLS enabled. The four
-- added above did not, which meant that on those four the `authenticated`
-- role could read and write every row through PostgREST — including other
-- teachers' notifications and the whole audit trail.
--
-- The four need different rules, not one rule:
--   schools, feature_flags  reference data — everyone reads, nobody writes
--   notifications           your own rows only
--   audit_log               no client access at all; the API writes it
--                           with the service connection, and a subject
--                           who can edit the audit trail makes it useless
ALTER TABLE public.schools       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_log     ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS schools_read ON public.schools;
CREATE POLICY schools_read ON public.schools
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS feature_flags_read ON public.feature_flags;
CREATE POLICY feature_flags_read ON public.feature_flags
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS notifications_own ON public.notifications;
CREATE POLICY notifications_own ON public.notifications
  FOR ALL TO authenticated
  USING      (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

-- audit_log deliberately gets NO policy. RLS with no policy denies every
-- client; the API reaches it over the pooler connection, which is not
-- subject to RLS.


-- ── 9. Let the browser actually use the storage buckets ───────────────
--
-- Five private buckets exist and NONE of them had a policy. Storage RLS
-- denies by default, so as it stood every upload and every download
-- failed for everyone — the CV upload could not have worked regardless
-- of what the parser does with the file.
--
-- The rule is one folder per user, named with their uid: a path must
-- begin with the caller's own id. That is what makes a private bucket
-- private, and it is why uploads go straight from the browser under the
-- teacher's own session rather than through a backend holding a
-- privileged key.
DO $$
DECLARE
  b text;
BEGIN
  FOREACH b IN ARRAY ARRAY['resumes', 'id-cards', 'avatars', 'ai-exports', 'imports'] LOOP
    EXECUTE format($p$
      DROP POLICY IF EXISTS %I ON storage.objects;
      CREATE POLICY %I ON storage.objects
        FOR ALL TO authenticated
        USING      (bucket_id = %L AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
        WITH CHECK (bucket_id = %L AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));
    $p$, b || '_own_folder', b || '_own_folder', b, b);
  END LOOP;
END $$;


-- ── 10. Keep the planner honest ───────────────────────────────────────
-- New indexes on empty tables have no statistics; ANALYZE costs nothing
-- here and stops the first real queries being planned against guesses.
--
-- Scoped to our own tables. A bare ANALYZE walks the system catalogs
-- too, which this role may not read, and buries the real output under a
-- screenful of "permission denied to analyze pg_authid".
DO $$
DECLARE t text;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public' LOOP
    EXECUTE format('ANALYZE public.%I', t);
  END LOOP;
END $$;


-- ── 11. The three screens with nowhere to store anything ──────────────
--
-- The new schema models generated work (ai_studio), who it was given to
-- (assignments) and what came back (quiz_attempts). It does not model
-- the timetable, the register, or a gradebook — and the studio has a
-- screen for each. They are not generated content, so they do not belong
-- in ai_studio: a lesson at 09:00 on Tuesday is a fact about the week,
-- not an artifact with a jsonb body.
--
-- Everything hangs off faculty, matching the rest of the schema.

CREATE TABLE IF NOT EXISTS public.schedule_entries (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  class_id   uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  title      text NOT NULL,
  subject    text,
  grade      text,
  section    text,
  date       date NOT NULL,
  start_time time,
  end_time   time,
  location   text,
  notes      text,
  status     text NOT NULL DEFAULT 'planned',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- One row per student per session. The unique key is what makes marking
-- a register idempotent — taking it twice corrects it rather than
-- doubling it.
CREATE TABLE IF NOT EXISTS public.attendance (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id  uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  student_id  uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id    uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  schedule_id uuid REFERENCES public.schedule_entries(id) ON DELETE SET NULL,
  date        date NOT NULL,
  status      text NOT NULL DEFAULT 'present',
  note        text,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

-- Idempotence, as two partial unique indexes rather than one table
-- constraint: a UNIQUE constraint cannot contain an expression, and
-- NULL never equals NULL, so a plain UNIQUE over a nullable schedule_id
-- would let the same student be marked any number of times on a day
-- with no session attached — exactly the case that needs it most.
CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_session_key
  ON public.attendance (student_id, date, schedule_id) WHERE schedule_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS attendance_student_day_key
  ON public.attendance (student_id, date) WHERE schedule_id IS NULL;

CREATE TABLE IF NOT EXISTS public.student_grades (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  class_id   uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  -- Where the mark came from, when it came from generated work. Null for
  -- a mark a teacher simply typed in.
  source_id  uuid REFERENCES public.ai_studio(id) ON DELETE SET NULL,
  subject    text,
  term       text,
  label      text,
  score      numeric,
  max_score  numeric,
  recorded_on date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Sign-in bookkeeping. The single-device rule needs somewhere to keep
-- the session it considers current; without it every request skips the
-- check, which is how a "signed out on another device" feature quietly
-- stops enforcing anything.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_at     timestamptz;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login_ip     text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS active_session_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS sub_role          text;
ALTER TABLE public.faculty ADD COLUMN IF NOT EXISTS hire_date date;

CREATE INDEX IF NOT EXISTS schedule_faculty_date_idx ON public.schedule_entries (faculty_id, date);
CREATE INDEX IF NOT EXISTS schedule_class_idx        ON public.schedule_entries (class_id);
CREATE INDEX IF NOT EXISTS attendance_faculty_idx    ON public.attendance (faculty_id, date);
CREATE INDEX IF NOT EXISTS attendance_student_idx    ON public.attendance (student_id, date);
CREATE INDEX IF NOT EXISTS attendance_class_idx      ON public.attendance (class_id);
CREATE INDEX IF NOT EXISTS attendance_schedule_idx   ON public.attendance (schedule_id);
CREATE INDEX IF NOT EXISTS grades_faculty_idx        ON public.student_grades (faculty_id, recorded_on DESC);
CREATE INDEX IF NOT EXISTS grades_student_idx        ON public.student_grades (student_id);
CREATE INDEX IF NOT EXISTS grades_class_idx          ON public.student_grades (class_id);
CREATE INDEX IF NOT EXISTS grades_source_idx         ON public.student_grades (source_id);
CREATE INDEX IF NOT EXISTS ai_studio_type_idx        ON public.ai_studio (faculty_id, type, created_at DESC);

-- Same owner rule the rest of the schema uses.
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['schedule_entries', 'attendance', 'student_grades'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_owner', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR ALL TO authenticated
         USING (faculty_id = current_faculty_id()) WITH CHECK (faculty_id = current_faculty_id())',
      t || '_owner', t);
    IF NOT EXISTS (SELECT 1 FROM pg_trigger tg JOIN pg_class c ON c.oid = tg.tgrelid
                   WHERE c.relname = t AND tg.tgname = 'set_updated_at' AND NOT tg.tgisinternal) THEN
      EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
                        FOR EACH ROW EXECUTE FUNCTION public.set_updated_at()', t);
    END IF;
  END LOOP;
END $$;


-- ── 12. What a notification points at ─────────────────────────────────
--
-- The reminder sweep runs on every page load, so it needs to recognise a
-- notice it has already sent. Without a reference back to the thing that
-- caused it, "homework due tomorrow" is re-inserted on each visit and
-- the bell fills with copies of one reminder.
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS ref_table text;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS ref_id    uuid;

-- The dedup key. Partial, because a notice with no referent (a broadcast,
-- a system message) is not a duplicate of the next one like it.
CREATE UNIQUE INDEX IF NOT EXISTS notifications_ref_key
  ON public.notifications (user_id, kind, ref_table, ref_id)
  WHERE ref_id IS NOT NULL;


-- ── 13. Corrections to this file's own earlier guesses ────────────────
--
-- The plan vocabulary above was invented before src/lib/plans.js was
-- read. A CHECK written from a guess is worse than none: it passes
-- review, then rejects the first real row. Drop the old one so the
-- corrected version can take its place.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'subscriptions_plan_check'
      AND connamespace = 'public'::regnamespace
      AND pg_get_constraintdef(oid) LIKE '%starter%'
  ) THEN
    ALTER TABLE public.subscriptions DROP CONSTRAINT subscriptions_plan_check;
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_plan_check
      CHECK (plan IN ('trial', 'monthly', 'quarterly', 'annual'));
  END IF;
END $$;

-- What an audit entry needs to be evidence. `meta` alone cannot answer
-- "from where", and an audit trail that cannot place an action is a log,
-- not a trail.
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS ip         text;
ALTER TABLE public.audit_log ADD COLUMN IF NOT EXISTS user_agent text;


-- ── 14. Soft delete for generated work ────────────────────────────────
--
-- The studio has a trash with restore and a 30-day window. Lesson plans
-- and quizzes were four tables with a deleted_at each; they are one
-- table now, and it has none — so a delete would have been permanent
-- and the trash screen permanently empty.
ALTER TABLE public.ai_studio ADD COLUMN IF NOT EXISTS deleted_at timestamptz;
ALTER TABLE public.materials ADD COLUMN IF NOT EXISTS deleted_at timestamptz;

-- The list query is "mine, of this type, not deleted, newest first", so
-- the index carries the predicate rather than filtering after the read.
CREATE INDEX IF NOT EXISTS ai_studio_live_idx
  ON public.ai_studio (faculty_id, type, updated_at DESC) WHERE deleted_at IS NULL;


-- ── 15. quiz_attempts is really "an attempt at an assignment" ─────────
--
-- Homework submissions and activity completions were their own tables.
-- Both are the same shape as a quiz attempt — a student, a piece of
-- assigned work, when it came in and what it scored — and assignments
-- already generalises over every type in ai_studio. So they share this
-- table rather than adding two more that differ only in name.
--
-- What it was missing to serve all three: a workflow state, a
-- denominator, and somewhere for the teacher to write back.
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS status    text NOT NULL DEFAULT 'pending';
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS max_score numeric;
ALTER TABLE public.quiz_attempts ADD COLUMN IF NOT EXISTS feedback  text;

-- One attempt per student per assignment: that is what makes the grid
-- editable in place, and PUT idempotent rather than additive.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_one_per_student
  ON public.quiz_attempts (assignment_id, student_id);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'quiz_attempts_status_check'
                   AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.quiz_attempts ADD CONSTRAINT quiz_attempts_status_check
      CHECK (status IN ('pending','submitted','graded','returned','late','completed'));
  END IF;
END $$;

-- A student is a person, so their name is on users. Every roster query
-- joins the two, and the FK from students to users carries no index of
-- its own beyond the unique one — which is enough, but the roster also
-- filters by class.
CREATE INDEX IF NOT EXISTS class_members_class_idx ON public.class_members (class_id);


-- ── 16. A timetable entry can come from a lesson plan ─────────────────
-- The planner drops a plan onto a day, and the calendar links back to it.
ALTER TABLE public.schedule_entries
  ADD COLUMN IF NOT EXISTS draft_id uuid REFERENCES public.ai_studio(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS schedule_draft_idx ON public.schedule_entries (draft_id);


-- ── 17. A student a teacher typed in is not yet a user ────────────────
--
-- students.user_id was NOT NULL and references users, which references
-- auth.users. Read together, that says every student must already have
-- signed in — but a teacher building a register types in thirty names
-- for children who have no account and may never have one.
--
-- The schema already shows the intended path: `invitations` sends a
-- student an email to join a class. So a student starts as a row with no
-- user, and gains one when they accept. That makes user_id nullable and
-- moves the identity fields onto students for the un-invited case.
--
-- Guardians live here rather than on users for the same reason. They are
-- contact details for a child's school record, not an account.
ALTER TABLE public.students ALTER COLUMN user_id DROP NOT NULL;

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS created_by uuid
  REFERENCES public.faculty(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS school_id uuid
  REFERENCES public.schools(id) ON DELETE SET NULL;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS first_name    text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS last_name     text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS student_id    text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS date_of_birth date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS gender        text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS email         text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS phone         text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS nationality   text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS address       text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS notes         text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS enrollment_date date;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS primary_guardian_name         text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS primary_guardian_relationship text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS primary_guardian_email        text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS primary_guardian_phone        text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS secondary_guardian_name         text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS secondary_guardian_relationship text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS secondary_guardian_email        text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS secondary_guardian_phone        text;

CREATE INDEX IF NOT EXISTS students_created_by_idx ON public.students (created_by);
CREATE INDEX IF NOT EXISTS students_school_idx     ON public.students (school_id);

-- students_own scoped on user_id, so a teacher-entered student with no
-- user was invisible to everyone including the teacher who typed it in.
DROP POLICY IF EXISTS students_own ON public.students;
CREATE POLICY students_own ON public.students
  FOR ALL TO authenticated
  USING (
    user_id = (SELECT auth.uid())
    OR created_by = current_faculty_id()
    OR EXISTS (SELECT 1 FROM class_members cm
                 JOIN classes c ON c.id = cm.class_id
                WHERE cm.student_id = students.id AND c.faculty_id = current_faculty_id())
  )
  WITH CHECK (user_id = (SELECT auth.uid()) OR created_by = current_faculty_id());

-- Which schools a teacher works at. faculty.school_id is their primary
-- one; a supply teacher covering three schools needs a list, and the
-- student form validates against exactly this.
CREATE TABLE IF NOT EXISTS public.faculty_schools (
  faculty_id uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  school_id  uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  role       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (faculty_id, school_id)
);
CREATE INDEX IF NOT EXISTS faculty_schools_school_idx ON public.faculty_schools (school_id);
ALTER TABLE public.faculty_schools ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS faculty_schools_own ON public.faculty_schools;
CREATE POLICY faculty_schools_own ON public.faculty_schools
  FOR ALL TO authenticated
  USING (faculty_id = current_faculty_id()) WITH CHECK (faculty_id = current_faculty_id());


-- ── 18. The catalog fields the school picker already renders ──────────
-- The picker shows the Arabic name and groups by city; the "not listed?"
-- fallback captures a website. Added rather than dropped from the UI —
-- an Arabic school name is not optional decoration in this market.
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS name_ar text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS city    text;
ALTER TABLE public.schools ADD COLUMN IF NOT EXISTS website text;

-- A teacher has one primary school and may teach different grades and
-- sections at each of them.
ALTER TABLE public.faculty_schools ADD COLUMN IF NOT EXISTS is_primary     boolean NOT NULL DEFAULT false;
ALTER TABLE public.faculty_schools ADD COLUMN IF NOT EXISTS grade_sections jsonb;

-- At most one primary, enforced rather than left to the application to
-- remember on every write.
CREATE UNIQUE INDEX IF NOT EXISTS faculty_schools_one_primary
  ON public.faculty_schools (faculty_id) WHERE is_primary;


-- ── 19. Images pasted into a lesson plan ──────────────────────────────
--
-- These were base64 blobs in a table, served back through the API. That
-- makes every image render a database read and a Node round-trip, and
-- puts megabytes of binary in the same rows the planner queries.
--
-- The project already has object storage — five buckets — so this table
-- holds only the reference. The bytes belong in the `imports` bucket,
-- uploaded from the browser under the teacher's own session, the same
-- way CVs are.
CREATE TABLE IF NOT EXISTS public.uploaded_images (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  file_path  text,
  mime       text,
  -- Retained for images pasted before storage upload existed. New rows
  -- leave it null; it is not the intended home.
  data       text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS uploaded_images_faculty_idx ON public.uploaded_images (faculty_id);
ALTER TABLE public.uploaded_images ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS uploaded_images_owner ON public.uploaded_images;
CREATE POLICY uploaded_images_owner ON public.uploaded_images
  FOR ALL TO authenticated
  USING (faculty_id = current_faculty_id()) WITH CHECK (faculty_id = current_faculty_id());
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger WHERE tgrelid='public.uploaded_images'::regclass AND NOT tgisinternal) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.uploaded_images
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;


-- ── 20. Reporting projections for the admin consoles ──────────────────
--
-- admin, dev, moe, owner and superadmin are 1,243 lines of read-only
-- reporting: counts by role, sign-ups per week, who is suspended. Their
-- SQL is the clearest thing about them, and rewriting every
-- `COUNT(*) FROM drafts` into a jsonb type filter would make it worse
-- while changing none of its meaning.
--
-- So the old names survive as VIEWS over the new tables. This is not a
-- compatibility hack kept out of laziness: a view IS the aligned answer
-- for a read-only projection, and it is the same data with no second
-- copy to drift.
--
-- Writes are NOT covered. A view across three tables is not
-- auto-updatable, so an UPDATE through `accounts` fails loudly rather
-- than silently doing nothing — and the two routes that write have been
-- pointed at the real tables instead.

CREATE OR REPLACE VIEW public.accounts AS
SELECT
  f.id, u.id AS user_id, u.id AS auth_uid,
  u.first_name, u.last_name, u.email, u.phone, u.avatar_url,
  u.role, u.sub_role, u.account_status AS status,
  u.onboarding_status, u.signup_provider, u.locale,
  u.last_login_at, u.last_login_ip, u.active_session_id,
  f.faculty_code, f.staff_id,
  f.expertise AS majors, f.eligible_grades AS grade_levels,
  f.languages, f.qualification, f.nationality, f.bio,
  f.years_experience, f.hire_date, f.organization, f.school_id,
  -- Gone from the schema; classes replaced them. Kept as typed NULLs so
  -- a console that still selects one gets a null column instead of 42703.
  NULL::text[] AS sections,
  NULL::jsonb  AS class_map,
  NULL::jsonb  AS grade_sections,
  s.plan AS subscription_plan,
  s.status AS subscription_status,
  COALESCE(s.current_period_end, s.trial_ends_at) AS subscription_ends_at,
  f.created_at, f.updated_at,
  -- Appended, not inserted: CREATE OR REPLACE VIEW may only add columns
  -- at the end, and renaming one in place fails with a confusing error.
  u.permissions
FROM faculty f
JOIN users u ON u.id = f.user_id
LEFT JOIN subscriptions s ON s.faculty_id = f.id;

-- The five content types, as the five tables they used to be. account_id
-- is exposed alongside faculty_id because that is the column every
-- console query names.
DO $$
DECLARE
  v record;
BEGIN
  FOR v IN SELECT * FROM (VALUES
      ('drafts', 'lesson_plan'), ('quizzes', 'quiz'), ('homework', 'homework'),
      ('presentations', 'presentation'), ('activities', 'activity'),
      ('templates', 'template')
    ) AS t(name, kind)
  LOOP
    EXECUTE format($v$
      CREATE OR REPLACE VIEW public.%I AS
      SELECT a.id,
             a.faculty_id, a.faculty_id AS account_id,
             a.status, a.created_at, a.updated_at, a.updated_at AS last_edited,
             a.deleted_at, a.content,
             a.content->>'title'   AS title,
             a.content->>'name'    AS name,
             a.content->>'subject' AS subject,
             a.content->>'grade'   AS grade,
             a.content->>'section' AS section
        FROM ai_studio a
       WHERE a.type = %L AND a.deleted_at IS NULL
    $v$, v.name, v.kind);
  END LOOP;
END $$;

CREATE OR REPLACE VIEW public.account_schools AS
SELECT faculty_id AS account_id, faculty_id, school_id, is_primary, grade_sections, created_at
  FROM faculty_schools;


-- ── 21. Per-account permission overrides ──────────────────────────────
-- The superadmin console grants capabilities beyond a role. On the user,
-- not the faculty row: it is the person who is trusted, and the grant
-- should survive them ceasing to teach.
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions jsonb;


-- ── 22. Pre-signup email verification ─────────────────────────────────
--
-- Kept, not dropped as obsolete. GoTrue has its own OTP, but this one
-- runs BEFORE an account exists — the sign-up form proves the address
-- before provisioning anything, and the frontend still calls
-- /api/auth/email-verify/send and /check.
--
-- Codes are bcrypt hashes, never the digits, so a read of this table
-- does not let anyone complete someone else's sign-up.
CREATE TABLE IF NOT EXISTS public.email_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  code_hash   text NOT NULL,
  expires_at  timestamptz NOT NULL,
  attempts    integer NOT NULL DEFAULT 0,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
-- The lookup is "newest code for this address".
CREATE INDEX IF NOT EXISTS email_verifications_lookup_idx
  ON public.email_verifications (email, created_at DESC);

-- No policy: RLS on with none denies every client outright. Codes are
-- issued and redeemed by the API over the pooler connection, and there
-- is no version of this table a browser should ever read.
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
