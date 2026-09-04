> **Resolved 2026-09-04.** Confirmed same project. Fixed on `final/backend`
> (`0081ae5`): `loadAccount()` now reads `profiles` directly, role gate
> accepts `super_admin`/`sub_admin`, `audit_log` and the key pool tables are
> restored. No data was lost — the pool held one seeded key, which re-seeds
> itself from `OPENROUTER_API_KEY`. `is_admin()` doesn't work over the
> backend's direct pooler connection (`auth.uid()` is null there) — it reads
> `profiles` with the already-verified uid instead. Keys is now live and
> wired on the frontend. See [10-remaining-after-keys.md](10-remaining-after-keys.md)
> for what's still open. Left below as the record of the original diagnosis.

# The backend's auth is broken against the current database — not just Keys

Written from the frontend side after being asked to wire the super-admin
Keys page to the real `final/backend` service. Handing this over instead of
wiring anything, because the problem is bigger than that one page.

## The finding

`final/backend` (per its own README, this is the branch deployed on Render)
authenticates **every** `/api/*` request by loading the caller's account:

```sql
-- src/middleware/auth.ts, loadAccount()
select f.id, u.id as user_id, u.email, ...
  from public.faculty f
  join public.users u on u.id = f.user_id
  left join public.subscriptions s on s.faculty_id = f.id
 where u.id = $1
```

and the Keys console additionally reads/writes `public.llm_keys`,
`public.llm_key_events`, `public.key_pool_settings`, and
`public.audit_log` (via `recordAudit`).

**None of those tables exist** in the Supabase project this frontend
currently uses (`beftrmuhplksbsfsfunc`) — confirmed directly against the
live database. That project's `public` schema now only has the tables the
rebuilt frontend created this week: `profiles`, `batches`, `grades`,
`divisions`, `classes`, `students`, `class_members`, `materials`,
`class_materials`, `doubts`, `goals`, `goal_items`, `assessments`,
`results`, `attendance`, `analytics_events`, `feature_costs`.

The old schema (`faculty`, `users`, `subscriptions`, `ai_studio`,
`audit_log`, and — per `db/2026-09-02-key-pool.sql` — the key pool tables)
was dropped by a migration named `clean_slate_v2`, applied to this same
project this morning as part of the frontend rewrite. `db/tune.sql` in the
frontend repo used to be ~14,000 lines describing exactly that schema
(`faculty`, `ai_studio`, `schedule_entries`, …) before it was replaced.

**If `final/backend`'s `DATABASE_URL`/`SUPABASE_URL` point at
`beftrmuhplksbsfsfunc`, every authenticated call to it is currently
failing** — `loadAccount()` throws (relation does not exist), which
`requireAuth`'s catch-all turns into a generic `401 Invalid or expired
access token`, indistinguishable from a bad token. That's consistent with
every endpoint I probed (`/api/keepwarm`, `/api/admin/keys`, etc.) coming
back 401 regardless of the path.

**First thing to check:** confirm in the Render dashboard for that service
whether `SUPABASE_URL` is in fact `beftrmuhplksbsfsfunc`. If it's a
different project, most of this document doesn't apply and the Keys
console should already work — the 401s I saw would just be "no token."

## If it is the same project

Two separate problems, both real:

### 1. The key pool's data is very likely gone

`llm_keys`/`llm_key_events`/`key_pool_settings` don't exist right now.
The `final/backend` branch's own commit (`833afce`, this morning, *before*
`clean_slate_v2` ran) says the pool "is already populated in production"
and was kept specifically because "rebuilding it would mean re-entering
keys to relearn lessons already paid for." If that was true an hour before
the wipe, that data is probably lost from live rows — `CREATE TABLE IF NOT
EXISTS` will happily recreate the empty structure, but not the keys in it.

**Worth checking now, before anything else, while it's still possible:**
Supabase project → Database → Backups. If point-in-time recovery is
enabled and within its retention window, the `llm_keys` rows can likely be
recovered from just before the `clean_slate_v2` migration
(`20260904055059`, ~05:50 UTC today) by restoring to a branch and copying
the rows across — without touching the live (already-rebuilt) database.
I did not attempt this myself; it's a judgment call about the live project
that should be made deliberately, not as a side effect of investigating.

### 2. The backend's queries need to target the new schema

Whether or not the pool's data survives, `final/backend`'s auth layer
needs to read *something* that identifies a caller as `super_admin` /
`sub_admin` in the new schema. The new source of truth is:

```sql
-- public.profiles (see db/tune.sql in the frontend repo for the full definition)
id uuid primary key references auth.users(id)
role text check (role in ('teacher','sub_admin','super_admin','organisation'))
status text check (status in ('pending','active','rejected'))
name text, email text, institution text, staff_id text, syllabus text
```

There's also `public.is_admin()` — a `SECURITY DEFINER` SQL function that
returns whether `auth.uid()` is `super_admin`/`sub_admin` — already used by
the frontend's own RLS policies. It's callable the same way from a raw
`pg` query (`select public.is_admin()`), which may be a cleaner swap for
`requireRole` than re-deriving the check.

**Concretely, `loadAccount()` needs to become something like:**

```sql
select id, role, status, name, email
  from public.profiles
 where id = $1
