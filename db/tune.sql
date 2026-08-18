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

-- When the period being counted down actually BEGAN.
--
-- Without it a subscription is only an end date, so "22 days left" has
-- nothing behind it: no paid date, no way to show how far through the
-- month a teacher is, and no way to tell a stale row from a fresh one.
-- Backfilled a month behind the end date, which is the period every
-- existing row was created with.
ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS current_period_start timestamptz;

UPDATE public.subscriptions
   SET current_period_start = current_period_end - INTERVAL '1 month'
 WHERE current_period_start IS NULL
   AND current_period_end IS NOT NULL;


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


-- ── 8b. What each bucket will accept ──────────────────────────────────
--
-- The buckets were created in the dashboard, so their limits live only
-- there — and `imports` was set up for the CSV roster importer: csv,
-- excel and images. The Goal planner and the studio's material attach
-- then shipped, both of which upload a syllabus or a textbook into the
-- same bucket, and storage refused every one of them with "mime type
-- application/pdf is not supported" — under a field whose own label
-- reads "Syllabus or textbook — optional, PDFs".
--
-- Set here so the bucket agrees with the product, and so a fresh project
-- comes up able to accept the files the UI offers to take. The size
-- limit matches the 25 MB the studio composer already enforces in the
-- browser; a real textbook does not fit in ten.
UPDATE storage.buckets
   SET allowed_mime_types = ARRAY[
         'text/csv',
         'application/vnd.ms-excel',
         'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
         'image/png', 'image/jpeg', 'image/webp', 'image/gif',
         'application/pdf',
         'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
         'application/msword',
         'text/plain'
       ],
       file_size_limit = 26214400
 WHERE id = 'imports';


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


-- ── 19b. The bulletin board ───────────────────────────────────────────
--
-- Notices a teacher pins up for a class: a field-trip reminder, exam
-- week, a birthday. Same argument as section 11: a post is a fact about
-- the class, not generated work, so it does not belong in ai_studio —
-- and its vocabulary (published, pinned, expires) would collide with
-- the generation lifecycle CHECK there.
--
-- Audience is grade + section text, matching schedule_entries: null
-- means the whole board, and the forms offer only what this teacher
-- actually teaches.
CREATE TABLE IF NOT EXISTS public.bulletin_posts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  title      text NOT NULL,
  body       text,
  kind       text NOT NULL DEFAULT 'notice',
  status     text NOT NULL DEFAULT 'published',
  pinned     boolean NOT NULL DEFAULT false,
  grade      text,
  section    text,
  event_on   date,
  expires_on date,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS bulletin_faculty_idx
  ON public.bulletin_posts (faculty_id, created_at DESC);

-- The section-8 vocabulary driver has already run by the time this table
-- exists on a fresh database, so its checks live here instead.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'bulletin_posts_kind_check'
                   AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.bulletin_posts ADD CONSTRAINT bulletin_posts_kind_check
      CHECK (kind IN ('notice','event','reminder','celebration'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'bulletin_posts_status_check'
                   AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.bulletin_posts ADD CONSTRAINT bulletin_posts_status_check
      CHECK (status IN ('published','archived'));
  END IF;
END $$;

ALTER TABLE public.bulletin_posts ENABLE ROW LEVEL SECURITY;
-- Transient: section 27 drops every policy on this table and installs
-- the device + subscription gated set. This one covers the window in
-- between, mirroring uploaded_images above.
DROP POLICY IF EXISTS bulletin_posts_owner ON public.bulletin_posts;
CREATE POLICY bulletin_posts_owner ON public.bulletin_posts
  FOR ALL TO authenticated
  USING (faculty_id = current_faculty_id()) WITH CHECK (faculty_id = current_faculty_id());
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'public.bulletin_posts'::regclass
                   AND tgname = 'set_updated_at' AND NOT tgisinternal) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.bulletin_posts
      FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;


-- ── 19b². Bulletin attachments and the class share link ───────────────
--
-- media: what is pinned to a note besides words — photos, a clip, a
-- voice message. A jsonb array of {type, path, url, name, mime, size,
-- duration} rather than a join table, because the attachments live and
-- die with their post and are never queried on their own.
ALTER TABLE public.bulletin_posts
  ADD COLUMN IF NOT EXISTS media jsonb NOT NULL DEFAULT '[]'::jsonb;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'bulletin_posts_media_check'
                   AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.bulletin_posts ADD CONSTRAINT bulletin_posts_media_check
      CHECK (jsonb_typeof(media) = 'array');
  END IF;
END $$;

-- The files live in their own PUBLIC bucket, unlike the five private
-- ones in section 9. Board media is announcement material and the same
-- bytes are read by students over an unauthenticated share link, so the
-- URLs must resolve without a session. Writes keep the own-folder rule:
-- a path must begin with the uploader's own uid.
INSERT INTO storage.buckets (id, name, public)
VALUES ('bulletin-media', 'bulletin-media', true)
ON CONFLICT (id) DO UPDATE SET public = true;

DROP POLICY IF EXISTS bulletin_media_own_folder ON storage.objects;
CREATE POLICY bulletin_media_own_folder ON storage.objects
  FOR ALL TO authenticated
  USING      (bucket_id = 'bulletin-media' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text))
  WITH CHECK (bucket_id = 'bulletin-media' AND (storage.foldername(name))[1] = (SELECT auth.uid()::text));

-- The share link: one row per teacher, minted on first use. The
-- unguessable token IS the authorisation — a student with the link needs
-- no account, which is the only arrangement that works for a class of
-- nine-year-olds.
CREATE TABLE IF NOT EXISTS public.bulletin_shares (
  faculty_id uuid PRIMARY KEY REFERENCES public.faculty(id) ON DELETE CASCADE,
  token      uuid NOT NULL UNIQUE DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.bulletin_shares ENABLE ROW LEVEL SECURITY;
-- Not in the section-27 driver on purpose: reading your own token must
-- keep working from a superseded device or a lapsed plan — the board
-- link students already hold does not stop resolving, so the screen
-- that shows it should not pretend otherwise.
DROP POLICY IF EXISTS bulletin_shares_owner ON public.bulletin_shares;
CREATE POLICY bulletin_shares_owner ON public.bulletin_shares
  FOR ALL TO authenticated
  USING (faculty_id = current_faculty_id()) WITH CHECK (faculty_id = current_faculty_id());

-- What a student sees behind the token: published, unexpired posts only.
-- SECURITY DEFINER because anon has no row access to bulletin_posts or
-- users — this function is the entire public surface of the board, and
-- it never returns drafts, the archive, or anything expired.
CREATE OR REPLACE FUNCTION public.bulletin_board_public(share_token uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT jsonb_build_object(
    'teacher', (
      SELECT COALESCE(
               NULLIF(TRIM(CONCAT(u.first_name, ' ', u.last_name)), ''),
               u.full_name
             )
        FROM bulletin_shares s
        JOIN faculty f ON f.id = s.faculty_id
        LEFT JOIN users u ON u.id = f.user_id
       WHERE s.token = share_token
    ),
    'known', EXISTS (SELECT 1 FROM bulletin_shares s WHERE s.token = share_token),
    'posts', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
               'id', p.id, 'title', p.title, 'body', p.body, 'kind', p.kind,
               'pinned', p.pinned, 'grade', p.grade, 'section', p.section,
               'event_on', p.event_on, 'media', p.media,
               'created_at', p.created_at, 'updated_at', p.updated_at
             ) ORDER BY p.pinned DESC, p.created_at DESC)
        FROM bulletin_posts p
        JOIN bulletin_shares s ON s.faculty_id = p.faculty_id
       WHERE s.token = share_token
         AND p.status = 'published'
         AND (p.expires_on IS NULL OR p.expires_on >= CURRENT_DATE)
    ), '[]'::jsonb)
  );
$$;
REVOKE ALL ON FUNCTION public.bulletin_board_public(uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.bulletin_board_public(uuid) TO anon, authenticated;


-- ── 19c. Where each teaching skill applies ────────────────────────────
--
-- A skill profile can shape generation for several classes, and one
-- class can draw on several skills for different subjects — so this is
-- a join table, not a column. grade/section/subject use the same
-- audience vocabulary as the scheduler and the bulletin board (NULL =
-- any). The generator reads it server-side to pick which profiles
-- ground a request; the browser owns the rows like any teacher data.

CREATE TABLE IF NOT EXISTS public.skill_assignments (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  skill_id   uuid NOT NULL REFERENCES public.teaching_skills(id) ON DELETE CASCADE,
  faculty_id uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  grade      text,
  section    text,
  subject    text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS skill_assignments_skill_idx
  ON public.skill_assignments (skill_id);
CREATE INDEX IF NOT EXISTS skill_assignments_faculty_idx
  ON public.skill_assignments (faculty_id);
-- The same combination twice on one skill says nothing new — refuse it
-- at the source rather than trusting every client to check first.
CREATE UNIQUE INDEX IF NOT EXISTS skill_assignments_combo_unique
  ON public.skill_assignments
  (skill_id, COALESCE(grade, ''), COALESCE(section, ''), COALESCE(subject, ''));

ALTER TABLE public.skill_assignments ENABLE ROW LEVEL SECURITY;
-- Transient: section 27 replaces this with the device + subscription
-- gated set, same as every other owner table.
DROP POLICY IF EXISTS skill_assignments_owner ON public.skill_assignments;
CREATE POLICY skill_assignments_owner ON public.skill_assignments
  FOR ALL TO authenticated
  USING (faculty_id = current_faculty_id()) WITH CHECK (faculty_id = current_faculty_id());
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_trigger
                 WHERE tgrelid = 'public.skill_assignments'::regclass
                   AND tgname = 'set_updated_at' AND NOT tgisinternal) THEN
    CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.skill_assignments
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


-- ── 23. Credits for teachers who already existed ──────────────────────
--
-- The balance is created alongside the faculty row now, but that path
-- only runs on FIRST sign-in — every teacher provisioned before it
-- landed has no credits row at all. A missing row is not zero: the join
-- yields null, which the studio reads as "unknown" and shows as blank.
--
-- Subscriptions have the same shape of hole for the same reason, so both
-- are filled here.
INSERT INTO public.credits (faculty_id, balance, monthly_allowance)
SELECT f.id, 200, 200
  FROM faculty f
 WHERE NOT EXISTS (SELECT 1 FROM credits c WHERE c.faculty_id = f.id);

INSERT INTO public.subscriptions (faculty_id, plan, status, trial_ends_at)
SELECT f.id, 'trial', 'trialing', now() + INTERVAL '14 days'
  FROM faculty f
 WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.faculty_id = f.id);


-- ── 24. Write policies for going direct to Supabase ───────────────────
--
-- With the API removed, the browser writes to Postgres itself, so a
-- table the teacher edits needs an owner policy for INSERT/UPDATE/DELETE
-- and not only SELECT. ai_studio had a read policy alone — every lesson
-- plan, quiz and piece of homework was unwritable from the client.
--
-- What deliberately does NOT get one, and this is the whole security
-- argument for going direct at all:
--
--   credits        a teacher must not be able to top up their own balance
--   subscriptions  nor extend their own plan
--   usage_logs     nor edit the record of what they spent
--   feature_flags  nor turn on a feature that is off for them
--   audit_log      nor touch the trail (RLS on, no policy: denies all)
--
-- Those five stay server-written. They are the reason the separate
-- backend still exists after this migration, and the reason it needs a
-- service role while the browser does not.
DROP POLICY IF EXISTS ai_studio_owner_write ON public.ai_studio;
CREATE POLICY ai_studio_owner_write ON public.ai_studio
  FOR ALL TO authenticated
  USING (faculty_id = current_faculty_id())
  WITH CHECK (faculty_id = current_faculty_id());

-- The catalog grows from the "my school isn't listed" fallback during
-- sign-up, so a teacher may ADD one. They may not edit or remove one —
-- that would let anybody rename a school every other teacher picked.
DROP POLICY IF EXISTS schools_insert ON public.schools;
CREATE POLICY schools_insert ON public.schools
  FOR INSERT TO authenticated
  WITH CHECK (true);


