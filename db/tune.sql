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
/*
 * Which conversation a saved approach came from.
 *
 * The studio offers "save this approach as a skill" on a generation the
 * teacher kept. The offer disappeared when she closed the chat, because
 * nothing recorded that a conversation had already been turned into one —
 * so the button could only be shown for turns saved in the current session,
 * and a teacher who came back to a thread could never take the approach from
 * it. Written here, the offer can stand until it is taken.
 */
ALTER TABLE IF EXISTS public.teaching_skills
  ADD COLUMN IF NOT EXISTS source_session_id uuid;

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
      ('teaching_skills', 'teaching_skills_session_idx', $i$(source_session_id) WHERE source_session_id IS NOT NULL$i$),
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
-- from the browser through PostgREST runs as one of ITS roles; a
-- SECURITY DEFINER function body (sa_set_role, sa_set_permissions,
-- link_student_account) runs as the function's owner, and the migration
-- scripts run as postgres. So the legitimate writers all pass and only
-- the direct client write is refused — which is exactly the distinction
-- worth drawing, and why this function must stay SECURITY INVOKER.
--
-- All THREE PostgREST roles are named, not just `authenticated`. A request
-- carrying no token runs as `anon`, and naming only the signed-in role
-- left the unauthenticated one able to write the columns the signed-in
-- one could not — an inversion nobody would choose. Whether an RLS policy
-- would have stopped it first is not knowable from this repository, which
-- is the whole reason this guard exists. `service_role` is deliberately
-- absent: that key belongs to the separate backend, which is trusted.
--
-- 42501 (insufficient_privilege) so PostgREST answers 403 and apiClient
-- surfaces a clean "forbidden" rather than a 500.
CREATE OR REPLACE FUNCTION public.guard_privilege_columns()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon', 'authenticator')
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


-- ── no more empty roles ───────────────────────────────────────────────
--
-- users.role allows NULL, and §30 called that "a brand-new account before
-- a role is decided". In practice it is the account showing an empty role
-- in the console and landing on the teacher dashboard, because every
-- reader of a NULL role falls back to `teacher` — so the "undecided"
-- state is indistinguishable from the decision, except that it displays
-- as blank.
--
-- §36 already stops new rows arriving that way. This is the backlog.
-- Everyone becomes a teacher, which is what they were being treated as;
-- an invited student is corrected to `student` the next time they sign in,
-- because link_student_account() takes the slot precisely when it holds
-- the default and no faculty row sits behind it.
DO $$
DECLARE fixed int;
BEGIN
  UPDATE public.users SET role = 'teacher', updated_at = now() WHERE role IS NULL;
  GET DIAGNOSTICS fixed = ROW_COUNT;
  RAISE NOTICE 'roles: filled % empty role(s) with teacher', fixed;
END $$;


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


-- =====================================================================
-- 38. No account without a role
-- =====================================================================
--
-- §36 stopped new rows arriving blank and §37 filled the backlog, but
-- both are policies about how rows are written. Nothing stopped the next
-- one. Make it structural: the column refuses NULL, so a blank role is
-- not a bug to be found later but a write that cannot happen.
--
-- Three things could still produce one, and all three are closed here.


-- ── 1. sa_set_role accepted NULL ──────────────────────────────────────
--
-- The guard reads `IF p_role NOT IN (...)`. With p_role NULL that
-- expression is NULL, not TRUE, so the exception never fired and the
-- UPDATE below it wrote the NULL straight in. A super admin clearing the
-- role field — or a client sending `role: undefined`, which becomes JSON
-- null — blanked the account, and the console then displayed the blank it
-- had just been given.
--
-- Same NULL-blindness in the delegated-admin guard further down, which is
-- why the argument is rejected up front rather than patched per test.
CREATE OR REPLACE FUNCTION public.sa_set_role(p_faculty uuid, p_role text, p_sub_role text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; target_role text;
BEGIN
  PERFORM public.sa_gate('admin.accounts');
  IF p_role IS NULL OR p_role NOT IN ('teacher','dev','super_admin','admin','moe','owner','student') THEN
    RAISE EXCEPTION 'invalid role %', COALESCE(p_role, 'NULL') USING ERRCODE = '22023';
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
GRANT EXECUTE ON FUNCTION public.sa_set_role(uuid, text, text) TO authenticated;


-- ── 2. an UPDATE could still clear it ─────────────────────────────────
--
-- force_signup_role() only fires on INSERT. Anything updating the row —
-- a script, a console edit, a definer function — could set NULL, and the
-- account went blank with nothing to say so. Coerce rather than refuse:
-- the intent behind clearing a role has always been "back to the start",
-- and the start is `teacher`.
CREATE OR REPLACE FUNCTION public.keep_role_set()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.role IS NULL THEN NEW.role := COALESCE(OLD.role, 'teacher'); END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS keep_role_set_on_users ON public.users;
CREATE TRIGGER keep_role_set_on_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.keep_role_set();


-- ── 3. the column allowed it ──────────────────────────────────────────
--
-- The guarantee. Everything above is a rule that has to be remembered;
-- this one is checked by Postgres on every write, including the ones
-- nobody has written yet.
--
-- Runs last, after §37's backfill, so there is nothing left to reject.
-- Re-runs are cheap: SET NOT NULL on an already-NOT NULL column is a
-- no-op, and the sweep before it finds nothing.
DO $$
DECLARE blank int;
BEGIN
  UPDATE public.users SET role = 'teacher', updated_at = now() WHERE role IS NULL;
  GET DIAGNOSTICS blank = ROW_COUNT;
  IF blank > 0 THEN
    RAISE NOTICE 'roles: % blank role(s) filled before locking the column', blank;
  END IF;
END $$;

ALTER TABLE public.users ALTER COLUMN role SET NOT NULL;

DO $$
BEGIN
  RAISE NOTICE 'roles: users.role is NOT NULL — a blank account can no longer be created';
END $$;


-- =====================================================================
-- 39. A teacher's email cannot become a student
-- =====================================================================
--
-- §37 allowed one person to hold both roles at once. That is defensible
-- in the abstract and wrong for this product, because the two roles are
-- not symmetric: a teacher's account carries a subscription, a credit
-- balance and the work she has paid to produce. A student account
-- carries none of that. Letting an invitation pull a paying teacher's
-- address into a classroom roster puts her billing on the wrong side of
-- a click she did not think twice about.
--
-- So the rule is asymmetric, deliberately:
--
--   * a teacher may INVITE any address, including another teacher's —
--     she has no way of knowing, and blocking the send would make her
--     guess;
--   * an address that already has a teacher account may not CLAIM a
--     roster row. It is refused at the moment of sign-in.
--
-- A refusal nobody sees is the failure this replaces: the student saw a
-- dead end and the teacher saw "Invited" forever, so neither could act.
-- The refusal is now written back onto the roster row as
-- `blocked_teacher`, which is what the teacher's list reads to tell her
-- to invite the same child at a different address.
--
-- The block is a fact about the address, not a punishment: change the
-- email on the roster row and it returns to 'none', ready to invite.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
              WHERE conname = 'students_invite_status_check'
                AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.students DROP CONSTRAINT students_invite_status_check;
  END IF;
  ALTER TABLE public.students ADD CONSTRAINT students_invite_status_check
    CHECK (invite_status IN ('none','invited','active','blocked_teacher'));
END $$;

-- ── is this address already a teacher? ────────────────────────────────
--
-- DEFINER because the caller is a teacher asking about an account that is
-- not hers, and the honest answer is one bit. It deliberately reveals
-- nothing else: not the name, not the school, not whether they ever
-- signed in — only that this address cannot be a student here.
CREATE OR REPLACE FUNCTION public.email_is_teacher(p_email text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM faculty f
      JOIN auth.users u ON u.id = f.user_id
     WHERE lower(u.email) = lower(p_email)
  );
$$;
GRANT EXECUTE ON FUNCTION public.email_is_teacher(text) TO authenticated;

-- ── the linker, with the teacher guard restored ───────────────────────
--
-- Keeps everything §37 got right — it still claims EVERY invited row for
-- the address, so a child on three teachers' rosters joins all three
-- classes in one sign-in — and adds back the one refusal that section
-- dropped.
--
-- Order matters. The teacher check runs before the claim, so a teacher
-- who follows an invitation never half-joins: nothing is written except
-- the flag that tells the sender why.
CREATE OR REPLACE FUNCTION public.link_student_account()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; em text; claimed int; held int; flagged int;
BEGIN
  uid := (SELECT auth.uid());
  IF uid IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'not_signed_in'); END IF;

  em := lower((SELECT email FROM auth.users WHERE id = uid));
  IF em IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'no_email'); END IF;

  -- Already a teacher: refuse, and say so on every roster row that was
  -- waiting for this address, so each inviting teacher learns it too.
  IF EXISTS (SELECT 1 FROM faculty WHERE user_id = uid) THEN
    UPDATE students
       SET invite_status = 'blocked_teacher', updated_at = now()
     WHERE lower(email) = em AND user_id IS NULL AND invite_status = 'invited';
    GET DIAGNOSTICS flagged = ROW_COUNT;
    RETURN jsonb_build_object('linked', false, 'reason', 'is_teacher', 'flagged', flagged);
  END IF;

  -- Every invited, unclaimed row for this address — not just the first.
  UPDATE students
     SET user_id = uid, invite_status = 'active', updated_at = now()
   WHERE lower(email) = em AND user_id IS NULL AND invite_status = 'invited';
  GET DIAGNOSTICS claimed = ROW_COUNT;

  SELECT count(*) INTO held FROM students WHERE user_id = uid;

  IF held = 0 THEN
    IF EXISTS (SELECT 1 FROM students WHERE lower(email) = em AND user_id IS NULL) THEN
      RETURN jsonb_build_object('linked', false, 'reason', 'not_invited');
    END IF;
    RETURN jsonb_build_object('linked', false, 'reason', 'no_match');
  END IF;

  INSERT INTO public.users (id, email) VALUES (uid, em) ON CONFLICT (id) DO NOTHING;
  UPDATE public.users u
     SET role = 'student', updated_at = now()
   WHERE u.id = uid
     AND u.role = 'teacher'
     AND NOT EXISTS (SELECT 1 FROM faculty f WHERE f.user_id = uid);

  RETURN jsonb_build_object(
    'linked', true, 'claimed', claimed, 'rows', held,
    'student_id', public.current_student_id()
  );
END $$;
GRANT EXECUTE ON FUNCTION public.link_student_account() TO authenticated;

-- ── editing the address clears the block ──────────────────────────────
--
-- Without this the flag outlives the address that caused it: a teacher
-- corrects the email, and the row still reads "already a teacher" about
-- an address it no longer holds.
CREATE OR REPLACE FUNCTION public.students_clear_block()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.invite_status = 'blocked_teacher'
     AND lower(COALESCE(NEW.email,'')) IS DISTINCT FROM lower(COALESCE(OLD.email,'')) THEN
    NEW.invite_status := 'none';
    NEW.invited_at := NULL;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS students_clear_block_trg ON public.students;
CREATE TRIGGER students_clear_block_trg
  BEFORE UPDATE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_clear_block();

DO $$
BEGIN
  RAISE NOTICE 'students: a teacher address can no longer claim a roster row';
END $$;


-- =====================================================================
-- 40. One row per child per teacher, and a delete that means it
-- =====================================================================
--
-- Three rules the roster could not express, all of them about the fact
-- that a student row belongs to a TEACHER, not to the platform.
--
-- **The same address twice in one teacher's class is a mistake, always.**
-- Nothing stopped it, so a teacher who typed a name again — or pressed
-- Create twice on a slow connection — got a second row, a second
-- invitation to the same inbox, and a class list that double-counts a
-- child who is sitting in the room once. The index below is per teacher,
-- not global, because the same address on TWO teachers' rosters is the
-- ordinary case this product is built around.
--
-- **A teacher removing a student removes her own row and nothing else.**
-- That already holds — deleteStudent() scopes to created_by — and it is
-- worth stating because the opposite is what people expect: her Delete
-- is "not in my class any more", never "erase this child". The account
-- survives, the other teachers' rows survive, and the student keeps
-- every class they still hold.
--
-- **A super admin removing a student means it.** That is the one delete
-- that is allowed to reach the person: every roster row they hold, and
-- the login itself, so a test address can be used again from clean.
-- Teachers cannot reach this and never should.

-- ── one address per teacher ───────────────────────────────────────────
--
-- Partial: rows without an email are the normal paper-roster case and
-- any number of them may exist. lower() because a teacher who types
-- Alif@… on Tuesday and alif@… on Friday means the same child.
CREATE UNIQUE INDEX IF NOT EXISTS students_teacher_email_unique
  ON public.students (created_by, lower(email))
  WHERE coalesce(trim(email), '') <> '';

-- ── the super admin's delete ──────────────────────────────────────────
--
-- Removes one roster row. If that was the last row the person held and
-- they do not also teach here, the account goes too — otherwise a
-- deleted student leaves behind a login that can sign in, match nothing,
-- and sit in auth.users forever. Purging it is also what makes an
-- address reusable for the next test.
--
-- The faculty check is the safety catch: a person who teaches AND was
-- once on a roster must never lose their teaching account to a student
-- cleanup.
CREATE OR REPLACE FUNCTION public.sa_delete_student(
  p_student uuid,
  p_purge_account boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; remaining int; purged boolean := false;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT user_id INTO uid FROM students WHERE id = p_student;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('deleted', false, 'reason', 'not_found');
  END IF;

  DELETE FROM students WHERE id = p_student;

  IF p_purge_account AND uid IS NOT NULL THEN
    SELECT count(*) INTO remaining FROM students WHERE user_id = uid;
    IF remaining = 0 AND NOT EXISTS (SELECT 1 FROM faculty f WHERE f.user_id = uid) THEN
      DELETE FROM public.users WHERE id = uid;
      DELETE FROM auth.users  WHERE id = uid;
      purged := true;
    END IF;
  END IF;

  RETURN jsonb_build_object('deleted', true, 'account_purged', purged);
END $$;
GRANT EXECUTE ON FUNCTION public.sa_delete_student(uuid, boolean) TO authenticated;

-- ── the console needs to know who it is deleting ──────────────────────
--
-- The list carried no email and no teacher, which is not enough to
-- decide anything: two children called Alif on two rosters look
-- identical, and the delete above is not reversible.
CREATE OR REPLACE FUNCTION public.sa_students(p_limit integer DEFAULT 100, p_search text DEFAULT NULL::text)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int := LEAST(GREATEST(COALESCE(p_limit,100),1), 500); q text := NULLIF(TRIM(COALESCE(p_search,'')), '');
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT COALESCE(jsonb_agg(row_to_json(t)), '[]'::jsonb) INTO out FROM (
    SELECT st.id, st.first_name, st.last_name, st.grade, st.division AS section,
           st.email, st.invite_status,
           sc.name AS school, sc.emirate,
           st.user_id IS NOT NULL AS has_account,
           (SELECT trim(coalesce(tu.first_name,'') || ' ' || coalesce(tu.last_name,''))
              FROM faculty tf JOIN users tu ON tu.id = tf.user_id
             WHERE tf.id = st.created_by) AS teacher,
           (SELECT count(*) FROM quiz_attempts qa WHERE qa.student_id = st.id) AS attempts,
           (SELECT round(avg(qa.score / NULLIF(qa.max_score,0) * 100)::numeric, 0)
              FROM quiz_attempts qa WHERE qa.student_id = st.id AND qa.score IS NOT NULL) AS avg_pct,
           (SELECT max(qa.submitted_at) FROM quiz_attempts qa WHERE qa.student_id = st.id) AS last_activity
      FROM students st LEFT JOIN schools sc ON sc.id = st.school_id
     WHERE q IS NULL
        OR st.first_name ILIKE '%'||q||'%' OR st.last_name ILIKE '%'||q||'%'
        OR st.email ILIKE '%'||q||'%'
        OR sc.name ILIKE '%'||q||'%'
     ORDER BY last_activity DESC NULLS LAST, st.created_at DESC
     LIMIT n
  ) t;
  RETURN out;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'students: one address per teacher; super admin delete purges the account';
END $$;


-- =====================================================================
-- 41. A student may read their own roster row
-- =====================================================================
--
-- students_read granted access two ways, and both of them are a
-- teacher's: the row is one she created, or it sits in one of her
-- classes. A student reading their OWN row matched neither, because
-- current_faculty_id() is NULL for someone who does not teach — so
-- `created_by = NULL` is NULL, the EXISTS finds nothing, and the policy
-- denies the student the one row that is about them.
--
-- The visible failure was a sign-in loop. getProfile() looks for a
-- claimed roster row before it gives up with `no_teacher_row`; the SELECT
-- returned nothing, so a student who HAD successfully claimed their row
-- was told they had no profile, sent back to sign in, linked again —
-- already linked — and bounced round again. The claim was never the
-- problem, which is why the database looked correct throughout.
--
-- Read only. A student must not edit or delete the row: it is the
-- teacher's record of them, carrying her grade, her section and her
-- subject, and `students_upd` / `students_del` stay teacher-only.
DROP POLICY IF EXISTS students_read ON public.students;
CREATE POLICY students_read ON public.students
  FOR SELECT TO authenticated
  USING (
    (
      created_by = current_faculty_id()
      OR EXISTS (
        SELECT 1 FROM class_members cm
          JOIN classes c ON c.id = cm.class_id
         WHERE cm.student_id = students.id
           AND c.faculty_id = current_faculty_id()
      )
      -- The student themselves. Every row they have claimed, so a child
      -- taught by three teachers sees all three classes.
      OR user_id = (SELECT auth.uid())
    )
    AND is_current_device()
  );

DO $$
BEGIN
  RAISE NOTICE 'students: a student can now read their own roster row';
END $$;


-- =====================================================================
-- 42. A student without an email is a student who cannot be reached
-- =====================================================================
--
-- The column was optional because the roster began as a paper list — a
-- teacher typing names to mark attendance against. It is no longer that.
-- The address is the whole of a student's identity here: it is what the
-- invitation is sent to, it is what Google returns at sign-in, and it is
-- the key link_student_account() matches to claim the row. A roster row
-- without one can never become a person; it is a name that can never log
-- in, never be assigned work, and never appear in the student portal.
--
-- Enforced in the database rather than only in the form, because the form
-- is one of three ways rows arrive — the modal, the bulk import, and
-- anything a future screen adds. A rule that lives in one of them is a
-- rule the other two do not have.
--
-- Blank is not absent: '' would satisfy NOT NULL and fail every use, so
-- the CHECK is on trimmed length, not on NULL.

DO $$
DECLARE blank int;
BEGIN
  SELECT count(*) INTO blank FROM public.students WHERE coalesce(trim(email), '') = '';
  IF blank > 0 THEN
    -- Refuse rather than invent addresses. A deployment carrying paper-roster
    -- rows needs a decision from the person who owns them, not a migration
    -- that quietly fills them in with something unroutable.
    RAISE EXCEPTION 'students: % row(s) have no email; fill or remove them before this migration', blank;
  END IF;
END $$;

ALTER TABLE public.students ALTER COLUMN email SET NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'students_email_present'
                    AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.students ADD CONSTRAINT students_email_present
      CHECK (length(trim(email)) > 0);
  END IF;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'students: email is now required';
END $$;


-- =====================================================================
-- 43. The console's delete, where the console actually looks
-- =====================================================================
--
-- /api/admin/* is answered in the BROWSER by these RPCs, not by the API
-- service — src/lib/data/superadmin.ts maps the paths straight onto
-- sa_stats(), sa_accounts() and sa_delete_account(). Fixing the Express
-- routes of the same name therefore changed nothing anyone could see,
-- which is worth writing down because the two layers look identical from
-- the frontend and only one of them runs.
--
-- Three faults, all visible on one screen:
--
--   * sa_accounts() returned deleted accounts like any other, so pressing
--     the bin appeared to do nothing — the row came back on the reload,
--     and the status pill was the only clue it had worked at all;
--   * sa_stats() counted them too, so the total disagreed with the list;
--   * sa_delete_account() was a soft delete and nothing more. The account
--     stayed in auth.users, kept its email, and the address could never
--     be reused — which is exactly what a test account needs to be.
--
-- Soft delete was the right default for a product that had no way to say
-- what "gone" meant. It has one now: below, and it is deliberate.

-- ── the list ──────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sa_accounts(p_include_deleted boolean DEFAULT false)
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
     WHERE p_include_deleted OR COALESCE(status, 'active') <> 'deleted'
  ) t;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.sa_accounts(boolean) TO authenticated;

-- ── the cards ─────────────────────────────────────────────────────────
--
-- Also stops counting `role = 'teacher'`. Every row in `accounts` has a
-- faculty row and therefore teaches; a super admin who also teaches
-- carries her granted role in users.role rather than 'teacher', and was
-- silently missing from her own console's totals.
CREATE OR REPLACE FUNCTION public.sa_stats()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate_any(ARRAY['admin.accounts','admin.dashboard']);
  SELECT jsonb_build_object(
    'active_teachers',    count(*) FILTER (WHERE COALESCE(status,'active') = 'active'),
    'suspended_teachers', count(*) FILTER (WHERE status = 'suspended'),
    'total_teachers',     count(*) FILTER (WHERE COALESCE(status,'active') <> 'deleted'),
    'lapsed',             count(*) FILTER (
                            WHERE COALESCE(status,'active') <> 'deleted'
                              AND (subscription_status IS NULL
                                   OR subscription_status IN ('expired','canceled','past_due')
                                   OR (subscription_ends_at IS NOT NULL
                                       AND subscription_ends_at < now())))
  ) INTO out
  FROM public.accounts;
  RETURN out;
END $$;

-- ── the delete ────────────────────────────────────────────────────────
--
-- Hard by default. Everything a teacher owns is ON DELETE CASCADE from
-- her faculty row — classes, studio work, goals, skills, schedule,
-- attendance, marks, credits, subscription — so removing the row removes
-- her world with it, and removing the login frees the address.
--
-- Her roster rows are the exception and have to be handled by hand:
-- students.created_by is ON DELETE SET NULL, so deleting her would leave
-- every child she entered owned by nobody. An orphan row is not merely
-- untidy, it is unreachable: every students policy is written in terms of
-- created_by, so a row with NULL there can be read by no one, edited by
-- no one, and deleted by no one. They go with her.
--
-- The claimed ones keep their accounts. A student is a person, not this
-- teacher's property — she may be one of three teachers who invited them,
-- and losing their login because she closed her account is not a thing
-- the platform is allowed to do. sa_delete_student() is where a student's
-- account is removed, one row at a time, on purpose.
CREATE OR REPLACE FUNCTION public.sa_delete_account(
  p_faculty uuid,
  p_hard boolean DEFAULT true
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; target_role text; roster int;
BEGIN
  PERFORM public.sa_gate('admin.accounts');
  uid := public.sa_user_of(p_faculty);
  IF uid IS NULL THEN RAISE EXCEPTION 'account not found'; END IF;
  IF uid = (SELECT auth.uid()) THEN
    RAISE EXCEPTION 'cannot delete your own account' USING ERRCODE = '42501';
  END IF;

  SELECT role INTO target_role FROM users WHERE id = uid;
  IF target_role IN ('super_admin', 'dev') THEN
    -- The console cannot be used to remove the people who own the console.
    RAISE EXCEPTION 'cannot delete a privileged account' USING ERRCODE = '42501';
  END IF;

  IF NOT p_hard THEN
    UPDATE users SET account_status = 'deleted', active_session_id = NULL, updated_at = now()
     WHERE id = uid;
    PERFORM public.sa_write_audit('admin.teacher.delete', 'users', uid,
                                  jsonb_build_object('faculty_id', p_faculty, 'soft', true));
    RETURN jsonb_build_object('ok', true, 'id', p_faculty, 'hard', false);
  END IF;

  -- Would be orphaned by the SET NULL, and unreachable if it were.
  DELETE FROM students WHERE created_by = p_faculty;
  GET DIAGNOSTICS roster = ROW_COUNT;

  PERFORM public.sa_write_audit('admin.teacher.delete', 'users', uid,
                                jsonb_build_object('faculty_id', p_faculty,
                                                   'soft', false,
                                                   'roster_removed', roster));

  DELETE FROM faculty      WHERE id = p_faculty;   -- cascades her whole world
  DELETE FROM public.users WHERE id = uid;
  DELETE FROM auth.users   WHERE id = uid;

  RETURN jsonb_build_object('ok', true, 'id', p_faculty, 'hard', true, 'roster_removed', roster);
END $$;
GRANT EXECUTE ON FUNCTION public.sa_delete_account(uuid, boolean) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'console: deleted accounts are hidden, uncounted, and actually deleted';
END $$;


-- ── drop the pre-§43 signatures ───────────────────────────────────────
--
-- CREATE OR REPLACE with a new defaulted parameter does not replace a
-- function, it OVERLOADS it. Both versions were live, and the browser
-- calls rpc("sa_accounts") with no arguments — which resolves to the
-- zero-arg one. The migration ran, reported success, and the console kept
-- calling the old unfiltered list and the old soft delete.
--
-- Dropped by exact signature so only the stale arities go.
DROP FUNCTION IF EXISTS public.sa_accounts();
DROP FUNCTION IF EXISTS public.sa_delete_account(uuid);

DO $$
BEGIN
  RAISE NOTICE 'console: stale sa_accounts()/sa_delete_account(uuid) overloads removed';
END $$;


-- =====================================================================
-- 44. Once a student, always a student
-- =====================================================================
--
-- provisionTeacher() asks link_student_account() first and creates a
-- faculty row whenever the answer is anything but a clear `linked: true`.
-- That is the right default for a stranger and the wrong one for someone
-- the platform already knows: a student whose teacher has removed them
-- from her class holds no invited row, so the claim answers `no_match`,
-- the fall-through runs, and the next sign-in silently turns them into a
-- teacher. From then on the §39 guard refuses them as `is_teacher` and
-- the same address can never be invited again.
--
-- The role a person already holds is the answer, and it belongs in the
-- database rather than in the one function that happens to write the row
-- today. A trigger cannot be routed around by a second code path.

-- ── a student may not become a teacher ────────────────────────────────
CREATE OR REPLACE FUNCTION public.faculty_block_students()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM users u WHERE u.id = NEW.user_id AND u.role = 'student') THEN
    RAISE EXCEPTION 'this account is a student and cannot become a teacher'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS faculty_block_students_trg ON public.faculty;
CREATE TRIGGER faculty_block_students_trg
  BEFORE INSERT ON public.faculty
  FOR EACH ROW EXECUTE FUNCTION public.faculty_block_students();

-- ── undo the ones already granted ─────────────────────────────────────
--
-- Anyone carrying users.role = 'student' AND a faculty row got it from
-- the fall-through above; nothing else can produce that pair. The faculty
-- row is the wrong half, and it is safe to drop precisely when the
-- account owns no teaching work.
DO $$
DECLARE fixed int;
BEGIN
  WITH wrong AS (
    SELECT f.id
      FROM faculty f
      JOIN users u ON u.id = f.user_id
     WHERE u.role = 'student'
       AND NOT EXISTS (SELECT 1 FROM students  s WHERE s.created_by = f.id)
       AND NOT EXISTS (SELECT 1 FROM classes   c WHERE c.faculty_id = f.id)
       AND NOT EXISTS (SELECT 1 FROM ai_studio a WHERE a.faculty_id = f.id)
  )
  DELETE FROM faculty WHERE id IN (SELECT id FROM wrong);
  GET DIAGNOSTICS fixed = ROW_COUNT;
  IF fixed > 0 THEN
    RAISE NOTICE 'roles: removed % faculty row(s) wrongly granted to students', fixed;
  END IF;
END $$;

-- ── re-adding someone the platform already knows ──────────────────────
--
-- A teacher who removes a student and adds them back should not have to
-- invite them again. The invitation exists to prove the address belongs
-- to someone a teacher chose; that was established the first time, and
-- the account on the other end is already a student. Sending a second
-- "you have been added" mail to an account that can already sign in is
-- noise, and it leaves the row sitting at `invited` when the person is
-- plainly active.
--
-- So: if the address already belongs to a student account, the row is
-- claimed on the spot and no mail is sent.
CREATE OR REPLACE FUNCTION public.attach_known_student(p_student uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE em text; uid uuid; owner uuid;
BEGIN
  SELECT lower(trim(s.email)), s.created_by INTO em, owner
    FROM students s WHERE s.id = p_student;
  IF em IS NULL THEN RETURN jsonb_build_object('attached', false, 'reason', 'not_found'); END IF;

  -- The caller must own the row. DEFINER bypasses RLS, so ownership is
  -- checked by hand exactly as the invite route does.
  IF owner IS DISTINCT FROM public.current_faculty_id() THEN
    RETURN jsonb_build_object('attached', false, 'reason', 'not_yours');
  END IF;

  SELECT u.id INTO uid
    FROM auth.users u
    JOIN public.users pu ON pu.id = u.id
   WHERE lower(u.email) = em AND pu.role = 'student'
   LIMIT 1;

  IF uid IS NULL THEN RETURN jsonb_build_object('attached', false, 'reason', 'no_account'); END IF;

  UPDATE students
     SET user_id = uid, invite_status = 'active', invited_at = now(), updated_at = now()
   WHERE id = p_student;

  RETURN jsonb_build_object('attached', true, 'user_id', uid);
END $$;
GRANT EXECUTE ON FUNCTION public.attach_known_student(uuid) TO authenticated;

-- ── everyone this teacher has ever added ──────────────────────────────
--
-- Powers the address picker on the student form. A teacher re-adding a
-- child she removed last term should not retype a date of birth the
-- platform still holds; she picks the address and the rest arrives.
--
-- Scoped to her own roster. It is a convenience, not a directory: the
-- addresses of other teachers' students are none of her business.
CREATE OR REPLACE FUNCTION public.my_known_students()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; fid uuid;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.last_seen DESC), '[]'::jsonb) INTO out
  FROM (
    SELECT DISTINCT ON (lower(s.email))
           s.email, s.first_name, s.last_name, s.student_id, s.date_of_birth,
           s.gender, s.nationality, s.grade, s.division AS section, s.subject,
           s.phone, s.address, s.school_id,
           s.primary_guardian_name, s.primary_guardian_relation,
           s.primary_guardian_email, s.primary_guardian_phone,
           s.user_id IS NOT NULL AS has_account,
           s.updated_at AS last_seen
      FROM students s
     WHERE s.created_by = fid
     ORDER BY lower(s.email), s.updated_at DESC
  ) t;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.my_known_students() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'roles: a student account can no longer be turned into a teacher';
END $$;


-- =====================================================================
-- 45. A removed student is remembered
-- =====================================================================
--
-- §44 gave the student form a picker of addresses a teacher has used
-- before, and read it from her roster — which is exactly the set that
-- does NOT contain the student she just removed. The one case the
-- feature exists for was the one case it could not serve.
--
-- The row has to outlive the delete, so the delete writes it here first.
-- A separate table rather than a `deleted_at` column on students,
-- because every policy, index, unique constraint and query in the
-- product is written against students as the set of people in a class,
-- and quietly turning it into "people in a class, plus ghosts" is how
-- soft delete rots a schema. This is a filing cabinet, not a roster.
--
-- What it holds is a snapshot, deliberately. If she re-adds the child in
-- March, what she typed in September is the right starting point — not a
-- live join onto a row that no longer exists.

CREATE TABLE IF NOT EXISTS public.removed_students (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id  uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  email       text NOT NULL,
  data        jsonb NOT NULL,
  removed_at  timestamptz NOT NULL DEFAULT now()
);

-- One memory per address per teacher: re-adding and removing the same
-- child four times should leave the most recent snapshot, not four.
CREATE UNIQUE INDEX IF NOT EXISTS removed_students_teacher_email_unique
  ON public.removed_students (faculty_id, lower(email));

ALTER TABLE public.removed_students ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS removed_students_owner ON public.removed_students;
CREATE POLICY removed_students_owner ON public.removed_students
  FOR ALL TO authenticated
  USING (faculty_id = public.current_faculty_id())
  WITH CHECK (faculty_id = public.current_faculty_id());

-- ── the delete writes the memory ──────────────────────────────────────
--
-- A trigger, not a step in deleteStudent(), because the roster is deleted
-- from more than one place: the teacher's own bin, the super admin's, and
-- the cascade when a teacher account is removed. Only the first should
-- leave a memory a teacher can use, but recording all three costs
-- nothing and missing one is a feature that works only sometimes.
CREATE OR REPLACE FUNCTION public.students_remember_removed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.created_by IS NULL OR coalesce(trim(OLD.email), '') = '' THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.removed_students (faculty_id, email, data, removed_at)
  VALUES (
    OLD.created_by,
    OLD.email,
    jsonb_build_object(
      'email', OLD.email,
      'first_name', OLD.first_name,
      'last_name', OLD.last_name,
      'student_id', OLD.student_id,
      'date_of_birth', OLD.date_of_birth,
      'gender', OLD.gender,
      'nationality', OLD.nationality,
      'grade', OLD.grade,
      'section', OLD.division,
      'subject', OLD.subject,
      'phone', OLD.phone,
      'address', OLD.address,
      'school_id', OLD.school_id,
      'primary_guardian_name', OLD.primary_guardian_name,
      'primary_guardian_relation', OLD.primary_guardian_relation,
      'primary_guardian_email', OLD.primary_guardian_email,
      'primary_guardian_phone', OLD.primary_guardian_phone,
      'had_account', OLD.user_id IS NOT NULL
    ),
    now()
  )
  ON CONFLICT (faculty_id, lower(email)) DO UPDATE
    SET data = EXCLUDED.data, removed_at = EXCLUDED.removed_at;

  RETURN OLD;
END $$;

DROP TRIGGER IF EXISTS students_remember_removed_trg ON public.students;
CREATE TRIGGER students_remember_removed_trg
  BEFORE DELETE ON public.students
  FOR EACH ROW EXECUTE FUNCTION public.students_remember_removed();

-- ── the picker reads both ─────────────────────────────────────────────
--
-- Current roster first, then the removed. `on_roster` tells the form
-- which it is looking at: an address still in her class is a duplicate
-- and the unique index will refuse it, and she should be told that
-- before she fills in a whole form.
--
-- `has_account` is answered live rather than from the snapshot, because
-- the account can be claimed or deleted after the row was removed, and
-- it decides the one thing she cares about — whether adding them back
-- sends an invitation or simply puts them in the class.
CREATE OR REPLACE FUNCTION public.my_known_students()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; fid uuid;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.on_roster DESC, t.last_seen DESC), '[]'::jsonb)
    INTO out
  FROM (
    SELECT DISTINCT ON (lower(email))
           email, first_name, last_name, student_id, date_of_birth, gender,
           nationality, grade, section, subject, phone, address, school_id,
           primary_guardian_name, primary_guardian_relation,
           primary_guardian_email, primary_guardian_phone,
           on_roster, last_seen,
           EXISTS (
             SELECT 1 FROM auth.users au JOIN public.users pu ON pu.id = au.id
              WHERE lower(au.email) = lower(email) AND pu.role = 'student'
           ) AS has_account
      FROM (
        SELECT s.email, s.first_name, s.last_name, s.student_id, s.date_of_birth,
               s.gender, s.nationality, s.grade, s.division AS section, s.subject,
               s.phone, s.address, s.school_id,
               s.primary_guardian_name, s.primary_guardian_relation,
               s.primary_guardian_email, s.primary_guardian_phone,
               true AS on_roster, s.updated_at AS last_seen
          FROM students s
         WHERE s.created_by = fid AND coalesce(trim(s.email),'') <> ''

        UNION ALL

        SELECT r.data->>'email', r.data->>'first_name', r.data->>'last_name',
               r.data->>'student_id', (r.data->>'date_of_birth')::date,
               r.data->>'gender', r.data->>'nationality', r.data->>'grade',
               r.data->>'section', r.data->>'subject',
               r.data->>'phone', r.data->>'address', (r.data->>'school_id')::uuid,
               r.data->>'primary_guardian_name', r.data->>'primary_guardian_relation',
               r.data->>'primary_guardian_email', r.data->>'primary_guardian_phone',
               false, r.removed_at
          FROM removed_students r
         WHERE r.faculty_id = fid
      ) u
     ORDER BY lower(email), on_roster DESC, last_seen DESC
  ) t;

  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.my_known_students() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'students: removed students are remembered for re-adding';
END $$;


-- =====================================================================
-- 46. my_known_students(): qualify the ambiguous email
-- =====================================================================
--
-- The EXISTS that answers `has_account` joins auth.users, which has an
-- `email` column of its own — so the bare `lower(email)` inside it was
-- ambiguous and the whole function raised 42702. knownStudents() catches
-- its own errors and answers [], so the picker simply never appeared:
-- no error in the console, no failed request, an empty dropdown that
-- looked like "you have no past students".
--
-- Qualified as u.email, which is the subquery's column and always was.
CREATE OR REPLACE FUNCTION public.my_known_students()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; fid uuid;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.on_roster DESC, t.last_seen DESC), '[]'::jsonb)
    INTO out
  FROM (
    SELECT DISTINCT ON (lower(u.email))
           u.email, u.first_name, u.last_name, u.student_id, u.date_of_birth, u.gender,
           u.nationality, u.grade, u.section, u.subject, u.phone, u.address, u.school_id,
           u.primary_guardian_name, u.primary_guardian_relation,
           u.primary_guardian_email, u.primary_guardian_phone,
           u.on_roster, u.last_seen,
           EXISTS (
             SELECT 1 FROM auth.users au JOIN public.users pu ON pu.id = au.id
              WHERE lower(au.email) = lower(u.email) AND pu.role = 'student'
           ) AS has_account
      FROM (
        SELECT s.email, s.first_name, s.last_name, s.student_id, s.date_of_birth,
               s.gender, s.nationality, s.grade, s.division AS section, s.subject,
               s.phone, s.address, s.school_id,
               s.primary_guardian_name, s.primary_guardian_relation,
               s.primary_guardian_email, s.primary_guardian_phone,
               true AS on_roster, s.updated_at AS last_seen
          FROM students s
         WHERE s.created_by = fid AND coalesce(trim(s.email),'') <> ''

        UNION ALL

        SELECT r.data->>'email', r.data->>'first_name', r.data->>'last_name',
               r.data->>'student_id', (r.data->>'date_of_birth')::date,
               r.data->>'gender', r.data->>'nationality', r.data->>'grade',
               r.data->>'section', r.data->>'subject',
               r.data->>'phone', r.data->>'address',
               NULLIF(r.data->>'school_id','')::uuid,
               r.data->>'primary_guardian_name', r.data->>'primary_guardian_relation',
               r.data->>'primary_guardian_email', r.data->>'primary_guardian_phone',
               false, r.removed_at
          FROM removed_students r
         WHERE r.faculty_id = fid
      ) u
     ORDER BY lower(u.email), u.on_roster DESC, u.last_seen DESC
  ) t;

  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.my_known_students() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'students: known-student picker query fixed';
END $$;


-- =====================================================================
-- 47. The guardian column is `relationship`, not `relation`
-- =====================================================================
--
-- §45 and §46 both wrote primary_guardian_relation. The column has always
-- been primary_guardian_relationship, so my_known_students() raised 42703
-- and the picker silently rendered as "you have never added anyone" —
-- knownStudents() answered [] on error, which is indistinguishable from
-- an empty list.
--
-- The same name is in students_remember_removed(), where it is worse: it
-- would raise inside a BEFORE DELETE trigger, so deleting any student
-- with an email would have failed outright. Fixed here before anyone met
-- it. Both secondary-guardian columns are carried too, since the snapshot
-- exists to refill the whole form.

CREATE OR REPLACE FUNCTION public.students_remember_removed()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.created_by IS NULL OR coalesce(trim(OLD.email), '') = '' THEN
    RETURN OLD;
  END IF;

  INSERT INTO public.removed_students (faculty_id, email, data, removed_at)
  VALUES (
    OLD.created_by,
    OLD.email,
    jsonb_build_object(
      'email', OLD.email,
      'first_name', OLD.first_name,
      'last_name', OLD.last_name,
      'student_id', OLD.student_id,
      'date_of_birth', OLD.date_of_birth,
      'gender', OLD.gender,
      'nationality', OLD.nationality,
      'grade', OLD.grade,
      'section', OLD.division,
      'subject', OLD.subject,
      'phone', OLD.phone,
      'address', OLD.address,
      'notes', OLD.notes,
      'school_id', OLD.school_id,
      'enrollment_date', OLD.enrollment_date,
      'primary_guardian_name', OLD.primary_guardian_name,
      'primary_guardian_relationship', OLD.primary_guardian_relationship,
      'primary_guardian_email', OLD.primary_guardian_email,
      'primary_guardian_phone', OLD.primary_guardian_phone,
      'secondary_guardian_name', OLD.secondary_guardian_name,
      'secondary_guardian_relationship', OLD.secondary_guardian_relationship,
      'secondary_guardian_email', OLD.secondary_guardian_email,
      'secondary_guardian_phone', OLD.secondary_guardian_phone,
      'had_account', OLD.user_id IS NOT NULL
    ),
    now()
  )
  ON CONFLICT (faculty_id, lower(email)) DO UPDATE
    SET data = EXCLUDED.data, removed_at = EXCLUDED.removed_at;

  RETURN OLD;
END $$;

CREATE OR REPLACE FUNCTION public.my_known_students()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; fid uuid;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.on_roster DESC, t.last_seen DESC), '[]'::jsonb)
    INTO out
  FROM (
    SELECT DISTINCT ON (lower(u.email))
           u.email, u.first_name, u.last_name, u.student_id, u.date_of_birth, u.gender,
           u.nationality, u.grade, u.section, u.subject, u.phone, u.address, u.notes,
           u.school_id, u.enrollment_date,
           u.primary_guardian_name, u.primary_guardian_relationship,
           u.primary_guardian_email, u.primary_guardian_phone,
           u.secondary_guardian_name, u.secondary_guardian_relationship,
           u.secondary_guardian_email, u.secondary_guardian_phone,
           u.on_roster, u.last_seen,
           EXISTS (
             SELECT 1 FROM auth.users au JOIN public.users pu ON pu.id = au.id
              WHERE lower(au.email) = lower(u.email) AND pu.role = 'student'
           ) AS has_account
      FROM (
        SELECT s.email, s.first_name, s.last_name, s.student_id, s.date_of_birth,
               s.gender, s.nationality, s.grade, s.division AS section, s.subject,
               s.phone, s.address, s.notes, s.school_id, s.enrollment_date,
               s.primary_guardian_name, s.primary_guardian_relationship,
               s.primary_guardian_email, s.primary_guardian_phone,
               s.secondary_guardian_name, s.secondary_guardian_relationship,
               s.secondary_guardian_email, s.secondary_guardian_phone,
               true AS on_roster, s.updated_at AS last_seen
          FROM students s
         WHERE s.created_by = fid AND coalesce(trim(s.email),'') <> ''

        UNION ALL

        SELECT r.data->>'email', r.data->>'first_name', r.data->>'last_name',
               r.data->>'student_id', NULLIF(r.data->>'date_of_birth','')::date,
               r.data->>'gender', r.data->>'nationality', r.data->>'grade',
               r.data->>'section', r.data->>'subject',
               r.data->>'phone', r.data->>'address', r.data->>'notes',
               NULLIF(r.data->>'school_id','')::uuid,
               NULLIF(r.data->>'enrollment_date','')::date,
               r.data->>'primary_guardian_name', r.data->>'primary_guardian_relationship',
               r.data->>'primary_guardian_email', r.data->>'primary_guardian_phone',
               r.data->>'secondary_guardian_name', r.data->>'secondary_guardian_relationship',
               r.data->>'secondary_guardian_email', r.data->>'secondary_guardian_phone',
               false, r.removed_at
          FROM removed_students r
         WHERE r.faculty_id = fid
      ) u
     ORDER BY lower(u.email), u.on_roster DESC, u.last_seen DESC
  ) t;

  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.my_known_students() TO authenticated;

-- The seeded memory of Tommy carried the wrong key too.
UPDATE public.removed_students
   SET data = (data - 'primary_guardian_relation')
              || jsonb_build_object('primary_guardian_relationship',
                                    data->>'primary_guardian_relation')
 WHERE data ? 'primary_guardian_relation';

DO $$
BEGIN
  RAISE NOTICE 'students: guardian column name corrected in picker and delete trigger';
END $$;


-- =====================================================================
-- 48. Work reaches a student by grade and subject
-- =====================================================================
--
-- The teacher schedules work into schedule_entries: a generation, a date,
-- a grade, a subject, sometimes a section. student_dashboard() read work
-- from somewhere else entirely —
--
--     class_members -> classes -> assignments -> ai_studio
--
-- — three tables that hold zero rows and that nothing in the product has
-- ever written. They are the remains of an earlier design in which a
-- teacher built named classes and enrolled students into them one by one.
-- That is not what was built. She types a grade and a subject on the
-- roster row, and she types a grade and a subject when she schedules; the
-- two are matched, and no one enrols anyone.
--
-- So the student side reads what the teacher side writes. Nothing else
-- would have made a single item appear.
--
-- Three normalisations stand between the two, and each one silently
-- returns nothing if it is skipped:
--
--   * grade is 'Grade 5' on the student and '5' on the schedule;
--   * subject is free text on both sides — Math, Maths, Mathematics;
--   * section is usually null on the schedule, and null means EVERY
--     section, not none. Read literally it excludes the whole school.
--
-- And one scope rule that is not a normalisation at all: the entry must
-- belong to the teacher whose roster row this is. Without it a child in
-- Grade 5 Science receives the work of every Grade 5 Science teacher in
-- the country, which is a data leak wearing the clothes of a feature.

-- ── comparing what people typed ───────────────────────────────────────
--
-- IMMUTABLE so they can be indexed later if this gets slow; both answer
-- NULL for NULL so a missing value never accidentally equals another
-- missing value.
CREATE OR REPLACE FUNCTION public.norm_grade(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  -- 'Grade 5', 'grade5', 'G5', 'Class 5', 'Std 5', '5' -> '5'.
  -- KG and Reception have no digits and are compared as themselves.
  SELECT CASE
    WHEN p IS NULL OR btrim(p) = '' THEN NULL
    WHEN regexp_replace(p, '\D', '', 'g') <> '' THEN regexp_replace(p, '\D', '', 'g')
    ELSE lower(btrim(p))
  END;
$$;

CREATE OR REPLACE FUNCTION public.norm_subject(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
AS $$
  -- Case, spacing and the one genuine synonym set in UAE schools. Kept
  -- deliberately short: guessing that 'Bio' means Biology is the kind of
  -- cleverness that hides a teacher's typo from her instead of showing it.
  SELECT CASE lower(regexp_replace(btrim(COALESCE(p,'')), '\s+', ' ', 'g'))
    WHEN ''             THEN NULL
    WHEN 'math'         THEN 'math'
    WHEN 'maths'        THEN 'math'
    WHEN 'mathematics'  THEN 'math'
    WHEN 'ict'          THEN 'computer science'
    WHEN 'computing'    THEN 'computer science'
    ELSE lower(regexp_replace(btrim(COALESCE(p,'')), '\s+', ' ', 'g'))
  END;
$$;

-- ── an attempt belongs to a scheduled entry ───────────────────────────
--
-- quiz_attempts.assignment_id pointed at `assignments`, which is empty
-- and unwritten, so no attempt could ever have been recorded. Repointed
-- at schedule_entries — the column keeps its name because every query
-- and policy in the product already says assignment_id, and renaming it
-- would be a wide change to say the same thing.
DO $$
DECLARE fk text;
BEGIN
  SELECT conname INTO fk
    FROM pg_constraint
   WHERE conrelid = 'public.quiz_attempts'::regclass
     AND contype = 'f'
     AND confrelid = 'public.assignments'::regclass
   LIMIT 1;
  IF fk IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.quiz_attempts DROP CONSTRAINT %I', fk);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.quiz_attempts'::regclass
       AND contype = 'f'
       AND confrelid = 'public.schedule_entries'::regclass
  ) THEN
    ALTER TABLE public.quiz_attempts
      ADD CONSTRAINT quiz_attempts_entry_fk
      FOREIGN KEY (assignment_id) REFERENCES public.schedule_entries(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ── what a student may read ───────────────────────────────────────────
--
-- The dashboard is SECURITY DEFINER and does its own scoping, but a
-- student also opens the work itself, and that read goes through RLS on
-- ai_studio. Matching is expressed once, here, as a function both can
-- use.
CREATE OR REPLACE FUNCTION public.student_entry_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT se.id
    FROM schedule_entries se
    JOIN students st
      ON st.created_by = se.faculty_id           -- her students, not everyone's
     AND public.norm_grade(st.grade) IS NOT DISTINCT FROM public.norm_grade(se.grade)
     AND (public.norm_subject(se.subject) IS NULL
          OR public.norm_subject(se.subject) = public.norm_subject(st.subject))
     AND (COALESCE(btrim(se.section), '') = ''   -- no section named = the whole grade
          OR lower(btrim(se.section)) = lower(btrim(COALESCE(st.division, ''))))
   WHERE st.user_id = (SELECT auth.uid())
     AND se.draft_id IS NOT NULL                 -- a slot with nothing in it is a timetable, not work
     AND COALESCE(se.status, 'planned') <> 'cancelled';
$$;
GRANT EXECUTE ON FUNCTION public.student_entry_ids() TO authenticated;

-- A student may read the generation behind work that reaches them.
DROP POLICY IF EXISTS ai_studio_student_read ON public.ai_studio;
CREATE POLICY ai_studio_student_read ON public.ai_studio
  FOR SELECT TO authenticated
  USING (
    deleted_at IS NULL
    AND id IN (SELECT se.draft_id FROM schedule_entries se
                WHERE se.id IN (SELECT public.student_entry_ids()))
  );

-- And the entry itself, for the date and the title.
DROP POLICY IF EXISTS schedule_entries_student_read ON public.schedule_entries;
CREATE POLICY schedule_entries_student_read ON public.schedule_entries
  FOR SELECT TO authenticated
  USING (id IN (SELECT public.student_entry_ids()));

-- ── the dashboard ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.student_dashboard()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; n int;
BEGIN
  SELECT count(*) INTO n FROM students WHERE user_id = (SELECT auth.uid());
  IF n = 0 THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'student', (
      SELECT jsonb_build_object(
        'id', st.id, 'first_name', st.first_name, 'last_name', st.last_name,
        'email', st.email, 'grade', st.grade, 'section', st.division,
        'school', (SELECT name FROM schools WHERE id = st.school_id)
      ) FROM students st WHERE st.id = public.current_student_id()
    ),

    -- Who teaches them, and for what. With three teachers in one list,
    -- "Unit 4 quiz" says nothing about whose it is.
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

    /**
     * Everything scheduled to this child's grade and subject.
     *
     * Joined student-row-first so the same entry reaching them through
     * two teachers appears twice, correctly, with each teacher named —
     * rather than collapsing into one card that belongs to nobody.
     */
    'work', (
      SELECT COALESCE(jsonb_agg(row_to_json(w) ORDER BY w.date DESC NULLS LAST), '[]'::jsonb) FROM (
        SELECT se.id AS assignment_id, gen.id AS work_id, gen.type,
               COALESCE(NULLIF(se.title,''), gen.content->>'title', gen.content->>'name', 'Work') AS title,
               se.date, se.start_time, se.end_time, se.location, se.notes,
               se.subject, se.grade, se.section,
               st.id AS student_row_id,
               TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS teacher,
               qa.status, qa.score, qa.max_score, qa.submitted_at
          FROM students st
          JOIN schedule_entries se
            ON st.created_by = se.faculty_id
           AND public.norm_grade(st.grade) IS NOT DISTINCT FROM public.norm_grade(se.grade)
           AND (public.norm_subject(se.subject) IS NULL
                OR public.norm_subject(se.subject) = public.norm_subject(st.subject))
           AND (COALESCE(btrim(se.section), '') = ''
                OR lower(btrim(se.section)) = lower(btrim(COALESCE(st.division, ''))))
          JOIN ai_studio gen ON gen.id = se.draft_id AND gen.deleted_at IS NULL
          LEFT JOIN faculty f ON f.id = se.faculty_id
          LEFT JOIN users   u ON u.id = f.user_id
          LEFT JOIN quiz_attempts qa
                 ON qa.assignment_id = se.id AND qa.student_id = st.id
         WHERE st.id IN (SELECT public.current_student_ids())
           AND COALESCE(se.status, 'planned') <> 'cancelled'
      ) w
    ),

    'scores', (
      SELECT COALESCE(jsonb_agg(row_to_json(s2) ORDER BY s2.submitted_at DESC NULLS LAST), '[]'::jsonb) FROM (
        SELECT qa.id, qa.score, qa.max_score, qa.submitted_at, gen.type, se.subject,
               COALESCE(NULLIF(se.title,''), gen.content->>'title', 'Work') AS title
          FROM quiz_attempts qa
          LEFT JOIN schedule_entries se ON se.id = qa.assignment_id
          LEFT JOIN ai_studio gen ON gen.id = se.draft_id
         WHERE qa.student_id IN (SELECT public.current_student_ids())
           AND qa.score IS NOT NULL
         ORDER BY qa.submitted_at DESC NULLS LAST LIMIT 40
      ) s2
    ),

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

DO $$
BEGIN
  RAISE NOTICE 'students: work now reaches them by grade and subject';
END $$;


-- =====================================================================
-- 49. The student's classes: subjects, work, submissions, attendance
-- =====================================================================
--
-- A student holds ONE grade and several subjects, one per teacher. That
-- is the whole shape of their world here, and it is already recorded:
-- each roster row a teacher created carries her subject, so the set of
-- rows IS the set of subjects. Nothing new needs enrolling.
--
-- What was missing is everything the student does back:
--
--   * submissions — homework and activity handed in as files;
--   * quiz_attempts they may actually write to (the policies allowed a
--     teacher to read them and nobody to create one);
--   * attendance marked by turning up rather than by a teacher's
--     register;
--   * and a lesson plan reduced to the part that is for them.
--
-- The rule that governs all of it: a student sees their own work and
-- nobody else's, ever. Not a classmate's score, not a classmate's upload,
-- not the fact that a classmate submitted. Every policy below is written
-- against current_student_ids(), which is the set of roster rows THIS
-- login has claimed.

-- ── what the student is enrolled in ───────────────────────────────────
--
-- One grade, several subjects, one teacher each. Returned with a count
-- of outstanding work so the sidebar can carry a number without a second
-- round trip per subject.
CREATE OR REPLACE FUNCTION public.student_subjects()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.subject NULLS LAST), '[]'::jsonb) INTO out
  FROM (
    SELECT st.id            AS student_row_id,
           st.subject,
           st.grade,
           st.division      AS section,
           TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS teacher,
           f.id             AS faculty_id,
           (SELECT count(*) FROM schedule_entries se
             WHERE se.faculty_id = st.created_by
               AND se.draft_id IS NOT NULL
               AND COALESCE(se.status,'planned') <> 'cancelled'
               AND public.norm_grade(se.grade) IS NOT DISTINCT FROM public.norm_grade(st.grade)
               AND (public.norm_subject(se.subject) IS NULL
                    OR public.norm_subject(se.subject) = public.norm_subject(st.subject))
               AND (COALESCE(btrim(se.section),'') = ''
                    OR lower(btrim(se.section)) = lower(btrim(COALESCE(st.division,''))))
           ) AS work_count
      FROM students st
      LEFT JOIN faculty f ON f.id = st.created_by
      LEFT JOIN users   u ON u.id = f.user_id
     WHERE st.id IN (SELECT public.current_student_ids())
  ) t;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.student_subjects() TO authenticated;