```

and `requireRole('superadmin')`'s comparison needs to change from the
literal string `'superadmin'` to `'super_admin'` (the new schema uses an
underscore; the old one didn't) — and probably accept `'sub_admin'` too,
matching how the frontend treats those two interchangeably everywhere else
(see `is_admin()` above).

The `Account` shape `loadAccount` returns is also full of fields that no
longer exist (`facultyCode`, `majors`, `gradeLevels`, `subscriptionPlan`,
`subscriptionStatus`) — those all came from `faculty`/`faculty_schools`/
`subscriptions`, none of which exist yet in the new schema. For the Keys
console specifically, none of that is needed — `keysRouter` only ever
reads `caller.userId` for the audit trail. A minimal fix could narrow
`Account` down to `{ id, userId, email, role, status }` for now, without
deciding the shape of the eventual reintroduced fields (batches/grades/
divisions already model class structure differently than `faculty_schools`
did, so those don't map over anyway — that decision belongs to whoever
reconnects generation, not to unblocking Keys).

### 3. `audit_log` needs to exist again

Every write in `keysRouter` calls `recordAudit`, which does:

```sql
insert into public.audit_log (actor_id, action, entity, entity_id, meta, ip, user_agent)
values (...)
```

This table doesn't exist in the new schema either. Minimal recreation:

```sql
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
alter table public.audit_log enable row level security;
-- No policy, on purpose (per the original design): unreachable from any
-- browser role, readable only over the backend's own pooler connection.
revoke all on public.audit_log from public, anon, authenticated;
```

## Once the backend can authenticate again

The Keys contract `final/backend` already implements (from its own
`src/routes/keys.ts`, restated here so nothing has to be re-read from the
backend repo to wire the frontend against it):

```
GET    /api/superadmin/keys
  → { keys: [{ id, label, provider, status, cooldown_until, last_ok_at,
               last_err_at, added_at, note, masked }],
      settings: { min_active_keys, cooldown_minutes },
      events: [{ label, event, detail, created_at }],   // last 100
      usable: number }

POST   /api/superadmin/keys        { keys: "one per line, or comma/space separated", note?: string }
  → 201 { added: number, rejected: [{ key, reason }], labels: string[] }

PATCH  /api/superadmin/keys/:id    { status?: 'active'|'probation'|'disabled', clear_cooldown?: boolean }
  → { label, status }

DELETE /api/superadmin/keys/:id
  → 204 (409 if it's the last active key below the configured floor)

PATCH  /api/superadmin/keys-settings   { min_active_keys?: number, cooldown_minutes?: number }
  → { min_active_keys, cooldown_minutes }
```

Auth: `Authorization: Bearer <supabase-access-token>`, same token the
frontend already holds from its Supabase session — no new auth flow
needed on the frontend side once the backend accepts it. All of this is
already reachable through the existing `/api/*` → Render rewrite
(`API_PROXY_TARGET`), so nothing changes about how the frontend reaches
the backend, only whether the backend's own queries resolve.

**Once this works**, I'll replace `app/(admin)/super-admin/keys/page.tsx`
(currently an honest "not wired up yet" placeholder) with a real page
against this contract — list, mask, add-by-paste, enable/disable/delete,
edit the pool floor/cooldown. That part is a small, ordinary fetch-and-
render job; it's waiting on the above, not on any frontend design work.

## Scope note

This document is scoped to unblocking Keys specifically, since that's
what was asked. The same root cause (backend auth reads a schema that no
longer exists) blocks *everything* under `/api/*` — generation, curriculum
derive, corpus search, materials extraction, all of it. Worth a separate,
deliberate decision about whether those get reconnected against the new
schema, rebuilt against it from scratch, or something in between — that's
a bigger call than this doc is trying to make.