-- ── 25. Attendance idempotence PostgREST can actually use ─────────────
--
-- Taking the register twice must correct it, not double it. That was two
-- partial unique indexes — one for a mark tied to a timetable slot, one
-- for a mark tied only to a day — because NULL never equals NULL, so a
-- plain UNIQUE over a nullable schedule_id would not have caught the
-- day-only case at all.
--
-- Correct, and unusable from the client: ON CONFLICT cannot target a
-- partial index unless the statement repeats its predicate, and
-- PostgREST's upsert only names columns. Every register mark failed with
-- "no unique or exclusion constraint matching the ON CONFLICT
-- specification".
--
-- So the NULL is removed from the key instead. A generated column folds
-- "no session" into a fixed uuid, and one ordinary UNIQUE constraint
-- then covers both cases — which ON CONFLICT can name.
ALTER TABLE public.attendance
  ADD COLUMN IF NOT EXISTS schedule_key uuid
  GENERATED ALWAYS AS (COALESCE(schedule_id, '00000000-0000-0000-0000-000000000000'::uuid)) STORED;

DROP INDEX IF EXISTS public.attendance_student_session_key;
DROP INDEX IF EXISTS public.attendance_student_day_key;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'attendance_once_per_session'
                   AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.attendance
      ADD CONSTRAINT attendance_once_per_session
      UNIQUE (student_id, date, schedule_key);
  END IF;
END $$;


-- ── 26. A teacher may mark the work they set ──────────────────────────
--
-- quiz_attempts allowed writes only from the student the attempt belongs
-- to. That is right for a student sitting a quiz, and it made grading
-- impossible: a teacher recording a homework mark got a policy violation
-- on their own class's work.
--
-- The rule is ownership of the WORK, not of the attempt: you may write an
-- attempt if it belongs to an assignment of an artifact you created.
-- Scoped through assignments rather than by faculty_id on the row itself,
-- because an attempt has no owner column and adding one would let the two
-- disagree.
DROP POLICY IF EXISTS quiz_attempts_teacher_write ON public.quiz_attempts;
CREATE POLICY quiz_attempts_teacher_write ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM assignments asg
        JOIN ai_studio a ON a.id = asg.generation_id
       WHERE asg.id = quiz_attempts.assignment_id
         AND a.faculty_id = current_faculty_id()
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM assignments asg
        JOIN ai_studio a ON a.id = asg.generation_id
       WHERE asg.id = quiz_attempts.assignment_id
         AND a.faculty_id = current_faculty_id()
    )
  );


-- ═══════════════════════════════════════════════════════════════════════
-- 27. The two gates that used to live in Express middleware
--
-- With no API in front of Postgres, "is this the current device" and "are
-- you paid up" have to be asked by the database or not at all. Both are
-- now RLS predicates.
--
-- The shape of the answer matters as much as the answer:
--
--   READS are never blocked by an expired subscription. A teacher whose
--   card failed must still be able to open, export and print a term's
--   lesson plans. Holding someone's own work hostage over a payment is
--   both hostile and, in several jurisdictions, unlawful.
--
--   WRITES are. That is the actual product boundary.
--
--   BOTH are blocked by a superseded device, because sharing one account
--   across a staffroom is exactly what single-device sign-in exists to
--   stop, and reading is most of what would be shared.
-- ═══════════════════════════════════════════════════════════════════════

-- ── the device check ──────────────────────────────────────────────────
--
-- Every Supabase access token carries a `session_id` claim, distinct per
-- sign-in. So the device key is already in the JWT and needs no custom
-- header: the browser cannot forge it, because the token is signed.
--
-- NULL active_session_id means "not claimed" and is allowed through —
-- accounts that predate this, and the moment between signing in and
-- claiming, must not be locked out of their own data.
CREATE OR REPLACE FUNCTION public.is_current_device()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (
      SELECT u.active_session_id IS NULL
          OR u.active_session_id = (auth.jwt() ->> 'session_id')
        FROM users u
       WHERE u.id = (SELECT auth.uid())
    ),
    -- No users row yet: sign-up is mid-flight. Let it through; there is
    -- nothing to protect and blocking it would break provisioning.
    true
  );
$$;

-- ── the subscription check ────────────────────────────────────────────
--
-- SECURITY DEFINER on purpose. Called from a policy on a table whose own
-- policy calls current_faculty_id(), an invoker-rights function reading
-- subscriptions would re-enter RLS and recurse. Running as owner reads
-- the row directly and terminates.
--
-- Three deliberate leniencies:
--   past_due counts as active — a failed retry is not a cancellation,
--     and locking a paying customer out over a late webhook is a worse
--     failure than a few days of unpaid access
--   a NULL end date is open-ended, not expired (admin extensions)
--   three days of grace past the end date, for the same reason
CREATE OR REPLACE FUNCTION public.subscription_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    -- Privileged roles do not pay, so the gate must not apply to them.
    EXISTS (
      SELECT 1 FROM users u
       WHERE u.id = (SELECT auth.uid())
         AND u.role IN ('dev', 'super_admin', 'admin', 'owner', 'moe')
    )
    OR EXISTS (
      SELECT 1 FROM subscriptions s
       WHERE s.faculty_id = current_faculty_id()
         AND s.status IN ('trialing', 'active', 'past_due')
         AND (
           COALESCE(s.current_period_end, s.trial_ends_at) IS NULL
           OR COALESCE(s.current_period_end, s.trial_ends_at) > now() - INTERVAL '3 days'
         )
    );
$$;

GRANT EXECUTE ON FUNCTION public.is_current_device()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.subscription_active() TO authenticated;


-- ── applying the gates ────────────────────────────────────────────────
--
-- One owner expression per table, then four policies built from it:
-- SELECT gated on device only, and INSERT/UPDATE/DELETE gated on device
-- AND subscription. Generated rather than written out because eleven
-- tables x four policies is forty-four chances to mistype an ownership
-- clause, and they must all say the same thing.
--
-- NOT gated, and each for a reason:
--   users, faculty        a superseded or lapsed teacher must still be
--                         able to read their own account — it is how the
--                         app knows what to tell them
--   subscriptions,
--   credits               same: the screen that says "your plan ended"
--                         has to be able to read that it ended
--   notifications         system-addressed, and the bell explaining the
--                         lockout is itself a notification
--   onboarding_documents  written during sign-up, before there is a
--                         subscription to check
--   chatbot_*             the assistant should still answer "why can I
--                         not save anything"
DO $$
DECLARE
  t record;
  pol record;
  own text;
BEGIN
  FOR t IN
    SELECT * FROM (VALUES
      ('ai_studio',         'faculty_id = current_faculty_id()'),
      ('materials',         'faculty_id = current_faculty_id()'),
      ('schedule_entries',  'faculty_id = current_faculty_id()'),
      ('attendance',        'faculty_id = current_faculty_id()'),
      ('student_grades',    'faculty_id = current_faculty_id()'),
      ('classes',           'faculty_id = current_faculty_id()'),
      ('goals',             'faculty_id = current_faculty_id()'),
      ('teaching_skills',   'faculty_id = current_faculty_id()'),
      ('skill_assignments', 'faculty_id = current_faculty_id()'),
      ('uploaded_images',   'faculty_id = current_faculty_id()'),
      ('bulletin_posts',    'faculty_id = current_faculty_id()'),
      ('faculty_schools',   'faculty_id = current_faculty_id()'),
      ('students',
       'created_by = current_faculty_id() OR EXISTS (SELECT 1 FROM class_members cm JOIN classes c ON c.id = cm.class_id WHERE cm.student_id = students.id AND c.faculty_id = current_faculty_id())'),
      ('class_members',
       'EXISTS (SELECT 1 FROM classes c WHERE c.id = class_members.class_id AND c.faculty_id = current_faculty_id())'),
      ('assignments',
       'EXISTS (SELECT 1 FROM classes c WHERE c.id = assignments.class_id AND c.faculty_id = current_faculty_id())'),
      ('invitations',
       'EXISTS (SELECT 1 FROM classes c WHERE c.id = invitations.class_id AND c.faculty_id = current_faculty_id())')
    ) AS v(tbl, owner)
  LOOP
    CONTINUE WHEN to_regclass('public.' || t.tbl) IS NULL;
    own := t.owner;

    -- Drop EVERY policy on the table, by enumeration rather than by name.
    --
    -- Naming them was a real bug and a quiet one: policies are OR'd, so a
    -- survivor from the original schema — ai_studio_owner_read,
    -- students_own — silently granted what the new gates were written to
    -- refuse. A superseded device still read every lesson plan, and the
    -- policy list looked correct unless you counted it.
    FOR pol IN SELECT policyname FROM pg_policies
                WHERE schemaname = 'public' AND tablename = t.tbl
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', pol.policyname, t.tbl);
    END LOOP;

    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING ((%s) AND is_current_device())',
      t.tbl || '_read', t.tbl, own);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR INSERT TO authenticated WITH CHECK ((%s) AND is_current_device() AND subscription_active())',
      t.tbl || '_ins', t.tbl, own);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR UPDATE TO authenticated USING ((%s) AND is_current_device() AND subscription_active()) WITH CHECK ((%s) AND is_current_device() AND subscription_active())',
      t.tbl || '_upd', t.tbl, own, own);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR DELETE TO authenticated USING ((%s) AND is_current_device() AND subscription_active())',
      t.tbl || '_del', t.tbl, own);
  END LOOP;
END $$;

-- quiz_attempts keeps its two audiences: a student writing their own
-- attempt, and the teacher who set the work marking it. Both are gated,
-- and every prior policy goes first for the reason above.
DO $$
DECLARE pol record;
BEGIN
  FOR pol IN SELECT policyname FROM pg_policies
              WHERE schemaname = 'public' AND tablename = 'quiz_attempts'
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.quiz_attempts', pol.policyname);
  END LOOP;
END $$;

-- A student reads and writes their own attempt.
CREATE POLICY quiz_attempts_student ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (student_id = current_student_id())
  WITH CHECK (student_id = current_student_id());

CREATE POLICY quiz_attempts_teacher_write ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (
    is_current_device() AND EXISTS (
      SELECT 1 FROM assignments asg JOIN ai_studio a ON a.id = asg.generation_id
       WHERE asg.id = quiz_attempts.assignment_id AND a.faculty_id = current_faculty_id())
  )
  WITH CHECK (
    is_current_device() AND subscription_active() AND EXISTS (
      SELECT 1 FROM assignments asg JOIN ai_studio a ON a.id = asg.generation_id
       WHERE asg.id = quiz_attempts.assignment_id AND a.faculty_id = current_faculty_id())
  );


-- ── 28. Provisioning, as a trigger instead of an endpoint ─────────────
--
-- Signing up used to POST /api/auth/supabase, which created users,
-- faculty, credits and subscriptions in one transaction. The browser
-- cannot do that itself: it may write its own users and faculty rows,
-- but credits and subscriptions are deliberately read-only — a teacher
-- must not be able to grant themselves a balance or a plan.
--
-- So the database does it. Creating a faculty row is the signal, and
-- everything a new teacher is entitled to follows from it. SECURITY
-- DEFINER, so it writes tables the caller cannot.
--
-- This makes the plan non-negotiable at sign-up, which is correct:
-- everyone starts on the same trial, and moving to a paid plan is a
-- payment, not a field on a form.
CREATE OR REPLACE FUNCTION public.provision_faculty()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO credits (faculty_id, balance, monthly_allowance)
  VALUES (NEW.id, 200, 200)
  ON CONFLICT (faculty_id) DO NOTHING;

  INSERT INTO subscriptions (faculty_id, plan, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trialing', now() + INTERVAL '7 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a sign-up over the entitlement rows. A teacher with no
  -- credits row is recoverable; a teacher who could not create an
  -- account at all is not.
  RAISE WARNING 'provision_faculty: %', SQLERRM;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS provision_on_faculty ON public.faculty;
CREATE TRIGGER provision_on_faculty
  AFTER INSERT ON public.faculty
  FOR EACH ROW EXECUTE FUNCTION public.provision_faculty();

-- credits had no primary key on faculty_id in every deployment; the
-- ON CONFLICT above needs one to be a no-op rather than an error.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.credits'::regclass AND contype IN ('p','u')
  ) THEN
    ALTER TABLE public.credits ADD PRIMARY KEY (faculty_id);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'subscriptions_faculty_unique' AND connamespace = 'public'::regnamespace
  ) THEN
    ALTER TABLE public.subscriptions ADD CONSTRAINT subscriptions_faculty_unique UNIQUE (faculty_id);
  END IF;