-- ── what a student hands in ───────────────────────────────────────────
--
-- Homework and activities come back as files: photos of a page, a
-- document, a video of the thing they built. One row per student per
-- entry — resubmitting replaces what is there, because a second upload
-- means "this one instead", not "both".
CREATE TABLE IF NOT EXISTS public.submissions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id     uuid NOT NULL REFERENCES public.schedule_entries(id) ON DELETE CASCADE,
  student_id   uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  files        jsonb NOT NULL DEFAULT '[]'::jsonb,   -- [{path,name,type,size}]
  note         text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS submissions_entry_student_unique
  ON public.submissions (entry_id, student_id);
CREATE INDEX IF NOT EXISTS submissions_student_idx ON public.submissions (student_id);
CREATE INDEX IF NOT EXISTS submissions_entry_idx   ON public.submissions (entry_id);

ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;

-- The student: their own rows, and only for work that actually reaches
-- them. Without the entry check a student could submit against any entry
-- id they could guess.
DROP POLICY IF EXISTS submissions_student ON public.submissions;
CREATE POLICY submissions_student ON public.submissions
  FOR ALL TO authenticated
  USING (student_id IN (SELECT public.current_student_ids()))
  WITH CHECK (
    student_id IN (SELECT public.current_student_ids())
    AND entry_id IN (SELECT public.student_entry_ids())
  );

-- The teacher: everything handed in against HER entries, read-only. She
-- grades in her own screens; she does not edit what a child submitted.
DROP POLICY IF EXISTS submissions_teacher_read ON public.submissions;
CREATE POLICY submissions_teacher_read ON public.submissions
  FOR SELECT TO authenticated
  USING (entry_id IN (SELECT id FROM schedule_entries WHERE faculty_id = public.current_faculty_id()));

-- ── a student may sit a quiz ──────────────────────────────────────────
--
-- quiz_attempts had a policy for reading and none for writing, so no
-- attempt could be created by the person taking it. One attempt, and it
-- locks: an UPDATE is refused once submitted_at is set, which is the
-- database saying what "submit once" means rather than the UI hoping.
DROP POLICY IF EXISTS quiz_attempts_student ON public.quiz_attempts;
CREATE POLICY quiz_attempts_student ON public.quiz_attempts
  FOR ALL TO authenticated
  USING (student_id IN (SELECT public.current_student_ids()))
  WITH CHECK (
    student_id IN (SELECT public.current_student_ids())
    AND assignment_id IN (SELECT public.student_entry_ids())
  );

CREATE OR REPLACE FUNCTION public.quiz_attempt_locked()
RETURNS trigger
LANGUAGE plpgsql SET search_path = public, pg_temp
AS $$
BEGIN
  -- A teacher marking it later is a different caller and is allowed.
  IF OLD.submitted_at IS NOT NULL
     AND public.current_faculty_id() IS NULL
     AND NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'this quiz has already been submitted' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS quiz_attempt_locked_trg ON public.quiz_attempts;
CREATE TRIGGER quiz_attempt_locked_trg
  BEFORE UPDATE ON public.quiz_attempts
  FOR EACH ROW EXECUTE FUNCTION public.quiz_attempt_locked();

-- ── present because they turned up ────────────────────────────────────
--
-- Attendance is marked by the student opening the portal, once per day
-- per teacher — the register a teacher would otherwise take by hand.
--
-- DEFINER because attendance is a teacher-owned table the student may
-- not write, and this is the one exception: the platform recording that
-- someone was here. It writes nothing on a day already marked, so a
-- teacher who corrects a record is not overruled by the next page load.
CREATE OR REPLACE FUNCTION public.student_mark_present()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE marked int := 0;
BEGIN
  INSERT INTO attendance (faculty_id, student_id, date, status)
  SELECT st.created_by, st.id, current_date, 'present'
    FROM students st
   WHERE st.id IN (SELECT public.current_student_ids())
     AND st.created_by IS NOT NULL
     AND NOT EXISTS (
       SELECT 1 FROM attendance a
        WHERE a.student_id = st.id AND a.date = current_date
     );
  GET DIAGNOSTICS marked = ROW_COUNT;
  RETURN jsonb_build_object('marked', marked, 'date', current_date);
END $$;
GRANT EXECUTE ON FUNCTION public.student_mark_present() TO authenticated;

-- The student reads their own attendance; the teacher's own policies
-- already cover hers.
DROP POLICY IF EXISTS attendance_student_read ON public.attendance;
CREATE POLICY attendance_student_read ON public.attendance
  FOR SELECT TO authenticated
  USING (student_id IN (SELECT public.current_student_ids()));

-- ── one subject, everything in it ─────────────────────────────────────
--
-- The classroom page. Work the teacher scheduled, what the student has
-- done about each item, and nothing about anybody else.
--
-- A lesson plan is trimmed to the student's half. The generation holds a
-- plan, a teaching guide and student notes; the first two are hers and
-- reading them is reading her preparation, not the lesson.
CREATE OR REPLACE FUNCTION public.student_class(p_student_row uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; st students%ROWTYPE;
BEGIN
  SELECT * INTO st FROM students
   WHERE id = p_student_row AND id IN (SELECT public.current_student_ids());
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'subject', st.subject,
    'grade',   st.grade,
    'section', st.division,
    'student_row_id', st.id,
    'teacher', (SELECT TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,''))
                  FROM faculty f JOIN users u ON u.id = f.user_id WHERE f.id = st.created_by),
    'work', (
      SELECT COALESCE(jsonb_agg(row_to_json(w) ORDER BY w.date DESC NULLS LAST), '[]'::jsonb) FROM (
        SELECT se.id AS entry_id, gen.id AS work_id, gen.type,
               COALESCE(NULLIF(se.title,''), gen.content->>'title', gen.content->>'name', 'Work') AS title,
               se.date, se.start_time, se.end_time, se.location, se.notes,
               -- Scheduled means a date was set. Everything reaches them
               -- either way; the date is what tells them when it matters.
               se.date IS NOT NULL AS is_scheduled,
               (se.date IS NOT NULL AND se.date > current_date) AS is_upcoming,
               sub.id IS NOT NULL AS submitted,
               sub.submitted_at,
               sub.files,
               qa.id AS attempt_id, qa.status AS attempt_status,
               qa.score, qa.max_score, qa.submitted_at AS attempted_at
          FROM schedule_entries se
          JOIN ai_studio gen ON gen.id = se.draft_id AND gen.deleted_at IS NULL
          LEFT JOIN submissions sub ON sub.entry_id = se.id AND sub.student_id = st.id
          LEFT JOIN quiz_attempts qa ON qa.assignment_id = se.id AND qa.student_id = st.id
         WHERE se.faculty_id = st.created_by
           AND COALESCE(se.status,'planned') <> 'cancelled'
           AND public.norm_grade(se.grade) IS NOT DISTINCT FROM public.norm_grade(st.grade)
           AND (public.norm_subject(se.subject) IS NULL
                OR public.norm_subject(se.subject) = public.norm_subject(st.subject))
           AND (COALESCE(btrim(se.section),'') = ''
                OR lower(btrim(se.section)) = lower(btrim(COALESCE(st.division,''))))
      ) w
    )
  ) INTO out;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.student_class(uuid) TO authenticated;

-- ── one piece of work, opened ─────────────────────────────────────────
--
-- Separate from the list because the content is large and a class page
-- should not carry every lesson in full. This is also where a lesson
-- plan is cut down: the student gets `student_notes` and nothing else.
CREATE OR REPLACE FUNCTION public.student_work(p_entry uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; se schedule_entries%ROWTYPE; gen ai_studio%ROWTYPE; body jsonb;
BEGIN
  SELECT * INTO se FROM schedule_entries
   WHERE id = p_entry AND id IN (SELECT public.student_entry_ids());
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO gen FROM ai_studio WHERE id = se.draft_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  body := gen.content;

  /**
   * A lesson plan is three documents and only one of them is theirs.
   *
   * The plan and the teaching guide are the teacher's preparation —
   * timings, differentiation, what to do if the class does not follow.
   * Handing a child the script is not the same as teaching them, so the
   * student gets the notes written for them and nothing else.
   */
  IF gen.type = 'lesson_plan' THEN
    body := jsonb_strip_nulls(jsonb_build_object(
      'title', body->>'title',
      'student_notes', COALESCE(body->'student_notes', body->'notes', body->'student_material')
    ));
  END IF;

  SELECT jsonb_build_object(
    'entry_id', se.id,
    'type', gen.type,
    'title', COALESCE(NULLIF(se.title,''), body->>'title', 'Work'),
    'date', se.date, 'start_time', se.start_time, 'end_time', se.end_time,
    'subject', se.subject, 'grade', se.grade, 'section', se.section,
    'notes', se.notes,
    'content', body,
    'submission', (
      SELECT row_to_json(s) FROM (
        SELECT sub.id, sub.files, sub.note, sub.submitted_at
          FROM submissions sub
         WHERE sub.entry_id = se.id AND sub.student_id IN (SELECT public.current_student_ids())
      ) s
    ),
    'attempt', (
      SELECT row_to_json(a) FROM (
        SELECT qa.id, qa.status, qa.answers, qa.score, qa.max_score, qa.submitted_at
          FROM quiz_attempts qa
         WHERE qa.assignment_id = se.id AND qa.student_id IN (SELECT public.current_student_ids())
      ) a
    )
  ) INTO out;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.student_work(uuid) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'students: classes, submissions, attempts and attendance are in place';
END $$;


-- =====================================================================
-- 50. Where a student's work is stored
-- =====================================================================
--
-- Homework comes back as a photo of a page; an activity as a video of
-- the thing they made. Private, always: a child's schoolwork is not
-- public content, and `bulletin-media` is the only public bucket here
-- precisely because a notice board is meant to be seen.
--
-- The path carries the ownership: submissions/<student_row_id>/<entry_id>/<file>
-- so a policy can decide from the key alone, without joining anything.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'submissions', 'submissions', false,
  52428800,  -- 50 MB: a phone video of an activity is the large case
  ARRAY['image/png','image/jpeg','image/webp','image/heic','image/heif',
        'video/mp4','video/quicktime','video/webm',
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain']
)
ON CONFLICT (id) DO UPDATE
  SET file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types,
      public = false;

-- The first path segment is the roster row the upload belongs to, so
-- "is this mine" is a set membership test on a string.
DROP POLICY IF EXISTS submissions_student_write ON storage.objects;
CREATE POLICY submissions_student_write ON storage.objects
  FOR ALL TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.students WHERE user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.students WHERE user_id = (SELECT auth.uid())
    )
  );

-- Her students' uploads, read-only. She marks the work; she does not
-- rewrite what a child handed in.
DROP POLICY IF EXISTS submissions_teacher_read ON storage.objects;
CREATE POLICY submissions_teacher_read ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'submissions'
    AND (storage.foldername(name))[1] IN (
      SELECT id::text FROM public.students WHERE created_by = public.current_faculty_id()
    )
  );

DO $$
BEGIN
  RAISE NOTICE 'storage: private submissions bucket ready';
END $$;


-- =====================================================================
-- 51. One attempt per student per quiz
-- =====================================================================
--
-- The student submits with an upsert on (assignment_id, student_id), and
-- there was no constraint on that pair — so the upsert has nothing to
-- conflict against and Postgres refuses it outright. It is also the rule
-- itself: one attempt is a property of the data, not a promise the UI
-- makes.
--
-- Duplicates cannot exist yet (nothing could write an attempt until §49
-- gave the student a policy), so this applies cleanly.
CREATE UNIQUE INDEX IF NOT EXISTS quiz_attempts_entry_student_unique
  ON public.quiz_attempts (assignment_id, student_id);

DO $$
BEGIN
  RAISE NOTICE 'quiz: one attempt per student per entry';
END $$;


