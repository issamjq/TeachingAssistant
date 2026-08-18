# Murchid — Security policy

A living record of what the security model **is**, what it **isn't**, and
what is knowingly deferred. Anything not listed here is unaudited.

Rewritten after the Supabase migration. The previous version described an
Express API on Render verifying Firebase tokens in middleware against a
Neon database — none of which exists any more, and it stated the opposite
of the truth on the most important point (it called row-level security
"planned, not done"; RLS is now the whole authorisation layer).

## The shape of the system

There is **no API server in this repository**. The browser reads and
writes Supabase directly through [`src/lib/data/`](src/lib/data/) over
PostgREST. What used to be middleware is now:

| Concern | Where it lives now |
|---|---|
| Authentication | Supabase Auth (Google OAuth, email+password, magic link), PKCE flow |
| Authorisation | Row Level Security policies on every table |
| Privileged actions | `SECURITY DEFINER` Postgres functions, gated on the caller's own row |
| Secrets | A **separate backend repository**, reached through a server-side rewrite |

That last row is the reason the arrangement is defensible at all: the
browser holds a publishable key and a user's access token, and nothing
else. Every key that grants real power — the AI providers, the mail
sender, the GoTrue admin key — is in a project this one cannot see.

## TL;DR

- Every request carries a Supabase access token (JWT, short-lived,
  auto-refreshed by the SDK). Postgres verifies it; no application code
  decides who you are.
- Tenant isolation is **policies**, not route handlers. Read paths
  deliberately do *not* filter by owner — the policy already does, and a
  redundant `.eq("faculty_id", …)` would only be a second place to get it
  wrong.
- `credits`, `subscriptions`, `usage_logs`, `feature_flags` and
  `audit_log` have RLS on and **no client policy**. A teacher cannot top
  up their own balance or extend their own plan.
- `users.role`, `sub_role` and `permissions` cannot be written by a
  browser at all — a trigger refuses the write whichever PostgREST role
  it arrives as.
- The privileged consoles are `SECURITY DEFINER` functions whose first
  act is to read the *caller's own* role. A teacher's token is refused by
  the database, not by hoping the UI hid a button.

## Threat model

### Defended

| Threat | Mechanism |
|---|---|
| Reading another teacher's students, plans, marks | RLS policies keyed to `current_faculty_id()` |
| A student reading another student's work | `current_student_ids()`, scoped to rows claimed by the caller |
| A teacher granting themselves admin | `guard_privilege_columns` trigger (below) |
| A teacher granting themselves credits or a plan | those tables have RLS on and no client policy |
| Calling a super-admin function directly | `sa_require()` / `sa_gate()` re-check `is_super_admin()` inside every function body |
| Editing the audit trail | `audit_log` has no client policy; its only writer is `sa_write_audit()`, called from inside the functions being audited |
| A student claiming a classmate's account by guessing their email | the invite gate — `invite_status` must be `invited`, which only that student's teacher can set |
| An account with no role defaulting to something powerful | `users.role` is `NOT NULL`; a sign-up is coerced to `teacher` |
| One account used on many devices at once | `is_current_device()` against `users.active_session_id` |
| An expired subscription still writing | `subscription_active()` in the write policies |

### Deliberately not defended here

| | Why |
|---|---|
| Anything the separate backend does | Different repository, different review. Its secrets never reach this one. |
| Abuse of the publishable key | It is public by design and carries no privileges. Access is decided by RLS and by the token, not by hiding it. |
| Formal pen-test, SAST/DAST | Not done. `npm audit` is the only static check in CI. |
| Column-level encryption of student PII | Supabase encrypts the disk; column encryption needs key management this project does not have. |
| Append-only audit log at the storage layer | `audit_log` is a regular table. A database compromise could rewrite history. |
| Payment integrity | No Stripe yet; subscription state is admin-managed. |

## The privilege guard

`role`, `sub_role` and `permissions` are the columns that decide what an
account may do, and they live on a row the account can otherwise edit
(its own name, phone, avatar). A `BEFORE UPDATE` trigger refuses a change
to any of the three when the write arrives as one of PostgREST's roles —
`authenticated`, `anon` or `authenticator`.

