-- Murchid v2 schema — applied directly to the live project
-- (beftrmuhplksbsfsfunc) via the Supabase MCP connector; this file is the
-- git-tracked record of that state, kept idempotent so `npm run db:tune`
-- can re-apply it safely. The v1 schema (users/faculty/library_* etc.)
-- was dropped entirely — see docs/00-concept.md for what replaced it.

-- ── profiles: one row per Supabase Auth user, auto-created on signup ──
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role text not null default 'teacher' check (role in ('teacher','sub_admin','super_admin','organisation')),
  status text not null default 'pending' check (status in ('pending','active','rejected')),
  name text,
  email text,
  institution text,
  staff_id text,
  syllabus text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "select own profile" on public.profiles;
create policy "select own profile" on public.profiles
  for select using (auth.uid() = id);

-- A policy on `profiles` cannot query `profiles` inline (via EXISTS) to
-- check the caller's own role — Postgres detects that as infinite
-- recursion (42P17) and 500s every request, admin or not. Route the
-- self-lookup through a SECURITY DEFINER function instead, which runs
-- outside the calling role's RLS context.
create or replace function public.is_admin()
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('super_admin','sub_admin')
  );
$$;
revoke all on function public.is_admin() from public, anon, authenticated;
grant execute on function public.is_admin() to authenticated;

-- The super-admin accounts console needs to see every teacher, not just
-- the signed-in one.
drop policy if exists "admins read all profiles" on public.profiles;
create policy "admins read all profiles" on public.profiles
  for select using (public.is_admin());

drop policy if exists "update own profile" on public.profiles;
create policy "update own profile" on public.profiles
  for update using (auth.uid() = id);

