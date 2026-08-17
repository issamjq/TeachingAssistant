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