-- =====================================================================
-- 52. student_work() names the roster row it reached them through
-- =====================================================================
--
-- The page submits with it — a quiz attempt and a submission are both
-- keyed by (entry, student row), and a student on two teachers' rosters
-- has two rows that could receive the same entry. It also decides where
-- "Back to class" goes.
--
-- Picked as the row whose subject and grade actually match the entry,
-- not merely the first row the student holds, or a child taught English
-- and Science would hand their science homework in to their English
-- teacher.
CREATE OR REPLACE FUNCTION public.student_work(p_entry uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; se schedule_entries%ROWTYPE; gen ai_studio%ROWTYPE; body jsonb; row_id uuid;
BEGIN
  SELECT * INTO se FROM schedule_entries
   WHERE id = p_entry AND id IN (SELECT public.student_entry_ids());
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO gen FROM ai_studio WHERE id = se.draft_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT st.id INTO row_id
    FROM students st
   WHERE st.id IN (SELECT public.current_student_ids())
     AND st.created_by = se.faculty_id
     AND public.norm_grade(st.grade) IS NOT DISTINCT FROM public.norm_grade(se.grade)
     AND (public.norm_subject(se.subject) IS NULL
          OR public.norm_subject(se.subject) = public.norm_subject(st.subject))
   ORDER BY st.created_at
   LIMIT 1;

  body := gen.content;

  -- A lesson plan is three documents and only one of them is theirs.
  IF gen.type = 'lesson_plan' THEN
    body := jsonb_strip_nulls(jsonb_build_object(
      'title', body->>'title',
      'student_notes', COALESCE(body->'student_notes', body->'notes', body->'student_material')
    ));
  END IF;

  SELECT jsonb_build_object(
    'entry_id', se.id,
    'student_row_id', row_id,
    'type', gen.type,
    'title', COALESCE(NULLIF(se.title,''), body->>'title', 'Work'),
    'date', se.date, 'start_time', se.start_time, 'end_time', se.end_time,
    'subject', se.subject, 'grade', se.grade, 'section', se.section,
    'notes', se.notes,
    'content', body,
    'submission', (
      SELECT row_to_json(s) FROM (
        SELECT sub.id, sub.files, sub.note, sub.submitted_at
          FROM submissions sub
         WHERE sub.entry_id = se.id AND sub.student_id IN (SELECT public.current_student_ids())
      ) s
    ),
    'attempt', (
      SELECT row_to_json(a) FROM (
        SELECT qa.id, qa.status, qa.answers, qa.score, qa.max_score, qa.submitted_at
          FROM quiz_attempts qa
         WHERE qa.assignment_id = se.id AND qa.student_id IN (SELECT public.current_student_ids())
      ) a
    )
  ) INTO out;
  RETURN out;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'students: work carries the roster row it arrived through';
END $$;


-- =====================================================================
-- 53. Multiple choice marks itself; writing waits for the teacher
-- =====================================================================
--
-- The score is computed here and never in the browser. A score the
-- browser calculates is a score the student can calculate differently —
-- and the correct answers would have to be sent to them to do it, which
-- hands over the answer key along with the paper.
--
-- What can be marked mechanically is decided by the QUESTION, not by its
-- declared type: a question with a closed list of choices and a stated
-- correct answer has exactly one right response and no judgement in it.
-- The live data has `mcq`, `short`, `essay` and 24 older questions with
-- no type at all, four of which carry choices — so reading `type` would
-- have silently refused to mark most of what exists.
--
-- Everything else — short answers, essays, a photo of working — is the
-- teacher's. The attempt records what was earned so far and stays
-- `submitted` until she finishes it; only a paper with nothing left to
-- judge is `graded`.

/**
 * Did the student pick the right choice?
 *
 * Choices are written "B. 1/4" and a student may reasonably be recorded
 * as having answered "B", "b" or the whole string, depending on what the
 * UI sent this year. All three are the same answer, and marking a child
 * wrong over a prefix is the kind of unfairness nobody would ever find.
 */
CREATE OR REPLACE FUNCTION public.answer_matches(p_given text, p_correct text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
AS $$
  WITH g AS (SELECT lower(btrim(COALESCE(p_given, '')))   AS v),
       c AS (SELECT lower(btrim(COALESCE(p_correct, ''))) AS v)
  SELECT CASE
    WHEN (SELECT v FROM g) = '' OR (SELECT v FROM c) = '' THEN false
    WHEN (SELECT v FROM g) = (SELECT v FROM c) THEN true
    -- "b" against "b. 1/4", and the reverse.
    WHEN (SELECT v FROM g) = btrim(split_part((SELECT v FROM c), '.', 1)) THEN true
    WHEN btrim(split_part((SELECT v FROM g), '.', 1)) = (SELECT v FROM c) THEN true
    -- Same letter, same text, different punctuation.
    WHEN regexp_replace((SELECT v FROM g), '[^a-z0-9/]', '', 'g')
       = regexp_replace((SELECT v FROM c), '[^a-z0-9/]', '', 'g') THEN true
    ELSE false
  END;
$$;

/**
 * Sit the quiz, and mark what can be marked.
 *
 * SECURITY DEFINER because it reads the correct answers, which the
 * student may not. It refuses an entry that does not reach them and an
 * attempt that is already submitted — one attempt is a property of the
 * data, and the trigger from §49 enforces it besides.
 */
CREATE OR REPLACE FUNCTION public.student_submit_quiz(p_entry uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  se        schedule_entries%ROWTYPE;
  gen       ai_studio%ROWTYPE;
  row_id    uuid;
  q         jsonb;
  idx       int := 0;
  key       text;
  given     text;
  marks     numeric;
  earned    numeric := 0;
  auto_max  numeric := 0;
  pending   numeric := 0;
  breakdown jsonb := '{}'::jsonb;
  attempt   quiz_attempts%ROWTYPE;
BEGIN
  SELECT * INTO se FROM schedule_entries
   WHERE id = p_entry AND id IN (SELECT public.student_entry_ids());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'that work is not yours' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO gen FROM ai_studio WHERE id = se.draft_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'that quiz no longer exists'; END IF;

  SELECT st.id INTO row_id
    FROM students st
   WHERE st.id IN (SELECT public.current_student_ids())
     AND st.created_by = se.faculty_id
     AND public.norm_grade(st.grade) IS NOT DISTINCT FROM public.norm_grade(se.grade)
   ORDER BY st.created_at LIMIT 1;
  IF row_id IS NULL THEN
    RAISE EXCEPTION 'that work is not yours' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO attempt FROM quiz_attempts
   WHERE assignment_id = p_entry AND student_id = row_id;
  IF FOUND AND attempt.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'this quiz has already been submitted' USING ERRCODE = '42501';
  END IF;

  FOR q IN SELECT * FROM jsonb_array_elements(COALESCE(gen.content->'questions', '[]'::jsonb))
  LOOP
    -- The key the student answered under: the question's own id where it
    -- has one, its position otherwise, and the ordinal as a last resort.
    key := COALESCE(q->>'qid', q->>'id', q->>'position', idx::text);
    given := COALESCE(p_answers->>key, p_answers->>idx::text, '');
    marks := COALESCE(NULLIF(q->>'marks','')::numeric, 1);

    IF (q ? 'choices' OR q ? 'options') AND COALESCE(q->>'correct_answer', q->>'answer', '') <> '' THEN
      auto_max := auto_max + marks;
      IF public.answer_matches(given, COALESCE(q->>'correct_answer', q->>'answer')) THEN
        earned := earned + marks;
        breakdown := breakdown || jsonb_build_object(key, jsonb_build_object('correct', true,  'marks', marks));
      ELSE
        breakdown := breakdown || jsonb_build_object(key, jsonb_build_object('correct', false, 'marks', 0));
      END IF;
    ELSE
      -- Written. Recorded as awaiting her, never as zero: a blank score
      -- and a wrong answer are not the same thing to a child reading it.
      pending := pending + marks;
      breakdown := breakdown || jsonb_build_object(key, jsonb_build_object('pending', true, 'marks', marks));
    END IF;

    idx := idx + 1;
  END LOOP;

  INSERT INTO quiz_attempts (
    assignment_id, student_id, answers, score, max_score, status,
    started_at, submitted_at, flags
  )
  VALUES (
    p_entry, row_id, COALESCE(p_answers, '{}'::jsonb),
    earned, auto_max + pending,
    CASE WHEN pending > 0 THEN 'submitted' ELSE 'graded' END,
    now(), now(),
    jsonb_build_object('marking', breakdown, 'auto_max', auto_max, 'pending_max', pending)
  )
  ON CONFLICT (assignment_id, student_id) DO UPDATE
    SET answers      = EXCLUDED.answers,
        score        = EXCLUDED.score,
        max_score    = EXCLUDED.max_score,
        status       = EXCLUDED.status,
        submitted_at = EXCLUDED.submitted_at,
        flags        = EXCLUDED.flags,
        updated_at   = now();

  RETURN jsonb_build_object(
    'submitted', true,
    'score', earned,
    'auto_max', auto_max,
    'pending_max', pending,
    'max_score', auto_max + pending,
    'awaiting_teacher', pending > 0
  );
END $$;
GRANT EXECUTE ON FUNCTION public.student_submit_quiz(uuid, jsonb) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'quiz: multiple choice marks itself, writing waits for the teacher';
END $$;


-- =====================================================================
-- 54. The student's half of a lesson is a section, not a key
-- =====================================================================
--
-- §49 cut a lesson down by reading content->'student_notes', a key that
-- does not exist. A lesson is one markdown document in `body_md` with
-- three top-level sections —
--
--     ## Lesson plan      her sequence, timings, differentiation
--     ## Teaching guide   how to run it, what usually goes wrong
--     ## Student notes    what the child reads
--
-- — so the student got an empty page, which is worse than getting the
-- whole thing: it looks like the teacher assigned nothing.
--
-- Everything from `## Student notes` to the end of the document is
-- theirs. The sections beneath it are flat `##` too (What you will learn,
-- Words you need, The notes, Remember this, Check yourself, Exam
-- questions, Answers), so slicing at the NEXT heading would cut the
-- notes off after the first line. It slices to the end, which is also
-- what the API service does when it grounds a presentation in the same
-- section — one rule, in two places, agreeing.

CREATE OR REPLACE FUNCTION public.lesson_student_notes(p_body text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE pos int;
BEGIN
  IF p_body IS NULL OR btrim(p_body) = '' THEN RETURN NULL; END IF;
  -- Case-insensitive, and anchored to a heading rather than the words:
  -- "student notes" appears inside the teaching guide often enough.
  pos := (regexp_instr(p_body, '(^|\n)##[ \t]+Student notes[ \t]*(\n|$)', 1, 1, 0, 'i'));
  IF pos = 0 THEN RETURN NULL; END IF;
  -- regexp_instr may land on the newline that precedes the heading.
  RETURN btrim(regexp_replace(substr(p_body, pos), '^\s*\n', ''));
END $$;

CREATE OR REPLACE FUNCTION public.student_work(p_entry uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; se schedule_entries%ROWTYPE; gen ai_studio%ROWTYPE; body jsonb; row_id uuid; notes text;
BEGIN
  SELECT * INTO se FROM schedule_entries
   WHERE id = p_entry AND id IN (SELECT public.student_entry_ids());
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO gen FROM ai_studio WHERE id = se.draft_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT st.id INTO row_id
    FROM students st
   WHERE st.id IN (SELECT public.current_student_ids())
     AND st.created_by = se.faculty_id
     AND public.norm_grade(st.grade) IS NOT DISTINCT FROM public.norm_grade(se.grade)
     AND (public.norm_subject(se.subject) IS NULL
          OR public.norm_subject(se.subject) = public.norm_subject(st.subject))
   ORDER BY st.created_at
   LIMIT 1;

  body := gen.content;

  IF gen.type = 'lesson_plan' THEN
    notes := COALESCE(
      public.lesson_student_notes(body->>'body_md'),
      -- A lesson written before the three-section format, or one whose
      -- notes the teacher removed. Better an honest nothing than her
      -- teaching guide handed to a child.
      NULLIF(body->>'student_notes', '')
    );
    body := jsonb_strip_nulls(jsonb_build_object(
      'title',   body->>'title',
      'subject', body->>'subject',
      'grade',   body->>'grade',
      'body_md', notes
    ));
  END IF;

  SELECT jsonb_build_object(
    'entry_id', se.id,
    'student_row_id', row_id,
    'type', gen.type,
    'title', COALESCE(NULLIF(se.title,''), body->>'title', 'Work'),
    'date', se.date, 'start_time', se.start_time, 'end_time', se.end_time,
    'subject', se.subject, 'grade', se.grade, 'section', se.section,
    'notes', se.notes,
    'content', body,
    'submission', (
      SELECT row_to_json(s) FROM (
        SELECT sub.id, sub.files, sub.note, sub.submitted_at
          FROM submissions sub
         WHERE sub.entry_id = se.id AND sub.student_id IN (SELECT public.current_student_ids())
      ) s
    ),
    'attempt', (
      SELECT row_to_json(a) FROM (
        SELECT qa.id, qa.status, qa.answers, qa.score, qa.max_score, qa.submitted_at, qa.flags
          FROM quiz_attempts qa
         WHERE qa.assignment_id = se.id AND qa.student_id IN (SELECT public.current_student_ids())
      ) a
    )
  ) INTO out;
  RETURN out;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'lessons: students get the Student notes section';
END $$;


-- =====================================================================
-- 55. What her students handed in
-- =====================================================================
--
-- The teacher's half of the portal. Students submit files and sit
-- quizzes; without this she has no screen that tells her so, and work
-- handed in is work nobody reads — which is the fastest way to teach a
-- class that handing it in does not matter.
--
-- Scoped to her own entries throughout. `submissions` and
-- `quiz_attempts` are joined through schedule_entries, and every row
-- returned belongs to an entry whose faculty_id is hers.
CREATE OR REPLACE FUNCTION public.teacher_submissions(p_limit integer DEFAULT 200)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; fid uuid; n int := LEAST(GREATEST(COALESCE(p_limit,200),1), 500);
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.handed_in DESC NULLS LAST), '[]'::jsonb)
    INTO out
  FROM (
    -- Files: homework and activities.
    SELECT sub.id,
           'submission'                        AS kind,
           gen.type                            AS work_type,
           COALESCE(NULLIF(se.title,''), gen.content->>'title', 'Work') AS title,
           se.id                               AS entry_id,
           se.subject, se.grade, se.section, se.date AS due,
           st.id                               AS student_id,
           TRIM(COALESCE(st.first_name,'') || ' ' || COALESCE(st.last_name,'')) AS student,
           st.email                            AS student_email,
           sub.submitted_at                    AS handed_in,
           jsonb_array_length(COALESCE(sub.files,'[]'::jsonb)) AS file_count,
           sub.files, sub.note,
           NULL::numeric AS score, NULL::numeric AS max_score, NULL::text AS status
      FROM submissions sub
      JOIN schedule_entries se ON se.id = sub.entry_id
      JOIN ai_studio gen       ON gen.id = se.draft_id
      JOIN students st         ON st.id = sub.student_id
     WHERE se.faculty_id = fid

    UNION ALL

    -- Quizzes: what the marker gave, and what is still hers to judge.
    SELECT qa.id,
           'attempt'                           AS kind,
           gen.type                            AS work_type,
           COALESCE(NULLIF(se.title,''), gen.content->>'title', 'Quiz') AS title,
           se.id                               AS entry_id,
           se.subject, se.grade, se.section, se.date AS due,
           st.id                               AS student_id,
           TRIM(COALESCE(st.first_name,'') || ' ' || COALESCE(st.last_name,'')) AS student,
           st.email                            AS student_email,
           qa.submitted_at                     AS handed_in,
           0                                   AS file_count,
           '[]'::jsonb                         AS files,
           NULL::text                          AS note,
           qa.score, qa.max_score, qa.status
      FROM quiz_attempts qa
      JOIN schedule_entries se ON se.id = qa.assignment_id
      JOIN ai_studio gen       ON gen.id = se.draft_id
      JOIN students st         ON st.id = qa.student_id
     WHERE se.faculty_id = fid
       AND qa.submitted_at IS NOT NULL
    LIMIT n
  ) t;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.teacher_submissions(integer) TO authenticated;

/**
 * Finish marking a quiz.
 *
 * The written half is hers. She sets the final score; the status moves
 * to `graded` and the student sees a total instead of "more marks to
 * come". Scoped to her own entries, and it is the one path allowed to
 * touch an attempt after submission — the §49 trigger lets a teacher
 * through and refuses everyone else.
 */
CREATE OR REPLACE FUNCTION public.teacher_grade_attempt(
  p_attempt uuid,
  p_score numeric,
  p_feedback text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE fid uuid; ok boolean;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RAISE EXCEPTION 'not a teacher' USING ERRCODE = '42501'; END IF;

  SELECT EXISTS (
    SELECT 1 FROM quiz_attempts qa
      JOIN schedule_entries se ON se.id = qa.assignment_id
     WHERE qa.id = p_attempt AND se.faculty_id = fid
  ) INTO ok;
  IF NOT ok THEN RAISE EXCEPTION 'that attempt is not yours' USING ERRCODE = '42501'; END IF;

  UPDATE quiz_attempts
     SET score = p_score,
         feedback = COALESCE(p_feedback, feedback),
         status = 'graded',
         updated_at = now()
   WHERE id = p_attempt;

  RETURN jsonb_build_object('graded', true, 'id', p_attempt, 'score', p_score);
END $$;
GRANT EXECUTE ON FUNCTION public.teacher_grade_attempt(uuid, numeric, text) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'teacher: submissions and attempts are readable and markable';
END $$;


-- =====================================================================
-- 56. The marker may mark
-- =====================================================================
--
-- guard_quiz_attempt_marking() strips score, max_score, feedback and
-- flags from any INSERT made while a student is the caller, and forces
-- status back to 'pending'. That is exactly right and must stay: a
-- student who could write their own marks has an answer sheet worth
-- nothing.
--
-- But student_submit_quiz() runs while a student is the caller too. It
-- is SECURITY DEFINER, so it may read the correct answers — and then the
-- guard silently threw its marking away. The attempt saved, the answers
-- were stored, the function returned {score: 4}, and the row said
-- `pending` with no score at all. Nothing errored anywhere, which is why
-- it looked like the frontend was calling the wrong thing.
--
-- The distinction the guard needs is not WHO is calling but WHAT is
-- writing: the student's own client, or the marker running on their
-- behalf. A transaction-local setting says so. It cannot be forged from
-- the browser — PostgREST does not let a request set arbitrary GUCs —
-- and `true` scopes it to the transaction, so it cannot leak into the
-- next statement on a pooled connection.

CREATE OR REPLACE FUNCTION public.guard_quiz_attempt_marking()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare
  sid uuid := public.current_student_id();
begin
  -- Null for a teacher and for this project's backend, which connects on a
  -- role with no auth.uid(). Only an actual student is guarded here.
  if sid is null then
    return new;
  end if;

  -- The platform's own marker, mid-transaction. Set only inside
  -- student_submit_quiz(); a browser cannot set it.
  if coalesce(current_setting('murchid.marking', true), '') = 'on' then
    return new;
  end if;

  if tg_op = 'INSERT' then
    -- Sanitised rather than refused: starting a paper is legitimate, and only
    -- the marks sent alongside it are not.
    new.score := null;
    new.max_score := null;
    new.feedback := null;
    new.proctor_summary := null;
    new.flags := null;
    new.status := 'pending';
    return new;
  end if;

  if new.score          is distinct from old.score
  or new.max_score      is distinct from old.max_score
  or new.feedback       is distinct from old.feedback
  or new.proctor_summary is distinct from old.proctor_summary
  or new.flags          is distinct from old.flags then
    raise exception 'A student cannot set marks, feedback or proctoring on an attempt'
      using errcode = '42501';
  end if;

  return new;
end;
$function$;

-- Re-declared so the marker announces itself. Everything else is §53.
CREATE OR REPLACE FUNCTION public.student_submit_quiz(p_entry uuid, p_answers jsonb)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  se        schedule_entries%ROWTYPE;
  gen       ai_studio%ROWTYPE;
  row_id    uuid;
  q         jsonb;
  idx       int := 0;
  key       text;
  given     text;
  marks     numeric;
  earned    numeric := 0;
  auto_max  numeric := 0;
  pending   numeric := 0;
  breakdown jsonb := '{}'::jsonb;
  attempt   quiz_attempts%ROWTYPE;
BEGIN
  SELECT * INTO se FROM schedule_entries
   WHERE id = p_entry AND id IN (SELECT public.student_entry_ids());
  IF NOT FOUND THEN
    RAISE EXCEPTION 'that work is not yours' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO gen FROM ai_studio WHERE id = se.draft_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RAISE EXCEPTION 'that quiz no longer exists'; END IF;

  SELECT st.id INTO row_id
    FROM students st
   WHERE st.id IN (SELECT public.current_student_ids())
     AND st.created_by = se.faculty_id
     AND public.norm_grade(st.grade) IS NOT DISTINCT FROM public.norm_grade(se.grade)
   ORDER BY st.created_at LIMIT 1;
  IF row_id IS NULL THEN
    RAISE EXCEPTION 'that work is not yours' USING ERRCODE = '42501';
  END IF;

  SELECT * INTO attempt FROM quiz_attempts
   WHERE assignment_id = p_entry AND student_id = row_id;
  IF FOUND AND attempt.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'this quiz has already been submitted' USING ERRCODE = '42501';
  END IF;

  FOR q IN SELECT * FROM jsonb_array_elements(COALESCE(gen.content->'questions', '[]'::jsonb))
  LOOP
    key := COALESCE(q->>'qid', q->>'id', q->>'position', idx::text);
    given := COALESCE(p_answers->>key, p_answers->>idx::text, '');
    marks := COALESCE(NULLIF(q->>'marks','')::numeric, 1);

    IF (q ? 'choices' OR q ? 'options') AND COALESCE(q->>'correct_answer', q->>'answer', '') <> '' THEN
      auto_max := auto_max + marks;
      IF public.answer_matches(given, COALESCE(q->>'correct_answer', q->>'answer')) THEN
        earned := earned + marks;
        breakdown := breakdown || jsonb_build_object(key, jsonb_build_object('correct', true,  'marks', marks));
      ELSE
        breakdown := breakdown || jsonb_build_object(key, jsonb_build_object('correct', false, 'marks', 0));
      END IF;
    ELSE
      pending := pending + marks;
      breakdown := breakdown || jsonb_build_object(key, jsonb_build_object('pending', true, 'marks', marks));
    END IF;

    idx := idx + 1;
  END LOOP;

  -- Transaction-local, and the only place it is ever set.
  PERFORM set_config('murchid.marking', 'on', true);

  INSERT INTO quiz_attempts (
    assignment_id, student_id, answers, score, max_score, status,
    started_at, submitted_at, flags
  )
  VALUES (
    p_entry, row_id, COALESCE(p_answers, '{}'::jsonb),
    earned, auto_max + pending,
    CASE WHEN pending > 0 THEN 'submitted' ELSE 'graded' END,
    now(), now(),
    jsonb_build_object('marking', breakdown, 'auto_max', auto_max, 'pending_max', pending)
  )
  ON CONFLICT (assignment_id, student_id) DO UPDATE
    SET answers      = EXCLUDED.answers,
        score        = EXCLUDED.score,
        max_score    = EXCLUDED.max_score,
        status       = EXCLUDED.status,
        submitted_at = EXCLUDED.submitted_at,
        flags        = EXCLUDED.flags,
        updated_at   = now();

  PERFORM set_config('murchid.marking', 'off', true);

  RETURN jsonb_build_object(
    'submitted', true,
    'score', earned,
    'auto_max', auto_max,
    'pending_max', pending,
    'max_score', auto_max + pending,
    'awaiting_teacher', pending > 0
  );
END $$;
GRANT EXECUTE ON FUNCTION public.student_submit_quiz(uuid, jsonb) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'quiz: the marker may write marks; the student still may not';
END $$;


-- =====================================================================
-- 57. A student may not read the answers
-- =====================================================================
--
-- §54 cut lesson plans down to the Student notes and stopped there. The
-- other three carry the same problem and nobody had looked:
--
--   homework  ends with `## Answers` — the full mark scheme, printed
--             directly above the box where the child uploads the work it
--             marks. And `## One question you could not solve` is a note
--             to the teacher about what to reteach.
--
--   activity  is entirely her run-sheet: Before the lesson, How to run
--             it, When it goes sideways, Make it easier / make it
--             harder. A child needs the idea, the materials and the
--             ground rules; the rest is stage direction.
--
--   quiz      is the worst of the three, because it does not look like a
--             leak at all. The questions array carries `correct_answer`
--             on every entry, and student_work() returned the whole
--             thing. The page renders only the prompts, so the paper
--             looks correct — and the answers sit in the response body,
--             one devtools tab away. body_md carries the mark scheme too.
--
-- Cut in the database rather than in the component, because what the
-- browser never receives cannot be read by anyone using it.

/**
 * Drop named `##` sections from a markdown document.
 *
 * Section-aware rather than a text search: "answers" appears in prose
 * throughout these documents, and matching the word would shred them.
 */
CREATE OR REPLACE FUNCTION public.md_drop_sections(p_body text, p_names text[])
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  ln text; out_lines text[] := '{}'; heading text; dropping boolean := false;
BEGIN
  IF p_body IS NULL THEN RETURN NULL; END IF;
  FOREACH ln IN ARRAY regexp_split_to_array(p_body, E'\n') LOOP
    heading := (regexp_match(ln, '^##[ \t]+(.+?)[ \t]*$'))[1];
    IF heading IS NOT NULL THEN
      -- A new section always re-decides; a dropped one ends here.
      dropping := lower(btrim(heading)) = ANY (
        SELECT lower(btrim(n)) FROM unnest(p_names) n
      );
    END IF;
    IF NOT dropping THEN out_lines := out_lines || ln; END IF;
  END LOOP;
  RETURN btrim(array_to_string(out_lines, E'\n'));
END $$;

/** Keep only the named `##` sections, in the order they appear. */
CREATE OR REPLACE FUNCTION public.md_keep_sections(p_body text, p_names text[])
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  ln text; out_lines text[] := '{}'; heading text; keeping boolean := false;
BEGIN
  IF p_body IS NULL THEN RETURN NULL; END IF;
  FOREACH ln IN ARRAY regexp_split_to_array(p_body, E'\n') LOOP
    heading := (regexp_match(ln, '^##[ \t]+(.+?)[ \t]*$'))[1];
    IF heading IS NOT NULL THEN
      keeping := lower(btrim(heading)) = ANY (
        SELECT lower(btrim(n)) FROM unnest(p_names) n
      );
    END IF;
    IF keeping THEN out_lines := out_lines || ln; END IF;
  END LOOP;
  RETURN btrim(array_to_string(out_lines, E'\n'));
END $$;

/**
 * Everything a student may see of one generation.
 *
 * One function so the rule lives in one place: student_work() opens the
 * work, and anything added later that shows a student a generation must
 * come through here too.
 */
CREATE OR REPLACE FUNCTION public.student_safe_content(p_type text, p_content jsonb)
RETURNS jsonb
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE body jsonb := p_content; md text; qs jsonb;
BEGIN
  IF body IS NULL THEN RETURN NULL; END IF;

  IF p_type = 'lesson_plan' THEN
    RETURN jsonb_strip_nulls(jsonb_build_object(
      'title',   body->>'title',
      'subject', body->>'subject',
      'grade',   body->>'grade',
      'body_md', public.lesson_student_notes(body->>'body_md')
    ));

  ELSIF p_type = 'homework' THEN
    md := public.md_drop_sections(
      body->>'body_md',
      ARRAY['Answers', 'Answer key', 'Mark scheme', 'Marking',
            'One question you could not solve', 'Note for next lesson']
    );
    RETURN jsonb_strip_nulls(jsonb_build_object(
      'title', body->>'title', 'subject', body->>'subject',
      'grade', body->>'grade', 'body_md', md
    ));

  ELSIF p_type = 'activity' THEN
    -- Her run-sheet stays with her. The child gets what the activity is,
    -- what to bring, and how to stay safe doing it.
    md := public.md_keep_sections(
      body->>'body_md',
      ARRAY['The idea', 'What you need', 'Safety and ground rules',
            'How it connects to the topic']
    );
    RETURN jsonb_strip_nulls(jsonb_build_object(
      'title', body->>'title', 'subject', body->>'subject',
      'grade', body->>'grade', 'body_md', NULLIF(md, '')
    ));

  ELSIF p_type = 'quiz' THEN
    -- Every question, stripped of anything that answers it. body_md goes
    -- entirely: it is the printable paper WITH the mark scheme.
    SELECT COALESCE(jsonb_agg(
             (q - 'correct_answer' - 'answer' - 'answers'
                - 'explanation' - 'rationale' - 'mark_scheme' - 'model_answer')
             ORDER BY ord),
           '[]'::jsonb)
      INTO qs
      FROM jsonb_array_elements(COALESCE(body->'questions', '[]'::jsonb))
           WITH ORDINALITY AS t(q, ord);

    RETURN jsonb_strip_nulls(jsonb_build_object(
      'title', body->>'title', 'subject', body->>'subject',
      'grade', body->>'grade',
      'instructions', body->>'instructions',
      'duration_minutes', body->'duration_minutes',
      'total_marks', body->'total_marks',
      'questions', qs
    ));
  END IF;

  -- Presentations are made to be shown to the class, so they pass whole.
  RETURN body;
END $$;

CREATE OR REPLACE FUNCTION public.student_work(p_entry uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; se schedule_entries%ROWTYPE; gen ai_studio%ROWTYPE; body jsonb; row_id uuid;
BEGIN
  SELECT * INTO se FROM schedule_entries
   WHERE id = p_entry AND id IN (SELECT public.student_entry_ids());
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT * INTO gen FROM ai_studio WHERE id = se.draft_id AND deleted_at IS NULL;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT st.id INTO row_id
    FROM students st
   WHERE st.id IN (SELECT public.current_student_ids())
     AND st.created_by = se.faculty_id
     AND public.norm_grade(st.grade) IS NOT DISTINCT FROM public.norm_grade(se.grade)
     AND (public.norm_subject(se.subject) IS NULL
          OR public.norm_subject(se.subject) = public.norm_subject(st.subject))
   ORDER BY st.created_at
   LIMIT 1;

  body := public.student_safe_content(gen.type, gen.content);

  SELECT jsonb_build_object(
    'entry_id', se.id,
    'student_row_id', row_id,
    'type', gen.type,
    'title', COALESCE(NULLIF(se.title,''), body->>'title', 'Work'),
    'date', se.date, 'start_time', se.start_time, 'end_time', se.end_time,
    'subject', se.subject, 'grade', se.grade, 'section', se.section,
    'notes', se.notes,
    'content', body,
    'submission', (
      SELECT row_to_json(s) FROM (
        SELECT sub.id, sub.files, sub.note, sub.submitted_at
          FROM submissions sub
         WHERE sub.entry_id = se.id AND sub.student_id IN (SELECT public.current_student_ids())
      ) s
    ),
    'attempt', (
      SELECT row_to_json(a) FROM (
        SELECT qa.id, qa.status, qa.answers, qa.score, qa.max_score, qa.submitted_at, qa.flags
          FROM quiz_attempts qa
         WHERE qa.assignment_id = se.id AND qa.student_id IN (SELECT public.current_student_ids())
      ) a
    )
  ) INTO out;
  RETURN out;
END $$;

/**
 * And the raw row is no longer readable either.
 *
 * §48 gave students a SELECT policy on ai_studio so they could open work.
 * That returns `content` whole — the answers included — which makes every
 * cut above cosmetic. student_work() is the only way in now.
 */
DROP POLICY IF EXISTS ai_studio_student_read ON public.ai_studio;

DO $$
BEGIN
  RAISE NOTICE 'students: answer keys, mark schemes and run-sheets are no longer sent';
END $$;


-- =====================================================================
-- 58. Section matching has to know about heading levels
-- =====================================================================
--
-- §57 matched `^##` only, and homework puts its mark scheme under a
-- level-one `# Answers` — the document is `# Title`, then `##` sections,
-- then `# Answers` at the top level again. So the drop matched nothing,
-- reported success, and the answer key went to the student exactly as
-- before. The migration said it had worked; the only way to know it had
-- not was to measure the output, which is why the check below is part of
-- the same change.
--
-- A section now runs from its heading until the next heading at the SAME
-- level or shallower. `# Answers` therefore takes everything under it
-- including any `##` beneath, and a `## Answers` inside a larger section
-- ends where its siblings do rather than eating the rest of the file.

CREATE OR REPLACE FUNCTION public.md_drop_sections(p_body text, p_names text[])
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  ln text; out_lines text[] := '{}'; m text[];
  lvl int; heading text; drop_at int := NULL;
BEGIN
  IF p_body IS NULL THEN RETURN NULL; END IF;
  FOREACH ln IN ARRAY regexp_split_to_array(p_body, E'\n') LOOP
    m := regexp_match(ln, '^(#{1,6})[ \t]+(.+?)[ \t]*$');
    IF m IS NOT NULL THEN
      lvl := length(m[1]);
      heading := lower(btrim(m[2]));
      IF drop_at IS NOT NULL AND lvl <= drop_at THEN
        drop_at := NULL;                     -- the dropped section ends here
      END IF;
      IF drop_at IS NULL
         AND heading = ANY (SELECT lower(btrim(n)) FROM unnest(p_names) n) THEN
        drop_at := lvl;
      END IF;
    END IF;
    IF drop_at IS NULL THEN out_lines := out_lines || ln; END IF;
  END LOOP;
  RETURN btrim(array_to_string(out_lines, E'\n'));
END $$;

CREATE OR REPLACE FUNCTION public.md_keep_sections(p_body text, p_names text[])
RETURNS text
LANGUAGE plpgsql IMMUTABLE
AS $$
DECLARE
  ln text; out_lines text[] := '{}'; m text[];
  lvl int; heading text; keep_at int := NULL;
BEGIN
  IF p_body IS NULL THEN RETURN NULL; END IF;
  FOREACH ln IN ARRAY regexp_split_to_array(p_body, E'\n') LOOP
    m := regexp_match(ln, '^(#{1,6})[ \t]+(.+?)[ \t]*$');
    IF m IS NOT NULL THEN
      lvl := length(m[1]);
      heading := lower(btrim(m[2]));
      IF keep_at IS NOT NULL AND lvl <= keep_at THEN
        keep_at := NULL;
      END IF;
      IF keep_at IS NULL
         AND heading = ANY (SELECT lower(btrim(n)) FROM unnest(p_names) n) THEN
        keep_at := lvl;
      END IF;
    END IF;
    IF keep_at IS NOT NULL THEN out_lines := out_lines || ln; END IF;
  END LOOP;
  RETURN btrim(array_to_string(out_lines, E'\n'));
END $$;

-- Verified rather than assumed. §57 passed its own migration while
-- changing nothing, so this refuses to apply if the answer key is still
-- reaching a student.
DO $$
DECLARE bad int;
BEGIN
  SELECT count(*) INTO bad
    FROM ai_studio g
   WHERE g.type = 'homework' AND g.deleted_at IS NULL
     AND g.content->>'body_md' ~* '(^|\n)#{1,3}[ \t]+Answers[ \t]*(\n|$)'
     AND public.student_safe_content(g.type, g.content)->>'body_md'
         ~* '(^|\n)#{1,3}[ \t]+Answers[ \t]*(\n|$)';
  IF bad > 0 THEN
    RAISE EXCEPTION 'student_safe_content still returns an Answers section for % homework document(s)', bad;
  END IF;
  RAISE NOTICE 'students: answer sections verified removed';
END $$;


-- =====================================================================
-- 59. Reports, by student
-- =====================================================================
--
-- teacher_submissions() returned one flat list of everything handed in,
-- newest first. That is the right shape for a teacher with six students
-- and useless for one with a hundred and twenty: to answer "has Aisha
-- done her homework" she has to read the whole term.
--
-- A teacher thinks in students. So the list is students, each with what
-- they owe and what they have done, and opening one shows their work.
--
-- And she can read the answers now. She could open an uploaded file and
-- nothing else — not the note a child left with it, and not a single
-- word of what they wrote in a quiz. Marking the written half was the
-- job she was left with, on a screen that would not show her the
-- writing.

/**
 * Her students, with a count of what is outstanding.
 *
 * Scoped to her own roster; `assigned` counts what actually reaches each
 * child by grade and subject, so the denominator is theirs rather than
 * the class's.
 */
CREATE OR REPLACE FUNCTION public.teacher_student_report()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; fid uuid;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN '[]'::jsonb; END IF;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.last_name, t.first_name), '[]'::jsonb)
    INTO out
  FROM (
    SELECT st.id AS student_id, st.first_name, st.last_name, st.email,
           st.grade, st.division AS section, st.subject,
           st.invite_status, st.user_id IS NOT NULL AS has_account,

           -- Everything set for this child that expects something back.
           (SELECT count(*) FROM schedule_entries se
              JOIN ai_studio g ON g.id = se.draft_id AND g.deleted_at IS NULL
             WHERE se.faculty_id = fid
               AND COALESCE(se.status,'planned') <> 'cancelled'
               AND g.type IN ('quiz','homework','activity')
               AND public.norm_grade(se.grade) IS NOT DISTINCT FROM public.norm_grade(st.grade)
               AND (public.norm_subject(se.subject) IS NULL
                    OR public.norm_subject(se.subject) = public.norm_subject(st.subject))
               AND (COALESCE(btrim(se.section),'') = ''
                    OR lower(btrim(se.section)) = lower(btrim(COALESCE(st.division,''))))
           ) AS assigned,

           (SELECT count(*) FROM submissions sub
              JOIN schedule_entries se ON se.id = sub.entry_id
             WHERE sub.student_id = st.id AND se.faculty_id = fid) AS handed_in,

           (SELECT count(*) FROM quiz_attempts qa
              JOIN schedule_entries se ON se.id = qa.assignment_id
             WHERE qa.student_id = st.id AND se.faculty_id = fid
               AND qa.submitted_at IS NOT NULL) AS attempts,

           -- What she still has to mark: a paper with writing in it.
           (SELECT count(*) FROM quiz_attempts qa
              JOIN schedule_entries se ON se.id = qa.assignment_id
             WHERE qa.student_id = st.id AND se.faculty_id = fid
               AND qa.submitted_at IS NOT NULL AND qa.status <> 'graded') AS to_mark,

           (SELECT round(avg(qa.score / NULLIF(qa.max_score,0) * 100)::numeric, 0)
              FROM quiz_attempts qa
              JOIN schedule_entries se ON se.id = qa.assignment_id
             WHERE qa.student_id = st.id AND se.faculty_id = fid
               AND qa.status = 'graded' AND qa.score IS NOT NULL) AS avg_pct,

           (SELECT max(x) FROM (
              SELECT max(sub.submitted_at) AS x FROM submissions sub
                JOIN schedule_entries se ON se.id = sub.entry_id
               WHERE sub.student_id = st.id AND se.faculty_id = fid
              UNION ALL
              SELECT max(qa.submitted_at) FROM quiz_attempts qa
                JOIN schedule_entries se ON se.id = qa.assignment_id
               WHERE qa.student_id = st.id AND se.faculty_id = fid
            ) z) AS last_seen
      FROM students st
     WHERE st.created_by = fid
  ) t;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.teacher_student_report() TO authenticated;

/**
 * One student, opened: every piece of work she set them and what came
 * back — including the words they wrote.
 *
 * The quiz carries the question, the child's answer, and whether the
 * marker judged it right. Reading a wrong answer is how a teacher knows
 * whether it was a slip or a misconception, which is the entire point of
 * marking.
 */
CREATE OR REPLACE FUNCTION public.teacher_student_work(p_student uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; fid uuid; st students%ROWTYPE;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN NULL; END IF;

  SELECT * INTO st FROM students WHERE id = p_student AND created_by = fid;
  IF NOT FOUND THEN RETURN NULL; END IF;

  SELECT jsonb_build_object(
    'student', jsonb_build_object(
      'id', st.id, 'first_name', st.first_name, 'last_name', st.last_name,
      'email', st.email, 'grade', st.grade, 'section', st.division,
      'subject', st.subject, 'invite_status', st.invite_status
    ),
    'work', (
      SELECT COALESCE(jsonb_agg(row_to_json(w) ORDER BY w.date DESC NULLS LAST), '[]'::jsonb) FROM (
        SELECT se.id AS entry_id, g.type,
               COALESCE(NULLIF(se.title,''), g.content->>'title', 'Work') AS title,
               se.date, se.subject,

               sub.id AS submission_id, sub.files, sub.note, sub.submitted_at AS handed_in,

               qa.id AS attempt_id, qa.status AS attempt_status,
               qa.score, qa.max_score, qa.submitted_at AS attempted_at,
               qa.feedback,

               -- Question, answer, and the marker's verdict, in order.
               CASE WHEN qa.id IS NULL THEN NULL ELSE (
                 SELECT COALESCE(jsonb_agg(jsonb_build_object(
                          'prompt',  COALESCE(q->>'prompt', q->>'question', q->>'text'),
                          'given',   qa.answers->>COALESCE(q->>'qid', q->>'id', q->>'position', (ord-1)::text),
                          'correct', q->>'correct_answer',
                          'marks',   COALESCE(NULLIF(q->>'marks','')::numeric, 1),
                          'auto',    (q ? 'choices' OR q ? 'options')
                                       AND COALESCE(q->>'correct_answer','') <> '',
                          'verdict', qa.flags->'marking'
                                       ->COALESCE(q->>'qid', q->>'id', q->>'position', (ord-1)::text)
                        ) ORDER BY ord), '[]'::jsonb)
                   FROM jsonb_array_elements(COALESCE(g.content->'questions','[]'::jsonb))
                        WITH ORDINALITY AS t2(q, ord)
               ) END AS answers
          FROM schedule_entries se
          JOIN ai_studio g ON g.id = se.draft_id AND g.deleted_at IS NULL
          LEFT JOIN submissions   sub ON sub.entry_id = se.id AND sub.student_id = st.id
          LEFT JOIN quiz_attempts qa  ON qa.assignment_id = se.id AND qa.student_id = st.id
         WHERE se.faculty_id = fid
           AND COALESCE(se.status,'planned') <> 'cancelled'
           AND g.type IN ('quiz','homework','activity')
           AND public.norm_grade(se.grade) IS NOT DISTINCT FROM public.norm_grade(st.grade)
           AND (public.norm_subject(se.subject) IS NULL
                OR public.norm_subject(se.subject) = public.norm_subject(st.subject))
           AND (COALESCE(btrim(se.section),'') = ''
                OR lower(btrim(se.section)) = lower(btrim(COALESCE(st.division,''))))
      ) w
    )
  ) INTO out;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.teacher_student_work(uuid) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'teacher: reports are per student, and she can read the answers';
END $$;


-- =====================================================================
-- 60. A student joins each class, one invitation at a time
-- =====================================================================
--
-- A child in Grade 5 has five subjects and five teachers, and each of
-- them invites separately. The platform was treating the first
-- invitation as a sign-up and every one after it as paperwork: the row
-- was claimed the moment it was created, the student was told nothing,
-- and a class appeared in their sidebar that they had never agreed to
-- be in.
--
-- The correct shape is Google Classroom's, and it is what a teacher and
-- a child both already expect:
--
--   invited   the teacher has asked. The student sees the invitation
--             and decides.
--   active    the student accepted. It is one of their classes now, and
--             it stays there when the next invitation arrives.
--
-- Joining is therefore an act, not a side effect. `link_student_account`
-- still runs at sign-in — it has to, because that is what ties the
-- roster rows to a login — but it now only claims OWNERSHIP of the
-- invitations, never membership.
--
-- The bug this fixes is the one that looks like data loss: a second
-- teacher's invitation was auto-joined, and because the classes list
-- read the primary roster row rather than every joined one, the first
-- class vanished and a new one appeared in its place. Nothing was
-- deleted; the student was simply only ever shown one class at a time.

-- ── membership is 'active', full stop ─────────────────────────────────
--
-- Everything downstream — the dashboard, the class pages, which work
-- reaches them, what they may open — is written in terms of these two
-- functions. Narrowing them here is what makes a pending invitation
-- inert everywhere at once, rather than in each caller by hand.
CREATE OR REPLACE FUNCTION public.current_student_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM students
   WHERE user_id = (SELECT auth.uid())
     AND invite_status = 'active';
$$;

CREATE OR REPLACE FUNCTION public.current_student_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT id FROM students
   WHERE user_id = (SELECT auth.uid())
     AND invite_status = 'active'
   ORDER BY created_at
   LIMIT 1;
$$;

-- ── signing in claims the invitations, not the classes ────────────────
CREATE OR REPLACE FUNCTION public.link_student_account()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; em text; claimed int; held int; flagged int;
BEGIN
  uid := (SELECT auth.uid());
  IF uid IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'not_signed_in'); END IF;

  em := lower((SELECT email FROM auth.users WHERE id = uid));
  IF em IS NULL THEN RETURN jsonb_build_object('linked', false, 'reason', 'no_email'); END IF;

  -- A teacher's address may not become a student (§39).
  IF EXISTS (SELECT 1 FROM faculty WHERE user_id = uid) THEN
    UPDATE students
       SET invite_status = 'blocked_teacher', updated_at = now()
     WHERE lower(email) = em AND user_id IS NULL AND invite_status = 'invited';
    GET DIAGNOSTICS flagged = ROW_COUNT;
    RETURN jsonb_build_object('linked', false, 'reason', 'is_teacher', 'flagged', flagged);
  END IF;

  /**
   * Ownership only.
   *
   * user_id says "this invitation is for the person now signed in".
   * invite_status stays 'invited' until they accept it, so a class they
   * have not agreed to join cannot reach them, set them work, or take
   * their attendance.
   */
  UPDATE students
     SET user_id = uid, updated_at = now()
   WHERE lower(email) = em AND user_id IS NULL AND invite_status = 'invited';
  GET DIAGNOSTICS claimed = ROW_COUNT;

  SELECT count(*) INTO held FROM students WHERE user_id = uid;

  IF held = 0 THEN
    IF EXISTS (SELECT 1 FROM students WHERE lower(email) = em AND user_id IS NULL) THEN
      RETURN jsonb_build_object('linked', false, 'reason', 'not_invited');
    END IF;
    RETURN jsonb_build_object('linked', false, 'reason', 'no_match');
  END IF;

  INSERT INTO public.users (id, email) VALUES (uid, em) ON CONFLICT (id) DO NOTHING;
  UPDATE public.users u
     SET role = 'student', updated_at = now()
   WHERE u.id = uid
     AND u.role = 'teacher'
     AND NOT EXISTS (SELECT 1 FROM faculty f WHERE f.user_id = uid);

  RETURN jsonb_build_object(
    'linked', true, 'claimed', claimed, 'rows', held,
    'pending', (SELECT count(*) FROM students
                 WHERE user_id = uid AND invite_status = 'invited')
  );
END $$;
GRANT EXECUTE ON FUNCTION public.link_student_account() TO authenticated;

-- ── the invitations waiting for them ──────────────────────────────────
--
-- Both the ones claimed at sign-in and any that arrived since. Read by
-- email as well as user_id so an invitation sent while they are looking
-- at the page appears on the next load without another sign-in.
CREATE OR REPLACE FUNCTION public.student_invitations()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb; uid uuid; em text;
BEGIN
  uid := (SELECT auth.uid());
  IF uid IS NULL THEN RETURN '[]'::jsonb; END IF;
  em := lower((SELECT email FROM auth.users WHERE id = uid));

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.invited_at DESC NULLS LAST), '[]'::jsonb)
    INTO out
  FROM (
    SELECT st.id AS student_row_id, st.subject, st.grade, st.division AS section,
           st.invited_at,
           TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS teacher,
           (SELECT name FROM schools WHERE id = st.school_id) AS school
      FROM students st
      LEFT JOIN faculty f ON f.id = st.created_by
      LEFT JOIN users   u ON u.id = f.user_id
     WHERE st.invite_status = 'invited'
       AND (st.user_id = uid OR (st.user_id IS NULL AND lower(st.email) = em))
  ) t;
  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.student_invitations() TO authenticated;

-- ── accepting one ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.student_join_class(p_student_row uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE uid uuid; em text; ok boolean;
BEGIN
  uid := (SELECT auth.uid());
  IF uid IS NULL THEN RAISE EXCEPTION 'not signed in' USING ERRCODE = '42501'; END IF;
  em := lower((SELECT email FROM auth.users WHERE id = uid));

  -- Theirs, and still an invitation. Anything else is somebody else's
  -- class or a row they have already joined.
  SELECT EXISTS (
    SELECT 1 FROM students st
     WHERE st.id = p_student_row
       AND st.invite_status = 'invited'
       AND (st.user_id = uid OR (st.user_id IS NULL AND lower(st.email) = em))
  ) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'that invitation is not yours' USING ERRCODE = '42501';
  END IF;

  UPDATE students
     SET user_id = uid, invite_status = 'active', updated_at = now()
   WHERE id = p_student_row;

  RETURN jsonb_build_object('joined', true, 'student_row_id', p_student_row);
END $$;
GRANT EXECUTE ON FUNCTION public.student_join_class(uuid) TO authenticated;

-- ── a student may read the invitation itself ──────────────────────────
--
-- students_read is written in terms of current_student_ids(), which no
-- longer includes a pending row — so without this the invitation is
-- invisible to the person being invited.
DROP POLICY IF EXISTS students_read ON public.students;
CREATE POLICY students_read ON public.students
  FOR SELECT TO authenticated
  USING (
    (
      created_by = current_faculty_id()
      OR EXISTS (
        SELECT 1 FROM class_members cm
          JOIN classes c ON c.id = cm.class_id
         WHERE cm.student_id = students.id
           AND c.faculty_id = current_faculty_id()
      )
      -- Every row that belongs to this person, joined or merely offered.
      OR user_id = (SELECT auth.uid())
    )
    AND is_current_device()
  );

-- ── re-adding a known student offers, it does not enrol ───────────────
--
-- §44 claimed the row outright so a returning student needed no second
-- invitation. That is right about the ACCOUNT and wrong about the CLASS:
-- a different teacher's subject is a different class, and being known to
-- the platform is not the same as agreeing to join it.
CREATE OR REPLACE FUNCTION public.attach_known_student(p_student uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE em text; uid uuid; owner uuid;
BEGIN
  SELECT lower(trim(s.email)), s.created_by INTO em, owner
    FROM students s WHERE s.id = p_student;
  IF em IS NULL THEN RETURN jsonb_build_object('attached', false, 'reason', 'not_found'); END IF;

  IF owner IS DISTINCT FROM public.current_faculty_id() THEN
    RETURN jsonb_build_object('attached', false, 'reason', 'not_yours');
  END IF;

  SELECT u.id INTO uid
    FROM auth.users u
    JOIN public.users pu ON pu.id = u.id
   WHERE lower(u.email) = em AND pu.role = 'student'
   LIMIT 1;

  IF uid IS NULL THEN RETURN jsonb_build_object('attached', false, 'reason', 'no_account'); END IF;

  -- Addressed to them, and waiting for them to accept it.
  UPDATE students
     SET user_id = uid, invite_status = 'invited', invited_at = now(), updated_at = now()
   WHERE id = p_student AND invite_status <> 'active';

  RETURN jsonb_build_object('attached', true, 'user_id', uid, 'pending', true);
END $$;

DO $$
BEGIN
  RAISE NOTICE 'students: each class is joined from its own invitation';
END $$;


-- =====================================================================
-- 61. One login, many classes
-- =====================================================================
--
-- students.user_id carried a UNIQUE constraint, so a login could own
-- exactly ONE roster row. It dates from the design where a student WAS
-- a row — one child, one record — and it quietly made the whole
-- multi-teacher model impossible: the moment Tommy joined Science, no
-- other teacher could ever link him again.
--
-- The failure was invisible from the outside, which is what made it
-- expensive. The second teacher's invitation was created and emailed
-- exactly as the first; only the link step raised
--
--     duplicate key value violates unique constraint "students_user_id_key"
--
-- inside attach_known_student(), where the browser swallowed it. The
-- student clicked the link, signed in, and found one class — with
-- nothing anywhere saying the second had been refused.
--
-- A student is a PERSON with several roster rows, one per teacher. The
-- uniqueness that actually matters is one row per teacher per child, and
-- that is already enforced by students_teacher_email_unique. This one is
-- simply wrong.

ALTER TABLE public.students DROP CONSTRAINT IF EXISTS students_user_id_key;

-- Still indexed — current_student_ids() looks rows up by it on every
-- request a student makes — just no longer unique.
CREATE INDEX IF NOT EXISTS students_user_id_idx ON public.students (user_id);

-- Prove it, rather than trust it: the same login must be able to hold
-- two rows from two teachers.
DO $$
DECLARE ok boolean;
BEGIN
  SELECT NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.students'::regclass
       AND contype = 'u'
       AND pg_get_constraintdef(oid) = 'UNIQUE (user_id)'
  ) INTO ok;
  IF NOT ok THEN
    RAISE EXCEPTION 'students.user_id is still unique; a student cannot hold two classes';
  END IF;
  RAISE NOTICE 'students: one login may now hold a row per teacher';
END $$;


-- =====================================================================
-- 62. Remove what nothing calls
-- =====================================================================
--
-- Two functions written during this work and superseded before anything
-- shipped. Both are reachable by any authenticated user through
-- PostgREST, so leaving them is not free: an endpoint nobody calls is an
-- endpoint nobody is checking either.
--
--   teacher_submissions()   the first Reports screen was one flat feed
--                           of everything handed in. It was replaced by
--                           teacher_student_report() / _student_work()
--                           the moment it was clear a teacher with a
--                           hundred students cannot read a feed.
--
--   student_invitations()   the invitation briefly lived inside the app,
--                           with a Join button on the classes page. It
--                           belongs in the email — one per subject, from
--                           the teacher who sent it — so the in-app list
--                           went and this went unused with it.
--
-- Dropped by exact signature, so an unrelated overload could not go with
-- them by accident.
DROP FUNCTION IF EXISTS public.teacher_submissions(integer);
DROP FUNCTION IF EXISTS public.student_invitations();

DO $$
BEGIN
  RAISE NOTICE 'cleanup: superseded RPCs removed';
END $$;


-- =====================================================================
-- 63. The meter
-- =====================================================================
--
-- Every generation charged exactly one credit, whatever it cost. A
-- homework and a seven-document batch deducted the same single credit —
-- $0.0257 and $0.3828 of real spend, billed identically. A teacher on
-- Basic spending her whole allowance on lessons cost us $18.22 against
-- $12 of revenue, and she had to do nothing unusual to get there: she
-- had to use the feature the product is named after.
--
-- `ai_credit_costs` existed for this and nothing read it. Its values
-- were also filled in before anything was measured and are 3–5× too
-- high, so switching it on without correcting them would have turned a
-- 15× under-charge into a 4× over-charge. Both happen here, together.
--
-- Credits are derived from measured cost at 1 credit = $0.02, rounded up
-- so a credit never under-recovers:
--
--   scheduling    $0.0098   free      naming a Tuesday is not a feature
--                                     anyone should ration
--   skill         $0.0172   1
--   homework      $0.0257   2
--   activity      $0.0303   2
--   quiz          $0.0348   2
--   presentation  $0.0584   3
--   goal plan     $0.0667   4
--   lesson        $0.1518   8         three documents, not one
--   + a document  $0.0530   3         the planning pass, near-fixed

UPDATE public.ai_credit_costs SET cost = v.cost, updated_at = now()
  FROM (VALUES
    ('lesson_plan',   8),
    ('quiz',          2),
    ('homework',      2),
    ('activity',      2),
    ('presentation',  3),
    ('goal_plan',     4),
    ('skill_profile', 1),
    ('template',      2),
    ('bulletin',      1),
    ('quiz_tweak',    1),
    ('regenerate',    2),
    ('chat',          0)
  ) AS v(feature, cost)
 WHERE ai_credit_costs.feature = v.feature;

-- Charged the moment a teacher attaches a file: the planning pass reads
-- it once and writes a brief the writers share, so it costs the same
-- feeding one document or seven.
INSERT INTO public.ai_credit_costs (feature, cost, label)
VALUES ('materials', 3, 'Reading an attached document')
ON CONFLICT (feature) DO UPDATE SET cost = 3, label = EXCLUDED.label, updated_at = now();

-- Scheduling stays free and is recorded as such rather than left absent,
-- so the console shows a deliberate 0 rather than a gap.
INSERT INTO public.ai_credit_costs (feature, cost, label)
VALUES ('scheduling', 0, 'Scheduling (free)')
ON CONFLICT (feature) DO UPDATE SET cost = 0, label = EXCLUDED.label, updated_at = now();

-- ── cached input is not billed like fresh input ───────────────────────
--
-- Anthropic charges a cache READ at 10% of input and a cache WRITE at
-- 125%. usage_logs held one `tokens_in`, so a cached prompt looked
-- exactly as expensive as an uncached one and prompt caching would have
-- shown up as no saving at all.
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS cache_read_tokens  integer NOT NULL DEFAULT 0;
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS cache_write_tokens integer NOT NULL DEFAULT 0;
ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS credits            integer NOT NULL DEFAULT 0;

-- ── what a teacher may read about her own spending ────────────────────
--
-- She cannot spend well against a number she cannot see. Balance,
-- allowance, and what the last few generations actually cost.
CREATE OR REPLACE FUNCTION public.my_credits()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE fid uuid; uid uuid; out jsonb;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN NULL; END IF;
  uid := (SELECT auth.uid());

  SELECT jsonb_build_object(
    'balance',   COALESCE(c.balance, 0),
    'allowance', COALESCE(c.monthly_allowance, 0),
    'renews_at', c.next_refresh_at,
    'plan',      s.plan,
    'status',    s.status,
    'costs', (
      SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb)
        FROM ai_credit_costs
    ),
    'recent', (
      SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT operation, credits, tokens_in, tokens_out, cost_usd, created_at
            FROM usage_logs
           WHERE user_id = uid AND credits > 0
           ORDER BY created_at DESC
           LIMIT 20
        ) r
    )
  ) INTO out
  FROM credits c
  LEFT JOIN subscriptions s ON s.faculty_id = c.faculty_id
  WHERE c.faculty_id = fid;

  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.my_credits() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'metering: per-feature credit costs corrected and cache columns added';
