# 12 — Super admin

The platform super admin is the top of the role pyramid
(`dev > super_admin > admin > moe > owner > teacher`). It has full,
cross-tenant reach — every account, all platform analytics, billing,
feature flags and the audit trail — through its own portal at
`/superadmin`, separate from the teacher sign-up funnel.

This is built **frontend-first, hybrid**: reads and dashboards resolve
straight against Supabase; the privileged writes go through
SECURITY DEFINER Postgres functions. The database is the "server" — there
is no service-role key in the browser.

## How the power is enforced (no service key in the browser)

The super-admin surface is a set of SECURITY DEFINER functions in
[`db/tune.sql` §30](../db/tune.sql). Each one's **first act** is
`sa_require()`, which calls `is_super_admin()` — a read of the *caller's
own* `users.role`. A teacher's token cannot make that true, so a teacher
calling `sa_set_role()` is refused by the function body, not by hoping the
UI hid the button. Inside the guard the function runs as its owner, so it
reads every tenant's rows and writes the five tables the browser is
otherwise forbidden (`credits`, `subscriptions`, `feature_flags`,
`audit_log`, cross-account `users`). This is the same mechanism
`bulletin_board_public()` and `provision_faculty()` already use.

`audit_log` stays unwritable from the client (RLS on, no policy). Its only
writer is `sa_write_audit()`, called from inside each mutating function —
so the trail records who did what and the subject cannot edit it.

## The RPCs

Reads: `sa_stats`, `sa_accounts`, `sa_account`, `sa_account_content`,
`sa_overview`, `sa_signups`, `sa_logins`, `sa_recent_activity`, `sa_flags`.
Writes: `sa_set_status`, `sa_set_role`, `sa_delete_account` (soft),
`sa_set_permissions`, `sa_adjust_credits`, `sa_set_subscription`,
`sa_set_flag`. Plus `record_auth_event(kind)` — any user records their own
login/signup, which feeds the dashboard's charts and stamps
`last_login_at`.

The screens call the same paths they always did
(`/api/admin/*`, `/api/superadmin/*`); [`src/lib/data/superadmin.ts`](../src/lib/data/superadmin.ts)
maps those to the RPCs, and `src/lib/data/index.ts` routes them there
instead of the backend.

## The hybrid boundary

Two operations a definer function genuinely cannot do stay on the backend
and return `{ handled: false }` (surfacing as "not connected yet"):

- **Creating an account** — needs the GoTrue admin key to make an
  `auth.users` row.
- **Hard-deleting an account** — `sa_delete_account` does a *soft* delete
  (`account_status = 'deleted'`, reversible); erasing the auth row + every
  cascade is a backend job.

## Provisioning a super admin

`npm run db:superadmin` (script: [`db/superadmin.js`](../db/superadmin.js)).
Run it from a machine with `DATABASE_URL`, like `db:tune`. Two modes,
chosen automatically:

```bash
# PROMOTE — the email already signed in once (e.g. Google). No password.
npm run db:superadmin you@example.com

# CREATE — new email + a password → mints an email+password login, then
# promotes it. No service-role key needed (same path as db/seed-demo).
npm run db:superadmin you@example.com --password 'S3cret!'

# Undo
npm run db:superadmin you@example.com --demote
```