-- Lets a super_admin/sub_admin approve other teachers.
drop policy if exists "admins manage other profiles" on public.profiles;
create policy "admins manage other profiles" on public.profiles
  for update using (public.is_admin());

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, name, email)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', new.email), new.email)
  on conflict (id) do nothing;
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── Class hierarchy: batch -> grade -> division -> class (one subject) ──
create table if not exists public.batches (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  start_year int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.grades (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.batches(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  level int not null,
  created_at timestamptz not null default now()
);

create table if not exists public.divisions (
  id uuid primary key default gen_random_uuid(),
  grade_id uuid not null references public.grades(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  created_at timestamptz not null default now()
);

-- One subject taught to one division — the app's single classId concept.
create table if not exists public.classes (
  id uuid primary key default gen_random_uuid(),
  division_id uuid not null references public.divisions(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  subject text not null,
  created_at timestamptz not null default now()
);

-- ── Students: invite-only, never self-registered ──
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  auth_user_id uuid references auth.users(id) on delete set null,
  name text not null,
  roll_no text,
  email text,
  status text not null default 'invited' check (status in ('invited','active','removed')),
  created_at timestamptz not null default now()
);

create table if not exists public.class_members (
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, student_id)
);

-- ── Materials: shared notes/lessons — no "templates" concept ──
create table if not exists public.materials (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  kind text not null default 'note' check (kind in ('note','lesson','ppt','other')),
  body_md text,
  storage_path text,
  subject text,
  syllabus text,
  grade_level int,
  is_shared boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists public.class_materials (
  class_id uuid not null references public.classes(id) on delete cascade,
  material_id uuid not null references public.materials(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (class_id, material_id)
);

-- Doubts anchored to a position in a material; an approved answer becomes
-- visible to the whole class, not just the asking student.
create table if not exists public.doubts (
  id uuid primary key default gen_random_uuid(),
  material_id uuid not null references public.materials(id) on delete cascade,
  class_id uuid not null references public.classes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  student_id uuid references public.students(id) on delete set null,
  anchor jsonb,
  question text not null,
  answer text,
  answered_by text check (answered_by in ('ai','faculty')),
  approved boolean not null default false,
  created_at timestamptz not null default now()
);

-- ── Goal Planner pipeline ──
create table if not exists public.goals (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  prompt text,
  source text not null default 'prompt' check (source in ('prompt','upload','library')),
  status text not null default 'draft' check (status in ('draft','approved')),
  created_at timestamptz not null default now(),
  approved_at timestamptz
);

create table if not exists public.goal_items (
  id uuid primary key default gen_random_uuid(),
  goal_id uuid not null references public.goals(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('lesson_plan','slide_deck','notes','quiz','exam','activity','homework')),
  title text not null,
  detail text,
  content jsonb,
  scheduled_for date,
  created_at timestamptz not null default now()
);

create table if not exists public.assessments (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  goal_item_id uuid references public.goal_items(id) on delete set null,
  kind text not null check (kind in ('quiz','exam')),
  title text not null,
  status text not null default 'draft' check (status in ('draft','scheduled')),
  scheduled_for date,
  created_at timestamptz not null default now()
);

create table if not exists public.results (
  id uuid primary key default gen_random_uuid(),
  assessment_id uuid not null references public.assessments(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  score numeric,
  created_at timestamptz not null default now(),
  unique (assessment_id, student_id)
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  class_id uuid not null references public.classes(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  owner_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  status text not null check (status in ('present','absent','late')),
  created_at timestamptz not null default now(),
  unique (class_id, student_id, date)
);

-- ── RLS: owner-scoped everywhere, denormalized owner_id avoids joins ──
alter table public.batches enable row level security;
alter table public.grades enable row level security;
alter table public.divisions enable row level security;
alter table public.classes enable row level security;
alter table public.students enable row level security;
alter table public.class_members enable row level security;
alter table public.materials enable row level security;
alter table public.class_materials enable row level security;
alter table public.doubts enable row level security;
alter table public.goals enable row level security;
alter table public.goal_items enable row level security;
alter table public.assessments enable row level security;
alter table public.results enable row level security;
alter table public.attendance enable row level security;

drop policy if exists "owner full access" on public.batches;
create policy "owner full access" on public.batches for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.grades;
create policy "owner full access" on public.grades for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.divisions;
create policy "owner full access" on public.divisions for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.classes;
create policy "owner full access" on public.classes for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.class_materials;
create policy "owner full access" on public.class_materials for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
-- Any signed-in teacher can read the shared library ("choose from deck"),
-- but only super_admin/sub_admin can add to it — a teacher still fully
-- manages their own private materials.
drop policy if exists "owner full access" on public.materials;
drop policy if exists "read own or shared materials" on public.materials;
create policy "read own or shared materials" on public.materials
  for select using (owner_id = auth.uid() or is_shared = true);
drop policy if exists "insert own materials, shared requires admin role" on public.materials;
create policy "insert own materials, shared requires admin role" on public.materials
  for insert with check (
    owner_id = auth.uid()
    and (
      is_shared = false
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','sub_admin'))
    )
  );
drop policy if exists "update own materials" on public.materials;
create policy "update own materials" on public.materials
  for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "delete own materials" on public.materials;
create policy "delete own materials" on public.materials
  for delete using (owner_id = auth.uid());
drop policy if exists "owner full access" on public.doubts;
create policy "owner full access" on public.doubts for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.goal_items;
create policy "owner full access" on public.goal_items for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.assessments;
create policy "owner full access" on public.assessments for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.results;
create policy "owner full access" on public.results for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner full access" on public.attendance;
create policy "owner full access" on public.attendance for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

-- Preparation (drafting) is open to pending teachers; only actions that
-- reach real students require an approved profile.
drop policy if exists "owner reads own students" on public.students;
create policy "owner reads own students" on public.students for select using (owner_id = auth.uid());
-- The super-admin students console reads across every teacher's roster.
drop policy if exists "admins read all students" on public.students;
create policy "admins read all students" on public.students
  for select using (public.is_admin());
drop policy if exists "owner updates own students" on public.students;
create policy "owner updates own students" on public.students for update using (owner_id = auth.uid()) with check (owner_id = auth.uid());
drop policy if exists "owner deletes own students" on public.students;
create policy "owner deletes own students" on public.students for delete using (owner_id = auth.uid());
drop policy if exists "active teachers add students" on public.students;
create policy "active teachers add students" on public.students
  for insert
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

drop policy if exists "owner reads own enrollments" on public.class_members;
create policy "owner reads own enrollments" on public.class_members for select using (owner_id = auth.uid());
drop policy if exists "owner removes own enrollments" on public.class_members;
create policy "owner removes own enrollments" on public.class_members for delete using (owner_id = auth.uid());
drop policy if exists "active teachers enroll students" on public.class_members;
create policy "active teachers enroll students" on public.class_members
  for insert
  with check (
    owner_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
  );

drop policy if exists "owner drafts goals" on public.goals;
create policy "owner drafts goals" on public.goals for insert with check (owner_id = auth.uid());
drop policy if exists "owner reads own goals" on public.goals;
create policy "owner reads own goals" on public.goals for select using (owner_id = auth.uid());
drop policy if exists "owner deletes own goals" on public.goals;
create policy "owner deletes own goals" on public.goals for delete using (owner_id = auth.uid());
drop policy if exists "owner updates goals, approval needs active status" on public.goals;
create policy "owner updates goals, approval needs active status" on public.goals
  for update using (owner_id = auth.uid())
  with check (
    owner_id = auth.uid()
    and (
      status = 'draft'
      or exists (select 1 from public.profiles p where p.id = auth.uid() and p.status = 'active')
    )
  );

-- ── Storage: shared curriculum library ──
-- Public-read bucket so any signed-in teacher can open a document a
-- super_admin/sub_admin curated into the shared library; writes are
-- admin-only. (The other buckets — avatars, class-documents, etc. —
-- predate this file and aren't yet captured here.)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'shared-library', 'shared-library', true, 26214400,
  array['application/pdf','application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'text/plain']
)
on conflict (id) do nothing;

drop policy if exists "shared_library_public_read" on storage.objects;
create policy "shared_library_public_read" on storage.objects for select
  using (bucket_id = 'shared-library');

drop policy if exists "shared_library_admin_insert" on storage.objects;
create policy "shared_library_admin_insert" on storage.objects for insert
  with check (
    bucket_id = 'shared-library'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','sub_admin'))
  );

drop policy if exists "shared_library_admin_update" on storage.objects;
create policy "shared_library_admin_update" on storage.objects for update
  using (bucket_id = 'shared-library' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','sub_admin')))
  with check (bucket_id = 'shared-library' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','sub_admin')));

drop policy if exists "shared_library_admin_delete" on storage.objects;
create policy "shared_library_admin_delete" on storage.objects for delete
  using (bucket_id = 'shared-library' and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role in ('super_admin','sub_admin')));

-- ── Analytics: real, minimal event logging ──
-- Not full product telemetry (no rage-click/dead-click/session tracking)
-- — just three honest signals the app can actually emit today: a page
-- was viewed, a generation was requested, a client error was thrown.
create table if not exists public.analytics_events (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('page_view','generation','client_error')),
  path text,
  feature text,
  class_id uuid references public.classes(id) on delete set null,
  message text,
  created_at timestamptz not null default now()
);

create index if not exists analytics_events_kind_created_at_idx
  on public.analytics_events (kind, created_at desc);
create index if not exists analytics_events_owner_id_idx
  on public.analytics_events (owner_id);

alter table public.analytics_events enable row level security;

drop policy if exists "owner logs own events" on public.analytics_events;
create policy "owner logs own events" on public.analytics_events
  for insert with check (owner_id = auth.uid());

drop policy if exists "admins read all events" on public.analytics_events;
create policy "admins read all events" on public.analytics_events
  for select using (public.is_admin());

-- ── Feature costs: real editable config, not yet enforced ──
-- There's no live credits/billing system to deduct against, so this is
-- pricing policy the super-admin can set now, ready for when generation
-- and credits are both real.
create table if not exists public.feature_costs (
  feature text primary key check (feature in ('lesson_plan','slide_deck','activity','homework','note','quiz','exam')),
  credit_cost numeric not null default 1,
  updated_at timestamptz not null default now()
);

alter table public.feature_costs enable row level security;

drop policy if exists "anyone signed in reads feature costs" on public.feature_costs;
create policy "anyone signed in reads feature costs" on public.feature_costs
  for select using (auth.uid() is not null);

drop policy if exists "admins write feature costs" on public.feature_costs;
create policy "admins write feature costs" on public.feature_costs
  for all using (public.is_admin()) with check (public.is_admin());

insert into public.feature_costs (feature, credit_cost) values
  ('lesson_plan', 1),
  ('slide_deck', 2),
  ('activity', 1),
  ('homework', 1),
  ('note', 1),
  ('quiz', 1),
  ('exam', 2)
on conflict (feature) do nothing;

-- ── Owned by the backend, mirrored here defensively ──
-- audit_log and the OpenRouter key pool belong to murchid-backend
-- (final/backend, db/2026-09-04-audit-and-key-pool.sql), not this repo —
-- nothing in the frontend reads or writes them. They're copied here only
-- so a future "clean slate" migration doesn't silently drop them again,
-- which is exactly what clean_slate_v2 did on 2026-09-04: it took out
-- these tables without anyone noticing until the Keys console broke.
-- If this file and the backend's copy ever disagree, the backend's is
-- authoritative — update this block to match, not the other way round.
create table if not exists public.audit_log (
  id bigint generated always as identity primary key,
  actor_id uuid,
  action text not null,
  entity text,
  entity_id text,
  meta jsonb,
  ip text,
  user_agent text,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_actor_idx on public.audit_log (actor_id, created_at desc);
create index if not exists audit_log_recent_idx on public.audit_log (created_at desc);

create table if not exists public.llm_keys (
  id bigint generated always as identity primary key,
  provider text not null default 'openrouter',
  label text not null unique,
  key_value text not null unique,
  status text not null default 'active' check (status in ('active', 'probation', 'disabled')),
  cooldown_until timestamptz,
  last_ok_at timestamptz,
  last_err_at timestamptz,
  note text,
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists llm_keys_active_idx on public.llm_keys (provider, id) where status = 'active';

create table if not exists public.llm_key_events (
  id bigint generated always as identity primary key,
  label text not null,
  event text not null check (event in ('added', 'seeded', 'probed_ok', 'probe_failed',
    'rate_limited', 'refused', 'transient', 'cooled', 'probation', 'disabled', 'reenabled', 'removed')),
  detail text,
  created_at timestamptz not null default now()
);
create index if not exists llm_key_events_label_idx on public.llm_key_events (label, created_at desc);
create index if not exists llm_key_events_recent_idx on public.llm_key_events (created_at desc);

create table if not exists public.key_pool_settings (
  id boolean primary key default true check (id),
  min_active_keys int not null default 1,
  cooldown_minutes int not null default 90,
  min_keys_alert int not null default 3,
  alert_email text,
  last_alert_at timestamptz,
  updated_at timestamptz not null default now()
);
insert into public.key_pool_settings (id) values (true) on conflict (id) do nothing;

-- RLS on with NO policy: unreachable from any browser role. Only the
-- backend's own pooler connection (which bypasses RLS) can read these.
alter table public.audit_log         enable row level security;
alter table public.llm_keys          enable row level security;
alter table public.llm_key_events    enable row level security;
alter table public.key_pool_settings enable row level security;

revoke all on public.audit_log         from public, anon, authenticated;
revoke all on public.llm_keys          from public, anon, authenticated;
revoke all on public.llm_key_events    from public, anon, authenticated;
revoke all on public.key_pool_settings from public, anon, authenticated;

create or replace function public.set_key_pool_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;

drop trigger if exists llm_keys_touch on public.llm_keys;
create trigger llm_keys_touch before update on public.llm_keys
  for each row execute function public.set_key_pool_updated_at();