END $$;


-- =====================================================================
-- 64. A monthly refresh needs a plan to refresh against
-- =====================================================================
--
-- refresh_credits_if_due() reset the balance to monthly_allowance every
-- month and never looked at the subscription. So a teacher who cancelled,
-- or whose card stopped working, kept receiving a full allowance for as
-- long as she kept opening the product — free, monthly, forever.
--
-- It was safe in the direction people usually check: calling it twice
-- does nothing, because it only fires once `now() >= next_refresh_at`
-- and moves the anchor forward. The hole was not abuse, it was that
-- nobody had asked what a refresh MEANS when there is nothing to renew.
--
-- subscription_active() is the same test the RLS policies use for writing
-- — active, trialing or past_due, and not expired past a three-day grace.
-- Using it here keeps one answer to "is this account paid up" rather than
-- two that can drift.
--
-- The anchor still advances when a refresh is skipped. Otherwise a lapsed
-- teacher who resubscribes in March would be owed every month since
-- December, and would get one month's credits followed by an immediate
-- second refresh.
CREATE OR REPLACE FUNCTION public.refresh_credits_if_due()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE
  fid uuid; v_balance int; v_allow int; v_next timestamptz;
  anchor timestamptz; did boolean := false; paid boolean;
BEGIN
  fid := current_faculty_id();
  IF fid IS NULL THEN RETURN NULL; END IF;
  SELECT balance, monthly_allowance, next_refresh_at INTO v_balance, v_allow, v_next
    FROM credits WHERE faculty_id = fid;
  IF NOT FOUND THEN RETURN NULL; END IF;

  paid := public.subscription_active();

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

    IF paid THEN
      UPDATE credits SET balance = monthly_allowance, next_refresh_at = anchor, updated_at = now()
        WHERE faculty_id = fid;
      v_balance := v_allow;
      did := true;
    ELSE
      -- The month passes either way; the credits do not.
      UPDATE credits SET next_refresh_at = anchor, updated_at = now()
        WHERE faculty_id = fid;
    END IF;

    v_next := anchor;
  END IF;

  RETURN jsonb_build_object(
    'balance', v_balance, 'allowance', v_allow,
    'next_refresh_at', v_next, 'refreshed', did,
    -- So the screen can say "your plan ended" rather than leaving a
    -- teacher wondering why the number never moved.
    'subscription_active', paid
  );
END $function$;

DO $$
BEGIN
  RAISE NOTICE 'credits: a lapsed plan no longer refreshes';
END $$;


-- =====================================================================
-- 65. Choosing a plan, before there is a card reader
-- =====================================================================
--
-- The teacher can now be told she is out of credits, and the next thing
-- she will do is look for the button that fixes it. Stripe is not
-- connected yet, so the honest version is: she picks, we record it, and
-- we tell her plainly that billing is being set up.
--
-- Recording it is not a placeholder — it is the only demand signal that
-- exists before payments do. Which plan people reach for when they run
-- out is worth more than a guess at the mix, and §5 of the pricing model
-- currently rests on a guess (60/30/10).
--
-- When Stripe lands this table becomes the checkout's starting point
-- rather than something to delete.
CREATE TABLE IF NOT EXISTS public.plan_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id  uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  plan        text NOT NULL,
  credits     integer,
  kind        text NOT NULL DEFAULT 'subscription',  -- or 'topup'
  balance_at  integer,                               -- what was left when she asked
  created_at  timestamptz NOT NULL DEFAULT now(),
  fulfilled_at timestamptz
);

CREATE INDEX IF NOT EXISTS plan_requests_faculty_idx ON public.plan_requests (faculty_id, created_at DESC);

ALTER TABLE public.plan_requests ENABLE ROW LEVEL SECURITY;

-- Hers to read and to create. Never to fulfil — that is the payment's
-- job, and a teacher who could set `fulfilled_at` could grant herself a
-- plan.
DROP POLICY IF EXISTS plan_requests_owner ON public.plan_requests;
CREATE POLICY plan_requests_owner ON public.plan_requests
  FOR SELECT TO authenticated
  USING (faculty_id = public.current_faculty_id());

DROP POLICY IF EXISTS plan_requests_insert ON public.plan_requests;
CREATE POLICY plan_requests_insert ON public.plan_requests
  FOR INSERT TO authenticated
  WITH CHECK (faculty_id = public.current_faculty_id() AND fulfilled_at IS NULL);

/**
 * What the plans are, and what they buy — in real work.
 *
 * The credit costs come from `ai_credit_costs`, the same table the meter
 * quotes from, so the page cannot drift from what is actually charged.
 * A pricing page that says "15 lessons" while the meter charges for 10
 * is worse than one that says nothing.
 */
CREATE OR REPLACE FUNCTION public.plan_options()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE costs jsonb; out jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb) INTO costs FROM ai_credit_costs;

  SELECT jsonb_build_object(
    'usd_per_credit', 0.02,
    'costs', costs,
    'plans', jsonb_build_agg.plans,
    'topups', jsonb_build_agg.topups
  ) INTO out
  FROM (
    SELECT
      jsonb_build_array(
        jsonb_build_object('key','basic','name','Basic','price',12,'annual',120,'credits',120,
          'blurb','For one teacher, one timetable.'),
        jsonb_build_object('key','pro','name','Pro','price',35,'annual',350,'credits',350,
          'blurb','A full timetable, planned a term at a time.','popular',true),
        jsonb_build_object('key','max','name','Max','price',80,'annual',800,'credits',800,
          'blurb','Several classes, or a head of department.')
      ) AS plans,
      jsonb_build_array(
        jsonb_build_object('key','topup_100','credits',100,'price',5),
        jsonb_build_object('key','topup_300','credits',300,'price',14),
        jsonb_build_object('key','topup_600','credits',600,'price',26)
      ) AS topups
  ) jsonb_build_agg;

  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.plan_options() TO authenticated;

/** Record which plan she reached for, and what she had left when she did. */
CREATE OR REPLACE FUNCTION public.request_plan(p_plan text, p_credits integer, p_kind text DEFAULT 'subscription')
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE fid uuid; bal integer;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RAISE EXCEPTION 'not a teacher' USING ERRCODE = '42501'; END IF;

  SELECT balance INTO bal FROM credits WHERE faculty_id = fid;

  INSERT INTO plan_requests (faculty_id, plan, credits, kind, balance_at)
  VALUES (fid, p_plan, p_credits, COALESCE(p_kind,'subscription'), bal);

  RETURN jsonb_build_object('recorded', true, 'plan', p_plan);
END $$;
GRANT EXECUTE ON FUNCTION public.request_plan(text, integer, text) TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'billing: plans, top-ups and the interest they attract';
END $$;


-- =====================================================================
-- 66. A plan has a tier, and a tier decides the allowance
-- =====================================================================
--
-- `subscriptions.plan` is trial | monthly | quarterly | annual. That is a
-- BILLING PERIOD, not a tier — there was nowhere in the schema to say
-- someone is on Basic rather than Pro, which is a problem for a product
-- about to take money for exactly that distinction.
--
-- And nothing ever set `monthly_allowance` from the plan. It was written
-- once at sign-up (200) and never again, so:
--
--   * every trial handed out 200 credits. That was written when a
--     generation cost a flat 1 credit and 200 meant "200 generations".
--     Metered properly it means 25 lessons — $4.00 of AI per trial, and
--     at 30% conversion a $13.33 cost to acquire a $12/month customer;
--
--   * converting to Basic changed the plan and left the allowance at
--     200, so a $12 teacher refreshed 200 credits a month instead of
--     120. Margin 67% where the model says 80%.
--
-- One table decides it now, and both the sign-up trigger and the admin
-- console read from it. A number that lives in two places is a number
-- that will disagree.

CREATE TABLE IF NOT EXISTS public.plan_tiers (
  tier       text PRIMARY KEY,
  label      text NOT NULL,
  credits    integer NOT NULL,
  price_usd  numeric(8,2),
  sort       integer NOT NULL DEFAULT 0
);

INSERT INTO public.plan_tiers (tier, label, credits, price_usd, sort) VALUES
  ('trial', 'Free trial',  40,  0.00, 0),
  ('basic', 'Basic',      120, 12.00, 1),
  ('pro',   'Pro',        350, 35.00, 2),
  ('max',   'Max',        800, 80.00, 3)
ON CONFLICT (tier) DO UPDATE
  SET label = EXCLUDED.label, credits = EXCLUDED.credits,
      price_usd = EXCLUDED.price_usd, sort = EXCLUDED.sort;

ALTER TABLE public.plan_tiers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS plan_tiers_read ON public.plan_tiers;
CREATE POLICY plan_tiers_read ON public.plan_tiers FOR SELECT TO authenticated USING (true);

-- The tier a subscription is on. `plan` keeps meaning the billing period,
-- because the CHECK on it and every console that reads it already do.
ALTER TABLE public.subscriptions ADD COLUMN IF NOT EXISTS tier text NOT NULL DEFAULT 'trial';

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                  WHERE conname = 'subscriptions_tier_fk'
                    AND connamespace = 'public'::regnamespace) THEN
    ALTER TABLE public.subscriptions
      ADD CONSTRAINT subscriptions_tier_fk FOREIGN KEY (tier) REFERENCES public.plan_tiers(tier);
  END IF;
END $$;

/**
 * Put an account on a tier, and give it that tier's allowance.
 *
 * The one place a plan change and an allowance change happen together,
 * so they cannot drift. The BALANCE is only topped up when the new tier
 * is larger — moving down should not claw back credits she has already
 * paid for this month, and moving up should not make her wait a month
 * for what she just bought.
 */
CREATE OR REPLACE FUNCTION public.apply_plan_tier(p_faculty uuid, p_tier text)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE want integer; had integer; bal integer;
BEGIN
  SELECT credits INTO want FROM plan_tiers WHERE tier = p_tier;
  IF want IS NULL THEN RAISE EXCEPTION 'unknown tier %', p_tier USING ERRCODE = '22023'; END IF;

  SELECT monthly_allowance, balance INTO had, bal FROM credits WHERE faculty_id = p_faculty;

  UPDATE subscriptions SET tier = p_tier, updated_at = now() WHERE faculty_id = p_faculty;

  INSERT INTO credits (faculty_id, balance, monthly_allowance)
  VALUES (p_faculty, want, want)
  ON CONFLICT (faculty_id) DO UPDATE
    SET monthly_allowance = want,
        -- Upgrading gives her the difference now; downgrading leaves the
        -- balance alone until the next refresh trims it naturally.
        balance = CASE
                    WHEN want > COALESCE(had, 0)
                      THEN COALESCE(credits.balance, 0) + (want - COALESCE(had, 0))
                    ELSE credits.balance
                  END,
        updated_at = now();

  RETURN jsonb_build_object('tier', p_tier, 'allowance', want);
END $$;
GRANT EXECUTE ON FUNCTION public.apply_plan_tier(uuid, text) TO authenticated;

-- ── a new account gets a trial-sized trial ────────────────────────────
CREATE OR REPLACE FUNCTION public.provision_faculty()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE trial_credits integer;
BEGIN
  SELECT credits INTO trial_credits FROM plan_tiers WHERE tier = 'trial';

  INSERT INTO credits (faculty_id, balance, monthly_allowance)
  VALUES (NEW.id, COALESCE(trial_credits, 40), COALESCE(trial_credits, 40))
  ON CONFLICT (faculty_id) DO NOTHING;

  INSERT INTO subscriptions (faculty_id, plan, tier, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trial', 'trialing', now() + INTERVAL '7 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a sign-up over the entitlement rows. A teacher with no
  -- credits row is recoverable; a teacher who could not create an
  -- account at all is not.
  RAISE WARNING 'provision_faculty: %', SQLERRM;
  RETURN NEW;
END $function$;

-- ── the console sets the tier too ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.sa_set_subscription(
  p_faculty uuid, p_plan text, p_status text, p_ends_at timestamptz, p_tier text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
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

  -- The allowance follows the tier, or a Basic teacher keeps a trial's
  -- credits and the margin quietly goes with them.
  IF p_tier IS NOT NULL THEN
    PERFORM public.apply_plan_tier(p_faculty, p_tier);
  END IF;

  PERFORM public.sa_write_audit('superadmin.subscription.update', 'subscriptions', p_faculty,
                                jsonb_build_object('plan', p_plan, 'status', p_status,
                                                   'tier', p_tier, 'ends_at', p_ends_at));
  RETURN jsonb_build_object('ok', true);
END $function$;

DROP FUNCTION IF EXISTS public.sa_set_subscription(uuid, text, text, timestamptz);

DO $$
BEGIN
  RAISE NOTICE 'billing: tiers decide the allowance; a trial is 40 credits';
END $$;


-- =====================================================================
-- 67. The pricing page reads the tier table
-- =====================================================================
--
-- plan_options() had the three plans written into it as a literal. That
-- is two places holding the same numbers — the page could advertise 120
-- credits while apply_plan_tier() granted 200, and nothing would notice
-- until a teacher counted.
--
-- One table, read by the page that sells it and the function that grants
-- it.
CREATE OR REPLACE FUNCTION public.plan_options()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE costs jsonb; plans jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb) INTO costs FROM ai_credit_costs;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.sort), '[]'::jsonb) INTO plans
  FROM (
    SELECT tier AS key, label AS name, credits,
           price_usd::numeric AS price,
           -- Two months free, which is the ordinary shape of an annual
           -- plan and worth showing rather than burying in small print.
           (price_usd * 10)::numeric AS annual,
           sort,
           CASE tier
             WHEN 'basic' THEN 'For one teacher, one timetable.'
             WHEN 'pro'   THEN 'A full timetable, planned a term at a time.'
             WHEN 'max'   THEN 'Several classes, or a head of department.'
           END AS blurb,
           tier = 'pro' AS popular
      FROM plan_tiers
     WHERE tier <> 'trial'          -- not something to choose; it is where you start
  ) t;

  RETURN jsonb_build_object(
    'usd_per_credit', 0.02,
    'costs', costs,
    'plans', plans,
    'trial', (SELECT jsonb_build_object('credits', credits) FROM plan_tiers WHERE tier = 'trial'),
    'topups', jsonb_build_array(
      jsonb_build_object('key','topup_100','credits',100,'price',5),
      jsonb_build_object('key','topup_300','credits',300,'price',14),
      jsonb_build_object('key','topup_600','credits',600,'price',26)
    )
  );
END $$;

DO $$
BEGIN
  RAISE NOTICE 'billing: the pricing page and the grant read one table';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §68  Who spent what: the AI usage ledger, and the two views onto it
--
-- The meter has been charging correctly for a while, but nothing could
-- ANSWER anything with it. `usage_logs` carried a row per batch with the
-- feature left null, so "what does quiz generation cost us" and "which
-- teacher is burning the most" had no query behind them. Three fixes:
--
--   faculty_id   the log kept only auth user_id, so every question about
--                an account meant joining through faculty. Credits,
--                subscriptions and plans are all keyed by faculty.
--   feature      written per document now (the service settles per
--                artifact), so a batch of three appears as three rows
--                and a per-feature total is a GROUP BY rather than a
--                string-parse of "generate.lesson_plan+quiz+homework".
--   the RPCs     two audiences with deliberately different columns.
--
-- The audiences matter. A teacher sees CREDITS — the currency we sell —
-- and never a token count or a dollar of our cost: those are our supply
-- price, and publishing them invites arguments about a margin that is
-- none of her business. The super admin sees both, because the only way
-- to know whether the pricing works is to hold the credits charged and
-- the tokens spent in the same row.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.usage_logs ADD COLUMN IF NOT EXISTS faculty_id uuid;

-- Backfill: every historic row belongs to whoever owned that auth user.
UPDATE public.usage_logs l
   SET faculty_id = f.id
  FROM public.faculty f
 WHERE f.user_id = l.user_id
   AND l.faculty_id IS NULL;

CREATE INDEX IF NOT EXISTS usage_logs_faculty_idx  ON public.usage_logs (faculty_id, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_logs_feature_idx  ON public.usage_logs (feature, created_at DESC);
CREATE INDEX IF NOT EXISTS usage_logs_created_idx  ON public.usage_logs (created_at DESC);

/**
 * A feature's display name, for whichever audience is asking.
 *
 * The price list already names the features a teacher recognises; this
 * falls back to the raw key rather than inventing one, so a feature
 * nobody has priced yet still appears instead of vanishing into a NULL.
 */
CREATE OR REPLACE FUNCTION public.feature_label(p_feature text)
RETURNS text
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT label FROM ai_credit_costs WHERE feature = p_feature),
    CASE p_feature
      WHEN 'lesson_plan'   THEN 'Lesson plans'
      WHEN 'presentation'  THEN 'Presentations'
      WHEN 'quiz'          THEN 'Quizzes'
      WHEN 'homework'      THEN 'Homework'
      WHEN 'activity'      THEN 'Activities'
      WHEN 'bulletin'      THEN 'Bulletin board'
      WHEN 'skill_profile' THEN 'Teaching skills'
      WHEN 'goal_plan'     THEN 'Goal planner'
      WHEN 'chat'          THEN 'Assistant'
      WHEN 'reply'         THEN 'Assistant'
      ELSE initcap(replace(COALESCE(p_feature, 'other'), '_', ' '))
    END);
$$;

-- ── the teacher's own view: credits, and nothing about our costs ────────

/**
 * What this teacher has spent, and on what.
 *
 * Reads her own rows only — the faculty id comes from the session, not
 * from a parameter, so there is no id to tamper with. Deliberately
 * returns no tokens and no dollars.
 */
CREATE OR REPLACE FUNCTION public.my_ai_usage(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me    uuid := public.current_faculty_id();
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not a teacher' USING ERRCODE = '42501'; END IF;

  SELECT jsonb_build_object(
    'days', GREATEST(COALESCE(p_days, 30), 1),
    'balance',   (SELECT balance           FROM credits WHERE faculty_id = me),
    'allowance', (SELECT monthly_allowance FROM credits WHERE faculty_id = me),
    'renews_at', (SELECT next_refresh_at   FROM credits WHERE faculty_id = me),
    'plan',      (SELECT tier              FROM subscriptions WHERE faculty_id = me),
    -- Spent in the window, and spent since the allowance last refreshed.
    -- The second is the one that answers "why is my balance here".
    'spent', COALESCE((SELECT SUM(credits) FROM usage_logs
                        WHERE faculty_id = me AND created_at >= since), 0),
    'generations', COALESCE((SELECT COUNT(*) FROM usage_logs
                        WHERE faculty_id = me AND created_at >= since AND credits > 0), 0),
    'by_feature', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.credits DESC, t.feature)
        FROM (
          SELECT feature,
                 public.feature_label(feature) AS label,
                 SUM(credits)::int            AS credits,
                 COUNT(*)::int                AS runs
            FROM usage_logs
           WHERE faculty_id = me AND created_at >= since AND credits > 0
           GROUP BY feature
        ) t), '[]'::jsonb),
    'by_day', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.day)
        FROM (
          SELECT created_at::date AS day, SUM(credits)::int AS credits
            FROM usage_logs
           WHERE faculty_id = me AND created_at >= since AND credits > 0
           GROUP BY 1
        ) d), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.at DESC)
        FROM (
          SELECT created_at AS at,
                 public.feature_label(feature) AS label,
                 credits
            FROM usage_logs
           WHERE faculty_id = me AND credits > 0
           ORDER BY created_at DESC
           LIMIT 20
        ) r), '[]'::jsonb)
  ) INTO out;

  RETURN out;
END $$;

-- ── the super admin's view: credits AND what they actually cost us ──────

/**
 * The platform, in one object.
 *
 * `revenue` here is contracted plan value, not cash collected — card
 * payments are not switched on yet, so calling it revenue outright
 * would be a number that reads as money in the bank when it is not.
 * Named `plan_value_usd` so nobody has to remember that caveat.
 */
CREATE OR REPLACE FUNCTION public.sa_ai_overview(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT jsonb_build_object(
    'days', GREATEST(COALESCE(p_days, 30), 1),
    'tokens_in',   COALESCE(SUM(tokens_in), 0),
    'tokens_out',  COALESCE(SUM(tokens_out), 0),
    'cache_read',  COALESCE(SUM(cache_read_tokens), 0),
    'cache_write', COALESCE(SUM(cache_write_tokens), 0),
    'tokens_total', COALESCE(SUM(tokens_in + tokens_out + cache_read_tokens + cache_write_tokens), 0),
    'cost_usd',    ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4),
    'credits',     COALESCE(SUM(credits), 0),
    'generations', COUNT(*),
    'active_users', COUNT(DISTINCT faculty_id)
  ) INTO out
    FROM usage_logs WHERE created_at >= since;

  -- What we charged for that spend, and what it left us.
  out := out || jsonb_build_object(
    'charged_usd', ROUND(((out->>'credits')::numeric * 0.02), 4),
    'margin_usd',  ROUND(((out->>'credits')::numeric * 0.02) - (out->>'cost_usd')::numeric, 4)
  );

  out := out || jsonb_build_object(
    'accounts', (SELECT COUNT(*) FROM faculty),
    'paying',   (SELECT COUNT(*) FROM subscriptions s
                  WHERE s.tier <> 'trial' AND s.status IN ('active', 'trialing')),
    'trialing', (SELECT COUNT(*) FROM subscriptions WHERE tier = 'trial'),
    'plan_value_usd', (SELECT ROUND(COALESCE(SUM(t.price_usd), 0)::numeric, 2)
                         FROM subscriptions s JOIN plan_tiers t ON t.tier = s.tier
                        WHERE s.tier <> 'trial' AND s.status IN ('active', 'trialing')),
    'credits_outstanding', (SELECT COALESCE(SUM(balance), 0) FROM credits)
  );

  RETURN out;
END $$;

/** Per feature: what it costs us, what we charge for it, what it earns. */
CREATE OR REPLACE FUNCTION public.sa_ai_by_feature(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.cost_usd DESC), '[]'::jsonb) INTO out
    FROM (
      SELECT feature,
             public.feature_label(feature)                              AS label,
             COUNT(*)::int                                              AS runs,
             COUNT(DISTINCT faculty_id)::int                            AS users,
             COALESCE(SUM(tokens_in), 0)::bigint                        AS tokens_in,
             COALESCE(SUM(tokens_out), 0)::bigint                       AS tokens_out,
             COALESCE(SUM(cache_read_tokens), 0)::bigint                AS cache_read,
             COALESCE(SUM(cache_write_tokens), 0)::bigint               AS cache_write,
             ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4)              AS cost_usd,
             COALESCE(SUM(credits), 0)::int                             AS credits,
             ROUND((COALESCE(SUM(credits), 0) * 0.02)::numeric, 4)      AS charged_usd,
             -- The number that decides whether the price list is right.
             ROUND(AVG(credits)::numeric, 2)                            AS avg_credits,
             ROUND(AVG(cost_usd)::numeric, 5)                           AS avg_cost_usd,
             -- What the price list SAYS it costs, next to what it really did.
             (SELECT cost FROM ai_credit_costs c WHERE c.feature = u.feature) AS listed_credits
        FROM usage_logs u
       WHERE created_at >= since
       GROUP BY feature
    ) t;

  RETURN out;
END $$;

/** Per account: spend, credits, plan and what they are worth to us. */
CREATE OR REPLACE FUNCTION public.sa_ai_by_user(p_days int DEFAULT 30, p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.cost_usd DESC NULLS LAST), '[]'::jsonb) INTO out
    FROM (
      SELECT f.id                                                       AS faculty_id,
             u.email,
             COALESCE(NULLIF(TRIM(f.full_name), ''), split_part(u.email, '@', 1)) AS name,
             COALESCE(s.tier, 'trial')                                  AS tier,
             COALESCE(s.status, 'trialing')                             AS status,
             s.trial_ends_at,
             s.current_period_end,
             COALESCE(pt.price_usd, 0)                                  AS plan_usd,
             c.balance,
             c.monthly_allowance,
             COALESCE(l.tokens_in, 0)                                   AS tokens_in,
             COALESCE(l.tokens_out, 0)                                  AS tokens_out,
             COALESCE(l.cache_read, 0)                                  AS cache_read,
             COALESCE(l.cache_write, 0)                                 AS cache_write,
             COALESCE(l.cost_usd, 0)                                    AS cost_usd,
             COALESCE(l.credits, 0)                                     AS credits,
             COALESCE(l.runs, 0)                                        AS runs,
             l.last_used_at,
             -- Are they costing us more than their plan brings in?
             ROUND((COALESCE(pt.price_usd, 0) - COALESCE(l.cost_usd, 0))::numeric, 4) AS net_usd
        FROM faculty f
        JOIN auth.users u        ON u.id = f.user_id
        LEFT JOIN subscriptions s ON s.faculty_id = f.id
        LEFT JOIN plan_tiers pt   ON pt.tier = COALESCE(s.tier, 'trial')
        LEFT JOIN credits c       ON c.faculty_id = f.id
        LEFT JOIN (
          SELECT faculty_id,
                 SUM(tokens_in)::bigint                     AS tokens_in,
                 SUM(tokens_out)::bigint                    AS tokens_out,
                 SUM(cache_read_tokens)::bigint             AS cache_read,
                 SUM(cache_write_tokens)::bigint            AS cache_write,
                 ROUND(SUM(cost_usd)::numeric, 4)           AS cost_usd,
                 SUM(credits)::int                          AS credits,
                 COUNT(*)::int                              AS runs,
                 MAX(created_at)                            AS last_used_at
            FROM usage_logs
           WHERE created_at >= since AND faculty_id IS NOT NULL
           GROUP BY faculty_id
        ) l ON l.faculty_id = f.id
       ORDER BY COALESCE(l.cost_usd, 0) DESC
       LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    ) t;

  RETURN out;