It sets `users.role = 'super_admin'`, ensures a `faculty` row exists (so
`/api/auth/me` doesn't 404 the account into the sign-up funnel), and writes
an audit entry. Idempotent.

## Signing in

Go to **`/superadmin`**. Continue with Google, **or** use the email +
password form (added for credential-provisioned admins with no Google
identity). On success `PortalSignIn` reads the role from `/api/auth/me`,
`setRole('super_admin')` routes the studio, and you land on the
super-admin **dashboard**.

## What you get

- **Dashboard** (`superadmin-dashboard`) — KPIs (accounts, MRR/ARR,
  trials, ending-soon, active today), signups/logins line charts, accounts
  and subscriptions donuts, revenue-by-plan bars, content footprint, the
  activity feed, and newest accounts. Charts are the hand-rolled SVG
  primitives in `src/components/MiniCharts.jsx`.
- **Account access** (`superadmin-console`) — every account with role
  filters; suspend / reactivate / soft-delete; change role + sub-role;
  a **Feature flags** panel; and the **Audit trail**.
- **Account drawer** (click any row) — identity, subscription, content
  footprint, schools, the per-account **permission matrix**, a **billing
  editor** (credits balance/allowance, plan, status, end date), and a
  read-only **inspector** ("view their work" — the honest form of
  impersonation in a direct-Supabase app; there is no session takeover).
- **Usage & heatmaps** (`superadmin-product`) and **Where they get
  stuck** (`superadmin-friction`) — the product telemetry, below.
- **Roles & access** (`superadmin-roles`) — the capability grid, below.

## Product telemetry (§95)

Everything above counts things that exist: accounts, lessons, credits,
dirhams. None of it can say which screens teachers open or where they
try something and fail, because that evidence is not in the content
tables — a lesson row proves a generation finished and is silent about
the four teachers who pressed Generate, got a 500 and left.

`app_events` is where the browser writes it down.
[`src/lib/telemetry.ts`](../src/lib/telemetry.ts) batches events and
flushes them on a timer, at a size cap, and on `pagehide` — the last
being the one that matters, since the session that ends in a rage-quit
is the session worth having. `startTelemetry()` is mounted once by
`StudioShell`, and `apiClient` reports every failed or slow request from
the one choke point every call already passes through.

**What it does not record.** No page content, no form values, no lesson
titles or student names, and no URLs — a URL carries ids, so the section
KEY is stored (`quizzes`, never `/quizzes/8f2c…`). A click's label comes
from a button, link or nav item's own accessible name, capped at 80
characters, never from an input. A heatmap needs to know that
"studio → generate" is where people rage-click; whose lesson it was adds
nothing to that answer and everything to the cost of holding it.

**Where it lands.** `app_events` has RLS on and *no policy* — deliberately,
like `audit_log`. The only writer is `record_app_events()`, which stamps
`auth.uid()` itself, so a caller cannot attribute an event to anyone
else and cannot read one back. Every read is a definer function behind
`sa_gate()`. Retention is 180 days, trimmed by `sa_prune_events()`,
which is manual for the same reason migrations are.

The reads: `sa_product_overview`, `sa_screen_usage`,
`sa_activity_heatmap` (day × hour), `sa_click_heatmap` (binned x/y plus
the same clicks by control name), `sa_feature_adoption`, `sa_friction`,
`sa_stuck_users`, `sa_journey` and `sa_retention`.

The last two deliberately do **not** read the ledger. `sa_journey`
derives the activation funnel from the content tables and
`sa_retention` builds its cohorts from `audit_log`'s sign-in trail, so
both answer for every account the product has ever had rather than only
for those who arrived after telemetry shipped — a cohort chart that
starts empty is useless for exactly the three months you most want one.

Friction is ranked by a weighted score, not a raw count: 5 for an error,
3 for a rage click, 3 for an abandoned flow, 2 for a dead click, 1 for a
slow response. One thing that genuinely broke should outrank a dozen
impatient taps.

## Roles & access (§95)

Access resolves in four steps, and until this screen existed only two of
them were visible anywhere:

1. `super_admin` / `dev` — everything, always
2. `users.permissions[cap]` — the per-account override
3. `role_capabilities[role][cap]` — the role's default
4. deny

Step 3 used to be a literal inside `admin_can()` — `p_cap IN
('admin.dashboard','admin.accounts')` — which made giving a new kind of
staff member a new kind of access a migration. It is now a table, and
**Roles & access** is the screen that edits it. Every cell also carries
the number of accounts that override it, because a grid saying "admins
cannot touch billing" while four admins carry an override saying
otherwise is a confident lie.

The capability catalog, each gating real definer functions:

| | |
|---|---|
| `admin.dashboard` | platform dashboards — accounts, students, orgs |
| `admin.accounts` | manage accounts: suspend, role, delete |
| `admin.analytics` | product analytics — heatmaps, usage, adoption |
| `admin.friction` | friction and stuck users — **this one carries names** |
| `admin.billing` | credits and subscriptions |
| `admin.platform` | feature flags, credit costs, the billing switch |
| `admin.audit` | the audit trail |
| `admin.roles` | see and grant capabilities |

`admin.friction` is split from `admin.analytics` on purpose. "The studio's
Generate button is rage-clicked" is a product fact anyone on staff can
see; "it is Fatima who tried nine times on Tuesday" is a support fact,
and handing it to everyone who can read a dashboard is how a console
stops being trusted.

**Two floors, both in the database.** `cap_is_grantable()` refuses an
`admin.*` capability to a `teacher` or a `student` whatever is written
in the grid — the table decides how much a staff member gets, not who
counts as staff. And `sa_set_role_cap()` is gated on `sa_require()`, not
on `admin.roles`: a delegated admin granted the access screen can see
the matrix and grant the rest, but cannot move the defaults underneath
it and cannot grant themselves anything.

`moe` and `owner` can now hold a capability at all, which they could not
before. A grant appears in their sidebar as a **Platform** section
alongside their own console — `platformNav()` in `src/config/nav.ts`.

**One trap worth naming.** `/api/me` resolves the `admin.*` half of its
permission map from `my_capabilities()`, which runs the same
`admin_can()` the gates run — *not* from `ROLE_DEFAULTS` in
`src/lib/permissions.js`. Resolving them from a constant would mean a
super admin granting `admin` the billing capability watched the RPC
start allowing it while the sidebar kept the link hidden. The constant
survives only as the value the rail assumes for the moment before
`/api/me` answers, so it must stay in step with the seeded rows.

## Applying it

```bash
npm run db:tune            # applies §30 (idempotent, one transaction)
npm run db:superadmin you@example.com --password '…'
# sign in at /superadmin
```

`db:tune` also **widens `users_role_check`** — it previously allowed only
`('teacher','student','school_admin','superadmin')` and would have rejected
`super_admin` (with the underscore) and the rest of the pyramid. Until
`db:tune` runs with §30, no account can be set to `super_admin`.

## Who gets the role (§36)

**A sign-up is a teacher.** Nothing in the app writes `users.role` at
sign-up — `provisionTeacher()` upserts a name and an avatar and stops —
so the value came entirely from the live schema, and the live schema was
handing every new Google account `super_admin`. Since `is_super_admin()`
is a read of the caller's own `users.role`, that one default gave every
visitor the cross-tenant consoles, billing, credit control and the audit
trail.

[`db/tune.sql` §36](../db/tune.sql) closes it in three places:

| | |
|---|---|
| `role` column `DEFAULT 'teacher'` | a plain INSERT is a teacher |
| `force_signup_role_on_users` (BEFORE INSERT) | **coerces** the role, so it wins over whatever `handle_new_user()` assigns — the console trigger's body does not need to be known to be overridden |
| `guard_privilege_columns_on_users` (BEFORE UPDATE) | refuses a change to `role` / `sub_role` / `permissions` arriving from the browser |

The UPDATE guard tests `current_user`, not `auth.uid()`. A write coming
straight through PostgREST runs as one of **its** roles —
`authenticated`, `anon` or `authenticator`, all three named; a SECURITY
DEFINER body (`sa_set_role`, `sa_set_permissions`,
`link_student_account`) runs as the function's owner, and the migration
scripts run as `postgres`. So every legitimate writer passes and only the
direct client write is refused — which is why that trigger function must
stay SECURITY INVOKER. `service_role` is deliberately absent: that key
belongs to the separate backend, which is trusted.

> Naming only `authenticated` was a real hole, found by testing rather
> than by reading: a request carrying **no token** runs as `anon`, so the
> unauthenticated role could write the columns the signed-in one could
> not. Whether an RLS policy would have caught it first is not knowable
> from this repository, which is the whole reason the guard exists.
It means the RLS policies on `public.users` (authored in the Supabase
console, invisible to this repo) no longer decide whether a teacher can
promote themselves.

**The one account.** `platform_owner_email()` names it —
`amalcpaulson@gmail.com` — hardcoded on purpose. It is not
configuration: it is the identity the platform trusts before anything
has been granted, and reading it from an env var would make a deploy
setting able to mint a super admin. That account is `super_admin` on
sight, including on a first-ever sign-in. Everyone else is granted the
role by an existing super admin (**Account access → change role**) or by
`npm run db:superadmin`.

Applying §36 also **demotes every other elevated account to `teacher`**
— `super_admin`, the legacy `superadmin` spelling, and `dev`, which is
in the list because `is_super_admin()` returns true for it too and a
leftover dev account is the same hole under another name. It removes
privilege, not data: no row is deleted, nothing else on the row changes,
and re-running is a no-op. Grant the real ones back from the console.

### The other half of it was in the browser

The database fix above is necessary but was not sufficient. `murchid_role`
in localStorage — read by `StudioShell` to pick the rail, the default
route and `SECTIONS_BY_ROLE` — was **written only by the portal sign-ins
and never cleared**. So it outlived the account that wrote it:

- a super admin signs in on a browser → `murchid_role = "super_admin"`;
- sign-out cleared the session, the account and the cached faculty id,
  but not this;
- the next account to sign in through the normal `/signin` funnel never
  called `setRole` at all, so it opened the studio on the super-admin
  rail and landed on `/superadmin-dashboard`.

An account whose `role` is NULL hit the same thing from the other
direction: `setRole()` ignores a value that is not a `Role`, so a null
role did not reset the key — it **kept** whatever was already there.

Nothing behind those screens was ever exposed: every `sa_*` RPC re-checks
`is_super_admin()` in Postgres, so the console loaded empty and 403ing.
A console a teacher can open is still a bug.

`syncRoleFromServer()` in [`src/lib/role.ts`](../src/lib/role.ts) makes
the account row the authority — called from `StudioShell`'s `/api/me`
hydration, so it runs on every sign-in rather than only at the portal.
Anything the server does not call a real role is a teacher. `dev` is the
one exception, and it is this key's original purpose: a dev entering
another portal previews that role's UI (`portal.ts`,
`previewRoleForDev`) while staying `dev` server-side.