END $$;


-- ── 29. Studio conversations ──────────────────────────────────────────
--
-- The AI Studio is a chat now, and a chat a teacher cannot return to is
-- a chat that loses their work. Its threads live in the tables the
-- assistant already uses, separated by page_scope = 'studio'.
--
-- Two columns the assistant never needed:
--
--   title     what the history list shows. Derived from the first
--             message, but stored rather than recomputed — the first
--             message can be edited away, and a list whose labels shift
--             under the reader is worse than one that is slightly stale.
--
--   artifact  the structured result: a deck's slides, a quiz's
--             questions. Reconstructing those by re-parsing markdown on
--             every load would be lossy in exactly the cases the viewers
--             exist for, and re-generating them would cost a model call
--             to recover something already produced.
ALTER TABLE public.chatbot_sessions ADD COLUMN IF NOT EXISTS title text;
ALTER TABLE public.chatbot_messages ADD COLUMN IF NOT EXISTS kind     text;
ALTER TABLE public.chatbot_messages ADD COLUMN IF NOT EXISTS artifact jsonb;

-- The history list is "my studio threads, newest first".
CREATE INDEX IF NOT EXISTS chatbot_sessions_scope_idx
  ON public.chatbot_sessions (user_id, page_scope, updated_at DESC);


-- ═══════════════════════════════════════════════════════════════════════
-- 30. The super admin, as a database surface
--
-- The privileged consoles (admin / super_admin) used to be endpoints on
-- the separate backend, reachable only because that service holds a
-- service-role key that bypasses RLS. This section moves the whole
-- super-admin surface INTO the database, as SECURITY DEFINER functions —
-- the same mechanism bulletin_board_public() and provision_faculty()
-- already use to cross RLS for one specific, audited purpose.
--
-- Why this is safe without a service key in the browser:
--
--   * Every function's FIRST act is to check is_super_admin(), which
--     reads the caller's OWN role from users. A teacher's token cannot
--     make that return true, so a teacher calling sa_set_role() is
--     rejected by the function body, not by hoping the UI hid the button.
--   * The functions run as their owner (which owns the tables), so inside
--     the guard they read every tenant's rows and write the five tables
--     the browser is otherwise forbidden — credits, subscriptions,
--     feature_flags, audit_log, and cross-account users. Outside the
--     guard they do nothing.
--   * audit_log stays unwritable from the client (RLS on, no policy).
--     The only writer is sa_write_audit() below, called from inside each
--     mutating function, so the trail records who did what and cannot be
--     edited by the subject.
--
-- The reason the separate backend still exists after this is the handful
-- of operations a definer function genuinely cannot do: creating an
-- auth.users row (needs the GoTrue admin key) and hard-deleting an
-- account. Those fall through to the backend; everything else is here.
-- ═══════════════════════════════════════════════════════════════════════

-- ── the role vocabulary the application actually assigns ───────────────
--
-- users_role_check was written (§8) before the role pyramid was read off
-- role.ts: it allowed ('teacher','student','school_admin','superadmin')
-- and would reject every value the app assigns — 'super_admin' (with the
-- underscore), 'dev', 'admin', 'moe', 'owner'. Widen it to the UNION of
-- both vocabularies so no existing row is invalidated and the app can set
-- the real roles. NULL stays allowed (a brand-new account before a role
-- is decided). Same drop-and-recreate §13 uses for the plan check.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'users_role_check'
               AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.users DROP CONSTRAINT users_role_check;
  END IF;
  ALTER TABLE public.users ADD CONSTRAINT users_role_check CHECK (
    role IN (
      -- the pyramid the app assigns
      'teacher','dev','super_admin','admin','moe','owner',
      -- legacy values that may already sit in rows
      'student','school_admin','superadmin'
    )
  );
END $$;


-- ── is the caller a platform operator? ────────────────────────────────
--
-- SECURITY DEFINER so it reads users regardless of the device / owner
-- gates on that table. `dev` is included on purpose: dev is the universal
-- inspector and reaches every console (see portal.ts). No argument, no
-- client input — the answer comes only from the caller's own row.
CREATE OR REPLACE FUNCTION public.is_super_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
     WHERE u.id = (SELECT auth.uid())
       AND u.role IN ('super_admin', 'dev')
  );
$$;
GRANT EXECUTE ON FUNCTION public.is_super_admin() TO authenticated;

-- Refuse anyone who is not a platform operator. Raised with errcode 42501
-- (insufficient_privilege) so PostgREST answers 403 and the app's
-- apiClient surfaces it as a clean "forbidden" rather than a 500.
CREATE OR REPLACE FUNCTION public.sa_require()
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'super admin only' USING ERRCODE = '42501';
  END IF;
END $$;
GRANT EXECUTE ON FUNCTION public.sa_require() TO authenticated;