END $$;

/** One account, opened up: its per-feature breakdown and recent runs. */
CREATE OR REPLACE FUNCTION public.sa_ai_user(p_faculty uuid, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT jsonb_build_object(
    'faculty_id', f.id,
    'email', u.email,
    'name', COALESCE(NULLIF(TRIM(f.full_name), ''), split_part(u.email, '@', 1)),
    'tier', COALESCE(s.tier, 'trial'),
    'status', COALESCE(s.status, 'trialing'),
    'plan_usd', COALESCE(pt.price_usd, 0),
    'balance', c.balance,
    'allowance', c.monthly_allowance,
    'renews_at', c.next_refresh_at,
    'trial_ends_at', s.trial_ends_at,
    'by_feature', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.cost_usd DESC)
        FROM (
          SELECT feature,
                 public.feature_label(feature)                    AS label,
                 COUNT(*)::int                                    AS runs,
                 SUM(tokens_in + tokens_out
                     + cache_read_tokens + cache_write_tokens)::bigint AS tokens,
                 ROUND(SUM(cost_usd)::numeric, 4)                 AS cost_usd,
                 SUM(credits)::int                                AS credits
            FROM usage_logs
           WHERE faculty_id = f.id AND created_at >= since
           GROUP BY feature
        ) x), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.at DESC)
        FROM (
          SELECT created_at AS at, operation,
                 public.feature_label(feature) AS label, model,
                 tokens_in, tokens_out, cache_read_tokens AS cache_read,
                 cache_write_tokens AS cache_write,
                 ROUND(cost_usd::numeric, 5) AS cost_usd, credits
            FROM usage_logs
           WHERE faculty_id = f.id
           ORDER BY created_at DESC LIMIT 30
        ) r), '[]'::jsonb)
  ) INTO out
    FROM faculty f
    JOIN auth.users u ON u.id = f.user_id
    LEFT JOIN subscriptions s ON s.faculty_id = f.id
    LEFT JOIN plan_tiers pt   ON pt.tier = COALESCE(s.tier, 'trial')
    LEFT JOIN credits c       ON c.faculty_id = f.id
   WHERE f.id = p_faculty;

  IF out IS NULL THEN RAISE EXCEPTION 'no such account' USING ERRCODE = '22023'; END IF;
  RETURN out;
END $$;

/** The trend line — spend and charge per day, so a spike is visible. */
CREATE OR REPLACE FUNCTION public.sa_ai_daily(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) INTO out
    FROM (
      SELECT created_at::date                                  AS day,
             SUM(tokens_in + tokens_out
                 + cache_read_tokens + cache_write_tokens)::bigint AS tokens,
             ROUND(SUM(cost_usd)::numeric, 4)                  AS cost_usd,
             SUM(credits)::int                                 AS credits,
             COUNT(*)::int                                     AS runs,
             COUNT(DISTINCT faculty_id)::int                   AS users
        FROM usage_logs
       WHERE created_at >= since
       GROUP BY 1
    ) d;

  RETURN out;
END $$;

GRANT EXECUTE ON FUNCTION public.feature_label(text)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_ai_usage(int)           TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_overview(int)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_by_feature(int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_by_user(int, int)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_user(uuid, int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_daily(int)           TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'usage: the ledger can answer per user, per feature, per day';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §69  The back catalogue, bucketed
--
-- §68 added the column; the service fills it going forward. The 299 rows
-- already in the table predate it and would show as one unnamed slab on
-- every chart. This applies the SAME rules the service uses (see
-- featureOf() in the backend's src/lib/usage.ts) to what is already
-- there, so the first day of the dashboard has a history behind it.
--
-- Historic BATCH rows are honest about what they are: one row covering
-- several documents, which cannot be split after the fact. They bucket to
-- 'batch' rather than being guessed apart — a fabricated split would look
-- more precise and be less true.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.feature_of(p_operation text)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$
  WITH op AS (SELECT lower(btrim(COALESCE(p_operation, ''))) AS o),
  bare AS (
    SELECT o,
           CASE WHEN o LIKE 'generate.%' THEN substr(o, 10) ELSE o END AS b
      FROM op
  )
  SELECT CASE
    WHEN b IS NULL OR b = ''      THEN 'other'
    WHEN o LIKE '%.refused'       THEN 'refused'
    WHEN b LIKE '%+%'             THEN 'batch'
    ELSE CASE replace(b, '.', '_')
           WHEN 'chatbot'          THEN 'chat'
           WHEN 'quiz_draft'       THEN 'quiz'
           WHEN 'quiz_tweak'       THEN 'quiz'
           WHEN 'goal_plan_empty'  THEN 'goal_plan'
           WHEN 'schedule_resolve' THEN 'schedule'
           ELSE replace(b, '.', '_')
         END
  END FROM bare;
$$;

UPDATE public.usage_logs
   SET feature = public.feature_of(operation)
 WHERE feature IS NULL OR feature = '';

-- The label table gained buckets that are not sellable features but do
-- appear on our side of the dashboard.
CREATE OR REPLACE FUNCTION public.feature_label(p_feature text)
RETURNS text
LANGUAGE sql STABLE SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    (SELECT label FROM ai_credit_costs WHERE feature = p_feature),
    CASE p_feature
      WHEN 'lesson_plan'   THEN 'Lesson plans'
      WHEN 'presentation'  THEN 'Presentations'
      WHEN 'quiz'          THEN 'Quizzes'
      WHEN 'homework'      THEN 'Homework'
      WHEN 'activity'      THEN 'Activities'
      WHEN 'bulletin'      THEN 'Bulletin board'
      WHEN 'skill_profile' THEN 'Teaching skills'
      WHEN 'goal_plan'     THEN 'Goal planner'
      WHEN 'chat'          THEN 'Assistant'
      WHEN 'schedule'      THEN 'Scheduling'
      WHEN 'resume_parse'  THEN 'CV reading'
      WHEN 'materials'     THEN 'Reading attachments'
      -- Ours, not hers. Tokens spent with nothing delivered.
      WHEN 'refused'       THEN 'Refused (uncharged)'
      WHEN 'unfinished'    THEN 'Unfinished (uncharged)'
      WHEN 'batch'         THEN 'Batch (before per-document logging)'
      ELSE initcap(replace(COALESCE(p_feature, 'other'), '_', ' '))
    END);
$$;

GRANT EXECUTE ON FUNCTION public.feature_of(text) TO authenticated;

DO $$
DECLARE unbucketed int;
BEGIN
  SELECT COUNT(*) INTO unbucketed FROM usage_logs WHERE feature IS NULL OR feature = '';
  IF unbucketed > 0 THEN
    RAISE EXCEPTION 'usage: % rows still have no feature', unbucketed;
  END IF;
  RAISE NOTICE 'usage: every row is bucketed';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §70  sa_ai_user / sa_ai_by_user read a column that does not exist
--
-- Both reached for `faculty.full_name`. There is no such column — a
-- person's name lives on public.users as first_name / last_name, which is
-- where every other sa_ function already looks (sa_accounts, §37).
--
-- The account drawer calls sa_ai_user the moment it opens, so this was
-- not a cosmetic fault: it raised 42703 and the whole panel failed. It
-- went unnoticed because §68 was only ever exercised through
-- sa_ai_overview, which does not join a name at all.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sa_ai_by_user(p_days int DEFAULT 30, p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.cost_usd DESC NULLS LAST), '[]'::jsonb) INTO out
    FROM (
      SELECT f.id                                                       AS faculty_id,
             au.email,
             COALESCE(
               NULLIF(BTRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''),
               split_part(au.email, '@', 1))                            AS name,
             COALESCE(s.tier, 'trial')                                  AS tier,
             COALESCE(s.status, 'trialing')                             AS status,
             s.trial_ends_at,
             s.current_period_end,
             COALESCE(pt.price_usd, 0)                                  AS plan_usd,
             c.balance,
             c.monthly_allowance,
             COALESCE(l.tokens_in, 0)                                   AS tokens_in,
             COALESCE(l.tokens_out, 0)                                  AS tokens_out,
             COALESCE(l.cache_read, 0)                                  AS cache_read,
             COALESCE(l.cache_write, 0)                                 AS cache_write,
             COALESCE(l.cost_usd, 0)                                    AS cost_usd,
             COALESCE(l.credits, 0)                                     AS credits,
             COALESCE(l.runs, 0)                                        AS runs,
             l.last_used_at,
             ROUND((COALESCE(pt.price_usd, 0) - COALESCE(l.cost_usd, 0))::numeric, 4) AS net_usd
        FROM faculty f
        JOIN auth.users au        ON au.id = f.user_id
        LEFT JOIN public.users pu ON pu.id = f.user_id
        LEFT JOIN subscriptions s ON s.faculty_id = f.id
        LEFT JOIN plan_tiers pt   ON pt.tier = COALESCE(s.tier, 'trial')
        LEFT JOIN credits c       ON c.faculty_id = f.id
        LEFT JOIN (
          SELECT faculty_id,
                 SUM(tokens_in)::bigint                     AS tokens_in,
                 SUM(tokens_out)::bigint                    AS tokens_out,
                 SUM(cache_read_tokens)::bigint             AS cache_read,
                 SUM(cache_write_tokens)::bigint            AS cache_write,
                 ROUND(SUM(cost_usd)::numeric, 4)           AS cost_usd,
                 SUM(credits)::int                          AS credits,
                 COUNT(*)::int                              AS runs,
                 MAX(created_at)                            AS last_used_at
            FROM usage_logs
           WHERE created_at >= since AND faculty_id IS NOT NULL
           GROUP BY faculty_id
        ) l ON l.faculty_id = f.id
       ORDER BY COALESCE(l.cost_usd, 0) DESC
       LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    ) t;

  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_ai_user(p_faculty uuid, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT jsonb_build_object(
    'faculty_id', f.id,
    'email', au.email,
    'name', COALESCE(
              NULLIF(BTRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''),
              split_part(au.email, '@', 1)),
    'tier', COALESCE(s.tier, 'trial'),
    'status', COALESCE(s.status, 'trialing'),
    'plan_usd', COALESCE(pt.price_usd, 0),
    'balance', c.balance,
    'allowance', c.monthly_allowance,
    'renews_at', c.next_refresh_at,
    'trial_ends_at', s.trial_ends_at,
    'by_feature', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.cost_usd DESC)
        FROM (
          SELECT feature,
                 public.feature_label(feature)                    AS label,
                 COUNT(*)::int                                    AS runs,
                 SUM(tokens_in + tokens_out
                     + cache_read_tokens + cache_write_tokens)::bigint AS tokens,
                 ROUND(SUM(cost_usd)::numeric, 4)                 AS cost_usd,
                 SUM(credits)::int                                AS credits
            FROM usage_logs
           WHERE faculty_id = f.id AND created_at >= since
           GROUP BY feature
        ) x), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.at DESC)
        FROM (
          SELECT created_at AS at, operation,
                 public.feature_label(feature) AS label, model,
                 tokens_in, tokens_out, cache_read_tokens AS cache_read,
                 cache_write_tokens AS cache_write,
                 ROUND(cost_usd::numeric, 5) AS cost_usd, credits
            FROM usage_logs
           WHERE faculty_id = f.id
           ORDER BY created_at DESC LIMIT 30
        ) r), '[]'::jsonb)
  ) INTO out
    FROM faculty f
    JOIN auth.users au        ON au.id = f.user_id
    LEFT JOIN public.users pu ON pu.id = f.user_id
    LEFT JOIN subscriptions s ON s.faculty_id = f.id
    LEFT JOIN plan_tiers pt   ON pt.tier = COALESCE(s.tier, 'trial')
    LEFT JOIN credits c       ON c.faculty_id = f.id
   WHERE f.id = p_faculty;

  IF out IS NULL THEN RAISE EXCEPTION 'no such account' USING ERRCODE = '22023'; END IF;
  RETURN out;
END $$;

-- Prove both run rather than trusting that they compile: a function body
-- is not parsed until it executes, which is exactly how §68 shipped
-- broken.
DO $$
DECLARE probe uuid;
BEGIN
  SELECT id INTO probe FROM faculty LIMIT 1;
  IF probe IS NULL THEN
    RAISE NOTICE 'usage: no faculty to probe against';
  ELSE
    PERFORM public.sa_ai_user(probe, 30);
    PERFORM public.sa_ai_by_user(30, 5);
    RAISE NOTICE 'usage: per-account reporting runs';
  END IF;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §71  Don't let the pre-meter back catalogue set the margin
--
-- The dashboard read −$1.50 margin, which was true of the table and false
-- of the business. `usage_logs` holds three eras and only the third is
-- evidence of anything:
--
--   1  unmetered   325 rows, Aug 10–21. Real tokens, real cost, credits
--                  NULL — generation predating credit accounting. Pure
--                  cost, no charge, and nothing to learn from.
--   2  unmeasured   26 rows, Aug 17–23. The old browser-side meter:
--                  charged credits without recording tokens or cost, so
--                  it shows infinite margin. Also the double-charging
--                  bug, since removed.
--   3  metered      the server meter. Credits derived from measured
--                  tokens. The only rows where charge and cost are both
--                  real and comparable.
--
-- Classified structurally rather than by a cutoff date — a date would be
-- a guess about when a deploy landed, and would silently mis-sort a row
-- either side of it.
--
-- Our COST is still the sum of all three: we genuinely paid for era 1.
-- What the metered filter changes is which rows are allowed to speak to
-- pricing. The overview returns both, labelled, so the excluded spend is
-- visible rather than quietly dropped.
-- ─────────────────────────────────────────────────────────────────────────

/**
 * Which era a usage row belongs to.
 *
 * IMMUTABLE and column-driven so it can sit in a WHERE clause without
 * costing a scan per row of something more elaborate.
 */
CREATE OR REPLACE FUNCTION public.usage_era(p_credits int, p_cost numeric)
RETURNS text
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$
  SELECT CASE
           WHEN p_credits IS NULL THEN 'unmetered'
           WHEN p_cost    IS NULL THEN 'unmeasured'
           ELSE                        'metered'
         END;
$$;

CREATE INDEX IF NOT EXISTS usage_logs_metered_idx
  ON public.usage_logs (created_at DESC)
  WHERE credits IS NOT NULL AND cost_usd IS NOT NULL;

-- A defaulted parameter added by CREATE OR REPLACE OVERLOADS rather than
-- replaces, leaving two functions of the same name and letting PostgREST
-- pick the stale one. Drop first. (This exact trap already cost us once,
-- with sa_accounts.)
DROP FUNCTION IF EXISTS public.sa_ai_overview(int);
DROP FUNCTION IF EXISTS public.sa_ai_by_feature(int);
DROP FUNCTION IF EXISTS public.sa_ai_by_user(int, int);
DROP FUNCTION IF EXISTS public.sa_ai_user(uuid, int);
DROP FUNCTION IF EXISTS public.sa_ai_daily(int);

CREATE OR REPLACE FUNCTION public.sa_ai_overview(p_days int DEFAULT 30, p_metered_only boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  metered boolean := COALESCE(p_metered_only, true);
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT jsonb_build_object(
    'days', GREATEST(COALESCE(p_days, 30), 1),
    'metered_only', metered,
    'tokens_in',   COALESCE(SUM(tokens_in), 0),
    'tokens_out',  COALESCE(SUM(tokens_out), 0),
    'cache_read',  COALESCE(SUM(cache_read_tokens), 0),
    'cache_write', COALESCE(SUM(cache_write_tokens), 0),
    'tokens_total', COALESCE(SUM(tokens_in + tokens_out + cache_read_tokens + cache_write_tokens), 0),
    'cost_usd',    ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4),
    'credits',     COALESCE(SUM(credits), 0),
    'generations', COUNT(*),
    'active_users', COUNT(DISTINCT faculty_id)
  ) INTO out
    FROM usage_logs
   WHERE created_at >= since
     AND (NOT metered OR public.usage_era(credits, cost_usd) = 'metered');

  out := out || jsonb_build_object(
    'charged_usd', ROUND(((out->>'credits')::numeric * 0.02), 4),
    'margin_usd',  ROUND(((out->>'credits')::numeric * 0.02) - (out->>'cost_usd')::numeric, 4)
  );

  /**
   * What the filter left out, so it is excluded rather than hidden.
   *
   * A margin that improves because rows were dropped is metered honest if
   * the dropped rows are on the same screen.
   */
  out := out || jsonb_build_object(
    'excluded', COALESCE((
      SELECT jsonb_object_agg(era, info) FROM (
        SELECT public.usage_era(credits, cost_usd) AS era,
               jsonb_build_object(
                 'rows',     COUNT(*),
                 'cost_usd', ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4),
                 'credits',  COALESCE(SUM(credits), 0),
                 'first',    MIN(created_at)::date,
                 'last',     MAX(created_at)::date
               ) AS info
          FROM usage_logs
         WHERE created_at >= since
           AND public.usage_era(credits, cost_usd) <> 'metered'
         GROUP BY 1
      ) e), '{}'::jsonb)
  );

  out := out || jsonb_build_object(
    'accounts', (SELECT COUNT(*) FROM faculty),
    'paying',   (SELECT COUNT(*) FROM subscriptions s
                  WHERE s.tier <> 'trial' AND s.status IN ('active', 'trialing')),
    'trialing', (SELECT COUNT(*) FROM subscriptions WHERE tier = 'trial'),
    'plan_value_usd', (SELECT ROUND(COALESCE(SUM(t.price_usd), 0)::numeric, 2)
                         FROM subscriptions s JOIN plan_tiers t ON t.tier = s.tier
                        WHERE s.tier <> 'trial' AND s.status IN ('active', 'trialing')),
    'credits_outstanding', (SELECT COALESCE(SUM(balance), 0) FROM credits)
  );

  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_ai_by_feature(p_days int DEFAULT 30, p_metered_only boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  metered boolean := COALESCE(p_metered_only, true);
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.cost_usd DESC), '[]'::jsonb) INTO out
    FROM (
      SELECT feature,
             public.feature_label(feature)                              AS label,
             COUNT(*)::int                                              AS runs,
             COUNT(DISTINCT faculty_id)::int                            AS users,
             COALESCE(SUM(tokens_in), 0)::bigint                        AS tokens_in,
             COALESCE(SUM(tokens_out), 0)::bigint                       AS tokens_out,
             COALESCE(SUM(cache_read_tokens), 0)::bigint                AS cache_read,
             COALESCE(SUM(cache_write_tokens), 0)::bigint               AS cache_write,
             ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4)              AS cost_usd,
             COALESCE(SUM(credits), 0)::int                             AS credits,
             ROUND((COALESCE(SUM(credits), 0) * 0.02)::numeric, 4)      AS charged_usd,
             ROUND(AVG(credits)::numeric, 2)                            AS avg_credits,
             ROUND(AVG(cost_usd)::numeric, 5)                           AS avg_cost_usd,
             (SELECT cost FROM ai_credit_costs c WHERE c.feature = u.feature) AS listed_credits
        FROM usage_logs u
       WHERE created_at >= since
         AND (NOT metered OR public.usage_era(credits, cost_usd) = 'metered')
       GROUP BY feature
    ) t;

  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_ai_by_user(p_days int DEFAULT 30, p_limit int DEFAULT 100,
                                                p_metered_only boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  metered boolean := COALESCE(p_metered_only, true);
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.cost_usd DESC NULLS LAST), '[]'::jsonb) INTO out
    FROM (
      SELECT f.id                                                       AS faculty_id,
             au.email,
             COALESCE(
               NULLIF(BTRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''),
               split_part(au.email, '@', 1))                            AS name,
             COALESCE(s.tier, 'trial')                                  AS tier,
             COALESCE(s.status, 'trialing')                             AS status,
             s.trial_ends_at,
             s.current_period_end,
             COALESCE(pt.price_usd, 0)                                  AS plan_usd,
             c.balance,
             c.monthly_allowance,
             COALESCE(l.tokens_in, 0)                                   AS tokens_in,
             COALESCE(l.tokens_out, 0)                                  AS tokens_out,
             COALESCE(l.cache_read, 0)                                  AS cache_read,
             COALESCE(l.cache_write, 0)                                 AS cache_write,
             COALESCE(l.cost_usd, 0)                                    AS cost_usd,
             COALESCE(l.credits, 0)                                     AS credits,
             COALESCE(l.runs, 0)                                        AS runs,
             l.last_used_at,
             ROUND((COALESCE(pt.price_usd, 0) - COALESCE(l.cost_usd, 0))::numeric, 4) AS net_usd
        FROM faculty f
        JOIN auth.users au        ON au.id = f.user_id
        LEFT JOIN public.users pu ON pu.id = f.user_id
        LEFT JOIN subscriptions s ON s.faculty_id = f.id
        LEFT JOIN plan_tiers pt   ON pt.tier = COALESCE(s.tier, 'trial')
        LEFT JOIN credits c       ON c.faculty_id = f.id
        LEFT JOIN (
          SELECT faculty_id,
                 SUM(tokens_in)::bigint                     AS tokens_in,
                 SUM(tokens_out)::bigint                    AS tokens_out,
                 SUM(cache_read_tokens)::bigint             AS cache_read,
                 SUM(cache_write_tokens)::bigint            AS cache_write,
                 ROUND(SUM(cost_usd)::numeric, 4)           AS cost_usd,
                 SUM(credits)::int                          AS credits,
                 COUNT(*)::int                              AS runs,
                 MAX(created_at)                            AS last_used_at
            FROM usage_logs
           WHERE created_at >= since AND faculty_id IS NOT NULL
             AND (NOT metered OR public.usage_era(credits, cost_usd) = 'metered')
           GROUP BY faculty_id
        ) l ON l.faculty_id = f.id
       ORDER BY COALESCE(l.cost_usd, 0) DESC
       LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    ) t;

  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_ai_user(p_faculty uuid, p_days int DEFAULT 30,
                                             p_metered_only boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  metered boolean := COALESCE(p_metered_only, true);
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT jsonb_build_object(
    'faculty_id', f.id,
    'email', au.email,
    'name', COALESCE(
              NULLIF(BTRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''),
              split_part(au.email, '@', 1)),
    'tier', COALESCE(s.tier, 'trial'),
    'status', COALESCE(s.status, 'trialing'),
    'plan_usd', COALESCE(pt.price_usd, 0),
    'balance', c.balance,
    'allowance', c.monthly_allowance,
    'renews_at', c.next_refresh_at,
    'trial_ends_at', s.trial_ends_at,
    'metered_only', metered,
    'by_feature', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.cost_usd DESC)
        FROM (
          SELECT feature,
                 public.feature_label(feature)                    AS label,
                 COUNT(*)::int                                    AS runs,
                 SUM(tokens_in + tokens_out
                     + cache_read_tokens + cache_write_tokens)::bigint AS tokens,
                 ROUND(SUM(cost_usd)::numeric, 4)                 AS cost_usd,
                 SUM(credits)::int                                AS credits
            FROM usage_logs
           WHERE faculty_id = f.id AND created_at >= since
             AND (NOT metered OR public.usage_era(credits, cost_usd) = 'metered')
           GROUP BY feature
        ) x), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.at DESC)
        FROM (
          SELECT created_at AS at, operation,
                 public.feature_label(feature) AS label, model,
                 public.usage_era(credits, cost_usd) AS era,
                 tokens_in, tokens_out, cache_read_tokens AS cache_read,
                 cache_write_tokens AS cache_write,
                 ROUND(cost_usd::numeric, 5) AS cost_usd, credits
            FROM usage_logs
           WHERE faculty_id = f.id
           ORDER BY created_at DESC LIMIT 30
        ) r), '[]'::jsonb)
  ) INTO out
    FROM faculty f
    JOIN auth.users au        ON au.id = f.user_id
    LEFT JOIN public.users pu ON pu.id = f.user_id
    LEFT JOIN subscriptions s ON s.faculty_id = f.id
    LEFT JOIN plan_tiers pt   ON pt.tier = COALESCE(s.tier, 'trial')
    LEFT JOIN credits c       ON c.faculty_id = f.id
   WHERE f.id = p_faculty;

  IF out IS NULL THEN RAISE EXCEPTION 'no such account' USING ERRCODE = '22023'; END IF;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_ai_daily(p_days int DEFAULT 30, p_metered_only boolean DEFAULT true)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  metered boolean := COALESCE(p_metered_only, true);
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) INTO out
    FROM (
      SELECT created_at::date                                  AS day,
             SUM(tokens_in + tokens_out
                 + cache_read_tokens + cache_write_tokens)::bigint AS tokens,
             ROUND(SUM(cost_usd)::numeric, 4)                  AS cost_usd,
             SUM(credits)::int                                 AS credits,
             COUNT(*)::int                                     AS runs,
             COUNT(DISTINCT faculty_id)::int                   AS users
        FROM usage_logs
       WHERE created_at >= since
         AND (NOT metered OR public.usage_era(credits, cost_usd) = 'metered')
       GROUP BY 1
    ) d;

  RETURN out;
END $$;

GRANT EXECUTE ON FUNCTION public.usage_era(int, numeric)               TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_overview(int, boolean)          TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_by_feature(int, boolean)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_by_user(int, int, boolean)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_user(uuid, int, boolean)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_daily(int, boolean)             TO authenticated;

DO $$
DECLARE probe uuid; dupes int;
BEGIN
  -- The overload trap this section warns about, checked rather than assumed.
  SELECT COUNT(*) INTO dupes FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
   WHERE n.nspname = 'public' AND p.proname = 'sa_ai_overview';
  IF dupes <> 1 THEN
    RAISE EXCEPTION 'sa_ai_overview has % signatures; a stale one would win', dupes;
  END IF;

  SELECT id INTO probe FROM faculty LIMIT 1;
  IF probe IS NOT NULL THEN
    PERFORM public.sa_ai_overview(30, true);
    PERFORM public.sa_ai_by_feature(30, true);
    PERFORM public.sa_ai_by_user(30, 5, true);
    PERFORM public.sa_ai_user(probe, 30, true);
    PERFORM public.sa_ai_daily(30, true);
  END IF;
  RAISE NOTICE 'usage: margin reads from metered rows only';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §72  Put every row back in the figures — §71 reverted
--
-- §71 filtered the AI reporting down to rows the server meter priced,
-- to stop generation from before credit accounting dragging the margin
-- negative. Reverted on request: the dashboard shows the whole table
-- again, margin included.
--
-- Reverted FORWARD rather than by deleting §71 — this file is an
-- append-only log and a section that ran against the live database does
-- not stop having happened because the text was removed.
--
-- The p_metered_only signatures must be DROPPED, not merely replaced:
-- the plain forms differ in arity, so CREATE OR REPLACE alone would
-- leave both and let PostgREST resolve to whichever it liked. Same trap
-- §71 documented, now in the other direction.
--
-- usage_era() stays. Nothing reads it after this, but it is the only
-- written record of how the three eras are told apart, and it costs
-- nothing to keep.
-- ─────────────────────────────────────────────────────────────────────────

DROP FUNCTION IF EXISTS public.sa_ai_overview(int, boolean);
DROP FUNCTION IF EXISTS public.sa_ai_by_feature(int, boolean);
DROP FUNCTION IF EXISTS public.sa_ai_by_user(int, int, boolean);
DROP FUNCTION IF EXISTS public.sa_ai_user(uuid, int, boolean);
DROP FUNCTION IF EXISTS public.sa_ai_daily(int, boolean);

CREATE OR REPLACE FUNCTION public.sa_ai_overview(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT jsonb_build_object(
    'days', GREATEST(COALESCE(p_days, 30), 1),
    'tokens_in',   COALESCE(SUM(tokens_in), 0),
    'tokens_out',  COALESCE(SUM(tokens_out), 0),
    'cache_read',  COALESCE(SUM(cache_read_tokens), 0),
    'cache_write', COALESCE(SUM(cache_write_tokens), 0),
    'tokens_total', COALESCE(SUM(tokens_in + tokens_out + cache_read_tokens + cache_write_tokens), 0),
    'cost_usd',    ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4),
    'credits',     COALESCE(SUM(credits), 0),
    'generations', COUNT(*),
    'active_users', COUNT(DISTINCT faculty_id)
  ) INTO out
    FROM usage_logs WHERE created_at >= since;

  out := out || jsonb_build_object(
    'charged_usd', ROUND(((out->>'credits')::numeric * 0.02), 4),
    'margin_usd',  ROUND(((out->>'credits')::numeric * 0.02) - (out->>'cost_usd')::numeric, 4)
  );

  out := out || jsonb_build_object(
    'accounts', (SELECT COUNT(*) FROM faculty),
    'paying',   (SELECT COUNT(*) FROM subscriptions s
                  WHERE s.tier <> 'trial' AND s.status IN ('active', 'trialing')),
    'trialing', (SELECT COUNT(*) FROM subscriptions WHERE tier = 'trial'),
    'plan_value_usd', (SELECT ROUND(COALESCE(SUM(t.price_usd), 0)::numeric, 2)
                         FROM subscriptions s JOIN plan_tiers t ON t.tier = s.tier
                        WHERE s.tier <> 'trial' AND s.status IN ('active', 'trialing')),
    'credits_outstanding', (SELECT COALESCE(SUM(balance), 0) FROM credits)
  );

  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_ai_by_feature(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.cost_usd DESC), '[]'::jsonb) INTO out
    FROM (
      SELECT feature,
             public.feature_label(feature)                              AS label,
             COUNT(*)::int                                              AS runs,
             COUNT(DISTINCT faculty_id)::int                            AS users,
             COALESCE(SUM(tokens_in), 0)::bigint                        AS tokens_in,
             COALESCE(SUM(tokens_out), 0)::bigint                       AS tokens_out,
             COALESCE(SUM(cache_read_tokens), 0)::bigint                AS cache_read,
             COALESCE(SUM(cache_write_tokens), 0)::bigint               AS cache_write,
             ROUND(COALESCE(SUM(cost_usd), 0)::numeric, 4)              AS cost_usd,
             COALESCE(SUM(credits), 0)::int                             AS credits,
             ROUND((COALESCE(SUM(credits), 0) * 0.02)::numeric, 4)      AS charged_usd,
             ROUND(AVG(credits)::numeric, 2)                            AS avg_credits,
             ROUND(AVG(cost_usd)::numeric, 5)                           AS avg_cost_usd,
             (SELECT cost FROM ai_credit_costs c WHERE c.feature = u.feature) AS listed_credits
        FROM usage_logs u
       WHERE created_at >= since
       GROUP BY feature
    ) t;

  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_ai_by_user(p_days int DEFAULT 30, p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.cost_usd DESC NULLS LAST), '[]'::jsonb) INTO out
    FROM (
      SELECT f.id                                                       AS faculty_id,
             au.email,
             COALESCE(
               NULLIF(BTRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''),
               split_part(au.email, '@', 1))                            AS name,
             COALESCE(s.tier, 'trial')                                  AS tier,
             COALESCE(s.status, 'trialing')                             AS status,
             s.trial_ends_at,
             s.current_period_end,
             COALESCE(pt.price_usd, 0)                                  AS plan_usd,
             c.balance,
             c.monthly_allowance,
             COALESCE(l.tokens_in, 0)                                   AS tokens_in,
             COALESCE(l.tokens_out, 0)                                  AS tokens_out,
             COALESCE(l.cache_read, 0)                                  AS cache_read,
             COALESCE(l.cache_write, 0)                                 AS cache_write,
             COALESCE(l.cost_usd, 0)                                    AS cost_usd,
             COALESCE(l.credits, 0)                                     AS credits,
             COALESCE(l.runs, 0)                                        AS runs,
             l.last_used_at,
             ROUND((COALESCE(pt.price_usd, 0) - COALESCE(l.cost_usd, 0))::numeric, 4) AS net_usd
        FROM faculty f
        JOIN auth.users au        ON au.id = f.user_id
        LEFT JOIN public.users pu ON pu.id = f.user_id
        LEFT JOIN subscriptions s ON s.faculty_id = f.id
        LEFT JOIN plan_tiers pt   ON pt.tier = COALESCE(s.tier, 'trial')
        LEFT JOIN credits c       ON c.faculty_id = f.id
        LEFT JOIN (
          SELECT faculty_id,
                 SUM(tokens_in)::bigint                     AS tokens_in,
                 SUM(tokens_out)::bigint                    AS tokens_out,
                 SUM(cache_read_tokens)::bigint             AS cache_read,
                 SUM(cache_write_tokens)::bigint            AS cache_write,
                 ROUND(SUM(cost_usd)::numeric, 4)           AS cost_usd,
                 SUM(credits)::int                          AS credits,
                 COUNT(*)::int                              AS runs,
                 MAX(created_at)                            AS last_used_at
            FROM usage_logs
           WHERE created_at >= since AND faculty_id IS NOT NULL
           GROUP BY faculty_id
        ) l ON l.faculty_id = f.id
       ORDER BY COALESCE(l.cost_usd, 0) DESC
       LIMIT GREATEST(COALESCE(p_limit, 100), 1)
    ) t;

  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_ai_user(p_faculty uuid, p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT jsonb_build_object(
    'faculty_id', f.id,
    'email', au.email,
    'name', COALESCE(
              NULLIF(BTRIM(COALESCE(pu.first_name, '') || ' ' || COALESCE(pu.last_name, '')), ''),
              split_part(au.email, '@', 1)),
    'tier', COALESCE(s.tier, 'trial'),
    'status', COALESCE(s.status, 'trialing'),
    'plan_usd', COALESCE(pt.price_usd, 0),
    'balance', c.balance,
    'allowance', c.monthly_allowance,
    'renews_at', c.next_refresh_at,
    'trial_ends_at', s.trial_ends_at,
    'by_feature', COALESCE((
      SELECT jsonb_agg(row_to_json(x) ORDER BY x.cost_usd DESC)
        FROM (
          SELECT feature,
                 public.feature_label(feature)                    AS label,
                 COUNT(*)::int                                    AS runs,
                 SUM(tokens_in + tokens_out
                     + cache_read_tokens + cache_write_tokens)::bigint AS tokens,
                 ROUND(SUM(cost_usd)::numeric, 4)                 AS cost_usd,
                 SUM(credits)::int                                AS credits
            FROM usage_logs
           WHERE faculty_id = f.id AND created_at >= since
           GROUP BY feature
        ) x), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.at DESC)
        FROM (
          SELECT created_at AS at, operation,
                 public.feature_label(feature) AS label, model,
                 public.usage_era(credits, cost_usd) AS era,
                 tokens_in, tokens_out, cache_read_tokens AS cache_read,
                 cache_write_tokens AS cache_write,
                 ROUND(cost_usd::numeric, 5) AS cost_usd, credits
            FROM usage_logs
           WHERE faculty_id = f.id
           ORDER BY created_at DESC LIMIT 30
        ) r), '[]'::jsonb)
  ) INTO out
    FROM faculty f
    JOIN auth.users au        ON au.id = f.user_id
    LEFT JOIN public.users pu ON pu.id = f.user_id
    LEFT JOIN subscriptions s ON s.faculty_id = f.id
    LEFT JOIN plan_tiers pt   ON pt.tier = COALESCE(s.tier, 'trial')
    LEFT JOIN credits c       ON c.faculty_id = f.id
   WHERE f.id = p_faculty;

  IF out IS NULL THEN RAISE EXCEPTION 'no such account' USING ERRCODE = '22023'; END IF;
  RETURN out;
END $$;

CREATE OR REPLACE FUNCTION public.sa_ai_daily(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(d) ORDER BY d.day), '[]'::jsonb) INTO out
    FROM (
      SELECT created_at::date                                  AS day,
             SUM(tokens_in + tokens_out
                 + cache_read_tokens + cache_write_tokens)::bigint AS tokens,
             ROUND(SUM(cost_usd)::numeric, 4)                  AS cost_usd,
             SUM(credits)::int                                 AS credits,
             COUNT(*)::int                                     AS runs,
             COUNT(DISTINCT faculty_id)::int                   AS users
        FROM usage_logs
       WHERE created_at >= since
       GROUP BY 1
    ) d;

  RETURN out;
END $$;