`clearRole()` now runs on all three sign-out paths — `StudioShell`'s
`signOutFully`, `Landing`'s `handleSignOut`, and `apiClient`'s forced
sign-out on `session_superseded`.

## Holding more than one role (§37)

A person can be several things at once — a teacher who is also studying,
an admin who is also a student, a teacher who also administers. Rather
than add a `roles` array that can disagree with the rest of the schema,
the set is **derived from what is already true and already enforced**:

| Role | Comes from |
|---|---|
| `teacher` | a `faculty` row exists for this user |
| `student` | at least one `students` row is claimed by this user |
| `admin` · `moe` · `owner` · `super_admin` · `dev` | `users.role` |

`my_roles()` only reports what those already decide, so there is nothing
to keep in sync: `is_super_admin()` still reads `users.role`,
`current_faculty_id()` still finds the faculty row,
`current_student_ids()` still finds the roster rows. Granting someone
`teacher` means giving them a faculty row; granting `student` means
inviting them.

`users.role` is the slot for an **assigned** role and the primary one —
what the shell lands on when no choice has been made. It is why
`link_student_account()` only takes that slot when it is still the
sign-up default `teacher` and there is no faculty row behind it: an admin
or a real teacher who is also on a roster must not lose their assignment
to a claim.

**Switching.** One interface is active at a time. `/api/me` returns
`roles`, and `syncRoleFromServer(primary, roles)` keeps whichever role
the browser already chose **as long as it is still in the set** — so the
choice survives a reload, and a revoked role drops back to the primary on
the next sign-in. The switcher itself is a row in the account menu,
hidden entirely when there is only one role.