The test is `current_user`, **not** `auth.uid()`. A `SECURITY DEFINER`
body runs as the function's owner and the migration scripts run as
`postgres`, so every legitimate writer passes and only the direct client
write is refused. This is why that one trigger function must stay
`SECURITY INVOKER` — it needs to see the caller's real role.

> Naming only `authenticated` was a hole, and it was found by running the
> SQL rather than by reading it: a request carrying **no token** runs as
> `anon`, so the unauthenticated role could write the columns the
> signed-in one could not. All three are named now. `service_role` is
> deliberately absent — that key belongs to the backend, which is trusted.

## What this document cannot tell you

**Not every RLS policy is in this repository.** The schema was authored
in the Supabase console and [`db/tune.sql`](db/tune.sql) adjusts it. The
policies tune.sql owns are auditable by reading it; any policy created in
the dashboard is not visible here, and no review done from this
repository can vouch for it.

This is a real limitation, not a formality. It is why the privilege guard
above exists as a trigger rather than as a policy: a trigger holds
whatever the policies turn out to permit.

**Recommended:** export the live policy set
(`SELECT * FROM pg_policies WHERE schemaname='public'`) and check it into
this repo, so the authorisation layer can be reviewed in one place and
diffed when it changes.

## Response headers

Set in [`next.config.ts`](next.config.ts) and served on every path:
`Strict-Transport-Security`, `X-Content-Type-Options`,
`X-Frame-Options`, `Referrer-Policy`, `X-DNS-Prefetch-Control`,
`Cross-Origin-Opener-Policy`.

**There is no Content-Security-Policy, and that is the largest open gap
in this document.** The Express app carried one; when the API was deleted
it went with it and nothing replaced it. Writing one means allowing
Google Fonts, Supabase over `wss:`, the avatar and marketing image hosts
and the OAuth redirect origins — and a CSP that is wrong does not degrade,
it blanks the page. It needs writing against a running app and verifying
in a preview deploy.

HSTS carries no `preload` and no `includeSubDomains`. Both are
effectively irreversible once a browser caches them.

## Rate limits

Enforced by Supabase, not by this codebase: auth attempts, token
refreshes and auth emails all have per-project caps configurable in the
dashboard (Authentication → Rate limits). There is no application-level
limiter, because there is no application server to put one in.

The one worth knowing: **auth emails per hour** is small by default and
is what a teacher inviting a class will hit. See
[docs/13](docs/13-student-invites.md).

## Input validation

Types are inferred from the backend's zod schemas
(`src/shared/types/api.ts`), which makes a drifting contract a compile
error — but that is a correctness gate, not a security boundary. The
security boundary is the database: `CHECK` constraints, `NOT NULL`,
foreign keys and the policies. Anything the browser sends that the schema
rejects fails in Postgres, which is the only place it cannot be talked
out of.

## If a credential leaks

1. **Supabase secret key** (`sb_secret_…`) — dashboard → Project settings
   → API keys → rotate. It belongs in no file in this repository; if it
   is in one, that is the incident.
2. **`DATABASE_URL`** — dashboard → Project settings → Database → reset
   password, update `.env`. Read only by the migration scripts, so
   nothing needs redeploying.
3. **Publishable key** — public by design, carries no privileges. Not an
   incident.
4. **Resend API key** — Resend → API Keys → revoke and reissue, then
   update Supabase's SMTP settings. Use a send-only restricted key.
5. **A user's session is suspected compromised** — Supabase dashboard →
   Authentication → Users → revoke sessions. `active_session_id` also
   means signing in anywhere else evicts the old device.
6. **OAuth provider secret** — rotate at the provider, then paste into
   Supabase → Authentication → Providers.

## Reporting a vulnerability

Email the address on murchid.com with a description, steps to reproduce,
and the impact. Please don't disclose publicly before we've had a chance
to patch.

## Honest limits

- **No external assessment has been done.** This is an in-codebase audit.
- **Part of the authorisation layer is invisible from here** (see above).
  That is the single biggest caveat on everything else in this document.
- **No CSP.**
- **No error tracking, logging or analytics of any kind is installed** —
  so there is no detection. An attack would be reconstructed from
  `audit_log` and Supabase's own logs, or not at all.
- **The audit log is application-trusted**, not append-only at the
  storage layer.