GRANT EXECUTE ON FUNCTION public.sa_ai_overview(int)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_by_feature(int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_by_user(int, int)    TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_user(uuid, int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_ai_daily(int)           TO authenticated;

DO $$
DECLARE probe uuid; n int; fn text;
BEGIN
  -- Exactly one signature each, or PostgREST picks and we get whichever.
  FOREACH fn IN ARRAY ARRAY['sa_ai_overview','sa_ai_by_feature','sa_ai_by_user',
                            'sa_ai_user','sa_ai_daily'] LOOP
    SELECT COUNT(*) INTO n FROM pg_proc p
      JOIN pg_namespace ns ON ns.oid = p.pronamespace
     WHERE ns.nspname = 'public' AND p.proname = fn;
    IF n <> 1 THEN
      RAISE EXCEPTION '% has % signatures; a stale one would win', fn, n;
    END IF;
  END LOOP;

  SELECT id INTO probe FROM faculty LIMIT 1;
  IF probe IS NOT NULL THEN
    PERFORM public.sa_ai_overview(30);
    PERFORM public.sa_ai_by_feature(30);
    PERFORM public.sa_ai_by_user(30, 5);
    PERFORM public.sa_ai_user(probe, 30);
    PERFORM public.sa_ai_daily(30);
  END IF;
  RAISE NOTICE 'usage: every row counts again';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §73  When a plan ends, the credits end with it
--
-- Four things were missing, and together they meant a subscription that
-- lapsed cost the teacher nothing and us everything:
--
--   1  a trial that ran out kept its unused credits. refresh_credits_if_due
--      stopped REFILLING on lapse but never removed what was already
--      there — "the month passes either way; the credits do not". A trial
--      that ended with 40 of 40 unspent kept all 40, for ever.
--   2  nothing downgraded a lapsed account. It stayed on its tier with its
--      allowance intact, waiting for a payment that never had to come.
--   3  expiry only happened when the teacher opened the app, because
--      refresh_credits_if_due is called from the client. An account nobody
--      logged into never expired at all.
--   4  and the AI routes never checked any of it — see assertBalance() in
--      the backend, which reads `balance` and nothing else. Data writes
--      were gated by subscription_active() through RLS, but generation
--      runs on the pooler, which bypasses RLS. So a dead trial with credit
--      left could keep generating until the balance ran dry.
--
-- ANNUAL IS A BILLING PERIOD, NOT A CREDIT PERIOD. An annual subscriber
-- is charged once a year and still receives their monthly allowance every
-- month — which is what the pricing page already advertises ("2 months
-- free" beside "350 credits a month"). So the refresh cadence stays
-- monthly for everyone; what the plan decides is when the SUBSCRIPTION
-- lapses, not when the credits land.
--
-- On lapse an account becomes a `free` tier: it keeps everything it has
-- made, its classes and its students, and can generate nothing new. That
-- is the "normal account without credits".
-- ─────────────────────────────────────────────────────────────────────────

INSERT INTO public.plan_tiers (tier, label, credits, price_usd, sort)
VALUES ('free', 'No plan', 0, 0.00, 9)
ON CONFLICT (tier) DO UPDATE
  SET label = EXCLUDED.label, credits = EXCLUDED.credits, price_usd = EXCLUDED.price_usd;

/**
 * Is this account's subscription live? Asked ABOUT an account rather
 * than about the caller.
 *
 * subscription_active() reads auth.uid() and so can only ever answer for
 * whoever is signed in — no use to a sweep that has to look at every
 * account. Same rules, including the privileged-role bypass and the
 * three-day grace that keeps a card retry from locking a teacher out
 * mid-lesson.
 */
CREATE OR REPLACE FUNCTION public.subscription_active_for(p_faculty uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM faculty f JOIN users u ON u.id = f.user_id
       WHERE f.id = p_faculty
         AND u.role IN ('dev', 'super_admin', 'admin', 'owner', 'moe')
    )
    OR EXISTS (
      SELECT 1 FROM subscriptions s
       WHERE s.faculty_id = p_faculty
         AND s.status IN ('trialing', 'active', 'past_due')
         AND (
           COALESCE(s.current_period_end, s.trial_ends_at) IS NULL
           OR COALESCE(s.current_period_end, s.trial_ends_at) > now() - INTERVAL '3 days'
         )
    );
$$;

/**
 * Take the plan away, and the credits with it.
 *
 * Idempotent — an account already on `free` with a zero balance is left
 * alone, so the sweep can run as often as it likes. Returns true only
 * when it actually changed something, which is what makes the sweep's
 * count meaningful.
 *
 * The allowance goes to zero as well as the balance. Leaving the
 * allowance would mean the next refresh boundary silently handed back a
 * full month of credits to an account that never paid.
 */
CREATE OR REPLACE FUNCTION public.expire_subscription(p_faculty uuid)
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE changed boolean := false;
BEGIN
  UPDATE subscriptions
     SET status = 'expired', tier = 'free', updated_at = now()
   WHERE faculty_id = p_faculty
     AND (status <> 'expired' OR tier <> 'free');
  IF FOUND THEN changed := true; END IF;

  UPDATE credits
     SET balance = 0, monthly_allowance = 0, next_refresh_at = NULL, updated_at = now()
   WHERE faculty_id = p_faculty
     AND (balance <> 0 OR monthly_allowance <> 0 OR next_refresh_at IS NOT NULL);
  IF FOUND THEN changed := true; END IF;

  RETURN changed;
END $$;

/**
 * The refresh, rewritten to end plans as well as renew them.
 *
 * Called by the client on load. Three outcomes:
 *
 *   lapsed          the plan is over. Credits and allowance go to zero and
 *                   the tier drops to `free`. This is the case that did
 *                   not exist before.
 *   due and live    the boundary has passed on a paying account: balance
 *                   goes back to the monthly allowance.
 *   live, not due   nothing happens except, on a first run, anchoring the
 *                   next boundary to the plan's own start day.
 *
 * The cadence is monthly whatever the billing period, because annual is
 * a billing period and not a credit period.
 */
CREATE OR REPLACE FUNCTION public.refresh_credits_if_due()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  fid uuid; v_balance int; v_allow int; v_next timestamptz;
  anchor timestamptz; did boolean := false; paid boolean; ended boolean := false;
BEGIN
  fid := current_faculty_id();
  IF fid IS NULL THEN RETURN NULL; END IF;
  SELECT balance, monthly_allowance, next_refresh_at INTO v_balance, v_allow, v_next
    FROM credits WHERE faculty_id = fid;
  IF NOT FOUND THEN RETURN NULL; END IF;

  paid := public.subscription_active_for(fid);

  IF NOT paid THEN
    -- The plan is over. Unused credits are not a possession that
    -- outlives it: a trial that ended with all 40 untouched keeps none.
    PERFORM public.expire_subscription(fid);
    RETURN jsonb_build_object(
      'balance', 0, 'allowance', 0, 'next_refresh_at', NULL,
      'refreshed', false, 'subscription_active', false, 'expired', true
    );
  END IF;

  IF v_next IS NULL THEN
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
    did := true;
    v_next := anchor;
  END IF;

  RETURN jsonb_build_object(
    'balance', v_balance, 'allowance', v_allow,
    'next_refresh_at', v_next, 'refreshed', did,
    'subscription_active', true, 'expired', ended
  );
END $$;

/**
 * The sweep, for every account at once.
 *
 * Expiry cannot depend on the teacher opening the app — that is how an
 * account nobody logged into kept its credits indefinitely. Run this on
 * a schedule (Supabase cron, or the backend on a timer); it is
 * idempotent and only touches accounts that have actually lapsed.
 */
CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  r record; n int := 0; credits_cleared int := 0; c int;
BEGIN
  FOR r IN
    SELECT s.faculty_id
      FROM subscriptions s
     WHERE NOT public.subscription_active_for(s.faculty_id)
       AND (s.status <> 'expired' OR s.tier <> 'free')
  LOOP
    SELECT COALESCE(balance, 0) INTO c FROM credits WHERE faculty_id = r.faculty_id;
    IF public.expire_subscription(r.faculty_id) THEN
      n := n + 1;
      credits_cleared := credits_cleared + COALESCE(c, 0);
    END IF;
  END LOOP;

  RETURN jsonb_build_object('expired', n, 'credits_cleared', credits_cleared);
END $$;

/** Super-admin trigger for the same sweep, so it can be run by hand. */
CREATE OR REPLACE FUNCTION public.sa_expire_lapsed()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.billing');
  out := public.expire_lapsed_subscriptions();
  PERFORM public.sa_write_audit('superadmin.subscriptions.expire_sweep', 'subscriptions', NULL, out);
  RETURN out;
END $$;

/**
 * Starting a plan sets the period end from the BILLING period.
 *
 * monthly → +1 month, quarterly → +3, annual → +12. The credit refresh
 * stays monthly regardless; this only decides when the subscription
 * itself lapses.
 */
CREATE OR REPLACE FUNCTION public.plan_period(p_plan text)
RETURNS interval
LANGUAGE sql IMMUTABLE SET search_path = public, pg_temp
AS $$
  SELECT CASE lower(COALESCE(p_plan, 'monthly'))
           WHEN 'annual'    THEN INTERVAL '1 year'
           WHEN 'quarterly' THEN INTERVAL '3 months'
           WHEN 'trial'     THEN INTERVAL '7 days'
           ELSE                  INTERVAL '1 month'
         END;
$$;

GRANT EXECUTE ON FUNCTION public.subscription_active_for(uuid)     TO authenticated;
GRANT EXECUTE ON FUNCTION public.plan_period(text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_expire_lapsed()                TO authenticated;
-- expire_subscription / expire_lapsed_subscriptions are deliberately NOT
-- granted: they are called from definer functions and a sweep, never by a
-- browser.
REVOKE EXECUTE ON FUNCTION public.expire_subscription(uuid)        FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_lapsed_subscriptions()    FROM public, authenticated;

DO $$
DECLARE probe uuid; before_balance int; after_balance int; after_tier text;
BEGIN
  -- Prove the lapse path on a real lapsed account rather than trusting it.
  SELECT s.faculty_id INTO probe
    FROM subscriptions s
   WHERE NOT public.subscription_active_for(s.faculty_id)
   LIMIT 1;

  IF probe IS NULL THEN
    RAISE NOTICE 'billing: no lapsed account to verify against';
  ELSE
    SELECT balance INTO before_balance FROM credits WHERE faculty_id = probe;
    PERFORM public.expire_subscription(probe);
    SELECT c.balance, s.tier INTO after_balance, after_tier
      FROM credits c JOIN subscriptions s ON s.faculty_id = c.faculty_id
     WHERE c.faculty_id = probe;
    IF after_balance <> 0 OR after_tier <> 'free' THEN
      RAISE EXCEPTION 'billing: lapse left balance=% tier=%', after_balance, after_tier;
    END IF;
    RAISE NOTICE 'billing: lapsed account cleared (% credits removed)', before_balance;
  END IF;
END $$;

-- §73b  my_credits() reports whether the plan is live
--
-- "You are out of credits" and "your plan has ended" need different
-- words and different buttons — topping up does not fix the second —
-- and the client could not tell them apart from `balance` alone.
CREATE OR REPLACE FUNCTION public.my_credits()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE fid uuid; uid uuid; out jsonb;
BEGIN
  fid := current_faculty_id();
  IF fid IS NULL THEN RETURN NULL; END IF;
  uid := (SELECT auth.uid());

  SELECT jsonb_build_object(
    'balance',   COALESCE(c.balance, 0),
    'allowance', COALESCE(c.monthly_allowance, 0),
    'renews_at', c.next_refresh_at,
    'plan',      s.plan,
    'tier',      s.tier,
    'status',    s.status,
    'subscription_active', public.subscription_active_for(fid),
    'ends_at',   COALESCE(s.current_period_end, s.trial_ends_at),
    'costs', (
      SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb) FROM ai_credit_costs
    ),
    'recent', (
      SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT operation, credits, tokens_in, tokens_out, cost_usd, created_at
            FROM usage_logs
           WHERE user_id = uid AND credits > 0
           ORDER BY created_at DESC LIMIT 20
        ) r
    )
  ) INTO out
  FROM credits c
  LEFT JOIN subscriptions s ON s.faculty_id = c.faculty_id
  WHERE c.faculty_id = fid;

  RETURN out;
END $$;

DO $$
BEGIN
  RAISE NOTICE 'billing: a plan that ends takes its credits with it';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §74  The grace period is for payments, not for trials
--
-- Both active-plan checks allowed three days past the end date. On a
-- paid plan that is right: a card retry should not lock a teacher out
-- mid-lesson, and `past_due` exists precisely for that window.
--
-- On a TRIAL there is no payment to retry, so the grace is simply three
-- free days nobody agreed to — a 7-day trial that runs 10. §73's own
-- test caught it: a trial expired yesterday still reported live.
--
-- Grace now applies only where a payment could be in flight.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.subscription_active_for(p_faculty uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM faculty f JOIN users u ON u.id = f.user_id
       WHERE f.id = p_faculty
         AND u.role IN ('dev', 'super_admin', 'admin', 'owner', 'moe')
    )
    OR EXISTS (
      SELECT 1 FROM subscriptions s
       WHERE s.faculty_id = p_faculty
         AND s.status IN ('trialing', 'active', 'past_due')
         AND (
           COALESCE(s.current_period_end, s.trial_ends_at) IS NULL
           OR COALESCE(s.current_period_end, s.trial_ends_at) >
              CASE WHEN s.status = 'trialing'
                   THEN now()                        -- a trial ends when it ends
                   ELSE now() - INTERVAL '3 days'    -- a card gets three days to clear
              END
         )
    );
$$;

CREATE OR REPLACE FUNCTION public.subscription_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
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
           OR COALESCE(s.current_period_end, s.trial_ends_at) >
              CASE WHEN s.status = 'trialing'
                   THEN now()
                   ELSE now() - INTERVAL '3 days'
              END
         )
    );
$$;

DO $$
DECLARE fid uuid; live boolean;
BEGIN
  SELECT s.faculty_id INTO fid FROM subscriptions s
    JOIN faculty f ON f.id = s.faculty_id
    JOIN users u ON u.id = f.user_id
   WHERE u.role NOT IN ('dev','super_admin','admin','owner','moe') LIMIT 1;
  IF fid IS NULL THEN RAISE NOTICE 'billing: no ordinary teacher to verify grace against'; RETURN; END IF;

  -- A trial that ended yesterday must read dead, not alive.
  CREATE TEMP TABLE _g AS SELECT status, trial_ends_at, current_period_end
    FROM subscriptions WHERE faculty_id = fid;
  UPDATE subscriptions SET status='trialing', trial_ends_at = now() - INTERVAL '1 day',
         current_period_end = NULL WHERE faculty_id = fid;
  live := public.subscription_active_for(fid);
  UPDATE subscriptions s SET status=g.status, trial_ends_at=g.trial_ends_at,
         current_period_end=g.current_period_end FROM _g g WHERE s.faculty_id = fid;
  DROP TABLE _g;

  IF live THEN RAISE EXCEPTION 'billing: a trial that ended yesterday still reads live'; END IF;
  RAISE NOTICE 'billing: a trial ends when it ends; grace is for cards only';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §75  Expiry stops waiting for someone to log in
--
-- §73 gave us expire_lapsed_subscriptions(), but nothing called it on a
-- schedule, so expiry still happened the moment a teacher opened the app.
-- An account nobody signed into kept its plan and its credits on paper
-- indefinitely — which is exactly the account most likely to have
-- stopped paying.
--
-- pg_cron runs it hourly. Hourly rather than daily because the drift is
-- the window in which a lapsed account still looks live to any report
-- reading `credits`; an hour is small enough not to matter and the sweep
-- only touches rows that have actually lapsed.
--
-- The sweep is rewritten set-based. The loop version called
-- subscription_active_for() twice per subscription per run, which is
-- fine for five accounts and silly for five thousand.
-- ─────────────────────────────────────────────────────────────────────────

CREATE EXTENSION IF NOT EXISTS pg_cron;

CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  WITH lapsed AS (
    SELECT s.faculty_id
      FROM subscriptions s
     WHERE (s.status <> 'expired' OR s.tier <> 'free')
       AND NOT public.subscription_active_for(s.faculty_id)
  ),
  -- Counted from the same snapshot as the updates below, so this reads
  -- the balances as they were BEFORE they were zeroed.
  before AS (
    SELECT COALESCE(SUM(c.balance), 0)::int AS credits
      FROM credits c JOIN lapsed l ON l.faculty_id = c.faculty_id
  ),
  subs AS (
    UPDATE subscriptions s
       SET status = 'expired', tier = 'free', updated_at = now()
      FROM lapsed l WHERE s.faculty_id = l.faculty_id
    RETURNING 1
  ),
  creds AS (
    UPDATE credits c
       SET balance = 0, monthly_allowance = 0, next_refresh_at = NULL, updated_at = now()
      FROM lapsed l WHERE c.faculty_id = l.faculty_id
    RETURNING 1
  )
  SELECT jsonb_build_object(
           'expired', (SELECT COUNT(*) FROM subs),
           'credits_cleared', (SELECT credits FROM before),
           'at', now()
         ) INTO out;

  RETURN out;
END $$;

REVOKE EXECUTE ON FUNCTION public.expire_lapsed_subscriptions() FROM public, authenticated;

/**
 * Re-register the schedule idempotently.
 *
 * cron.schedule() on an existing job name updates it rather than adding
 * a second, but unscheduling first makes a changed cadence unambiguous
 * and keeps this file safe to re-run.
 */
DO $$
BEGIN
  PERFORM cron.unschedule('expire-lapsed-subscriptions')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'expire-lapsed-subscriptions');

  PERFORM cron.schedule(
    'expire-lapsed-subscriptions',
    '7 * * * *',                       -- hourly, off the top of the hour
    $cron$SELECT public.expire_lapsed_subscriptions();$cron$
  );
END $$;

DO $$
DECLARE n int; sched text;
BEGIN
  SELECT COUNT(*), MAX(schedule) INTO n, sched
    FROM cron.job WHERE jobname = 'expire-lapsed-subscriptions';
  IF n <> 1 THEN
    RAISE EXCEPTION 'billing: expected one expiry job, found %', n;
  END IF;
  -- Prove it runs, rather than trusting that it is registered.
  PERFORM public.expire_lapsed_subscriptions();
  RAISE NOTICE 'billing: expiry sweep scheduled (%) and runs', sched;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §76  The views were reading past RLS — every teacher could see every
--      other teacher's work
--
-- Eight views sit over `ai_studio`, `faculty` and `faculty_schools`, and
-- all eight ran as their OWNER rather than as the caller. That is the
-- PostgreSQL 15+ default: a view without `security_invoker` executes with
-- the owner's rights, and the owner here is the table owner, for whom RLS
-- does not apply. The content views compound it by filtering on `type`
-- alone, with no `faculty_id` predicate at all:
--
--     FROM ai_studio WHERE type = 'lesson_plan' AND deleted_at IS NULL
--
-- Measured in production, signed in as ONE teacher:
--
--     drafts        11 rows, 11 belonging to other teachers
--     quizzes        7 rows,  7 belonging to other teachers
--     homework       9 rows,  9 belonging to other teachers
--     presentations  4 rows,  4 belonging to other teachers
--     activities     3 rows,  3 belonging to other teachers
--     accounts       every account on the platform
--
-- The same query against the base table returned 0. So RLS was never
-- broken — the views simply went around it. This is the whole security
-- argument of the direct-to-Supabase architecture, undone by a default.
--
-- `security_invoker = true` makes each view execute as the querying user,
-- so the existing policies apply: ai_studio_read, faculty_own and
-- faculty_schools_read all already restrict to the caller's own rows.
-- Nothing about the policies needs to change; they were correct and
-- unreachable.
--
-- The sa_* consoles are unaffected: they are SECURITY DEFINER, so inside
-- them the effective user is still the owner and the views behave as they
-- did. Only the browser's own reads change, which is the point.
-- ─────────────────────────────────────────────────────────────────────────

ALTER VIEW public.drafts          SET (security_invoker = true);
ALTER VIEW public.quizzes         SET (security_invoker = true);
ALTER VIEW public.homework        SET (security_invoker = true);
ALTER VIEW public.presentations   SET (security_invoker = true);
ALTER VIEW public.activities      SET (security_invoker = true);
ALTER VIEW public.templates       SET (security_invoker = true);
ALTER VIEW public.accounts        SET (security_invoker = true);
ALTER VIEW public.account_schools SET (security_invoker = true);

DO $$
DECLARE leaky text;
BEGIN
  SELECT string_agg(c.relname, ', ') INTO leaky
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE n.nspname = 'public' AND c.relkind = 'v'
     AND NOT EXISTS (
       SELECT 1 FROM unnest(coalesce(c.reloptions, '{}')) o
        WHERE o = 'security_invoker=true');
  IF leaky IS NOT NULL THEN
    RAISE EXCEPTION 'views still running as owner: %', leaky;
  END IF;
  RAISE NOTICE 'security: every view now runs as the caller';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §77  The pricing page was selling "No plan" for $0
--
-- §73 added a `free` tier as the state a LAPSED account falls into — no
-- credits, no allowance, keeps everything it made. It is a state, not a
-- product. But plan_options() selected every tier except `trial`, so
-- `free` went straight onto the pricing page as a fourth card offering
-- "No plan · $0 · 0 credits a month", with a blank blurb because the
-- CASE has no arm for it.
--
-- Filtering `tier <> 'free'` beside `tier <> 'trial'` would fix today and
-- fail again the next time an internal tier is added — the page opts
-- everything IN by default and has to be told what to leave out.
--
-- So the table says what is for sale. A new tier is invisible to the
-- pricing page until someone deliberately marks it purchasable.
-- ─────────────────────────────────────────────────────────────────────────

ALTER TABLE public.plan_tiers
  ADD COLUMN IF NOT EXISTS purchasable boolean NOT NULL DEFAULT false;

UPDATE public.plan_tiers SET purchasable = (tier IN ('basic', 'pro', 'max'));

CREATE OR REPLACE FUNCTION public.plan_options()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE costs jsonb; plans jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb) INTO costs FROM ai_credit_costs;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.sort), '[]'::jsonb) INTO plans
  FROM (
    SELECT tier AS key, label AS name, credits,
           price_usd::numeric AS price,
           (price_usd * 10)::numeric AS annual,
           sort,
           CASE tier
             WHEN 'basic' THEN 'For one teacher, one timetable.'
             WHEN 'pro'   THEN 'A full timetable, planned a term at a time.'
             WHEN 'max'   THEN 'Several classes, or a head of department.'
           END AS blurb,
           tier = 'pro' AS popular
      FROM plan_tiers
     WHERE purchasable            -- `trial` is where you start, `free` is where you land
  ) t;

  RETURN jsonb_build_object(
    'usd_per_credit', 0.02,
    'costs', costs,
    'plans', plans,
    'trial', (SELECT jsonb_build_object('credits', credits) FROM plan_tiers WHERE tier = 'trial'),
    'topups', jsonb_build_array(
      jsonb_build_object('key','topup_100','credits',100,'price',5),
      jsonb_build_object('key','topup_300','credits',300,'price',14),
      jsonb_build_object('key','topup_600','credits',600,'price',26)
    )
  );
END $$;

DO $$
DECLARE keys text; n int;
BEGIN
  SELECT string_agg(p->>'key', ', ' ORDER BY p->>'key'), count(*)
    INTO keys, n
    FROM jsonb_array_elements(public.plan_options()->'plans') p;
  IF n <> 3 OR keys <> 'basic, max, pro' THEN
    RAISE EXCEPTION 'pricing page offers % (%), expected exactly basic, max, pro', n, keys;
  END IF;
  RAISE NOTICE 'billing: the pricing page offers only what is for sale (%)', keys;
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §78  The trial belongs on the pricing page — as a card, not a footnote
--
-- §77 correctly stopped `free` being sold, and the trial went with it: the
-- page returned only what is purchasable, so the thing every visitor
-- actually starts on was reduced to a credits number in the small print.
--
-- The trial is not purchasable and must not be — `purchasable` still
-- decides what can be BOUGHT — but it is the first thing a teacher should
-- see. So it is returned as a full card of its own, marked `is_trial`, and
-- carrying the one fact that governs it: seven days.
--
-- Monthly only. An annual view offering a 7-day trial beside three yearly
-- prices is answering a question nobody asked, and the page hides it there.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.plan_options()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE costs jsonb; plans jsonb; trial_card jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb) INTO costs FROM ai_credit_costs;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.sort), '[]'::jsonb) INTO plans
  FROM (
    SELECT tier AS key, label AS name, credits,
           price_usd::numeric AS price,
           (price_usd * 10)::numeric AS annual,
           sort,
           CASE tier
             WHEN 'basic' THEN 'For one teacher, one timetable.'
             WHEN 'pro'   THEN 'A full timetable, planned a term at a time.'
             WHEN 'max'   THEN 'Several classes, or a head of department.'
           END AS blurb,
           tier = 'pro' AS popular
      FROM plan_tiers
     WHERE purchasable
  ) t;

  -- The card everyone starts on. Not purchasable, so it is built here
  -- rather than coming through the `purchasable` filter.
  SELECT jsonb_build_object(
           'key', tier, 'name', label, 'credits', credits,
           'price', 0, 'annual', 0, 'sort', -1,
           'blurb', 'Try the whole thing. No card, nothing charged.',
           'popular', false,
           'is_trial', true,
           'trial_days', 7
         ) INTO trial_card
    FROM plan_tiers WHERE tier = 'trial';

  RETURN jsonb_build_object(
    'usd_per_credit', 0.02,
    'costs', costs,
    'plans', plans,
    'trial', trial_card,
    'topups', jsonb_build_array(
      jsonb_build_object('key','topup_100','credits',100,'price',5),
      jsonb_build_object('key','topup_300','credits',300,'price',14),
      jsonb_build_object('key','topup_600','credits',600,'price',26)
    )
  );
END $$;

DO $$
DECLARE o jsonb;
BEGIN
  o := public.plan_options();
  IF jsonb_array_length(o->'plans') <> 3 THEN
    RAISE EXCEPTION 'expected 3 purchasable plans, got %', jsonb_array_length(o->'plans');
  END IF;
  IF (o->'trial'->>'is_trial') IS DISTINCT FROM 'true'
     OR (o->'trial'->>'trial_days') IS DISTINCT FROM '7'
     OR (o->'trial'->>'credits') IS NULL THEN
    RAISE EXCEPTION 'trial card incomplete: %', o->'trial';
  END IF;
  RAISE NOTICE 'billing: 3 plans for sale + a % credit, % day trial card',
    o->'trial'->>'credits', o->'trial'->>'trial_days';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §79  Taking money: what a plan costs, and what was actually paid
--
-- Until now `plan_requests` recorded that a teacher ASKED for a plan and a
-- human granted it by hand. This is the machinery for being paid.
--
-- Three ideas, kept apart on purpose:
--
--   plan_tiers    what a plan costs and what it grants. Prices are charged
--                 in AED (the market), while `price_usd` stays as the unit
--                 the credit economics are reasoned in — $0.02 a credit,
--                 and every cost figure in the AI dashboard. Deriving one
--                 from the other at read time would put an exchange rate
--                 inside the margin calculation.
--
--   payments      one row per attempt, not per success. A checkout that is
--                 abandoned or declined is a fact worth having: "we tried
--                 to charge and could not" is the row that explains a
--                 teacher's angry email.
--
--   subscriptions unchanged in shape — it already carries
--                 stripe_customer_id and stripe_subscription_id. What it
--                 gains is which billing period was bought and whether a
--                 cancellation is pending.
--
-- Nothing here talks to Stripe. The service does that; this only records
-- what Stripe reported, so a webhook replayed twice cannot double-grant.
-- ─────────────────────────────────────────────────────────────────────────

/* ── what a plan costs ─────────────────────────────────────────────────── */

ALTER TABLE public.plan_tiers
  ADD COLUMN IF NOT EXISTS price_aed        numeric(10,2),
  ADD COLUMN IF NOT EXISTS annual_aed       numeric(10,2),
  ADD COLUMN IF NOT EXISTS stripe_price_monthly text,
  ADD COLUMN IF NOT EXISTS stripe_price_annual  text;

/**
 * AED at the pegged rate (3.6725), rounded to a price a person would
 * quote. Written down rather than computed so a rate move cannot silently
 * change what a teacher is charged, and annual is ten months for twelve —
 * the same "2 months free" the page already advertises.
 */
UPDATE public.plan_tiers SET
  price_aed  = CASE tier WHEN 'basic' THEN 45 WHEN 'pro' THEN 129 WHEN 'max' THEN 295 ELSE 0 END,
  annual_aed = CASE tier WHEN 'basic' THEN 450 WHEN 'pro' THEN 1290 WHEN 'max' THEN 2950 ELSE 0 END
WHERE price_aed IS NULL OR annual_aed IS NULL;

/* ── what was actually paid ────────────────────────────────────────────── */

CREATE TABLE IF NOT EXISTS public.payments (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  faculty_id             uuid NOT NULL REFERENCES public.faculty(id) ON DELETE CASCADE,
  /**
   * What was bought. `tier` is null for a top-up: it buys credits, not a
   * plan, and writing a tier there would make a top-up look like a
   * subscription in every report.
   */
  kind                   text NOT NULL CHECK (kind IN ('subscription', 'topup')),
  tier                   text REFERENCES public.plan_tiers(tier),
  billing_period         text CHECK (billing_period IN ('monthly', 'annual')),
  credits_granted        integer NOT NULL DEFAULT 0,
  /** Minor units, as Stripe counts them: 4500 fils = AED 45.00. */
  amount_minor           integer NOT NULL DEFAULT 0,
  currency               text NOT NULL DEFAULT 'aed',
  status                 text NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending','paid','failed','refunded','canceled')),
  /**
   * Stripe's own ids. `checkout_session_id` is unique so a webhook
   * delivered twice — which Stripe does, deliberately — updates the row
   * it already wrote instead of granting a second month of credits.
   */
  checkout_session_id    text UNIQUE,
  payment_intent_id      text,
  subscription_id        text,
  invoice_id             text,
  /** What Stripe said, verbatim, for the argument nobody expects to have. */
  raw                    jsonb,
  created_at             timestamptz NOT NULL DEFAULT now(),
  paid_at                timestamptz,
  updated_at             timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS payments_faculty_idx ON public.payments (faculty_id, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_status_idx  ON public.payments (status, created_at DESC);
CREATE INDEX IF NOT EXISTS payments_invoice_idx ON public.payments (invoice_id)
  WHERE invoice_id IS NOT NULL;

DROP TRIGGER IF EXISTS set_updated_at ON public.payments;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

/**
 * A teacher may READ her own receipts and nothing else.
 *
 * No insert, update or delete policy exists, and that is deliberate: the
 * only writer is the service, on a webhook Stripe signed. A browser that
 * could write here could buy itself a plan.
 */
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS payments_owner_read ON public.payments;
CREATE POLICY payments_owner_read ON public.payments
  FOR SELECT TO authenticated
  USING (faculty_id = public.current_faculty_id());

/* ── what the subscription knows about its own billing ─────────────────── */

ALTER TABLE public.subscriptions
  ADD COLUMN IF NOT EXISTS billing_period       text
    CHECK (billing_period IN ('monthly', 'annual')),
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  RAISE NOTICE 'billing: payments table, AED prices and Stripe columns in place';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §80  Granting what was paid for, and showing what was spent
--
-- One writer and two readers.
--
-- The writer, apply_payment(), is the only thing that turns money into
-- credits. It is idempotent on the Stripe session id because Stripe
-- delivers a webhook more than once by design — at-least-once, not
-- exactly-once — and a second delivery must not grant a second month.
--
-- The readers are deliberately different. A teacher sees her own
-- receipts. A super admin sees what every account has paid, because
-- "which teachers are actually worth money" is the question the console
-- exists to answer.
-- ─────────────────────────────────────────────────────────────────────────

/**
 * Money in, credits out.
 *
 * Called by the service from a Stripe webhook, never from a browser —
 * there is no grant policy on `payments` and no execute grant here.
 *
 * The balance is SET to the allowance rather than added to. Buying Pro
 * makes the balance 350, whatever it was: adding would let someone stack
 * a trial's 40 on top of every plan they buy, and stack again on each
 * switch. It also matches how the monthly refresh already behaves, so a
 * plan bought today and refreshed next month land on the same number.
 */
CREATE OR REPLACE FUNCTION public.apply_payment(p_payment uuid)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  pay   public.payments%ROWTYPE;
  allow int;
  ends  timestamptz;
BEGIN
  SELECT * INTO pay FROM payments WHERE id = p_payment FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'no such payment' USING ERRCODE = '22023'; END IF;

  -- Already granted. Say so plainly rather than granting again.
  IF pay.status = 'paid' AND pay.paid_at IS NOT NULL AND pay.credits_granted > 0 THEN
    RETURN jsonb_build_object('already_applied', true, 'payment', pay.id);
  END IF;

  IF pay.kind = 'subscription' THEN
    SELECT credits INTO allow FROM plan_tiers WHERE tier = pay.tier;
    IF allow IS NULL THEN RAISE EXCEPTION 'unknown tier %', pay.tier USING ERRCODE='22023'; END IF;

    ends := now() + public.plan_period(
              CASE WHEN pay.billing_period = 'annual' THEN 'annual' ELSE 'monthly' END);

    UPDATE subscriptions
       SET tier = pay.tier,
           plan = COALESCE(pay.billing_period, 'monthly'),
           status = 'active',
           billing_period = COALESCE(pay.billing_period, 'monthly'),
           cancel_at_period_end = false,
           current_period_start = now(),
           current_period_end = ends,
           trial_ends_at = NULL,
           stripe_subscription_id = COALESCE(pay.subscription_id, stripe_subscription_id),
           updated_at = now()
     WHERE faculty_id = pay.faculty_id;

    -- An account that never had a subscription row still gets its plan.
    IF NOT FOUND THEN
      INSERT INTO subscriptions (faculty_id, plan, tier, status, billing_period,
                                 current_period_start, current_period_end,
                                 stripe_subscription_id)
      VALUES (pay.faculty_id, COALESCE(pay.billing_period,'monthly'), pay.tier, 'active',
              COALESCE(pay.billing_period,'monthly'), now(), ends, pay.subscription_id);
    END IF;

    /**
     * The allowance follows the tier, and the balance is set to it.
     * next_refresh_at is a month out whatever the billing period —
     * annual is a billing period, not a credit period (§73).
     */
    UPDATE credits
       SET balance = allow, monthly_allowance = allow,
           next_refresh_at = now() + INTERVAL '1 month', updated_at = now()
     WHERE faculty_id = pay.faculty_id;
    IF NOT FOUND THEN
      INSERT INTO credits (faculty_id, balance, monthly_allowance, next_refresh_at)
      VALUES (pay.faculty_id, allow, allow, now() + INTERVAL '1 month');
    END IF;

  ELSE
    /**
     * A top-up ADDS. It is not a plan — it is credits bought outright on
     * top of whatever the plan already granted, so setting the balance
     * here would destroy what she had and charge her for the privilege.
     */
    allow := pay.credits_granted;
    UPDATE credits SET balance = balance + allow, updated_at = now()
     WHERE faculty_id = pay.faculty_id;
  END IF;

  UPDATE payments
     SET status = 'paid', paid_at = COALESCE(paid_at, now()),
         credits_granted = COALESCE(NULLIF(credits_granted, 0), allow)
   WHERE id = pay.id;

  RETURN jsonb_build_object('applied', true, 'payment', pay.id,
                            'kind', pay.kind, 'credits', allow);
END $$;

REVOKE EXECUTE ON FUNCTION public.apply_payment(uuid) FROM public, authenticated;

/**
 * A teacher's own billing page: the plan, the money, the receipts.
 *
 * Spend is summed from `payments` rather than from the plan price, so a
 * refund and a failed attempt are both reflected without a second source
 * of truth.
 */
CREATE OR REPLACE FUNCTION public.my_billing()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE me uuid := public.current_faculty_id(); out jsonb;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not a teacher' USING ERRCODE = '42501'; END IF;

  SELECT jsonb_build_object(
    'plan', jsonb_build_object(
      'tier',        COALESCE(s.tier, 'trial'),
      'label',       COALESCE(pt.label, 'Free trial'),
      'status',      COALESCE(s.status, 'trialing'),
      'billing_period', s.billing_period,
      'price_aed',   CASE WHEN s.billing_period = 'annual' THEN pt.annual_aed ELSE pt.price_aed END,
      'started_at',  s.current_period_start,
      'renews_at',   COALESCE(s.current_period_end, s.trial_ends_at),
      'cancel_at_period_end', COALESCE(s.cancel_at_period_end, false),
      'live',        public.subscription_active_for(me)
    ),
    'credits', jsonb_build_object(
      'balance',   COALESCE(c.balance, 0),
      'allowance', COALESCE(c.monthly_allowance, 0),
      'refreshes_at', c.next_refresh_at
    ),
    -- What she has actually paid us, all time.
    'spend', (
      SELECT jsonb_build_object(
               'total_minor', COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid'), 0),
               'currency',    COALESCE(MAX(currency), 'aed'),
               'payments',    COUNT(*) FILTER (WHERE status = 'paid'))
        FROM payments WHERE faculty_id = me
    ),
    'receipts', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
        FROM (
          SELECT id, kind, tier, billing_period, credits_granted,
                 amount_minor, currency, status, created_at, paid_at
            FROM payments WHERE faculty_id = me
           ORDER BY created_at DESC LIMIT 50
        ) r), '[]'::jsonb)
  ) INTO out
  FROM (SELECT 1) _
  LEFT JOIN subscriptions s ON s.faculty_id = me
  LEFT JOIN plan_tiers pt   ON pt.tier = s.tier
  LEFT JOIN credits c       ON c.faculty_id = me;

  RETURN out;
END $$;

GRANT EXECUTE ON FUNCTION public.my_billing() TO authenticated;

DO $$
BEGIN
  RAISE NOTICE 'billing: apply_payment grants, my_billing reports';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §81  The revenue side of the console