### No account without a role (§38)

§36 stops new rows arriving blank and §37 filled the backlog, but both
are rules about how rows get written — neither stops the next one. §38
makes it structural: **`users.role` is `NOT NULL`**, so a blank role is
not a bug to find later but a write that cannot happen.

Three things could produce one, and all three are closed:

1. **`sa_set_role` accepted NULL.** Its guard read
   `IF p_role NOT IN (...)`. With `p_role` NULL that expression is NULL,
   not TRUE, so the exception never fired and the UPDATE below wrote the
   NULL straight in. A super admin clearing the field — or a client
   sending `role: undefined`, which becomes JSON null — blanked the
   account, and the console then displayed the blank it had been handed.
   The argument is now rejected up front, since the delegated-admin guard
   further down was NULL-blind in the same way.
2. **An UPDATE could still clear it.** `force_signup_role()` fires only
   on INSERT. `keep_role_set()` now coerces a NULL on UPDATE back to the
   previous role, or to `teacher` — the intent behind clearing a role has
   always been "back to the start", and the start is `teacher`.
3. **The column allowed it.** `ALTER COLUMN role SET NOT NULL`, after the
   sweep, in the same transaction. This is the guarantee: the other two
   are rules that have to be remembered, this one is checked by Postgres
   on every write including the ones nobody has written yet.

`db/seed-demo.js` set `role = NULL` on the deliberately-empty demo
account and now sets `teacher`. What makes that account empty is having
no faculty row and a pending onboarding, not an absent role — the NULL
was never a distinct state, only an unreadable one, since every reader
falls back to `teacher` anyway.
