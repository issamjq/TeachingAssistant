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