--
-- The AI usage page answers "what did this cost us". This answers "what
-- did they pay us", and the two only mean something together: an account
-- burning $4 of tokens on a 45 AED plan is a different problem from the
-- same burn on a 295 AED plan.
--
-- Money is summed from `payments` and never from the plan price. A plan
-- price says what a teacher SHOULD be paying; only a payment row says
-- what actually arrived, and the gap between those two is exactly what a
-- billing console exists to show.
-- ─────────────────────────────────────────────────────────────────────────

/** Platform revenue at a glance. */
CREATE OR REPLACE FUNCTION public.sa_revenue_overview(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE since timestamptz := now() - (GREATEST(COALESCE(p_days,30),1) || ' days')::interval;
        out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT jsonb_build_object(
    'days', GREATEST(COALESCE(p_days,30),1),
    'currency', 'aed',
    'collected_minor', COALESCE(SUM(amount_minor) FILTER (WHERE status='paid'), 0),
    'refunded_minor',  COALESCE(SUM(amount_minor) FILTER (WHERE status='refunded'), 0),
    'payments',        COUNT(*) FILTER (WHERE status='paid'),
    'failed',          COUNT(*) FILTER (WHERE status IN ('failed','canceled')),
    'pending',         COUNT(*) FILTER (WHERE status='pending'),
    'paying_accounts', COUNT(DISTINCT faculty_id) FILTER (WHERE status='paid'),
    'subscriptions',   COUNT(*) FILTER (WHERE status='paid' AND kind='subscription'),
    'topups',          COUNT(*) FILTER (WHERE status='paid' AND kind='topup')
  ) INTO out
  FROM payments WHERE created_at >= since;

  -- Recurring value under contract right now, whatever was collected in
  -- the window. Annual is shown as its monthly equivalent so the two
  -- billing periods can be added together honestly.
  out := out || jsonb_build_object(
    'mrr_minor', (
      SELECT COALESCE(SUM(
        CASE WHEN s.billing_period = 'annual'
             THEN ROUND(pt.annual_aed * 100 / 12.0)
             ELSE ROUND(pt.price_aed * 100) END), 0)::bigint
        FROM subscriptions s JOIN plan_tiers pt ON pt.tier = s.tier
       WHERE s.status = 'active' AND pt.purchasable));

  RETURN out;
END $$;

/** Per account: the plan, what it costs them, what they have actually paid. */
CREATE OR REPLACE FUNCTION public.sa_revenue_by_user(p_limit int DEFAULT 100)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.paid_minor DESC, t.email), '[]'::jsonb)
    INTO out
  FROM (
    SELECT f.id AS faculty_id, au.email,
           COALESCE(
             NULLIF(BTRIM(COALESCE(pu.first_name,'') || ' ' || COALESCE(pu.last_name,'')), ''),
             split_part(au.email,'@',1))                              AS name,
           COALESCE(s.tier,'trial')                                   AS tier,
           COALESCE(s.status,'trialing')                              AS status,
           s.billing_period,
           COALESCE(s.cancel_at_period_end,false)                     AS cancelling,
           COALESCE(s.current_period_end, s.trial_ends_at)            AS renews_at,
           CASE WHEN s.billing_period='annual' THEN pt.annual_aed ELSE pt.price_aed END AS plan_aed,
           COALESCE(p.paid_minor,0)::bigint                           AS paid_minor,
           COALESCE(p.payments,0)                                     AS payments,
           p.last_paid_at,
           COALESCE(c.balance,0)                                      AS balance
      FROM faculty f
      JOIN auth.users au        ON au.id = f.user_id
      LEFT JOIN public.users pu ON pu.id = f.user_id
      LEFT JOIN subscriptions s ON s.faculty_id = f.id
      LEFT JOIN plan_tiers pt   ON pt.tier = s.tier
      LEFT JOIN credits c       ON c.faculty_id = f.id
      LEFT JOIN (
        SELECT faculty_id,
               SUM(amount_minor) FILTER (WHERE status='paid') AS paid_minor,
               COUNT(*) FILTER (WHERE status='paid')          AS payments,
               MAX(paid_at)                                   AS last_paid_at
          FROM payments GROUP BY faculty_id
      ) p ON p.faculty_id = f.id
     LIMIT GREATEST(COALESCE(p_limit,100),1)
  ) t;

  RETURN out;
END $$;

/** One account's receipts, for the drawer. */
CREATE OR REPLACE FUNCTION public.sa_payments_for(p_faculty uuid, p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');
  SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::jsonb) INTO out
  FROM (
    SELECT id, kind, tier, billing_period, credits_granted,
           amount_minor, currency, status, created_at, paid_at,
           checkout_session_id, invoice_id
      FROM payments WHERE faculty_id = p_faculty
     ORDER BY created_at DESC LIMIT GREATEST(COALESCE(p_limit,50),1)
  ) r;
  RETURN out;
END $$;

GRANT EXECUTE ON FUNCTION public.sa_revenue_overview(int)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_revenue_by_user(int)       TO authenticated;
GRANT EXECUTE ON FUNCTION public.sa_payments_for(uuid, int)    TO authenticated;

DO $$
DECLARE probe uuid;
BEGIN
  PERFORM public.sa_revenue_overview(30);
  PERFORM public.sa_revenue_by_user(5);
  SELECT id INTO probe FROM faculty LIMIT 1;
  IF probe IS NOT NULL THEN PERFORM public.sa_payments_for(probe, 5); END IF;
  RAISE NOTICE 'billing: revenue console reads run';
END $$;

-- ─────────────────────────────────────────────────────────────────────────
-- §82  A request she already made should still look made
--
-- While card payments are off, "Request Pro" writes a `plan_requests` row
-- and the card says so. That acknowledgement lived only in component
-- state: refreshing the page put a live button back, so a teacher who had
-- already asked was invited to ask again — and did, which is why
-- plan_requests holds the same plan several times over.
--
-- The page now reads what she has already asked for, so the card can
-- carry it across a reload. Only unfulfilled requests count: once a plan
-- is actually granted, the card should offer the NEXT thing rather than
-- claim a request is still outstanding.
-- ─────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.plan_options()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE costs jsonb; plans jsonb; trial_card jsonb; mine uuid;
BEGIN
  mine := public.current_faculty_id();

  SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb) INTO costs FROM ai_credit_costs;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.sort), '[]'::jsonb) INTO plans
  FROM (
    SELECT tier AS key, label AS name, credits,
           price_usd::numeric AS price,
           (price_usd * 10)::numeric AS annual,
           price_aed, annual_aed,
           sort,
           CASE tier
             WHEN 'basic' THEN 'For one teacher, one timetable.'
             WHEN 'pro'   THEN 'A full timetable, planned a term at a time.'
             WHEN 'max'   THEN 'Several classes, or a head of department.'
           END AS blurb,
           tier = 'pro' AS popular
      FROM plan_tiers
     WHERE purchasable
  ) t;

  SELECT jsonb_build_object(
           'key', tier, 'name', label, 'credits', credits,
           'price', 0, 'annual', 0, 'sort', -1,
           'blurb', 'Try the whole thing. No card, nothing charged.',
           'popular', false, 'is_trial', true, 'trial_days', 7
         ) INTO trial_card
    FROM plan_tiers WHERE tier = 'trial';

  RETURN jsonb_build_object(
    'usd_per_credit', 0.02,
    'costs', costs,
    'plans', plans,
    'trial', trial_card,
    -- What she has already asked for and not yet been given.
    'requested', COALESCE((
      SELECT jsonb_agg(DISTINCT plan)
        FROM plan_requests
       WHERE faculty_id = mine AND fulfilled_at IS NULL), '[]'::jsonb),
    'topups', jsonb_build_array(
      jsonb_build_object('key','topup_100','credits',100,'price',5),
      jsonb_build_object('key','topup_300','credits',300,'price',14),
      jsonb_build_object('key','topup_600','credits',600,'price',26)
    )
  );
END $$;

DO $$
BEGIN
  PERFORM public.plan_options();
  RAISE NOTICE 'billing: the pricing page remembers what was already requested';
END $$;


-- ---------------------------------------------------------------------
-- §83  `anon` was never revoked, and anon is the browser
--
-- §73, §75 and §80 each ended with
--
--     REVOKE EXECUTE ON FUNCTION … FROM public, authenticated;
--
-- which reads like it locks the door and does not. Supabase ships a
-- default privilege that grants EXECUTE on every new function in
-- `public` to `anon`, `authenticated` AND `service_role`, and `anon` is
-- not a member of `public` in the SQL sense — a role explicitly granted
-- keeps its grant when PUBLIC's is revoked. So all three functions were
-- left callable by `anon`, which is the role attached to the publishable
-- key that ships inside the browser bundle. Not a theoretical reader: a
-- key anyone can read from our own JavaScript.
--
-- What that allowed, with no session at all:
--
--   expire_lapsed_subscriptions()  clear credits across the platform
--   expire_subscription(uuid)      end one named teacher's plan
--   apply_payment(uuid)            grant credits for an unpaid payment
--
-- All three are SECURITY DEFINER and none consult current_faculty_id(),
-- because all three are meant to be called by the cron job and the
-- webhook — service_role — where there is no session to consult. That
-- is exactly why the grant matters: the gate was supposed to be the
-- privilege, and the privilege was not there.
--
-- refresh_credits_if_due() is deliberately left alone. It resolves
-- current_faculty_id() and returns NULL when there isn't one, so it is
-- self-scoped by construction and a teacher calling it can only refresh
-- herself.
-- ---------------------------------------------------------------------

REVOKE EXECUTE ON FUNCTION public.expire_subscription(uuid)        FROM anon;
REVOKE EXECUTE ON FUNCTION public.expire_lapsed_subscriptions()    FROM anon;
REVOKE EXECUTE ON FUNCTION public.apply_payment(uuid)              FROM anon;

-- And re-state the earlier revokes, so this section stands alone if the
-- ones above it are ever reordered.
REVOKE EXECUTE ON FUNCTION public.expire_subscription(uuid)        FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.expire_lapsed_subscriptions()    FROM public, authenticated;
REVOKE EXECUTE ON FUNCTION public.apply_payment(uuid)              FROM public, authenticated;

/**
 * Assert it, rather than trusting that the REVOKE above said what it
 * meant. `has_function_privilege` answers the real question — can this
 * role execute it — instead of the one the grant syntax answers.
 */
DO $$
DECLARE r record; leaked text[] := '{}';
BEGIN
  FOR r IN
    SELECT p.oid, p.proname, a.rolname
      FROM pg_proc p
      JOIN pg_namespace n ON n.oid = p.pronamespace
      CROSS JOIN (SELECT unnest(ARRAY['anon','authenticated']) AS rolname) a
     WHERE n.nspname = 'public'
       AND p.proname IN ('expire_subscription',
                         'expire_lapsed_subscriptions',
                         'apply_payment')
  LOOP
    IF has_function_privilege(r.rolname, r.oid, 'execute') THEN
      leaked := leaked || (r.proname || ' → ' || r.rolname);
    END IF;
  END LOOP;

  IF array_length(leaked, 1) > 0 THEN
    RAISE EXCEPTION 'service-only functions still reachable from the browser: %',
      array_to_string(leaked, ', ');
  END IF;

  -- The cron job and the Stripe webhook must still be able to work.
  IF NOT has_function_privilege('service_role',
        'public.expire_lapsed_subscriptions()', 'execute')
     OR NOT has_function_privilege('service_role',
        'public.apply_payment(uuid)', 'execute') THEN
    RAISE EXCEPTION 'revoked too far: service_role can no longer bill or expire';
  END IF;

  RAISE NOTICE 'billing: expiry and payment are service-only, and service_role still has them';
END $$;


-- ---------------------------------------------------------------------
-- §84  A checkout nobody finished is not a payment pending
--
-- Every press of a plan button inserts a `payments` row as `pending`
-- BEFORE the teacher leaves for Stripe, because that row's id is what
-- travels as client_reference_id and comes back on the webhook. Only
-- paying flips it to `paid`.
--
-- So every abandoned checkout — a closed tab, a second thought at the
-- card form, a teacher comparing two tiers — leaves a `pending` row that
-- nothing will ever resolve. They are honest to her (`my_billing()`
-- shows "Not finished" and leaves them out of the total) but the revenue
-- console counts them, and that count only ever grows.
--
-- One hour is the cut. Stripe sessions live 24h, but one unpaid after an
-- hour is not in flight, it is abandoned. If she does pay a stale
-- session later the webhook still finds the row by id and apply_payment()
-- still grants: `canceled` is a display state, not a lock, and the grant
-- path never consults it.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.expire_stale_checkouts()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE n int;
BEGIN
  UPDATE payments
     SET status = 'canceled', updated_at = now()
   WHERE status = 'pending'
     AND paid_at IS NULL
     AND created_at < now() - INTERVAL '1 hour';
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN jsonb_build_object('at', now(), 'abandoned', n);
END $$;

-- §83 is why this is spelled out: Supabase grants EXECUTE on every new
-- public function to `anon`, the role behind the key in the browser.
REVOKE EXECUTE ON FUNCTION public.expire_stale_checkouts() FROM anon, public, authenticated;

-- Hourly at :23, offset from the expiry sweep at :07 so the two are
-- never contending for the same rows.
DO $$
BEGIN
  PERFORM cron.unschedule('expire-stale-checkouts');
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

SELECT cron.schedule(
  'expire-stale-checkouts',
  '23 * * * *',
  $cron$SELECT public.expire_stale_checkouts();$cron$
);


-- ---------------------------------------------------------------------
-- §85  Abandoned is not failed, and the last of the request flow
--
-- 1. §84 moves a stale checkout to 'canceled' to clear it out of
--    `pending` — but the overview counted ('failed','canceled') together
--    as `failed`, so the number simply moved to a more alarming column.
--    "12 failed" would mean "12 people closed a tab", not twelve refused
--    cards: the same misreading §84 set out to remove. Own bucket.
--
-- 2. `plan_options()` still built a `requested` array on every load of
--    the pricing page, and nothing reads it since the request flow was
--    removed from the UI.
--
-- 3. `request_plan()` was still granted to `authenticated`. Removing the
--    caller is not removing the capability.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.sa_revenue_overview(p_days integer DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE since timestamptz := now() - (GREATEST(COALESCE(p_days,30),1) || ' days')::interval;
        out jsonb;
BEGIN
  PERFORM public.sa_gate('admin.dashboard');

  SELECT jsonb_build_object(
    'days', GREATEST(COALESCE(p_days,30),1),
    'currency', 'aed',
    'collected_minor', COALESCE(SUM(amount_minor) FILTER (WHERE status='paid'), 0),
    'refunded_minor',  COALESCE(SUM(amount_minor) FILTER (WHERE status='refunded'), 0),
    'payments',        COUNT(*) FILTER (WHERE status='paid'),
    -- A card the bank refused. Actionable.
    'failed',          COUNT(*) FILTER (WHERE status='failed'),
    -- A checkout nobody finished. Not a failure, and not actionable.
    'abandoned',       COUNT(*) FILTER (WHERE status='canceled'),
    'pending',         COUNT(*) FILTER (WHERE status='pending'),
    'paying_accounts', COUNT(DISTINCT faculty_id) FILTER (WHERE status='paid'),
    'subscriptions',   COUNT(*) FILTER (WHERE status='paid' AND kind='subscription'),
    'topups',          COUNT(*) FILTER (WHERE status='paid' AND kind='topup')
  ) INTO out
  FROM payments WHERE created_at >= since;

  out := out || jsonb_build_object(
    'mrr_minor', (
      SELECT COALESCE(SUM(
        CASE WHEN s.billing_period = 'annual'
             THEN ROUND(pt.annual_aed * 100 / 12.0)
             ELSE ROUND(pt.price_aed * 100) END), 0)::bigint
        FROM subscriptions s JOIN plan_tiers pt ON pt.tier = s.tier
       WHERE s.status = 'active' AND pt.purchasable));

  RETURN out;
END $$;

/** §82 minus `requested`. Everything else the page reads is unchanged. */
CREATE OR REPLACE FUNCTION public.plan_options()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE costs jsonb; plans jsonb; trial_card jsonb;
BEGIN
  SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb) INTO costs FROM ai_credit_costs;

  SELECT COALESCE(jsonb_agg(row_to_json(t) ORDER BY t.sort), '[]'::jsonb) INTO plans
  FROM (
    SELECT tier AS key, label AS name, credits,
           price_usd::numeric AS price,
           (price_usd * 10)::numeric AS annual,
           price_aed, annual_aed,
           sort,
           CASE tier
             WHEN 'basic' THEN 'For one teacher, one timetable.'
             WHEN 'pro'   THEN 'A full timetable, planned a term at a time.'
             WHEN 'max'   THEN 'Several classes, or a head of department.'
           END AS blurb,
           tier = 'pro' AS popular
      FROM plan_tiers
     WHERE purchasable
  ) t;

  SELECT jsonb_build_object(
           'key', tier, 'name', label, 'credits', credits,
           'price', 0, 'annual', 0, 'sort', -1,
           'blurb', 'Try the whole thing. No card, nothing charged.',
           'popular', false, 'is_trial', true, 'trial_days', 7
         ) INTO trial_card
    FROM plan_tiers WHERE tier = 'trial';

  -- `topups` stays: the page no longer renders it, but the shape is
  -- public and dropping a key is how a forgotten caller starts throwing.
  RETURN jsonb_build_object(
    'usd_per_credit', 0.02,
    'costs', costs,
    'plans', plans,
    'trial', trial_card,
    'topups', jsonb_build_array(
      jsonb_build_object('key','topup_100','credits',100,'price',5),
      jsonb_build_object('key','topup_300','credits',300,'price',14),
      jsonb_build_object('key','topup_600','credits',600,'price',26)
    )
  );
END $$;

-- Dead code is not the same as no capability.
REVOKE EXECUTE ON FUNCTION public.request_plan(text, int, text) FROM anon, public, authenticated;

DO $$
DECLARE n int;
BEGIN
  IF has_function_privilege('authenticated', 'public.request_plan(text,int,text)', 'execute')
     OR has_function_privilege('anon', 'public.request_plan(text,int,text)', 'execute') THEN
    RAISE EXCEPTION 'request_plan is still reachable from the browser';
  END IF;
  IF has_function_privilege('anon', 'public.expire_stale_checkouts()', 'execute')
     OR has_function_privilege('authenticated', 'public.expire_stale_checkouts()', 'execute') THEN
    RAISE EXCEPTION 'expire_stale_checkouts is reachable from the browser';
  END IF;
  SELECT COUNT(*) INTO n FROM cron.job WHERE jobname = 'expire-stale-checkouts';
  IF n <> 1 THEN RAISE EXCEPTION 'expire-stale-checkouts is not scheduled (found %)', n; END IF;
  IF NOT (public.sa_revenue_overview_shape_ok()) THEN NULL; END IF;
EXCEPTION WHEN undefined_function THEN
  RAISE NOTICE 'billing: abandoned split from failed, request_plan closed, sweep scheduled';
END $$;


-- ---------------------------------------------------------------------
-- §86  my_credits() lost its tier to this very file
--
-- §64 defines my_credits() returning `plan` (the billing cadence) and no
-- `tier`. A richer version — with `tier`, `subscription_active` and
-- `ends_at` — was applied to the live database directly and never came
-- back into this file, so the next `npm run db:tune` quietly replaced it
-- with §64's older shape.
--
-- That is the hazard of an out-of-band change to an append-only log: the
-- file is the source of truth, so anything not written here is reverted
-- the next time it runs, silently, and only surfaces when something
-- downstream reads a key that is no longer there.
--
-- What broke: the pricing page decides "your current plan" by comparing
-- `tier`. With the key gone the comparison was against undefined, so
-- EVERY card offered a buy button — including the one already paid for.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.my_credits()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE fid uuid; uid uuid; out jsonb;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN NULL; END IF;
  uid := (SELECT auth.uid());

  SELECT jsonb_build_object(
    'balance',   COALESCE(c.balance, 0),
    'allowance', COALESCE(c.monthly_allowance, 0),
    'renews_at', c.next_refresh_at,
    -- `plan` is the billing CADENCE ('monthly' | 'annual' | 'trial').
    -- `tier` is the PRODUCT ('basic' | 'pro' | 'max' | 'trial').
    -- Both are needed and they are not interchangeable.
    'plan',      s.plan,
    'tier',      s.tier,
    'status',    s.status,
    'subscription_active', public.subscription_active_for(fid),
    'ends_at',   COALESCE(s.current_period_end, s.trial_ends_at),
    'costs', (
      SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb)
        FROM ai_credit_costs
    ),
    'recent', (
      SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT operation, credits, tokens_in, tokens_out, cost_usd, created_at
            FROM usage_logs
           WHERE user_id = uid AND credits > 0
           ORDER BY created_at DESC
           LIMIT 20
        ) r
    )
  ) INTO out
  FROM credits c
  LEFT JOIN subscriptions s ON s.faculty_id = c.faculty_id
  WHERE c.faculty_id = fid;

  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.my_credits() TO authenticated;

/**
 * Assert the SHAPE, not just that it runs.
 *
 * §64 ran perfectly while returning the wrong keys — which is exactly
 * why nobody noticed. A missing key is a silent `undefined` in
 * JavaScript, so the check has to live here, where it can fail loudly.
 */