-- ── delegated sub-admins ──────────────────────────────────────────────
--
-- A super admin can make someone an `admin` and grant them a SUBSET of the
-- platform controls. The grant lives in users.permissions (the same JSONB
-- the drawer already edits), keyed on capabilities:
--
--   admin.dashboard  platform analytics (dashboard, students, orgs)
--   admin.accounts   the accounts console — view, suspend, role, delete
--   admin.billing    credits & subscriptions
--   admin.platform   feature flags & credit costs
--
-- dev / super_admin always pass. A plain teacher/student never does. An
-- admin passes for a capability they were granted, or its default:
-- dashboard + accounts are on out of the box (an admin manages accounts);
-- billing and platform are off until explicitly granted. Keep these
-- defaults in step with ROLE_DEFAULTS.admin in src/lib/permissions.js.
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM users u
     WHERE u.id = (SELECT auth.uid())
       AND u.role IN ('super_admin', 'dev', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.admin_can(p_cap text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE r text; perms jsonb;
BEGIN
  IF public.is_super_admin() THEN RETURN true; END IF;
  SELECT role, permissions INTO r, perms FROM users WHERE id = (SELECT auth.uid());
  IF r <> 'admin' THEN RETURN false; END IF;
  RETURN COALESCE(
    (perms ->> p_cap)::boolean,
    p_cap IN ('admin.dashboard', 'admin.accounts')  -- admin role defaults
  );
END $$;

CREATE OR REPLACE FUNCTION public.admin_can_any(p_caps text[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT public.is_super_admin()
      OR EXISTS (SELECT 1 FROM unnest(p_caps) c WHERE public.admin_can(c));
$$;

-- Guard: pass if the caller holds the capability, else 403.
CREATE OR REPLACE FUNCTION public.sa_gate(p_cap text)
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.admin_can(p_cap) THEN
    RAISE EXCEPTION 'not authorized for %', p_cap USING ERRCODE = '42501';
  END IF;
END $$;

-- Guard: pass if the caller holds ANY of the capabilities (shared reads).
CREATE OR REPLACE FUNCTION public.sa_gate_any(p_caps text[])
RETURNS void
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.admin_can_any(p_caps) THEN
    RAISE EXCEPTION 'not authorized' USING ERRCODE = '42501';
  END IF;
END $$;

GRANT EXECUTE ON FUNCTION public.is_platform_admin()     TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_can(text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_can_any(text[])   TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_gate(text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_gate_any(text[])     TO authenticated;

-- The one writer of audit_log. VOLATILE, DEFINER — reaches the table the
-- client cannot. actor is always the caller; the subject cannot forge it.
CREATE OR REPLACE FUNCTION public.sa_write_audit(
  p_action text, p_entity text, p_entity_id uuid, p_meta jsonb
)
RETURNS void
LANGUAGE sql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  INSERT INTO audit_log (actor_id, action, entity, entity_id, meta)
  VALUES ((SELECT auth.uid()), p_action, p_entity, p_entity_id, p_meta);
$$;
-- Not granted to clients directly: it is only ever called from inside the
-- guarded functions below, which run as owner.


-- ── the faculty id → user id bridge the writes need ───────────────────
--
-- The console keys every action on the ACCOUNT id, which is the faculty
-- row id (accounts.id = faculty.id). Role, status and permissions live on
-- users, so a write has to hop faculty → user first. One helper rather
-- than the same subquery in six places.
CREATE OR REPLACE FUNCTION public.sa_user_of(p_faculty uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT user_id FROM faculty WHERE id = p_faculty;
$$;


-- ── reads ─────────────────────────────────────────────────────────────

-- /api/admin/stats
CREATE OR REPLACE FUNCTION public.sa_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate_any(ARRAY['admin.accounts','admin.dashboard']);
  SELECT jsonb_build_object(
    'active_teachers',    count(*) FILTER (WHERE role = 'teacher' AND COALESCE(status,'active') = 'active'),
    'suspended_teachers', count(*) FILTER (WHERE role = 'teacher' AND status = 'suspended'),
    'total_teachers',     count(*) FILTER (WHERE role = 'teacher'),
    'lapsed',             count(*) FILTER (
                            WHERE role = 'teacher'
                              AND (subscription_status IS NULL
                                   OR subscription_status IN ('expired','canceled')
                                   OR (subscription_ends_at IS NOT NULL
                                       AND subscription_ends_at < now())))
  ) INTO out
  FROM public.accounts;
  RETURN out;
END $$;

-- /api/admin/teachers  — every account, newest first. The console filters
-- by role client-side, so this returns all of them, not only teachers.
CREATE OR REPLACE FUNCTION public.sa_accounts()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate_any(ARRAY['admin.accounts','admin.dashboard']);
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.created_at DESC), '[]'::jsonb) INTO out
  FROM (
    SELECT id, user_id, first_name, last_name, email, role, sub_role, status,
           staff_id, last_login_at, created_at,
           subscription_plan, subscription_status, subscription_ends_at
      FROM public.accounts
  ) t;
  RETURN out;
END $$;

-- /api/superadmin/account/:id — one account, with content footprint,
-- schools and the permission override map for the drawer.
CREATE OR REPLACE FUNCTION public.sa_account(p_faculty uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate_any(ARRAY['admin.accounts','admin.dashboard']);
  SELECT to_jsonb(a) - 'majors' - 'grade_levels'
         || jsonb_build_object(
              'permissions', COALESCE(u.permissions, '{}'::jsonb),
              'credits_balance', (SELECT balance FROM credits WHERE faculty_id = a.id),
              'credits_allowance', (SELECT monthly_allowance FROM credits WHERE faculty_id = a.id),
              'content', (
                SELECT COALESCE(jsonb_object_agg(label, n), '{}'::jsonb) FROM (
                  SELECT CASE type
                           WHEN 'lesson_plan'  THEN 'Lessons'
                           WHEN 'quiz'         THEN 'Quizzes'
                           WHEN 'homework'     THEN 'Homework'
                           WHEN 'presentation' THEN 'Presentations'
                           WHEN 'activity'     THEN 'Activities'
                           WHEN 'template'     THEN 'Templates'
                           ELSE type
                         END AS label,
                         count(*) AS n
                    FROM ai_studio
                   WHERE faculty_id = a.id AND deleted_at IS NULL
                   GROUP BY 1
                ) c
              ),
              'schools', (
                SELECT COALESCE(jsonb_agg(jsonb_build_object(
                         'id', s.id, 'name', s.name, 'emirate', s.emirate,
                         'is_primary', fs.is_primary)), '[]'::jsonb)
                  FROM faculty_schools fs JOIN schools s ON s.id = fs.school_id
                 WHERE fs.faculty_id = a.id
              )
            )
    INTO out
    FROM public.accounts a
    JOIN users u ON u.id = a.user_id
   WHERE a.id = p_faculty;
  IF out IS NULL THEN
    RAISE EXCEPTION 'account not found';
  END IF;
  RETURN out;
END $$;

-- /api/superadmin/overview — the whole dashboard object in one round trip.
CREATE OR REPLACE FUNCTION public.sa_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT jsonb_build_object(
    'accounts', jsonb_build_object(
      'total', (SELECT count(*) FROM accounts),
      'by_role', (SELECT COALESCE(jsonb_object_agg(role, n), '{}'::jsonb)
                    FROM (SELECT COALESCE(role,'teacher') AS role, count(*) n FROM accounts GROUP BY 1) r)
    ),
    'subscriptions', jsonb_build_object(
      'active',    (SELECT count(*) FROM accounts WHERE subscription_status = 'active'),
      'trial',     (SELECT count(*) FROM accounts WHERE subscription_status = 'trialing'),
      'expired',   (SELECT count(*) FROM accounts WHERE subscription_status IN ('expired','canceled')),
      'suspended', (SELECT count(*) FROM accounts WHERE status = 'suspended'),
      'ending_30d',(SELECT count(*) FROM accounts
                     WHERE subscription_ends_at IS NOT NULL
                       AND subscription_ends_at BETWEEN now() AND now() + INTERVAL '30 days')
    ),
    'revenue', (
      -- Monthly recurring, priced off src/lib/plans.js (per-month effective
      -- AED). Only genuinely-active paid plans count; trials are 0. The
      -- inner query is one row per plan (pm = that plan's monthly total);
      -- the outer sum is MRR, the object_agg is the by-plan breakdown.
      SELECT jsonb_build_object(
        'mrr', COALESCE(sum(pm), 0),
        'arr', COALESCE(sum(pm), 0) * 12,
        'by_plan', COALESCE(jsonb_object_agg(plan, pm) FILTER (WHERE pm > 0), '{}'::jsonb)
      )
      FROM (
        SELECT subscription_plan AS plan,
               sum(CASE subscription_plan
                     WHEN 'monthly'   THEN 29.99
                     WHEN 'quarterly' THEN 26.99
                     WHEN 'annual'    THEN 22.49
                     ELSE 0 END) AS pm
          FROM accounts
         WHERE subscription_status = 'active'
           AND subscription_plan IN ('monthly','quarterly','annual')
         GROUP BY subscription_plan
      ) p
    ),
    'activity', jsonb_build_object(
      'new_signups_7d',  (SELECT count(*) FROM accounts WHERE created_at > now() - INTERVAL '7 days'),
      'logged_in_today', (SELECT count(*) FROM users WHERE last_login_at::date = current_date)
    ),
    'content', (
      SELECT COALESCE(jsonb_object_agg(label, n), '{}'::jsonb) FROM (
        SELECT CASE type
                 WHEN 'lesson_plan'  THEN 'Lessons'
                 WHEN 'quiz'         THEN 'Quizzes'
                 WHEN 'homework'     THEN 'Homework'
                 WHEN 'presentation' THEN 'Presentations'
                 WHEN 'activity'     THEN 'Activities'
                 WHEN 'template'     THEN 'Templates'
                 ELSE type END AS label,
               count(*) AS n
          FROM ai_studio WHERE deleted_at IS NULL GROUP BY 1
        UNION ALL
        SELECT 'Students', count(*) FROM students
      ) c
    )
  ) INTO out;
  RETURN out;
END $$;

-- /api/superadmin/signups?days= — daily new accounts, gaps filled so the
-- line has a continuous x-axis. Derived from real created_at, not audit.
CREATE OR REPLACE FUNCTION public.sa_signups(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int := LEAST(GREATEST(COALESCE(p_days,30), 1), 365);
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'n', c) ORDER BY d), '[]'::jsonb)
    INTO out
  FROM (
    SELECT gs::date AS d,
           (SELECT count(*) FROM users u WHERE u.created_at::date = gs::date) AS c
      FROM generate_series(current_date - (n - 1), current_date, INTERVAL '1 day') gs
  ) s;
  RETURN out;
END $$;

-- /api/superadmin/logins?days= — daily auth events from the audit trail.
-- Sparse until record_auth_event() has run for a while; the chart shows a
-- flat baseline rather than erroring.
CREATE OR REPLACE FUNCTION public.sa_logins(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int := LEAST(GREATEST(COALESCE(p_days,30), 1), 365);
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT COALESCE(jsonb_agg(jsonb_build_object('day', to_char(d, 'YYYY-MM-DD'), 'n', c) ORDER BY d), '[]'::jsonb)
    INTO out
  FROM (
    SELECT gs::date AS d,
           (SELECT count(*) FROM audit_log a
             WHERE a.action IN ('auth.login','auth.signup')
               AND a.created_at::date = gs::date) AS c
      FROM generate_series(current_date - (n - 1), current_date, INTERVAL '1 day') gs
  ) s;
  RETURN out;
END $$;

-- /api/superadmin/recent-activity?limit= — the audit feed, actor joined in.
CREATE OR REPLACE FUNCTION public.sa_recent_activity(p_limit int DEFAULT 15)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int := LEAST(GREATEST(COALESCE(p_limit,15), 1), 100);
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO out
  FROM (
    SELECT a.id, a.action,
           a.entity    AS target_table,
           a.entity_id AS target_id,
           a.created_at,
           u.first_name, u.last_name, u.email
      FROM audit_log a
      LEFT JOIN users u ON u.id = a.actor_id
     ORDER BY a.created_at DESC
     LIMIT n
  ) t;
  RETURN out;
END $$;

-- /api/superadmin/flags — feature flags, for the toggle panel.
CREATE OR REPLACE FUNCTION public.sa_flags()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.platform');
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.key), '[]'::jsonb) INTO out
  FROM (SELECT key, enabled, description, updated_at FROM feature_flags) t;
  RETURN out;
END $$;


-- ── writes — each guards, mutates, then records the action ────────────

-- PATCH /api/admin/teachers/:id/status
CREATE OR REPLACE FUNCTION public.sa_set_status(p_faculty uuid, p_status text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid;
BEGIN
  PERFORM public.sa_gate('admin.accounts');
  IF p_status NOT IN ('active','suspended','deleted') THEN
    RAISE EXCEPTION 'invalid status %', p_status USING ERRCODE = '22023';
  END IF;
  uid := public.sa_user_of(p_faculty);
  IF uid IS NULL THEN RAISE EXCEPTION 'account not found'; END IF;
  IF uid = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'cannot change your own status' USING ERRCODE = '42501';
  END IF;
  UPDATE users SET account_status = p_status, updated_at = now() WHERE id = uid;
  PERFORM public.sa_write_audit('admin.teacher.' || p_status, 'users', uid,
                                jsonb_build_object('faculty_id', p_faculty));
  RETURN jsonb_build_object('id', p_faculty, 'status', p_status);
END $$;

-- PATCH /api/admin/teachers/:id/role
CREATE OR REPLACE FUNCTION public.sa_set_role(p_faculty uuid, p_role text, p_sub_role text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; target_role text;
BEGIN
  PERFORM public.sa_gate('admin.accounts');
  IF p_role NOT IN ('teacher','dev','super_admin','admin','moe','owner','student') THEN
    RAISE EXCEPTION 'invalid role %', p_role USING ERRCODE = '22023';
  END IF;
  uid := public.sa_user_of(p_faculty);
  IF uid IS NULL THEN RAISE EXCEPTION 'account not found'; END IF;
  -- Escalation guard: only a super admin may create staff or touch a staff
  -- account. A delegated sub-admin may reassign ordinary users
  -- (teacher/student) but cannot mint another admin or demote a colleague.
  IF NOT public.is_super_admin() THEN
    IF p_role NOT IN ('teacher','student') THEN
      RAISE EXCEPTION 'only a super admin can grant staff roles' USING ERRCODE = '42501';
    END IF;
    SELECT role INTO target_role FROM users WHERE id = uid;
    IF target_role IN ('dev','super_admin','admin','moe','owner') THEN
      RAISE EXCEPTION 'only a super admin can change a staff account' USING ERRCODE = '42501';
    END IF;
  END IF;
  UPDATE users SET role = p_role, sub_role = NULLIF(p_sub_role, ''), updated_at = now() WHERE id = uid;
  PERFORM public.sa_write_audit('admin.teacher.role_update', 'users', uid,
                                jsonb_build_object('role', p_role, 'sub_role', p_sub_role));
  RETURN jsonb_build_object('id', p_faculty, 'role', p_role, 'sub_role', NULLIF(p_sub_role, ''));
END $$;

-- DELETE /api/admin/teachers/:id — soft delete. A definer function cannot
-- remove the auth.users row (that needs the GoTrue admin key), and erasing
-- a tenant's every lesson from the browser is not something to do behind a
-- single click, so this marks the account deleted and reversible. A hard
-- delete stays a backend operation.
CREATE OR REPLACE FUNCTION public.sa_delete_account(p_faculty uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid;
BEGIN
  PERFORM public.sa_gate('admin.accounts');
  uid := public.sa_user_of(p_faculty);
  IF uid IS NULL THEN RAISE EXCEPTION 'account not found'; END IF;
  IF uid = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'cannot delete your own account' USING ERRCODE = '42501';
  END IF;
  UPDATE users SET account_status = 'deleted', active_session_id = NULL, updated_at = now() WHERE id = uid;
  PERFORM public.sa_write_audit('admin.teacher.delete', 'users', uid,
                                jsonb_build_object('faculty_id', p_faculty, 'soft', true));
  RETURN jsonb_build_object('ok', true, 'id', p_faculty);
END $$;

-- PATCH /api/superadmin/account/:id/permissions
CREATE OR REPLACE FUNCTION public.sa_set_permissions(p_faculty uuid, p_perms jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid;
BEGIN
  PERFORM public.sa_require();
  uid := public.sa_user_of(p_faculty);
  IF uid IS NULL THEN RAISE EXCEPTION 'account not found'; END IF;
  UPDATE users SET permissions = COALESCE(p_perms, '{}'::jsonb), updated_at = now() WHERE id = uid;
  PERFORM public.sa_write_audit('superadmin.permissions.update', 'users', uid, p_perms);
  RETURN jsonb_build_object('ok', true);
END $$;

-- PATCH /api/superadmin/account/:id/credits
CREATE OR REPLACE FUNCTION public.sa_adjust_credits(p_faculty uuid, p_balance numeric, p_allowance numeric)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sa_gate('admin.billing');
  INSERT INTO credits (faculty_id, balance, monthly_allowance)
  VALUES (p_faculty, GREATEST(COALESCE(p_balance,0), 0), GREATEST(COALESCE(p_allowance,0), 0))
  ON CONFLICT (faculty_id) DO UPDATE
    SET balance = GREATEST(COALESCE(p_balance, credits.balance), 0),
        monthly_allowance = GREATEST(COALESCE(p_allowance, credits.monthly_allowance), 0);
  PERFORM public.sa_write_audit('superadmin.credits.update', 'credits', p_faculty,
                                jsonb_build_object('balance', p_balance, 'allowance', p_allowance));
  RETURN jsonb_build_object('ok', true);
END $$;

-- PATCH /api/superadmin/account/:id/subscription
CREATE OR REPLACE FUNCTION public.sa_set_subscription(p_faculty uuid, p_plan text, p_status text, p_ends_at timestamptz)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sa_gate('admin.billing');
  IF p_plan IS NOT NULL AND p_plan NOT IN ('trial','monthly','quarterly','annual') THEN
    RAISE EXCEPTION 'invalid plan %', p_plan USING ERRCODE = '22023';
  END IF;
  IF p_status IS NOT NULL AND p_status NOT IN ('trialing','active','past_due','canceled','expired') THEN
    RAISE EXCEPTION 'invalid status %', p_status USING ERRCODE = '22023';
  END IF;
  INSERT INTO subscriptions (faculty_id, plan, status, current_period_start, current_period_end)
  VALUES (p_faculty, COALESCE(p_plan,'trial'), COALESCE(p_status,'active'), now(), p_ends_at)
  ON CONFLICT (faculty_id) DO UPDATE
    SET plan = COALESCE(p_plan, subscriptions.plan),
        status = COALESCE(p_status, subscriptions.status),
        current_period_end = COALESCE(p_ends_at, subscriptions.current_period_end);
  PERFORM public.sa_write_audit('superadmin.subscription.update', 'subscriptions', p_faculty,
                                jsonb_build_object('plan', p_plan, 'status', p_status, 'ends_at', p_ends_at));
  RETURN jsonb_build_object('ok', true);
END $$;

-- PATCH /api/superadmin/flags/:key
CREATE OR REPLACE FUNCTION public.sa_set_flag(p_key text, p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sa_gate('admin.platform');
  UPDATE feature_flags SET enabled = COALESCE(p_enabled, false), updated_at = now() WHERE key = p_key;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown flag %', p_key; END IF;
  PERFORM public.sa_write_audit('superadmin.flag.update', 'feature_flags', NULL,
                                jsonb_build_object('key', p_key, 'enabled', p_enabled));
  RETURN jsonb_build_object('key', p_key, 'enabled', p_enabled);
END $$;

-- A read-only window into one teacher's own work, for the drawer's
-- "inspect" — the honest form of impersonation in a direct-Supabase app.
-- The super admin cannot BECOME the teacher (that needs their session),
-- but this definer read shows exactly what they have, which is what
-- support and debugging actually need.
CREATE OR REPLACE FUNCTION public.sa_account_content(p_faculty uuid, p_limit int DEFAULT 40)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int := LEAST(GREATEST(COALESCE(p_limit,40), 1), 200);
BEGIN
  PERFORM public.sa_gate('admin.accounts');
  SELECT jsonb_build_object(
    'work', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT id, type,
               COALESCE(content->>'title', content->>'name', 'Untitled') AS title,
               status, updated_at
          FROM ai_studio
         WHERE faculty_id = p_faculty AND deleted_at IS NULL
         ORDER BY updated_at DESC LIMIT n
      ) t
    ),
    'students', (
      SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) FROM (
        SELECT id, first_name, last_name, grade, division AS section
          FROM students WHERE created_by = p_faculty
         ORDER BY grade, division, last_name LIMIT n
      ) t
    )
  ) INTO out;
  RETURN out;
END $$;

-- Any authenticated user records their OWN sign-in / sign-up. Not guarded
-- by is_super_admin — the actor is always auth.uid(), so there is nothing
-- to escalate. This is what gives the logins / signups charts real data
-- going forward, without the browser touching audit_log directly.
CREATE OR REPLACE FUNCTION public.record_auth_event(p_kind text)
RETURNS void
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_kind NOT IN ('login','signup') THEN RETURN; END IF;
  IF (SELECT auth.uid()) IS NULL THEN RETURN; END IF;
  INSERT INTO audit_log (actor_id, action, entity, entity_id)
  VALUES ((SELECT auth.uid()), 'auth.' || p_kind, 'users', (SELECT auth.uid()));
  -- Stamp last_login_at so "active today" and every account's "last login"
  -- column read from real data. Writes the caller's OWN row only.
  UPDATE users SET last_login_at = now() WHERE id = (SELECT auth.uid());
END $$;

GRANT EXECUTE ON FUNCTION public.sa_stats()                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_accounts()                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_account(uuid)                        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_overview()                           TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_signups(int)                         TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_logins(int)                          TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_recent_activity(int)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_flags()                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_set_status(uuid, text)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_set_role(uuid, text, text)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_delete_account(uuid)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_set_permissions(uuid, jsonb)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_adjust_credits(uuid, numeric, numeric) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_set_subscription(uuid, text, text, timestamptz) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_set_flag(text, boolean)              TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_account_content(uuid, int)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.record_auth_event(text)                 TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- 31. Fuller subscription + credit control for the super admin
--
-- §30 could SET a credit balance and a subscription's fields absolutely.
-- These add the operations a head-of-project actually reaches for: grant
-- MORE tokens (a delta, not a replacement), upgrade a plan for its real
-- duration, extend a period, cancel, or remove a subscription outright.
-- All guarded and audited, same as everything else in §30.
-- ═══════════════════════════════════════════════════════════════════════

-- Grant (or deduct, with a negative delta) credits. "Give more tokens."
-- Distinct from sa_adjust_credits, which sets the balance absolutely.
CREATE OR REPLACE FUNCTION public.sa_grant_credits(p_faculty uuid, p_delta numeric)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE new_balance numeric;
BEGIN
  PERFORM public.sa_gate('admin.billing');
  INSERT INTO credits (faculty_id, balance, monthly_allowance)
  VALUES (p_faculty, GREATEST(COALESCE(p_delta, 0), 0), 200)
  ON CONFLICT (faculty_id) DO UPDATE
    SET balance = GREATEST(credits.balance + COALESCE(p_delta, 0), 0)
  RETURNING balance INTO new_balance;
  PERFORM public.sa_write_audit('superadmin.credits.grant', 'credits', p_faculty,
                                jsonb_build_object('delta', p_delta, 'balance', new_balance));
  RETURN jsonb_build_object('ok', true, 'balance', new_balance);
END $$;

-- Activate / upgrade a plan for its NATURAL duration (the same day counts
-- src/lib/plans.js uses: trial 7, monthly 30, quarterly 90, annual 365).
-- One click puts a teacher on a plan with a correct end date, rather than
-- the operator computing it by hand.
CREATE OR REPLACE FUNCTION public.sa_activate_plan(p_faculty uuid, p_plan text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE d int; st text; ends timestamptz;
BEGIN
  PERFORM public.sa_gate('admin.billing');
  IF p_plan NOT IN ('trial','monthly','quarterly','annual') THEN
    RAISE EXCEPTION 'invalid plan %', p_plan USING ERRCODE = '22023';
  END IF;
  d := CASE p_plan WHEN 'trial' THEN 7 WHEN 'monthly' THEN 30
                   WHEN 'quarterly' THEN 90 WHEN 'annual' THEN 365 END;
  st := CASE WHEN p_plan = 'trial' THEN 'trialing' ELSE 'active' END;
  ends := now() + make_interval(days => d);
  INSERT INTO subscriptions (faculty_id, plan, status, current_period_start, current_period_end)
  VALUES (p_faculty, p_plan, st, now(), ends)
  ON CONFLICT (faculty_id) DO UPDATE
    SET plan = p_plan, status = st, current_period_start = now(), current_period_end = ends;
  PERFORM public.sa_write_audit('superadmin.subscription.activate', 'subscriptions', p_faculty,
                                jsonb_build_object('plan', p_plan, 'ends_at', ends));
  RETURN jsonb_build_object('ok', true, 'plan', p_plan, 'status', st, 'ends_at', ends);
END $$;

-- Extend the current period by N days, counting from the later of its end
-- and now — so it tops up a live plan and revives an expired one.
CREATE OR REPLACE FUNCTION public.sa_extend_subscription(p_faculty uuid, p_days int)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE base timestamptz; ends timestamptz;
BEGIN
  PERFORM public.sa_gate('admin.billing');
  SELECT GREATEST(COALESCE(current_period_end, now()), now()) INTO base
    FROM subscriptions WHERE faculty_id = p_faculty;
  base := COALESCE(base, now());
  ends := base + make_interval(days => GREATEST(COALESCE(p_days, 0), 0));
  INSERT INTO subscriptions (faculty_id, plan, status, current_period_start, current_period_end)
  VALUES (p_faculty, 'monthly', 'active', now(), ends)
  ON CONFLICT (faculty_id) DO UPDATE
    SET current_period_end = ends,
        status = CASE WHEN subscriptions.status IN ('canceled','expired')
                      THEN 'active' ELSE subscriptions.status END;
  PERFORM public.sa_write_audit('superadmin.subscription.extend', 'subscriptions', p_faculty,
                                jsonb_build_object('days', p_days, 'ends_at', ends));
  RETURN jsonb_build_object('ok', true, 'ends_at', ends);
END $$;

-- Cancel: keep the row for history, mark it canceled. Writes stop at the
-- next attempt (subscription_active() fails); reads keep working, which is
-- the deliberate READ-vs-WRITE split from §27.
CREATE OR REPLACE FUNCTION public.sa_cancel_subscription(p_faculty uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sa_gate('admin.billing');
  UPDATE subscriptions SET status = 'canceled', current_period_end = now() WHERE faculty_id = p_faculty;
  PERFORM public.sa_write_audit('superadmin.subscription.cancel', 'subscriptions', p_faculty, NULL);
  RETURN jsonb_build_object('ok', true);
END $$;

-- Remove: delete the subscription row entirely. The teacher is then on no
-- plan at all until re-subscribed (or comped again).
CREATE OR REPLACE FUNCTION public.sa_remove_subscription(p_faculty uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sa_gate('admin.billing');
  DELETE FROM subscriptions WHERE faculty_id = p_faculty;
  PERFORM public.sa_write_audit('superadmin.subscription.remove', 'subscriptions', p_faculty, NULL);
  RETURN jsonb_build_object('ok', true);
END $$;

GRANT EXECUTE ON FUNCTION public.sa_grant_credits(uuid, numeric)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_activate_plan(uuid, text)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_extend_subscription(uuid, int)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_cancel_subscription(uuid)         TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_remove_subscription(uuid)         TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- 32. AI credit consumption + the monthly refresh
--
-- Using an AI feature spends credits, and the allowance replenishes on the
-- billing cycle. Both are writes to `credits`, which the browser can never
-- make directly — so, like everything else privileged here, they are
-- SECURITY DEFINER functions. The safety argument is different from the
-- super-admin ones though: these act ONLY on the CALLER'S OWN row
-- (current_faculty_id()) and can only *reduce* the balance or reset it to
-- the allowance — never inflate it — so any authenticated teacher may call
-- them for themselves.
--
-- The per-feature cost is read from a table, not passed by the client, so
-- the browser cannot understate what an action costs.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.credits    ADD COLUMN IF NOT EXISTS next_refresh_at timestamptz;
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS feature text;
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS credits integer;

-- What each AI action costs, in credits. Server-authoritative; the super
-- admin edits it through sa_set_credit_cost. Readable by everyone so the
-- studio can show "this costs N" and grey a button out before spending.
CREATE TABLE IF NOT EXISTS public.ai_credit_costs (
  feature    text PRIMARY KEY,
  cost       integer NOT NULL DEFAULT 1,
  label      text,
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.ai_credit_costs (feature, cost, label) VALUES
  ('lesson_plan',  10, 'Lesson plan'),
  ('quiz',         10, 'Quiz'),
  ('homework',      8, 'Homework'),
  ('presentation', 12, 'Presentation'),
  ('activity',      6, 'Activity'),
  ('template',      6, 'Template'),
  ('regenerate',    3, 'Regenerate a section'),
  ('quiz_tweak',    2, 'Quiz tweak'),
  ('goal_plan',    15, 'Goal plan'),
  ('bulletin',      2, 'Bulletin draft'),
  ('skill_profile', 5, 'Skill profile'),
  ('chat',          1, 'Assistant message')
ON CONFLICT (feature) DO NOTHING;

ALTER TABLE public.ai_credit_costs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ai_credit_costs_read ON public.ai_credit_costs;
CREATE POLICY ai_credit_costs_read ON public.ai_credit_costs
  FOR SELECT TO authenticated USING (true);
-- No write policy: edited only through sa_set_credit_cost (definer).

-- Replenish the allowance when a billing period has elapsed. Called lazily
-- (getProfile runs it), so "the counts refresh on those days" happens the
-- first time the teacher loads on or after the boundary — no cron needed.
-- Resets to monthly_allowance (a quota, not an accumulation); a super-admin
-- one-off grant therefore lasts until the next refresh, while a raised
-- monthly_allowance recurs every month.
CREATE OR REPLACE FUNCTION public.refresh_credits_if_due()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE fid uuid; v_balance int; v_allow int; v_next timestamptz; anchor timestamptz; did boolean := false;
BEGIN
  fid := current_faculty_id();
  IF fid IS NULL THEN RETURN NULL; END IF;
  SELECT balance, monthly_allowance, next_refresh_at INTO v_balance, v_allow, v_next
    FROM credits WHERE faculty_id = fid;
  IF NOT FOUND THEN RETURN NULL; END IF;

  IF v_next IS NULL THEN
    -- First run: anchor to the plan's period-start day if there is one, so
    -- the refresh lands on the same day the plan renews; else the credit
    -- row's own creation day. Advance to the next boundary after now.
    SELECT current_period_start INTO anchor FROM subscriptions WHERE faculty_id = fid;
    anchor := COALESCE(anchor, now());
    WHILE anchor <= now() LOOP anchor := anchor + INTERVAL '1 month'; END LOOP;
    UPDATE credits SET next_refresh_at = anchor WHERE faculty_id = fid;
    v_next := anchor;
  ELSIF now() >= v_next THEN
    anchor := v_next;
    WHILE anchor <= now() LOOP anchor := anchor + INTERVAL '1 month'; END LOOP;
    UPDATE credits SET balance = monthly_allowance, next_refresh_at = anchor, updated_at = now()
      WHERE faculty_id = fid;
    v_balance := v_allow;
    v_next := anchor;
    did := true;
  END IF;

  RETURN jsonb_build_object('balance', v_balance, 'allowance', v_allow,
                            'next_refresh_at', v_next, 'refreshed', did);
END $$;

-- Spend credits for one AI action. Refreshes first (so a due reset happens
-- before the charge), looks the cost up server-side, and refuses rather
-- than going negative — returning {ok:false, insufficient:true} so the UI
-- can say "out of credits" instead of erroring. Records the spend in
-- usage_logs. Every AI feature calls this on a successful generation.
CREATE OR REPLACE FUNCTION public.consume_credits(p_feature text, p_ref uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE fid uuid; v_cost int; v_balance int; v_new int;
BEGIN
  fid := current_faculty_id();
  IF fid IS NULL THEN RAISE EXCEPTION 'no teaching profile' USING ERRCODE = '42501'; END IF;
  PERFORM public.refresh_credits_if_due();

  SELECT cost INTO v_cost FROM ai_credit_costs WHERE feature = p_feature;
  v_cost := COALESCE(v_cost, 1);  -- unknown feature costs the minimum

  SELECT balance INTO v_balance FROM credits WHERE faculty_id = fid;
  IF v_balance IS NULL OR v_balance < v_cost THEN
    RETURN jsonb_build_object('ok', false, 'insufficient', true,
                              'balance', COALESCE(v_balance, 0), 'cost', v_cost);
  END IF;

  v_new := v_balance - v_cost;
  UPDATE credits SET balance = v_new, updated_at = now() WHERE faculty_id = fid;
  INSERT INTO usage_logs (user_id, operation, feature, credits, created_at)
  VALUES ((SELECT auth.uid()), 'ai.' || p_feature, p_feature, v_cost, now());

  RETURN jsonb_build_object('ok', true, 'balance', v_new, 'spent', v_cost, 'cost', v_cost);
END $$;

-- The studio's credit widget: current balance, allowance, next refresh, and
-- the whole cost table in one call.
CREATE OR REPLACE FUNCTION public.credits_status()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE fid uuid; out jsonb;
BEGIN
  fid := current_faculty_id();
  IF fid IS NULL THEN RETURN NULL; END IF;
  SELECT jsonb_build_object(
    'balance', c.balance, 'allowance', c.monthly_allowance, 'next_refresh_at', c.next_refresh_at,
    'costs', (SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb) FROM ai_credit_costs)
  ) INTO out FROM credits c WHERE c.faculty_id = fid;
  RETURN out;
END $$;

-- Super admin: read + edit the cost table.
CREATE OR REPLACE FUNCTION public.sa_credit_costs()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.platform');
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.feature), '[]'::jsonb) INTO out
    FROM (SELECT feature, cost, label FROM ai_credit_costs) t;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_set_credit_cost(p_feature text, p_cost int)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sa_gate('admin.platform');
  UPDATE ai_credit_costs SET cost = GREATEST(COALESCE(p_cost, 0), 0), updated_at = now()
    WHERE feature = p_feature;
  IF NOT FOUND THEN RAISE EXCEPTION 'unknown feature %', p_feature USING ERRCODE = '22023'; END IF;
  PERFORM public.sa_write_audit('superadmin.credit_cost.update', 'ai_credit_costs', NULL,
                                jsonb_build_object('feature', p_feature, 'cost', p_cost));
  RETURN jsonb_build_object('feature', p_feature, 'cost', p_cost);
END $$;

GRANT EXECUTE ON FUNCTION public.refresh_credits_if_due()          TO authenticated;
GRANT EXECUTE ON FUNCTION public.consume_credits(text, uuid)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.credits_status()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_credit_costs()                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_set_credit_cost(text, int)     TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- 33. Students & organisations — the two surfaces the super admin lacked
--
-- The consoles cover ACCOUNTS (teachers and staff). The people those
-- teachers teach — students — and the places they teach at —
-- organisations (schools) — had no cross-tenant view. These RPCs build
-- both, plus the "what are they doing" activity each surface needs:
-- students' quiz attempts and submissions, organisations' content output.
-- All is_super_admin() gated, all read-only.
-- ═══════════════════════════════════════════════════════════════════════

-- ── students ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sa_students_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT jsonb_build_object(
    'total',        (SELECT count(*) FROM students),
    'with_account', (SELECT count(*) FROM students WHERE user_id IS NOT NULL),
    'roster_only',  (SELECT count(*) FROM students WHERE user_id IS NULL),
    'active_7d',    (SELECT count(DISTINCT student_id) FROM quiz_attempts
                       WHERE submitted_at > now() - INTERVAL '7 days'),
    'submissions_total', (SELECT count(*) FROM quiz_attempts WHERE submitted_at IS NOT NULL),
    'avg_pct', (SELECT round(avg(score / NULLIF(max_score, 0) * 100)::numeric, 0)
                  FROM quiz_attempts WHERE score IS NOT NULL AND max_score > 0),
    'by_grade', (SELECT COALESCE(jsonb_object_agg(g, n), '{}'::jsonb) FROM (
                   SELECT COALESCE(NULLIF(grade, ''), 'Ungraded') AS g, count(*) n
                     FROM students GROUP BY 1 ORDER BY 2 DESC LIMIT 12) x),
    'by_school', (SELECT COALESCE(jsonb_object_agg(name, n), '{}'::jsonb) FROM (
                    SELECT COALESCE(sc.name, 'Unassigned') AS name, count(*) n
                      FROM students st LEFT JOIN schools sc ON sc.id = st.school_id
                     GROUP BY 1 ORDER BY 2 DESC LIMIT 6) y),
    'submissions', (SELECT COALESCE(jsonb_agg(jsonb_build_object('day', to_char(d,'YYYY-MM-DD'),'n',c) ORDER BY d), '[]'::jsonb)
                      FROM (SELECT gs::date d,
                                   (SELECT count(*) FROM quiz_attempts q WHERE q.submitted_at::date = gs::date) c
                              FROM generate_series(current_date - 13, current_date, INTERVAL '1 day') gs) s)
  ) INTO out;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_students(p_limit int DEFAULT 100, p_search text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int := LEAST(GREATEST(COALESCE(p_limit,100),1), 500); q text := NULLIF(TRIM(COALESCE(p_search,'')), '');
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO out FROM (
    SELECT st.id, st.first_name, st.last_name, st.grade, st.division AS section,
           sc.name AS school, sc.emirate,
           st.user_id IS NOT NULL AS has_account,
           (SELECT count(*) FROM quiz_attempts qa WHERE qa.student_id = st.id) AS attempts,
           (SELECT round(avg(qa.score / NULLIF(qa.max_score,0) * 100)::numeric, 0)
              FROM quiz_attempts qa WHERE qa.student_id = st.id AND qa.score IS NOT NULL) AS avg_pct,
           (SELECT max(qa.submitted_at) FROM quiz_attempts qa WHERE qa.student_id = st.id) AS last_activity
      FROM students st LEFT JOIN schools sc ON sc.id = st.school_id
     WHERE q IS NULL
        OR st.first_name ILIKE '%'||q||'%' OR st.last_name ILIKE '%'||q||'%'
        OR sc.name ILIKE '%'||q||'%'
     ORDER BY last_activity DESC NULLS LAST, st.created_at DESC
     LIMIT n
  ) t;
  RETURN out;
END $$;

-- What students are doing: recent graded/submitted attempts, with the
-- work they were sitting and how they scored.
CREATE OR REPLACE FUNCTION public.sa_student_activity(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int := LEAST(GREATEST(COALESCE(p_limit,20),1), 100);
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO out FROM (
    SELECT qa.id, qa.status, qa.submitted_at, qa.score, qa.max_score,
           st.first_name, st.last_name, st.grade,
           COALESCE(a.content->>'title', a.content->>'name', 'work') AS work_title,
           a.type AS work_type
      FROM quiz_attempts qa
      JOIN students st ON st.id = qa.student_id
      LEFT JOIN assignments asg ON asg.id = qa.assignment_id
      LEFT JOIN ai_studio a ON a.id = asg.generation_id
     WHERE qa.submitted_at IS NOT NULL
     ORDER BY qa.submitted_at DESC
     LIMIT n
  ) t;
  RETURN out;
END $$;

-- ── organisations (schools) ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sa_orgs_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT jsonb_build_object(
    -- An "organisation" that matters is one with at least one teacher or
    -- student on the platform, not every row in the catalog.
    'active_orgs', (SELECT count(*) FROM schools s
                     WHERE EXISTS (SELECT 1 FROM faculty f WHERE f.school_id = s.id)
                        OR EXISTS (SELECT 1 FROM students st WHERE st.school_id = s.id)),
    'catalog',      (SELECT count(*) FROM schools),
    'teachers',     (SELECT count(*) FROM faculty WHERE school_id IS NOT NULL),
    'students',     (SELECT count(*) FROM students WHERE school_id IS NOT NULL),
    'unaffiliated_teachers', (SELECT count(*) FROM faculty WHERE school_id IS NULL),
    'by_emirate', (SELECT COALESCE(jsonb_object_agg(em, n), '{}'::jsonb) FROM (
                     SELECT COALESCE(NULLIF(s.emirate,''), 'Other') AS em, count(*) n
                       FROM schools s
                      WHERE EXISTS (SELECT 1 FROM faculty f WHERE f.school_id = s.id)
                         OR EXISTS (SELECT 1 FROM students st WHERE st.school_id = s.id)
                      GROUP BY 1 ORDER BY 2 DESC LIMIT 8) x)
  ) INTO out;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_orgs(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int := LEAST(GREATEST(COALESCE(p_limit,100),1), 500);
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO out FROM (
    SELECT s.id, s.name, s.emirate, s.curriculum,
           (SELECT count(*) FROM faculty f WHERE f.school_id = s.id) AS teachers,
           (SELECT count(*) FROM students st WHERE st.school_id = s.id) AS students,
           (SELECT count(*) FROM ai_studio a JOIN faculty f2 ON f2.id = a.faculty_id
             WHERE f2.school_id = s.id AND a.deleted_at IS NULL) AS content
      FROM schools s
     WHERE EXISTS (SELECT 1 FROM faculty f WHERE f.school_id = s.id)
        OR EXISTS (SELECT 1 FROM students st WHERE st.school_id = s.id)
     ORDER BY teachers DESC, students DESC
     LIMIT n
  ) t;
  RETURN out;
END $$;

-- What organisations are doing: the most recent work their teachers made.
CREATE OR REPLACE FUNCTION public.sa_org_activity(p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int := LEAST(GREATEST(COALESCE(p_limit,20),1), 100);
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO out FROM (
    SELECT a.id, a.type, a.created_at,
           COALESCE(a.content->>'title', a.content->>'name', 'Untitled') AS title,
           u.first_name, u.last_name,
           COALESCE(sc.name, f.organization, 'Independent') AS org
      FROM ai_studio a
      JOIN faculty f ON f.id = a.faculty_id
      LEFT JOIN users u ON u.id = f.user_id
      LEFT JOIN schools sc ON sc.id = f.school_id
     WHERE a.deleted_at IS NULL
     ORDER BY a.created_at DESC
     LIMIT n
  ) t;
  RETURN out;
END $$;

GRANT EXECUTE ON FUNCTION public.sa_students_overview()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_students(int, text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_student_activity(int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_orgs_overview()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_orgs(int)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_org_activity(int)          TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- 34. The student, as a signed-in role
--
-- Until now the only signed-in users were staff — provisioning always made
-- a teacher. A student is different: they are a row a teacher typed into a
-- roster, and they become a *user* by signing in with the email that row
-- carries. These two functions are that bridge:
--
--   link_student_account()  claims the roster row for the signed-in email
--                           and marks the user a student. SECURITY DEFINER
--                           because it writes students.user_id and
--                           users.role, which the browser cannot.
--   student_dashboard()     the student's own world — assigned work with
--                           their attempt, scores, attendance, marks —
--                           reaching past the teacher-owner RLS on grades
--                           and attendance to the caller's OWN rows only.
-- ═══════════════════════════════════════════════════════════════════════

-- Claim a roster row by matching the signed-in email. Idempotent: a second
-- call for an already-linked user is a no-op that reports success.
CREATE OR REPLACE FUNCTION public.link_student_account()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; em text; sid uuid;
BEGIN
  uid := (SELECT auth.uid());
  IF uid IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'not_signed_in'); END IF;

  IF EXISTS (SELECT 1 FROM students WHERE user_id = uid) THEN
    RETURN jsonb_build_object('linked', true, 'already', true);
  END IF;
  -- A teacher is not a student — never convert one.
  IF EXISTS (SELECT 1 FROM faculty WHERE user_id = uid) THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'is_teacher');
  END IF;

  em := lower((SELECT email FROM auth.users WHERE id = uid));
  IF em IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'no_email'); END IF;

  -- The oldest unclaimed roster row for this email. Unclaimed only: a row
  -- already linked to someone else is off-limits.
  SELECT id INTO sid FROM students
    WHERE lower(email) = em AND user_id IS NULL
    ORDER BY created_at LIMIT 1;
  IF sid IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'no_match'); END IF;

  UPDATE students SET user_id = uid, updated_at = now() WHERE id = sid;
  INSERT INTO public.users (id, email) VALUES (uid, em) ON CONFLICT (id) DO NOTHING;
  UPDATE public.users SET role = 'student', updated_at = now() WHERE id = uid;

  RETURN jsonb_build_object('linked', true, 'student_id', sid);
END $$;

CREATE OR REPLACE FUNCTION public.student_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE sid uuid; out jsonb;
BEGIN
  sid := current_student_id();
  IF sid IS NULL THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'student', (SELECT jsonb_build_object(
        'id', st.id, 'first_name', st.first_name, 'last_name', st.last_name,
        'grade', st.grade, 'section', st.division,
        'school', (SELECT name FROM schools WHERE id = st.school_id)
      ) FROM students st WHERE st.id = sid),

    -- Everything assigned to a class this student is in, with their attempt.
    'work', (
      SELECT COALESCE(jsonb_agg(row_to_json(w) ORDER BY w.starts_at DESC NULLS LAST), '[]'::jsonb) FROM (
        SELECT a.id AS assignment_id, gen.id AS work_id, gen.type,
               COALESCE(gen.content->>'title', gen.content->>'name', 'Work') AS title,
               a.starts_at, a.ends_at, c.name AS class_name,
               qa.status, qa.score, qa.max_score, qa.submitted_at
          FROM class_members cm
          JOIN classes c      ON c.id = cm.class_id
          JOIN assignments a  ON a.class_id = cm.class_id
          JOIN ai_studio gen  ON gen.id = a.generation_id AND gen.deleted_at IS NULL
          LEFT JOIN quiz_attempts qa ON qa.assignment_id = a.id AND qa.student_id = sid
         WHERE cm.student_id = sid
      ) w
    ),

    -- Graded attempts, newest first — the student's scoreline.
    'scores', (
      SELECT COALESCE(jsonb_agg(row_to_json(s2) ORDER BY s2.submitted_at DESC NULLS LAST), '[]'::jsonb) FROM (
        SELECT qa.id, qa.score, qa.max_score, qa.submitted_at, gen.type,
               COALESCE(gen.content->>'title', gen.content->>'name', 'Work') AS title
          FROM quiz_attempts qa
          LEFT JOIN assignments a ON a.id = qa.assignment_id
          LEFT JOIN ai_studio gen ON gen.id = a.generation_id
         WHERE qa.student_id = sid AND qa.score IS NOT NULL
         ORDER BY qa.submitted_at DESC NULLS LAST LIMIT 20
      ) s2
    ),

    'attendance', (
      SELECT jsonb_build_object(
        'present', count(*) FILTER (WHERE status = 'present'),
        'absent',  count(*) FILTER (WHERE status = 'absent'),
        'late',    count(*) FILTER (WHERE status = 'late'),
        'total',   count(*)
      ) FROM attendance WHERE student_id = sid
    ),

    -- Marks a teacher typed in (as opposed to scored work).
    'grades', (
      SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.recorded_on DESC), '[]'::jsonb) FROM (
        SELECT subject, term, label, score, max_score, recorded_on
          FROM student_grades WHERE student_id = sid
         ORDER BY recorded_on DESC LIMIT 20
      ) g
    )
  ) INTO out;
  RETURN out;
END $$;

GRANT EXECUTE ON FUNCTION public.link_student_account() TO authenticated;
GRANT EXECUTE ON FUNCTION public.student_dashboard()    TO authenticated;


-- ═══════════════════════════════════════════════════════════════════════
-- 35. Invite-gated student login + the subject a student is taught
--
-- Only a student the teacher has INVITED may claim an account — an email
-- match alone is not enough, or anyone who guessed a classmate's address
-- could sign in as them. `invite_status` is that gate:
--
--   none     on the roster, not yet invited (cannot log in)
--   invited  the teacher opened the door; a matching email may claim it
--   active   claimed — user_id is set, the student has signed in
--
-- `subject` is what this teacher teaches the student, carried on the roster
-- row and pre-filling the gradebook. Grade and section already exist.
-- ═══════════════════════════════════════════════════════════════════════

ALTER TABLE public.students ADD COLUMN IF NOT EXISTS subject       text;
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS invite_status text NOT NULL DEFAULT 'none';
ALTER TABLE public.students ADD COLUMN IF NOT EXISTS invited_at    timestamptz;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'students_invite_status_check'
                   AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_invite_status_check
      CHECK (invite_status IN ('none','invited','active'));
  END IF;
END $$;

-- Re-create the linker with the invite gate. Distinguishes "no roster row
-- for this email" from "there is one, but you weren't invited", so the
-- sign-in page can say which.
CREATE OR REPLACE FUNCTION public.link_student_account()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; em text; sid uuid;
BEGIN
  uid := (SELECT auth.uid());
  IF uid IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'not_signed_in'); END IF;

  IF EXISTS (SELECT 1 FROM students WHERE user_id = uid) THEN
    RETURN jsonb_build_object('linked', true, 'already', true);
  END IF;
  IF EXISTS (SELECT 1 FROM faculty WHERE user_id = uid) THEN
    RETURN jsonb_build_object('linked', false, 'reason', 'is_teacher');
  END IF;

  em := lower((SELECT email FROM auth.users WHERE id = uid));
  IF em IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'no_email'); END IF;

  -- Invited AND unclaimed only.
  SELECT id INTO sid FROM students
    WHERE lower(email) = em AND user_id IS NULL AND invite_status = 'invited'
    ORDER BY created_at LIMIT 1;

  IF sid IS NULL THEN
    -- Is there a roster row for this email that simply wasn't invited?
    IF EXISTS (SELECT 1 FROM students WHERE lower(email) = em AND user_id IS NULL) THEN
      RETURN jsonb_build_object('linked', false, 'reason', 'not_invited');
    END IF;
    RETURN jsonb_build_object('linked', false, 'reason', 'no_match');
  END IF;

  UPDATE students SET user_id = uid, invite_status = 'active', updated_at = now() WHERE id = sid;
  INSERT INTO public.users (id, email) VALUES (uid, em) ON CONFLICT (id) DO NOTHING;
  UPDATE public.users SET role = 'student', updated_at = now() WHERE id = uid;

  RETURN jsonb_build_object('linked', true, 'student_id', sid);
END $$;


-- =====================================================================
-- 36. A sign-up is a teacher. Super admin is granted, never defaulted
-- =====================================================================
--
-- Every new account — Google, email, anything — arrived as a
-- `super_admin`. Nothing in the application asks for that: neither
-- provisionTeacher() nor the sign-up funnel writes `role` at all, so the
-- value comes from the live schema, either as the column's DEFAULT or
-- from handle_new_user() (both authored in the Supabase console, neither
-- visible in this repo). is_super_admin() is a read of the caller's own
-- users.role, so that one default handed every visitor the cross-tenant
-- consoles, billing, credit control and the audit trail.
--
-- Fixed in three places, because one is not enough:
--
--   * the column default, so a plain INSERT is a teacher;
--   * a BEFORE INSERT trigger, which also overrides whatever the console
--     trigger writes — we do not need to know its body to beat it;
--   * a BEFORE UPDATE guard, so a teacher cannot promote themselves
--     through PostgREST even if the users UPDATE policy lets them write
--     their own row.
--
-- The one account that is a super admin is named here, in one place.


-- ── the platform owner ────────────────────────────────────────────────
--
-- Hardcoded on purpose. This is not configuration: it is the single
-- identity the platform trusts before anyone has been granted anything,
-- and reading it from an env var would mean a deploy setting could mint
-- a super admin. Everyone else is granted the role by an existing super
-- admin (sa_set_role) or by `npm run db:superadmin`.
CREATE OR REPLACE FUNCTION public.platform_owner_email()
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$ SELECT 'amalcpaulson@gmail.com'::text $$;


ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'teacher';


-- ── new rows: teacher, unless it is the owner ─────────────────────────
--
-- SECURITY INVOKER (the default) — it reads nothing privileged, and the
-- UPDATE guard below genuinely needs the caller's real `current_user`.
--
-- Coerces rather than defaults, so it wins over handle_new_user() no
-- matter what that trigger assigns. Roles other than teacher are set by
-- a later UPDATE (link_student_account marks a student, sa_set_role
-- grants the pyramid, db/superadmin.js promotes), which this does not
-- touch.
CREATE OR REPLACE FUNCTION public.force_signup_role()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF lower(COALESCE(NEW.email, '')) = public.platform_owner_email() THEN
    NEW.role := 'super_admin';
  ELSE
    NEW.role := 'teacher';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS force_signup_role_on_users ON public.users;
CREATE TRIGGER force_signup_role_on_users
  BEFORE INSERT ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.force_signup_role();


-- ── existing rows: privilege is not self-service ──────────────────────
--
-- The RLS policies on public.users live in the Supabase console, so this
-- file cannot see whether the UPDATE policy that lets a teacher edit
-- their own name also lets them edit their own role. Assume it does and
-- close it here, where the answer does not depend on a policy nobody in
-- this repo can read.
--
-- The test is `current_user`, not auth.uid(). A write arriving straight
-- from the browser through PostgREST runs as the `authenticated` role; a
-- SECURITY DEFINER function body (sa_set_role, sa_set_permissions,
-- link_student_account) runs as the function's owner, and the migration
-- scripts run as postgres. So the legitimate writers all pass and only
-- the direct client write is refused — which is exactly the distinction
-- worth drawing, and why this function must stay SECURITY INVOKER.
--
-- 42501 (insufficient_privilege) so PostgREST answers 403 and apiClient
-- surfaces a clean "forbidden" rather than a 500.
CREATE OR REPLACE FUNCTION public.guard_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user = 'authenticated'
     AND (NEW.role        IS DISTINCT FROM OLD.role
       OR NEW.sub_role    IS DISTINCT FROM OLD.sub_role
       OR NEW.permissions IS DISTINCT FROM OLD.permissions)
  THEN
    RAISE EXCEPTION 'role is granted by a super admin, not set by the account'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS guard_privilege_columns_on_users ON public.users;
CREATE TRIGGER guard_privilege_columns_on_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.guard_privilege_columns();


-- ── demote everyone the old default elevated ──────────────────────────
--
-- `dev` is in here with `super_admin` because is_super_admin() returns
-- true for both — a leftover dev account is the same hole under another
-- name. `superadmin` is the pre-§30 spelling. Demoted to teacher, which
-- is what these accounts actually are: the owner grants the real ones
-- back from the console.
--
-- This is the one statement in this file that rewrites existing rows. It
-- removes privilege rather than data — no account is deleted, nothing
-- else on the row changes, and re-running it is a no-op.
DO $$
DECLARE demoted int; owner_ok boolean;
BEGIN
  UPDATE public.users
     SET role = 'teacher', updated_at = now()
   WHERE role IN ('super_admin', 'dev', 'superadmin')
     AND lower(COALESCE(email, '')) <> public.platform_owner_email();
  GET DIAGNOSTICS demoted = ROW_COUNT;

  UPDATE public.users
     SET role = 'super_admin', updated_at = now()
   WHERE lower(COALESCE(email, '')) = public.platform_owner_email()
     AND role IS DISTINCT FROM 'super_admin';

  SELECT EXISTS (SELECT 1 FROM public.users
                  WHERE lower(COALESCE(email, '')) = public.platform_owner_email())
    INTO owner_ok;

  RAISE NOTICE 'super admin: demoted % account(s) to teacher', demoted;
  IF owner_ok THEN
    RAISE NOTICE 'super admin: % holds the role', public.platform_owner_email();
  ELSE
    RAISE NOTICE 'super admin: % has no account yet — it becomes super_admin on first sign-in, or run: npm run db:superadmin %',
      public.platform_owner_email(), public.platform_owner_email();
  END IF;
END $$;


-- =====================================================================
-- 37. More than one role, and more than one teacher
-- =====================================================================
--
-- Two limits with the same shape: the product assumed a person is exactly
-- one thing.
--
-- **A person can hold several roles.** A teacher who is also studying, an
-- admin who is also a student, a teacher who also administers. Rather than
-- add a roles array that can disagree with the rest of the schema, the set
-- is DERIVED from what is already true and already enforced:
--
--     teacher   ← a faculty row exists for this user
--     student   ← at least one students row is claimed by this user
--     admin · moe · owner · super_admin · dev   ← users.role
--
-- Every combination asked for falls out of that, and there is nothing to
-- keep in sync: is_super_admin() still reads users.role, current_faculty_id()
-- still finds the faculty row, and current_student_ids() still finds the
-- roster rows. my_roles() only reports what those already decide.
--
-- **A student can be invited by several teachers.** link_student_account()
-- claimed one row (`ORDER BY created_at LIMIT 1`), so a student on three
-- teachers' rosters saw one teacher's world and the other two invitations
-- did nothing. It now claims every invited row for that email, and the
-- dashboard reads across all of them.


-- ── every roster row this user has claimed ────────────────────────────
--
-- The set form of current_student_id(). DEFINER so it is readable under
-- the policies that are themselves written in terms of it.
CREATE OR REPLACE FUNCTION public.current_student_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM students WHERE user_id = (SELECT auth.uid());
$$;
GRANT EXECUTE ON FUNCTION public.current_student_ids() TO authenticated;

-- current_student_id() stays, and stays singular: policies authored in the
-- Supabase console are written in terms of it and this file cannot see them.
-- It answers with the PRIMARY row — the first a teacher created — so those
-- policies keep working unchanged rather than breaking on a student who now
-- holds three rows. Everything in this file uses the set.
CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM students WHERE user_id = (SELECT auth.uid())
   ORDER BY created_at LIMIT 1;
$$;
GRANT EXECUTE ON FUNCTION public.current_student_id() TO authenticated;

-- The attempt policy has to see all of them, or a student can sit the work
-- their first teacher set and nothing from the other two.
DROP POLICY IF EXISTS quiz_attempts_student ON public.quiz_attempts;
CREATE POLICY quiz_attempts_student ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (student_id IN (SELECT public.current_student_ids()))
  WITH CHECK (student_id IN (SELECT public.current_student_ids()));


-- ── the roles this user actually holds ────────────────────────────────
--
-- Ordered by the pyramid (dev > super_admin > admin > moe > owner >
-- teacher > student) so the first element is the most privileged, which is
-- what a UI should offer first.
CREATE OR REPLACE FUNCTION public.my_roles()
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(r ORDER BY rank), ARRAY['teacher']::text[])
    FROM (
      SELECT DISTINCT ON (r) r,
             array_position(
               ARRAY['dev','super_admin','admin','moe','owner','teacher','student'], r
             ) AS rank
        FROM (
          SELECT u.role AS r FROM users u WHERE u.id = (SELECT auth.uid())
          UNION ALL
          SELECT 'teacher' WHERE EXISTS (
            SELECT 1 FROM faculty f WHERE f.user_id = (SELECT auth.uid()))
          UNION ALL
          SELECT 'student' WHERE EXISTS (
            SELECT 1 FROM students s WHERE s.user_id = (SELECT auth.uid()))
        ) candidates
       WHERE r IN ('dev','super_admin','admin','moe','owner','teacher','student')
    ) ranked;
$$;
GRANT EXECUTE ON FUNCTION public.my_roles() TO authenticated;


-- ── claim EVERY invitation, not the oldest one ────────────────────────
--
-- Three changes from §35:
--
--   * every invited, unclaimed row for this email is claimed, so a student
--     on several teachers' rosters gets all of them;
--   * a teacher is no longer refused. Holding a faculty row used to end the
--     call with `is_teacher`, which is exactly the both-at-once case this
--     section exists to allow;
--   * the role is only taken if it is still free. users.role is the slot for
--     an ASSIGNED role, and a teacher or an admin who is also a student must
--     not lose theirs to a claim — my_roles() reports both regardless.
--
-- Re-runnable: a student who is invited again later calls this again and
-- picks up only the new rows.
CREATE OR REPLACE FUNCTION public.link_student_account()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; em text; claimed int; held int;
BEGIN
  uid := (SELECT auth.uid());
  IF uid IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'not_signed_in'); END IF;

  em := lower((SELECT email FROM auth.users WHERE id = uid));
  IF em IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'no_email'); END IF;

  UPDATE students
     SET user_id = uid, invite_status = 'active', updated_at = now()
   WHERE lower(email) = em AND user_id IS NULL AND invite_status = 'invited';
  GET DIAGNOSTICS claimed = ROW_COUNT;

  SELECT count(*) INTO held FROM students WHERE user_id = uid;

  IF held = 0 THEN
    -- Nothing claimed and nothing held. Say which, so the sign-in page can
    -- tell "your teacher hasn't invited you yet" from "we don't know you".
    IF EXISTS (SELECT 1 FROM students WHERE lower(email) = em AND user_id IS NULL) THEN
      RETURN jsonb_build_object('linked', false, 'reason', 'not_invited');
    END IF;
    RETURN jsonb_build_object('linked', false, 'reason', 'no_match');
  END IF;

  INSERT INTO public.users (id, email) VALUES (uid, em) ON CONFLICT (id) DO NOTHING;
  UPDATE public.users u
     SET role = 'student', updated_at = now()
   WHERE u.id = uid
     AND u.role = 'teacher'                    -- still the sign-up default
     AND NOT EXISTS (SELECT 1 FROM faculty f WHERE f.user_id = uid);

  RETURN jsonb_build_object(
    'linked', true, 'claimed', claimed, 'rows', held,
    'student_id', public.current_student_id()
  );
END $$;
GRANT EXECUTE ON FUNCTION public.link_student_account() TO authenticated;


-- ── one dashboard across every teacher who invited them ───────────────
--
-- Reads over current_student_ids() rather than one id, and carries the
-- subject and the teacher on each row — with three teachers in one list,
-- "Unit 4 quiz" is not enough to know whose it is.
CREATE OR REPLACE FUNCTION public.student_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int;
BEGIN
  SELECT count(*) INTO n FROM students WHERE user_id = (SELECT auth.uid());
  IF n = 0 THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    -- Identity comes from the primary row; name, grade and school are the
    -- student's own, not any one teacher's view of them.
    'student', (
      SELECT jsonb_build_object(
        'id', st.id, 'first_name', st.first_name, 'last_name', st.last_name,
        'grade', st.grade, 'section', st.division,
        'school', (SELECT name FROM schools WHERE id = st.school_id)
      ) FROM students st WHERE st.id = public.current_student_id()
    ),

    -- Who they are enrolled with, and for what. The list a student needs to
    -- make sense of a merged view.
    'teachers', (
      SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.subject NULLS LAST), '[]'::jsonb) FROM (
        SELECT st.id AS student_row_id, st.subject, st.grade, st.division AS section,
               TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS teacher,
               (SELECT name FROM schools WHERE id = st.school_id) AS school
          FROM students st
          LEFT JOIN faculty f ON f.id = st.created_by
          LEFT JOIN users   u ON u.id = f.user_id
         WHERE st.id IN (SELECT public.current_student_ids())
      ) t
    ),

    'work', (
      SELECT COALESCE(jsonb_agg(row_to_json(w) ORDER BY w.starts_at DESC NULLS LAST), '[]'::jsonb) FROM (
        SELECT a.id AS assignment_id, gen.id AS work_id, gen.type,
               COALESCE(gen.content->>'title', gen.content->>'name', 'Work') AS title,
               a.starts_at, a.ends_at, c.name AS class_name,
               -- Which roster row this reached them through. Two teachers
               -- could set work in the same class, so the assignment id
               -- alone is not a key for the merged list.
               cm.student_id AS student_row_id,
               st.subject,
               TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS teacher,
               qa.status, qa.score, qa.max_score, qa.submitted_at
          FROM class_members cm
          JOIN students     st ON st.id = cm.student_id
          JOIN classes      c  ON c.id  = cm.class_id
          JOIN assignments  a  ON a.class_id = cm.class_id
          JOIN ai_studio    gen ON gen.id = a.generation_id AND gen.deleted_at IS NULL
          LEFT JOIN faculty f  ON f.id = gen.faculty_id
          LEFT JOIN users   u  ON u.id = f.user_id
          LEFT JOIN quiz_attempts qa
                 ON qa.assignment_id = a.id AND qa.student_id = cm.student_id
         WHERE cm.student_id IN (SELECT public.current_student_ids())
      ) w
    ),

    'scores', (
      SELECT COALESCE(jsonb_agg(row_to_json(s2) ORDER BY s2.submitted_at DESC NULLS LAST), '[]'::jsonb) FROM (
        SELECT qa.id, qa.score, qa.max_score, qa.submitted_at, gen.type, st.subject,
               COALESCE(gen.content->>'title', gen.content->>'name', 'Work') AS title
          FROM quiz_attempts qa
          JOIN students st ON st.id = qa.student_id
          LEFT JOIN assignments a ON a.id = qa.assignment_id
          LEFT JOIN ai_studio gen ON gen.id = a.generation_id
         WHERE qa.student_id IN (SELECT public.current_student_ids())
           AND qa.score IS NOT NULL
         ORDER BY qa.submitted_at DESC NULLS LAST LIMIT 40
      ) s2
    ),

    -- Attendance is per teacher — one may mark it and another may not — so
    -- the total is the sum, and it is the honest one only when read across
    -- every roster row.
    'attendance', (
      SELECT jsonb_build_object(
        'present', count(*) FILTER (WHERE status = 'present'),
        'absent',  count(*) FILTER (WHERE status = 'absent'),
        'late',    count(*) FILTER (WHERE status = 'late'),
        'total',   count(*)
      ) FROM attendance WHERE student_id IN (SELECT public.current_student_ids())
    ),

    'grades', (
      SELECT COALESCE(jsonb_agg(row_to_json(g) ORDER BY g.recorded_on DESC), '[]'::jsonb) FROM (
        SELECT sg.subject, sg.term, sg.label, sg.score, sg.max_score, sg.recorded_on
          FROM student_grades sg
         WHERE sg.student_id IN (SELECT public.current_student_ids())
         ORDER BY sg.recorded_on DESC LIMIT 40
      ) g
    )
  ) INTO out;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.student_dashboard() TO authenticated;