DO $$
DECLARE missing text[] := '{}'; k text; def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE proname = 'my_credits';
  FOREACH k IN ARRAY ARRAY['balance','allowance','renews_at','plan','tier',
                           'status','subscription_active','ends_at','costs','recent']
  LOOP
    IF position('''' || k || '''' IN def) = 0 THEN missing := missing || k; END IF;
  END LOOP;
  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'my_credits() is missing: %', array_to_string(missing, ', ');
  END IF;

  IF (public.sa_revenue_overview(30)) ? 'abandoned' IS NOT TRUE THEN
    RAISE EXCEPTION 'sa_revenue_overview() is missing the abandoned bucket';
  END IF;

  RAISE NOTICE 'billing: my_credits returns tier, revenue splits abandoned from failed';
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- §87  The public test: no plans, one grant of 800
-- ─────────────────────────────────────────────────────────────────────────
--
-- Murchid is opening to the public for testing, and a paywall in front of
-- an untested product buys nothing but a smaller sample. So the plans go
-- away: every teacher gets the same 800 credits, and the only thing that
-- can stop a generation is having spent them.
--
-- What is deliberately NOT changed:
--
--   * The credit costs. A lesson plan still costs 8, a quiz still costs 2.
--     The whole point of the test is to learn what real teachers actually
--     spend, and that number is worthless if the meter is re-tuned first.
--   * The metering itself — spend_credits(), the usage log, the per-feature
--     breakdown. The usage page stays; a teacher on a fixed grant needs to
--     see where it went more than one on a plan does.
--   * The subscriptions and payments tables, and every admin view over
--     them. Nothing is dropped. The rows keep being written.
--
-- The lever is one function, not thirty policies. Every write policy in
-- §37 ends in `AND subscription_active()`, and the backend's per-account
-- variant is subscription_active_for(). Making both answer `true` turns
-- plan gating off everywhere at once — including in expire_lapsed_
-- subscriptions(), whose `lapsed` CTE is now empty, and in
-- refresh_credits_if_due(), which stops taking credits away.
--
-- To bring plans back: revert this section forward with §86's definitions
-- of both functions (they are in this file, above), restore the nav
-- entries in src/config/nav.ts and the two redirecting page.tsx files.

CREATE OR REPLACE FUNCTION public.subscription_active_for(p_faculty uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  /* PUBLIC TEST PERIOD: there are no plans, so nothing can lapse. The
     argument is kept so every call site and grant stays valid. */
  SELECT p_faculty IS NOT NULL;
$$;

CREATE OR REPLACE FUNCTION public.subscription_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  /* PUBLIC TEST PERIOD: see subscription_active_for(). Still requires a
     session — an anonymous caller has no faculty and no business writing.
     Dropping that check would turn a billing switch into a security hole. */
  SELECT (SELECT auth.uid()) IS NOT NULL;
$$;

-- §83: Supabase grants EXECUTE on every new function to `anon` as well as
-- `authenticated`, and CREATE OR REPLACE re-runs that default. Both of
-- these are SECURITY DEFINER, so revoke again and assert it took.
-- FROM PUBLIC as well as anon. CREATE FUNCTION grants EXECUTE to PUBLIC
-- by default and anon inherits it through that group grant, so revoking
-- anon alone leaves the function reachable — the assertion below is what
-- catches it, and it caught it. (§83 got this right by revoking both.)
REVOKE EXECUTE ON FUNCTION public.subscription_active_for(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.subscription_active()         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.subscription_active_for(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.subscription_active()         TO authenticated;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.subscription_active_for(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.subscription_active()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute the subscription gate functions';
  END IF;
END $$;

-- ── the grant itself ──────────────────────────────────────────────────
--
-- 800 is not arbitrary: it is what the Max plan gave for AED 295, which
-- makes the test a real answer to "is this worth paying for" rather than
-- a taster.
--
-- It is written onto the EXISTING 'trial' tier rather than a new
-- 'public_test' one, and that is a deliberate choice against the tidier
-- name. `subscriptions.plan` carries a CHECK of ('trial','monthly',
-- 'quarterly','annual') and `subscriptions.tier` is a foreign key into
-- this table; a new value means editing a constraint, and every admin
-- view that joins `plan_tiers ON tier = COALESCE(s.tier, 'trial')` would
-- need to learn about it. Widening a constraint to rename something is a
-- lot of blast radius for a label. A public test period IS an extended
-- free trial — so the row keeps its key and gets the honest label.
--
-- The other three tiers are left exactly as they are. Nothing sells them
-- any more, but the payments already taken reference them, and the
-- revenue views join them.

UPDATE public.plan_tiers
   SET label = 'Public test', credits = 800
 WHERE tier = 'trial';

CREATE OR REPLACE FUNCTION public.provision_faculty()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE grant_credits integer;
BEGIN
  SELECT credits INTO grant_credits FROM plan_tiers WHERE tier = 'trial';

  INSERT INTO credits (faculty_id, balance, monthly_allowance)
  VALUES (NEW.id, COALESCE(grant_credits, 800), COALESCE(grant_credits, 800))
  ON CONFLICT (faculty_id) DO NOTHING;

  /* PUBLIC TEST PERIOD: 'active' with no end date, not 'trialing' with a
     seven-day clock. Gating is off either way, but leaving a countdown on
     the row is a landmine for whoever turns gating back on — it would
     expire every account that signed up during the test on the day it was
     restored. The row is still written: my_credits(), the admin console
     and the revenue views all join subscriptions, and a missing row reads
     as broken rather than as free. */
  INSERT INTO subscriptions (faculty_id, plan, tier, status, current_period_start)
  VALUES (NEW.id, 'trial', 'trial', 'active', now())
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Unchanged: never block a sign-up over the entitlement rows. A teacher
  -- with no credits row is recoverable; one who could not create an
  -- account at all is not.
  RAISE WARNING 'provision_faculty: %', SQLERRM;
  RETURN NEW;
END $function$;

-- ── everyone already here ─────────────────────────────────────────────
--
-- Existing accounts get the same grant. Written as a top-up, not an
-- assignment: allowance moves to 800 for everyone, but the balance is
-- only raised, never lowered. A teacher who bought Max and still holds
-- more than 800 keeps what she paid for — taking it back because the
-- shop closed would be theft, and she is exactly the person whose
-- goodwill the test needs.
--
-- Any lapsed row is reopened, because expire_lapsed_subscriptions()
-- already zeroed some of them and the grant is meant to be universal.

UPDATE public.credits c
   SET monthly_allowance = 800,
       balance = GREATEST(COALESCE(c.balance, 0), 800),
       updated_at = now()
 WHERE COALESCE(c.monthly_allowance, 0) <> 800
    OR COALESCE(c.balance, 0) < 800;

UPDATE public.subscriptions s
   SET status = 'active',
       tier = 'trial',
       current_period_start = COALESCE(s.current_period_start, now()),
       trial_ends_at = NULL,
       updated_at = now()
 WHERE s.status IN ('expired', 'canceled')
    OR s.tier = 'free';

-- Teachers with no rows at all (provisioning that failed, or an account
-- made before the trigger existed) get them now.
INSERT INTO public.credits (faculty_id, balance, monthly_allowance)
SELECT f.id, 800, 800 FROM public.faculty f
ON CONFLICT (faculty_id) DO NOTHING;

INSERT INTO public.subscriptions (faculty_id, plan, tier, status, current_period_start)
SELECT f.id, 'trial', 'trial', 'active', now()
  FROM public.faculty f
 WHERE NOT EXISTS (SELECT 1 FROM public.subscriptions s WHERE s.faculty_id = f.id);

-- ── prove it ──────────────────────────────────────────────────────────
--
-- §86 is the reason for asserting rather than trusting: this file is
-- append-only and re-run whole, so a later CREATE OR REPLACE above could
-- silently undo any of the above. A failure here is loud and blocks the
-- migration, which is the point.

DO $$
DECLARE short int; lapsed int;
BEGIN
  IF NOT public.subscription_active_for('00000000-0000-0000-0000-000000000001'::uuid) THEN
    RAISE EXCEPTION 'subscription_active_for() still gates on a plan';
  END IF;

  SELECT COUNT(*) INTO short FROM public.credits
   WHERE COALESCE(monthly_allowance, 0) <> 800 OR COALESCE(balance, 0) < 800;
  IF short > 0 THEN
    RAISE EXCEPTION '% account(s) did not get the 800-credit grant', short;
  END IF;

  SELECT COUNT(*) INTO lapsed FROM public.subscriptions
   WHERE status IN ('expired', 'canceled') OR tier = 'free';
  IF lapsed > 0 THEN
    RAISE EXCEPTION '% subscription(s) still lapsed after the public-test grant', lapsed;
  END IF;

  IF (SELECT credits FROM public.plan_tiers WHERE tier = 'trial') <> 800 THEN
    RAISE EXCEPTION 'the public-test grant is not 800';
  END IF;

  RAISE NOTICE 'public test: plan gating off, everyone on 800 credits';
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- §88  The public test is off; plans are back
-- ─────────────────────────────────────────────────────────────────────────
--
-- §87 is reverted. This file is append-only and re-run whole, so the way
-- to undo a section is to write the opposite one after it — deleting §87
-- would leave everything it already did to the live database standing,
-- with nothing left in the file to reverse it.
--
-- The two gate functions go back to the definitions §86 left them with,
-- word for word. Restoring them restores plan gating everywhere at once:
-- every write policy ends in AND subscription_active(), the backend calls
-- subscription_active_for() on the pooler, expire_lapsed_subscriptions()
-- gets its lapsed CTE back, and refresh_credits_if_due() resumes taking
-- credits away when a plan ends.

CREATE OR REPLACE FUNCTION public.subscription_active_for(p_faculty uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
    EXISTS (
      SELECT 1 FROM faculty f JOIN users u ON u.id = f.user_id
       WHERE f.id = p_faculty
         AND u.role IN ('dev', 'super_admin', 'admin', 'owner', 'moe')
    )
    OR EXISTS (
      SELECT 1 FROM subscriptions s
       WHERE s.faculty_id = p_faculty
         AND s.status IN ('trialing', 'active', 'past_due')
         AND (
           COALESCE(s.current_period_end, s.trial_ends_at) IS NULL
           OR COALESCE(s.current_period_end, s.trial_ends_at) >
              CASE WHEN s.status = 'trialing'
                   THEN now()                        -- a trial ends when it ends
                   ELSE now() - INTERVAL '3 days'    -- a card gets three days to clear
              END
         )
    );
$$;

CREATE OR REPLACE FUNCTION public.subscription_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT
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
           OR COALESCE(s.current_period_end, s.trial_ends_at) >
              CASE WHEN s.status = 'trialing'
                   THEN now()
                   ELSE now() - INTERVAL '3 days'
              END
         )
    );
$$;

-- §83 again: CREATE OR REPLACE re-runs Supabase's default grant to anon.
-- FROM PUBLIC as well as anon. CREATE FUNCTION grants EXECUTE to PUBLIC
-- by default and anon inherits it through that group grant, so revoking
-- anon alone leaves the function reachable — the assertion below is what
-- catches it, and it caught it. (§83 got this right by revoking both.)
REVOKE EXECUTE ON FUNCTION public.subscription_active_for(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.subscription_active()         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.subscription_active_for(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.subscription_active()         TO authenticated;

DO $$
BEGIN
  IF has_function_privilege('anon', 'public.subscription_active_for(uuid)', 'EXECUTE')
     OR has_function_privilege('anon', 'public.subscription_active()', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can still execute the subscription gate functions';
  END IF;
END $$;

-- ── the trial tier goes back to being a trial ─────────────────────────
--
-- §87 rewrote this row in place — 'Free trial'/40 became 'Public test'/800.
-- provision_faculty() reads it, so restoring the row is most of restoring
-- sign-up.

UPDATE public.plan_tiers
   SET label = 'Free trial', credits = 40
 WHERE tier = 'trial';

CREATE OR REPLACE FUNCTION public.provision_faculty()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE trial_credits integer;
BEGIN
  SELECT credits INTO trial_credits FROM plan_tiers WHERE tier = 'trial';

  INSERT INTO credits (faculty_id, balance, monthly_allowance)
  VALUES (NEW.id, COALESCE(trial_credits, 40), COALESCE(trial_credits, 40))
  ON CONFLICT (faculty_id) DO NOTHING;

  INSERT INTO subscriptions (faculty_id, plan, tier, status, trial_ends_at)
  VALUES (NEW.id, 'trial', 'trial', 'trialing', now() + INTERVAL '7 days')
  ON CONFLICT DO NOTHING;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a sign-up over the entitlement rows. A teacher with no
  -- credits row is recoverable; a teacher who could not create an
  -- account at all is not.
  RAISE WARNING 'provision_faculty: %', SQLERRM;
  RETURN NEW;
END $function$;

-- ── clearing up after the grant ───────────────────────────────────────
--
-- §87 did two things to live rows that restoring the functions does not
-- undo, and the second one is a hole rather than a leftover.
--
-- The hole: §87 set status='active' with BOTH current_period_end and
-- trial_ends_at NULL on every row it reopened, and provision_faculty()
-- wrote the same shape for everyone who signed up while it was live. Read
-- that through the restored subscription_active_for() above and the
-- COALESCE(...) IS NULL arm answers TRUE — forever. Left alone, every one
-- of those accounts has a subscription that can never lapse, which is the
-- paywall quietly not existing rather than the paywall being off.
--
-- So they go back on a trial clock. Scoped to rows that carry no Stripe
-- subscription: anyone who actually paid keeps their period end, and the
-- three paid tiers are not touched at all.
UPDATE public.subscriptions s
   SET status = 'trialing',
       plan = 'trial',
       trial_ends_at = COALESCE(s.current_period_start, now()) + INTERVAL '7 days',
       updated_at = now()
 WHERE s.tier = 'trial'
   AND s.status = 'active'
   AND s.current_period_end IS NULL
   AND s.trial_ends_at IS NULL
   AND s.stripe_subscription_id IS NULL;

-- The leftover: allowances. §87 set monthly_allowance = 800 for everyone,
-- which governs what refresh_credits_if_due() tops a teacher back up to.
-- Left at 800 a trial account would refill to twenty times its tier every
-- month. Each row goes back to what its own tier grants.
UPDATE public.credits c
   SET monthly_allowance = t.credits, updated_at = now()
  FROM public.subscriptions s
  JOIN public.plan_tiers t ON t.tier = s.tier
 WHERE s.faculty_id = c.faculty_id
   AND c.monthly_allowance IS DISTINCT FROM t.credits;

-- BALANCES ARE DELIBERATELY NOT TOUCHED.
--
-- §87 raised them to 800 and that credit is already in people's accounts;
-- taking it back is destructive, and this file is not the place to make
-- that call silently. It also fixes itself: refresh_credits_if_due() sets
-- balance = monthly_allowance at the next refresh, so an over-granted
-- account converges on its real tier within a month without anyone losing
-- work they were part-way through.
--
-- To claw them back now instead, run this by hand and watch the count:
--
--   UPDATE public.credits c SET balance = LEAST(c.balance, c.monthly_allowance)
--    WHERE c.balance > c.monthly_allowance;

DO $$
DECLARE loose int; over int;
BEGIN
  IF public.subscription_active_for('00000000-0000-0000-0000-000000000001'::uuid) THEN
    RAISE EXCEPTION 'subscription_active_for() still answers true for anyone';
  END IF;

  SELECT COUNT(*) INTO loose FROM public.subscriptions
   WHERE tier = 'trial' AND status = 'active'
     AND current_period_end IS NULL AND trial_ends_at IS NULL
     AND stripe_subscription_id IS NULL;
  IF loose > 0 THEN
    RAISE EXCEPTION '% trial subscription(s) still have no end date', loose;
  END IF;

  SELECT COUNT(*) INTO over FROM public.credits c
    JOIN public.subscriptions s ON s.faculty_id = c.faculty_id
    JOIN public.plan_tiers t ON t.tier = s.tier
   WHERE c.monthly_allowance IS DISTINCT FROM t.credits;
  IF over > 0 THEN
    RAISE EXCEPTION '% account(s) still on the public-test allowance', over;
  END IF;

  IF (SELECT credits FROM public.plan_tiers WHERE tier = 'trial') <> 40 THEN
    RAISE EXCEPTION 'the trial tier is not back to 40 credits';
  END IF;

  RAISE NOTICE 'public test reverted: plan gating on, tiers back to normal';
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- §89  Billing as a switch, not a deploy
-- ─────────────────────────────────────────────────────────────────────────
--
-- §87 turned billing off and §88 turned it back on, and both were code
-- changes that had to be written, reviewed, pushed and migrated. That is
-- the wrong shape for a decision the business will make more than once —
-- open the doors for a testing week, close them again, open them for a
-- school holiday. It should be a switch a super admin flips, and it should
-- take effect for everyone at once, immediately, with no deploy.
--
-- So: one flag, `billing_enabled`, and one function reading it. Everything
-- that used to be edited by hand now asks that function instead.
--
--   ON  (the default, and what is live today)
--        Plans, billing, tiered credits, trials that end, cards that
--        decline. Exactly the current behaviour.
--
--   OFF (the public test)
--        No plans, no billing, no subscription anywhere in a teacher's
--        panel. Everyone gets FREE_GRANT credits. Nothing can lapse.
--
-- Credit COSTS never change. A lesson plan costs 8 either way — the point
-- of a free period is to learn what teachers actually spend, and that
-- number is worthless if the meter is re-tuned at the same time.
--
-- Why one function rather than a flag check at each site: there are
-- roughly thirty RLS write policies ending in AND subscription_active(),
-- plus the pooler path, plus sign-up, plus the expiry cron. A flag read
-- scattered across all of those is a flag that will be missed in one of
-- them, and the one that is missed is the one that leaks. Routing every
-- caller through subscription_active()/subscription_active_for() means
-- there are exactly two places that read the flag for gating, and both
-- are in this section.

INSERT INTO public.feature_flags (key, enabled, description) VALUES
  ('billing_enabled', true,
   'Master switch for plans, billing and tiered credits. OFF = free public test: no subscription UI, everyone on the free grant, nothing lapses.')
ON CONFLICT (key) DO NOTHING;   -- never re-arm a switch someone deliberately threw

/**
 * The switch itself.
 *
 * STABLE, so Postgres evaluates it once per statement rather than once
 * per row — this ends up inside RLS policies on every write, and a
 * VOLATILE read of a three-row table on every row of a bulk insert is a
 * cost nobody would ever go looking for.
 *
 * SECURITY DEFINER because the callers are: RLS policies (running as the
 * teacher), the pooled backend connection (running as no one in
 * particular), and the sign-up trigger. Only one of those can read
 * feature_flags through RLS, and a gate that answers differently
 * depending on who asks is not a gate.
 *
 * Defaults to TRUE — billing ON — when the row is missing. A flag table
 * that failed to seed must not silently hand the whole product away.
 */
CREATE OR REPLACE FUNCTION public.billing_enabled()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT enabled FROM feature_flags WHERE key = 'billing_enabled'), true);
$$;

/**
 * What a teacher gets while billing is off.
 *
 * A function rather than a literal so there is exactly one place to
 * change it, and rather than a plan_tiers row because that table's key is
 * a foreign key from subscriptions.tier and its values are constrained —
 * §87 learned that the hard way. This number belongs to the free period,
 * not to the plan catalogue, and it should not have to pretend to be a
 * product to be stored.
 */
CREATE OR REPLACE FUNCTION public.free_grant_credits()
RETURNS integer
LANGUAGE sql IMMUTABLE
AS $$ SELECT 800 $$;

-- ── the two gates ─────────────────────────────────────────────────────
--
-- Both keep their §86 logic verbatim in the ELSE arm. The only change is
-- the CASE around it. Read the ELSE and you are reading the paid product
-- exactly as it behaves today.

CREATE OR REPLACE FUNCTION public.subscription_active_for(p_faculty uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN NOT public.billing_enabled()
    THEN p_faculty IS NOT NULL      -- nothing to lapse; still needs to be someone
    ELSE
      EXISTS (
        SELECT 1 FROM faculty f JOIN users u ON u.id = f.user_id
         WHERE f.id = p_faculty
           AND u.role IN ('dev', 'super_admin', 'admin', 'owner', 'moe')
      )
      OR EXISTS (
        SELECT 1 FROM subscriptions s
         WHERE s.faculty_id = p_faculty
           AND s.status IN ('trialing', 'active', 'past_due')
           AND (
             COALESCE(s.current_period_end, s.trial_ends_at) IS NULL
             OR COALESCE(s.current_period_end, s.trial_ends_at) >
                CASE WHEN s.status = 'trialing'
                     THEN now()                        -- a trial ends when it ends
                     ELSE now() - INTERVAL '3 days'    -- a card gets three days to clear
                END
           )
      )
  END;
$$;

CREATE OR REPLACE FUNCTION public.subscription_active()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN NOT public.billing_enabled()
    -- Still requires a session. Turning a billing switch into an
    -- anonymous write hole would be the easy mistake here: this function
    -- is the last clause of every write policy in §37, so `true` would
    -- mean anon can write to any table whose owner predicate it can
    -- satisfy. The flag decides whether she has PAID, never whether she
    -- is SOMEONE.
    THEN (SELECT auth.uid()) IS NOT NULL
    ELSE
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
             OR COALESCE(s.current_period_end, s.trial_ends_at) >
                CASE WHEN s.status = 'trialing'
                     THEN now()
                     ELSE now() - INTERVAL '3 days'
                END
           )
      )
  END;
$$;

-- BOTH revokes are needed, and each one alone is a hole.
--
-- CREATE FUNCTION grants EXECUTE to PUBLIC by default, and `anon` is a
-- member of PUBLIC, so revoking from anon alone leaves it reachable
-- through the group grant. Supabase then adds its OWN explicit grant to
-- anon, which revoking from PUBLIC does not touch. §83 learned the
-- second half; this is the first. The assertion below is what caught it.
REVOKE EXECUTE ON FUNCTION public.free_grant_credits()          FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.billing_enabled()             FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.subscription_active_for(uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.subscription_active()         FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.free_grant_credits()          TO authenticated;
GRANT  EXECUTE ON FUNCTION public.billing_enabled()             TO authenticated;
GRANT  EXECUTE ON FUNCTION public.subscription_active_for(uuid) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.subscription_active()         TO authenticated;

-- ── sign-up follows the switch ────────────────────────────────────────
--
-- While billing is off a new teacher gets the free grant and a
-- subscription row with no end date. That row would read as
-- never-lapsing if the switch were thrown back to ON with it untouched,
-- which is why sa_set_billing(true) below puts every such account onto a
-- fresh trial rather than leaving them be. The reconciliation belongs to
-- the transition, not to steady state.

CREATE OR REPLACE FUNCTION public.provision_faculty()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp
AS $function$
DECLARE start_credits integer; paid boolean;
BEGIN
  paid := public.billing_enabled();

  IF paid THEN
    SELECT credits INTO start_credits FROM plan_tiers WHERE tier = 'trial';
    start_credits := COALESCE(start_credits, 40);
  ELSE
    start_credits := public.free_grant_credits();
  END IF;

  INSERT INTO credits (faculty_id, balance, monthly_allowance)
  VALUES (NEW.id, start_credits, start_credits)
  ON CONFLICT (faculty_id) DO NOTHING;

  IF paid THEN
    INSERT INTO subscriptions (faculty_id, plan, tier, status, trial_ends_at)
    VALUES (NEW.id, 'trial', 'trial', 'trialing', now() + INTERVAL '7 days')
    ON CONFLICT DO NOTHING;
  ELSE
    INSERT INTO subscriptions (faculty_id, plan, tier, status, current_period_start)
    VALUES (NEW.id, 'trial', 'trial', 'active', now())
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  -- Never block a sign-up over the entitlement rows. A teacher with no
  -- credits row is recoverable; a teacher who could not create an
  -- account at all is not.
  RAISE WARNING 'provision_faculty: %', SQLERRM;
  RETURN NEW;
END $function$;

-- ── the cron stops sweeping ───────────────────────────────────────────
--
-- With the switch off, subscription_active_for() answers true for
-- everyone, so the `lapsed` CTE would be empty and this is already a
-- no-op. The explicit early return is here anyway: it says so out loud,
-- it saves a full scan of subscriptions every night, and it means a
-- future edit to the CTE cannot accidentally start zeroing balances
-- during a free period.

CREATE OR REPLACE FUNCTION public.expire_lapsed_subscriptions()
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE out jsonb;
BEGIN
  IF NOT public.billing_enabled() THEN
    RETURN jsonb_build_object('expired', 0, 'credits_cleared', 0,
                              'skipped', 'billing_disabled', 'at', now());
  END IF;

  WITH lapsed AS (
    SELECT s.faculty_id
      FROM subscriptions s
     WHERE (s.status <> 'expired' OR s.tier <> 'free')
       AND NOT public.subscription_active_for(s.faculty_id)
  ),
  before AS (
    SELECT COALESCE(SUM(c.balance), 0)::int AS credits
      FROM credits c JOIN lapsed l ON l.faculty_id = c.faculty_id
  ),
  subs AS (
    UPDATE subscriptions s
       SET status = 'expired', tier = 'free', updated_at = now()
      FROM lapsed l WHERE s.faculty_id = l.faculty_id
    RETURNING 1
  ),
  creds AS (
    UPDATE credits c
       SET balance = 0, monthly_allowance = 0, next_refresh_at = NULL, updated_at = now()
      FROM lapsed l WHERE c.faculty_id = l.faculty_id
    RETURNING 1
  )
  SELECT jsonb_build_object(
           'expired', (SELECT COUNT(*) FROM subs),
           'credits_cleared', (SELECT credits FROM before),
           'at', now()
         ) INTO out;

  RETURN out;
END $$;

REVOKE EXECUTE ON FUNCTION public.expire_lapsed_subscriptions() FROM PUBLIC, authenticated, anon;

-- ── throwing the switch ───────────────────────────────────────────────
--
-- Flipping the flag alone would leave the database in a state that is
-- consistent with neither mode, so the flip and the reconciliation are
-- one transaction. Either both happen or neither does.
--
-- What has to be reconciled, and why the flag alone is not enough:
--
--   monthly_allowance  drives what refresh_credits_if_due() tops a
--                      teacher back up to every month. Leave it at 800
--                      after switching billing back on and a trial
--                      account refills to twenty times its tier, for
--                      ever, silently.
--
--   subscription dates  while billing is off, sign-up writes rows with
--                      no end date. Read back through the paid gate,
--                      COALESCE(period_end, trial_ends_at) IS NULL
--                      answers TRUE — permanently. That is not the
--                      paywall being off, it is the paywall silently not
--                      existing, which is far worse because it looks
--                      like it is working.
--
-- BALANCES ARE NEVER LOWERED, in either direction. Credits already in an
-- account were given; taking them back is a decision for a human, not a
-- side effect of a toggle. It also self-corrects: refresh_credits_if_due()
-- sets balance = monthly_allowance at the next refresh, so an
-- over-granted account converges on its real tier within a month without
-- interrupting work someone is part-way through.

CREATE OR REPLACE FUNCTION public.sa_set_billing(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  was boolean; want boolean; grant_size integer;
  n_credits int := 0; n_subs int := 0;
BEGIN
  PERFORM public.sa_gate('admin.billing');

  want := COALESCE(p_enabled, true);
  was  := public.billing_enabled();
  grant_size := public.free_grant_credits();

  UPDATE feature_flags SET enabled = want, updated_at = now()
   WHERE key = 'billing_enabled';
  IF NOT FOUND THEN
    INSERT INTO feature_flags (key, enabled, description)
    VALUES ('billing_enabled', want, 'Master switch for plans, billing and tiered credits.');
  END IF;

  IF was IS NOT DISTINCT FROM want THEN
    -- Idempotent: flipping a switch to where it already is should not
    -- re-grant credits to everyone. Say so rather than pretending work
    -- was done.
    RETURN jsonb_build_object('enabled', want, 'changed', false,
                              'credits_updated', 0, 'subscriptions_updated', 0);
  END IF;

  IF NOT want THEN
    -- ── going FREE ────────────────────────────────────────────────────
    -- Everyone lands on the same grant. Raise-only: a teacher holding
    -- more than the grant because she paid for Max keeps what she paid
    -- for. Taking it away because the shop closed would be theft, and
    -- she is exactly the person whose goodwill a free period needs.
    UPDATE credits c
       SET monthly_allowance = grant_size,
           balance = GREATEST(COALESCE(c.balance, 0), grant_size),
           updated_at = now()
     WHERE COALESCE(c.monthly_allowance, 0) <> grant_size
        OR COALESCE(c.balance, 0) < grant_size;
    GET DIAGNOSTICS n_credits = ROW_COUNT;

    -- Every non-paying row goes to the same open state, not just the
    -- ones the cron had already closed.
    --
    -- Scoping this to expired/canceled rows was a bug with a long fuse. A
    -- teacher whose trial ran out BEFORE the free period kept
    -- status='trialing' with a date in the past — invisible while the
    -- switch was off, because nothing reads the date then. The moment
    -- billing came back she was locked out by a trial that had expired
    -- months earlier, having used the product happily the whole time.
    -- Normalising every non-Stripe row here is what lets the paid flip
    -- below hand out a fresh trial to exactly the same set.
    --
    -- Rows carrying a Stripe subscription are left alone: a live Max
    -- subscription should still read as Max when billing comes back.
    UPDATE subscriptions s
       SET status = 'active',
           tier = 'trial',
           plan = 'trial',
           current_period_start = COALESCE(s.current_period_start, now()),
           trial_ends_at = NULL,
           updated_at = now()
     WHERE s.stripe_subscription_id IS NULL
       AND (s.status IS DISTINCT FROM 'active'
            OR s.trial_ends_at IS NOT NULL
            OR s.tier IS DISTINCT FROM 'trial');
    GET DIAGNOSTICS n_subs = ROW_COUNT;

    -- Accounts that never got entitlement rows at all.
    INSERT INTO credits (faculty_id, balance, monthly_allowance)
    SELECT f.id, grant_size, grant_size FROM faculty f
    ON CONFLICT (faculty_id) DO NOTHING;

    INSERT INTO subscriptions (faculty_id, plan, tier, status, current_period_start)
    SELECT f.id, 'trial', 'trial', 'active', now() FROM faculty f
     WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.faculty_id = f.id);

  ELSE
    -- ── going PAID ────────────────────────────────────────────────────
    -- Every account back to what its own tier grants.
    UPDATE credits c
       SET monthly_allowance = t.credits, updated_at = now()
      FROM subscriptions s
      JOIN plan_tiers t ON t.tier = s.tier
     WHERE s.faculty_id = c.faculty_id
       AND c.monthly_allowance IS DISTINCT FROM t.credits;
    GET DIAGNOSTICS n_credits = ROW_COUNT;

    -- The open-ended rows the free period created get a FRESH trial,
    -- dated from the flip rather than from sign-up.
    --
    -- Dating it from sign-up would be defensible and is wrong in
    -- practice: a teacher who joined during a three-month free period
    -- would have her trial expire the instant the switch moved, having
    -- never been offered one. She gets the same seven days a new sign-up
    -- gets, starting now.
    --
    -- Scoped to rows carrying no Stripe subscription and no real period
    -- end, so nobody who actually paid is touched. This is deliberately
    -- the SAME set the free flip normalised above — the two directions
    -- have to agree on who they are talking about, or accounts fall
    -- between them and surface as a lockout much later.
    --
    -- Someone mid-trial when the switch was thrown gets a full seven days
    -- rather than her remaining three. Carrying the remainder across a
    -- mode change is more arithmetic than it is worth, and erring toward
    -- the teacher is the right direction to err in.
    UPDATE subscriptions s
       SET status = 'trialing',
           plan = 'trial',
           tier = 'trial',
           trial_ends_at = now() + INTERVAL '7 days',
           updated_at = now()
     WHERE s.current_period_end IS NULL
       AND s.stripe_subscription_id IS NULL;
    GET DIAGNOSTICS n_subs = ROW_COUNT;
  END IF;

  PERFORM public.sa_write_audit(
    'superadmin.billing.mode', 'feature_flags', NULL,
    jsonb_build_object('enabled', want, 'was', was, 'free_grant', grant_size,
                       'credits_updated', n_credits, 'subscriptions_updated', n_subs));

  RETURN jsonb_build_object('enabled', want, 'changed', true,
                            'credits_updated', n_credits,
                            'subscriptions_updated', n_subs,
                            'free_grant', grant_size);
END $$;

/**
 * What the console shows before anyone touches the switch.
 *
 * Returns the counts the confirmation needs, so the super admin is told
 * how many accounts a flip will rewrite BEFORE they flip it rather than
 * after. A toggle that silently rewrites every row in two tables should
 * at least say how many.
 */
CREATE OR REPLACE FUNCTION public.sa_billing_mode()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sa_gate('admin.billing');
  RETURN jsonb_build_object(
    'enabled',    public.billing_enabled(),
    'free_grant', public.free_grant_credits(),
    'accounts',   (SELECT COUNT(*) FROM faculty),
    'paying',     (SELECT COUNT(*) FROM subscriptions
                    WHERE stripe_subscription_id IS NOT NULL
                      AND status IN ('active', 'past_due')),
    'updated_at', (SELECT updated_at FROM feature_flags WHERE key = 'billing_enabled')
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.sa_set_billing(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sa_billing_mode()       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sa_set_billing(boolean) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.sa_billing_mode()       TO authenticated;

-- ── the browser learns which mode it is in ────────────────────────────
--
-- my_credits() is already fetched by the studio shell on load and again
-- on every spend, and it is already the source for the credit meter and
-- the usage page. Adding the flag here means the teacher UI reacts to a
-- flip with no new round trip, no new endpoint, and no poll — the next
-- generation she runs refreshes it.
--
-- Everything else in the payload is unchanged. `plan`, `tier`, `status`
-- and `ends_at` still come back while billing is off; they are simply
-- not rendered. Blanking them here would break the super admin's account
-- drawer, which reads the same shape.

CREATE OR REPLACE FUNCTION public.my_credits()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE fid uuid; uid uuid; out jsonb;
BEGIN
  fid := public.current_faculty_id();
  IF fid IS NULL THEN RETURN NULL; END IF;
  uid := (SELECT auth.uid());

  SELECT jsonb_build_object(
    'balance',   COALESCE(c.balance, 0),
    'allowance', COALESCE(c.monthly_allowance, 0),
    'renews_at', c.next_refresh_at,
    -- `plan` is the billing CADENCE ('monthly' | 'annual' | 'trial').
    -- `tier` is the PRODUCT ('basic' | 'pro' | 'max' | 'trial').
    -- Both are needed and they are not interchangeable.
    'plan',      s.plan,
    'tier',      s.tier,
    'status',    s.status,
    'subscription_active', public.subscription_active_for(fid),
    -- Whether this teacher should be shown plans and billing at all.
    'billing_enabled', public.billing_enabled(),
    'ends_at',   COALESCE(s.current_period_end, s.trial_ends_at),
    'costs', (
      SELECT COALESCE(jsonb_object_agg(feature, cost), '{}'::jsonb)
        FROM ai_credit_costs
    ),
    'recent', (
      SELECT COALESCE(jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC), '[]'::jsonb)
        FROM (
          SELECT operation, credits, tokens_in, tokens_out, cost_usd, created_at
            FROM usage_logs
           WHERE user_id = uid AND credits > 0
           ORDER BY created_at DESC
           LIMIT 20
        ) r
    )
  ) INTO out
  FROM credits c
  LEFT JOIN subscriptions s ON s.faculty_id = c.faculty_id
  WHERE c.faculty_id = fid;

  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.my_credits() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_credits() FROM PUBLIC, anon;

-- ── prove the whole switch ────────────────────────────────────────────
--
-- §86 is why this asserts rather than trusts: this file is append-only
-- and re-run whole, and a CREATE OR REPLACE further up silently won the
-- last time. Every claim the section makes is checked here, and a failure
-- blocks the migration rather than shipping a half-wired switch.

DO $$
DECLARE missing text[] := '{}'; k text; def text; started boolean;
BEGIN
  -- 1. The payload keeps every key it had, and gains the new one.
  SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE proname = 'my_credits';
  FOREACH k IN ARRAY ARRAY['balance','allowance','renews_at','plan','tier','status',
                           'subscription_active','billing_enabled','ends_at','costs','recent']
  LOOP
    IF position('''' || k || '''' IN def) = 0 THEN missing := missing || k; END IF;
  END LOOP;
  IF array_length(missing, 1) > 0 THEN
    RAISE EXCEPTION 'my_credits() is missing: %', array_to_string(missing, ', ');
  END IF;

  -- 2. The flag exists and the gates actually read it. Flipped inside a
  --    savepoint and rolled straight back, so this proves the wiring on
  --    the real functions without leaving the switch moved.
  started := public.billing_enabled();

  BEGIN
    UPDATE feature_flags SET enabled = false WHERE key = 'billing_enabled';
    IF public.billing_enabled() THEN
      RAISE EXCEPTION 'billing_enabled() does not read the flag';
    END IF;
    IF NOT public.subscription_active_for('00000000-0000-0000-0000-000000000001'::uuid) THEN
      RAISE EXCEPTION 'subscription_active_for() ignores the billing switch';
    END IF;
    IF (public.expire_lapsed_subscriptions()) ->> 'skipped' IS DISTINCT FROM 'billing_disabled' THEN
      RAISE EXCEPTION 'the expiry sweep still runs while billing is off';
    END IF;
    RAISE EXCEPTION 'rollback_probe';        -- unwind everything above
  EXCEPTION WHEN OTHERS THEN
    IF SQLERRM <> 'rollback_probe' THEN RAISE; END IF;
  END;

  -- 3. The switch is exactly where it was before the probe.
  IF public.billing_enabled() IS DISTINCT FROM started THEN
    RAISE EXCEPTION 'the probe left billing_enabled changed (now %)', public.billing_enabled();
  END IF;

  -- 4. Anonymous callers cannot reach any of it (§83).
  FOREACH k IN ARRAY ARRAY['public.billing_enabled()',
                           'public.free_grant_credits()',
                           'public.subscription_active()',
                           'public.subscription_active_for(uuid)',
                           'public.sa_set_billing(boolean)',
                           'public.sa_billing_mode()']
  LOOP
    IF has_function_privilege('anon', k, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can execute %', k;
    END IF;
  END LOOP;

  RAISE NOTICE 'billing switch wired: mode=%, free grant=% credits',
    CASE WHEN started THEN 'PAID' ELSE 'FREE' END, public.free_grant_credits();
END $$;

-- ── the usage page needs the mode too ─────────────────────────────────
--
-- CreditUsage reads my_ai_usage(), not my_credits(), so without this it
-- would keep offering "Top up or move to a bigger plan" during a free
-- period. Adding the key here rather than making the page fetch
-- my_credits() as well keeps it to one request — the page already has
-- everything else it needs.
--
-- Only the two lines marked below differ from the §68 definition.

CREATE OR REPLACE FUNCTION public.my_ai_usage(p_days int DEFAULT 30)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  me    uuid := public.current_faculty_id();
  since timestamptz := now() - (GREATEST(COALESCE(p_days, 30), 1) || ' days')::interval;
  out   jsonb;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not a teacher' USING ERRCODE = '42501'; END IF;

  SELECT jsonb_build_object(
    'days', GREATEST(COALESCE(p_days, 30), 1),
    'balance',   (SELECT balance           FROM credits WHERE faculty_id = me),
    'allowance', (SELECT monthly_allowance FROM credits WHERE faculty_id = me),
    'renews_at', (SELECT next_refresh_at   FROM credits WHERE faculty_id = me),
    'plan',      (SELECT tier              FROM subscriptions WHERE faculty_id = me),
    -- NEW: whether plans and billing exist right now (§89).
    'billing_enabled', public.billing_enabled(),
    -- Spent in the window, and spent since the allowance last refreshed.
    -- The second is the one that answers "why is my balance here".
    'spent', COALESCE((SELECT SUM(credits) FROM usage_logs
                        WHERE faculty_id = me AND created_at >= since), 0),
    'generations', COALESCE((SELECT COUNT(*) FROM usage_logs
                        WHERE faculty_id = me AND created_at >= since AND credits > 0), 0),
    'by_feature', COALESCE((
      SELECT jsonb_agg(row_to_json(t) ORDER BY t.credits DESC, t.feature)
        FROM (
          SELECT feature,
                 public.feature_label(feature) AS label,
                 SUM(credits)::int            AS credits,
                 COUNT(*)::int                AS runs
            FROM usage_logs
           WHERE faculty_id = me AND created_at >= since AND credits > 0
           GROUP BY feature
        ) t), '[]'::jsonb),
    'by_day', COALESCE((
      SELECT jsonb_agg(row_to_json(d) ORDER BY d.day)
        FROM (
          SELECT created_at::date AS day, SUM(credits)::int AS credits
            FROM usage_logs
           WHERE faculty_id = me AND created_at >= since AND credits > 0
           GROUP BY 1
        ) d), '[]'::jsonb),
    'recent', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.at DESC)
        FROM (
          SELECT created_at AS at,
                 public.feature_label(feature) AS label,
                 credits
            FROM usage_logs
           WHERE faculty_id = me AND credits > 0
           ORDER BY created_at DESC
           LIMIT 20
        ) r), '[]'::jsonb)
  ) INTO out;

  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.my_ai_usage(int) TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_ai_usage(int) FROM PUBLIC, anon;

DO $$
DECLARE def text;
BEGIN
  SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE proname = 'my_ai_usage';
  IF position('''billing_enabled''' IN def) = 0 THEN
    RAISE EXCEPTION 'my_ai_usage() lost billing_enabled';
  END IF;
  IF position('''by_feature''' IN def) = 0 OR position('''recent''' IN def) = 0 THEN
    RAISE EXCEPTION 'my_ai_usage() lost a key the usage page reads';
  END IF;
END $$;

-- ── and the billing page ──────────────────────────────────────────────
--
-- Same reason as my_ai_usage() above: Billing.jsx reads my_billing(), so
-- without the key it cannot tell a free period from a teacher who simply
-- has no receipts yet. Identical to the §80 definition apart from the one
-- marked line.

CREATE OR REPLACE FUNCTION public.my_billing()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE me uuid := public.current_faculty_id(); out jsonb;
BEGIN
  IF me IS NULL THEN RAISE EXCEPTION 'not a teacher' USING ERRCODE = '42501'; END IF;

  SELECT jsonb_build_object(
    -- NEW: whether plans and billing exist right now (§89).
    'billing_enabled', public.billing_enabled(),
    'plan', jsonb_build_object(
      'tier',        COALESCE(s.tier, 'trial'),
      'label',       COALESCE(pt.label, 'Free trial'),
      'status',      COALESCE(s.status, 'trialing'),
      'billing_period', s.billing_period,
      'price_aed',   CASE WHEN s.billing_period = 'annual' THEN pt.annual_aed ELSE pt.price_aed END,
      'started_at',  s.current_period_start,
      'renews_at',   COALESCE(s.current_period_end, s.trial_ends_at),
      'cancel_at_period_end', COALESCE(s.cancel_at_period_end, false),
      'live',        public.subscription_active_for(me)
    ),
    'credits', jsonb_build_object(
      'balance',   COALESCE(c.balance, 0),
      'allowance', COALESCE(c.monthly_allowance, 0),
      'refreshes_at', c.next_refresh_at
    ),
    -- What she has actually paid us, all time.
    'spend', (
      SELECT jsonb_build_object(
               'total_minor', COALESCE(SUM(amount_minor) FILTER (WHERE status = 'paid'), 0),
               'currency',    COALESCE(MAX(currency), 'aed'),
               'payments',    COUNT(*) FILTER (WHERE status = 'paid'))
        FROM payments WHERE faculty_id = me
    ),
    'receipts', COALESCE((
      SELECT jsonb_agg(row_to_json(r) ORDER BY r.created_at DESC)
        FROM (
          SELECT id, kind, tier, billing_period, credits_granted,
                 amount_minor, currency, status, created_at, paid_at
            FROM payments WHERE faculty_id = me
           ORDER BY created_at DESC LIMIT 50
        ) r), '[]'::jsonb)
  ) INTO out
  FROM (SELECT 1) _
  LEFT JOIN subscriptions s ON s.faculty_id = me
  LEFT JOIN plan_tiers pt   ON pt.tier = s.tier
  LEFT JOIN credits c       ON c.faculty_id = me;

  RETURN out;
END $$;
GRANT EXECUTE ON FUNCTION public.my_billing() TO authenticated;
REVOKE EXECUTE ON FUNCTION public.my_billing() FROM PUBLIC, anon;

DO $$
DECLARE def text; fn text; sig text;
BEGIN
  -- Checked here rather than beside my_credits() because that block runs
  -- before this section redefines the other two, and a privilege check on
  -- a function that does not exist yet fails for the wrong reason.
  FOREACH fn IN ARRAY ARRAY['my_credits','my_ai_usage','my_billing'] LOOP
    SELECT pg_get_functiondef(oid) INTO def FROM pg_proc WHERE proname = fn;
    IF position('''billing_enabled''' IN def) = 0 THEN
      RAISE EXCEPTION '%() does not tell the browser which billing mode it is in', fn;
    END IF;
  END LOOP;

  FOREACH sig IN ARRAY ARRAY['public.my_credits()', 'public.my_ai_usage(int)',
                             'public.my_billing()']
  LOOP
    IF has_function_privilege('anon', sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'anon can execute %', sig;
    END IF;
    IF NOT has_function_privilege('authenticated', sig, 'EXECUTE') THEN
      RAISE EXCEPTION 'authenticated LOST execute on % — teachers would see nothing', sig;
    END IF;
  END LOOP;

  RAISE NOTICE 'billing switch reaches all three teacher payloads';
END $$;


-- ─────────────────────────────────────────────────────────────────────────
-- §90  "Has this account paid?" belongs in one place
-- ─────────────────────────────────────────────────────────────────────────
--
-- §89's two flips each carried their own idea of who counts as a paying
-- account, spelled as `stripe_subscription_id IS NULL`. Live data says
-- that is wrong: the one paying account on this platform has NO
-- stripe_subscription_id and no stripe_customer_id. It was bought through
-- Checkout in payment mode, so apply_payment() recorded the entitlement
-- as `tier = 'max'` with a `current_period_end` and no subscription
-- object ever existed.
--
-- Under §89 that account would have been swept into the free grant,
-- rewritten to tier 'trial', and handed a 7-day trial with 40 credits
-- when billing came back — a real customer silently demoted to a trial
-- for having paid the wrong way. Caught by reading the confirmation
-- dialog against real rows: it said "all 5 accounts" and showed no
-- paying-account warning, on a platform with a live Max subscriber.
--
-- The fix is not a better WHERE clause. It is having ONE clause. Two
-- copies of a predicate that must agree is the bug; a function both
-- callers ask is the fix, and sa_billing_mode() now counts with the same
-- one, so the confirmation dialog cannot disagree with what the flip
-- actually does.

CREATE OR REPLACE FUNCTION public.has_paid_entitlement(p_faculty uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM subscriptions s
     WHERE s.faculty_id = p_faculty
       AND (
         -- Bought as a recurring subscription.
         s.stripe_subscription_id IS NOT NULL
         -- Or bought outright: a real period end is a paid entitlement
         -- whatever produced it. This is the arm §89 was missing.
         OR s.current_period_end IS NOT NULL
         -- Or sitting on a paid product for any other reason — granted by
         -- an admin, migrated in. A trial is the only unpaid tier.
         OR s.tier IN ('basic', 'pro', 'max')
       )
  );
$$;

REVOKE EXECUTE ON FUNCTION public.has_paid_entitlement(uuid) FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.has_paid_entitlement(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.sa_set_billing(p_enabled boolean)
RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
DECLARE
  was boolean; want boolean; grant_size integer;
  n_credits int := 0; n_subs int := 0;
BEGIN
  PERFORM public.sa_gate('admin.billing');

  want := COALESCE(p_enabled, true);
  was  := public.billing_enabled();
  grant_size := public.free_grant_credits();

  UPDATE feature_flags SET enabled = want, updated_at = now()
   WHERE key = 'billing_enabled';
  IF NOT FOUND THEN
    INSERT INTO feature_flags (key, enabled, description)
    VALUES ('billing_enabled', want, 'Master switch for plans, billing and tiered credits.');
  END IF;

  IF was IS NOT DISTINCT FROM want THEN
    RETURN jsonb_build_object('enabled', want, 'changed', false,
                              'credits_updated', 0, 'subscriptions_updated', 0);
  END IF;

  IF NOT want THEN
    -- ── going FREE ────────────────────────────────────────────────────
    -- Credits go to everyone, paying or not: during a free period nobody
    -- should have less than the grant. Raise-only, so a Max subscriber
    -- sitting above it keeps what she paid for.
    UPDATE credits c
       SET monthly_allowance = grant_size,
           balance = GREATEST(COALESCE(c.balance, 0), grant_size),
           updated_at = now()
     WHERE COALESCE(c.monthly_allowance, 0) <> grant_size
        OR COALESCE(c.balance, 0) < grant_size;
    GET DIAGNOSTICS n_credits = ROW_COUNT;

    -- Subscription ROWS are only rewritten for unpaid accounts. A paying
    -- account needs no rewriting: gating is off, so its dates are inert,
    -- and leaving them untouched is what lets it come back as itself.
    UPDATE subscriptions s
       SET status = 'active',
           tier = 'trial',
           plan = 'trial',
           current_period_start = COALESCE(s.current_period_start, now()),
           trial_ends_at = NULL,
           updated_at = now()
     WHERE NOT public.has_paid_entitlement(s.faculty_id)
       AND (s.status IS DISTINCT FROM 'active' OR s.trial_ends_at IS NOT NULL);
    GET DIAGNOSTICS n_subs = ROW_COUNT;

    INSERT INTO credits (faculty_id, balance, monthly_allowance)
    SELECT f.id, grant_size, grant_size FROM faculty f
    ON CONFLICT (faculty_id) DO NOTHING;

    INSERT INTO subscriptions (faculty_id, plan, tier, status, current_period_start)
    SELECT f.id, 'trial', 'trial', 'active', now() FROM faculty f
     WHERE NOT EXISTS (SELECT 1 FROM subscriptions s WHERE s.faculty_id = f.id);

  ELSE
    -- ── going PAID ────────────────────────────────────────────────────
    UPDATE credits c
       SET monthly_allowance = t.credits, updated_at = now()
      FROM subscriptions s
      JOIN plan_tiers t ON t.tier = s.tier
     WHERE s.faculty_id = c.faculty_id
       AND c.monthly_allowance IS DISTINCT FROM t.credits;
    GET DIAGNOSTICS n_credits = ROW_COUNT;

    -- Exactly the accounts the free flip rewrote — same predicate, one
    -- definition, so the two directions cannot disagree about who they
    -- are talking about. Everyone here gets a full fresh trial dated from
    -- the flip, not from sign-up: a teacher who joined during a
    -- three-month free period would otherwise have her trial expire the
    -- instant the switch moved, having never been offered one.
    UPDATE subscriptions s
       SET status = 'trialing',
           plan = 'trial',
           tier = 'trial',
           trial_ends_at = now() + INTERVAL '7 days',
           updated_at = now()
     WHERE NOT public.has_paid_entitlement(s.faculty_id);
    GET DIAGNOSTICS n_subs = ROW_COUNT;
  END IF;

  PERFORM public.sa_write_audit(
    'superadmin.billing.mode', 'feature_flags', NULL,
    jsonb_build_object('enabled', want, 'was', was, 'free_grant', grant_size,
                       'credits_updated', n_credits, 'subscriptions_updated', n_subs));

  RETURN jsonb_build_object('enabled', want, 'changed', true,
                            'credits_updated', n_credits,
                            'subscriptions_updated', n_subs,
                            'free_grant', grant_size);
END $$;

CREATE OR REPLACE FUNCTION public.sa_billing_mode()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.sa_gate('admin.billing');
  RETURN jsonb_build_object(
    'enabled',    public.billing_enabled(),
    'free_grant', public.free_grant_credits(),
    'accounts',   (SELECT COUNT(*) FROM faculty),
    -- Counted with the SAME predicate the flip uses. When these two
    -- disagreed, the dialog under-reported the blast radius on the only
    -- account that mattered.
    'paying',     (SELECT COUNT(*) FROM subscriptions s
                    WHERE public.has_paid_entitlement(s.faculty_id)),
    'updated_at', (SELECT updated_at FROM feature_flags WHERE key = 'billing_enabled')
  );
END $$;

REVOKE EXECUTE ON FUNCTION public.sa_set_billing(boolean) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.sa_billing_mode()       FROM PUBLIC, anon;
GRANT  EXECUTE ON FUNCTION public.sa_set_billing(boolean) TO authenticated;
GRANT  EXECUTE ON FUNCTION public.sa_billing_mode()       TO authenticated;

DO $$
DECLARE paid_rows int; unpaid_rows int;
BEGIN
  SELECT COUNT(*) INTO paid_rows   FROM subscriptions s
   WHERE public.has_paid_entitlement(s.faculty_id);
  SELECT COUNT(*) INTO unpaid_rows FROM subscriptions s
   WHERE NOT public.has_paid_entitlement(s.faculty_id);

  -- The specific regression: a tier that was bought outright, with no
  -- Stripe subscription object, must read as paid.
  IF EXISTS (SELECT 1 FROM subscriptions
              WHERE tier IN ('basic','pro','max')
                AND NOT public.has_paid_entitlement(faculty_id)) THEN
    RAISE EXCEPTION 'a paid tier is being treated as an unpaid account';
  END IF;

  IF has_function_privilege('anon', 'public.has_paid_entitlement(uuid)', 'EXECUTE') THEN
    RAISE EXCEPTION 'anon can execute has_paid_entitlement';
  END IF;

  RAISE NOTICE 'billing switch: % paid account(s) protected, % on the free grant',
    paid_rows, unpaid_rows;
END $$;
