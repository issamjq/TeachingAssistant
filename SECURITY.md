# Murchid — Security policy

This document is a living record of what the app's security model **is**,
what it **isn't**, the **threats we explicitly defend against**, and the
**threats we knowingly accept or defer**. Anything not listed here is
unaudited.

> ## ⚠️ This document predates the Supabase migration and owes a rewrite
>
> Large parts of it describe a stack that no longer exists — an Express
> API on Render, Firebase Admin verifying tokens in middleware, and Neon
> Postgres. Three claims are now **inverted**, which is why this banner is
> here rather than a quiet note:
>
> - **Row Level Security is not "planned, not done" — it is the whole
>   authorisation layer.** There is no API in this repository. The browser
>   reads and writes Supabase directly and the policies are what stop one
>   teacher seeing another's rows. See [`db/tune.sql`](db/tune.sql).
> - **Auth is Supabase, not Firebase.** No Firebase Admin SDK, no
>   `requireAuth()` middleware, no `req.firebaseUser`.
> - **The database is Supabase, not Neon.**
>
> What has not changed: `credits`, `subscriptions`, `usage_logs`,
> `feature_flags` and `audit_log` are unwritable from the browser, and the
> privileged surface is SECURITY DEFINER functions gated on
> `is_super_admin()` — a teacher's token is refused by Postgres, not by
> hoping the UI hid a button ([docs/12](docs/12-super-admin.md)).
>
> Treat every specific below as needing verification against the code
> until this is rewritten in full.

## TL;DR

- All `/api/*` requests require a Firebase ID token verified by the
  Firebase Admin SDK on every call. No long-lived session tokens, no
  cookies, no homemade JWTs.
- Every teacher row is isolated by `teacher_id`. Cross-tenant reads and
  writes are blocked at the route layer; the database is a defence in
  depth, not the only line.
- Helmet + strict CSP, CORS allowlist, per-IP rate limiting, request
  timeout, body-size limits, and a sanitised error handler are wired
  into the request pipeline before any route runs.
- Every privileged action (sign-in, sign-up, plan change, admin
  mutations, dev flag toggles, school removal) writes an append-only
  row to `audit_log` with IP and user-agent.

## Threat model

### In scope (we defend)

| Threat | Where it's stopped |
|---|---|
| Stolen or forged auth tokens | Every `/api/*` call verifies a fresh Firebase ID token via `firebase-admin`. Forged tokens fail signature check; stolen tokens stop working ~1 hour after issue. |
| Cross-tenant data reads (teacher A reads teacher B's students) | `requireAuth()` loads `req.teacher` from the verified UID; every `crudRouter({ teacherScoped: true })` query carries `WHERE teacher_id = $1` automatically. Child-resource handlers (quiz questions, scores, submissions, completions) verify the parent's ownership before any read or write. |
| Cross-tenant data writes (teacher A overwriting teacher B's attendance row via ON CONFLICT) | Explicit `student_id` ownership check before every `INSERT … ON CONFLICT`. The `ON CONFLICT DO UPDATE` clauses now include `WHERE attendance.teacher_id = $1` so a stale row owned by another teacher can't be hijacked. |
| Privilege escalation to admin / dev endpoints | `/api/admin/*` and `/api/dev/*` are mounted with `requireRole("admin")` / `requireRole("dev")`. A 403 is returned without leaking which role is needed. |
| Self-lockout / self-deletion by admin | `PATCH /api/admin/teachers/:id/status` and `DELETE /api/admin/teachers/:id` refuse the operation when the target is the calling admin. |
| Subscription bypass | `requireAuth()` rejects with `403 subscription_expired` when the teacher's `subscription_ends_at` is past or status is `expired` / `suspended`. The status is flipped to `'expired'` automatically on first detection so admin queries surface lapsed accounts. |
| Brute-force / credential stuffing on auth endpoints | `express-rate-limit` caps `/api/auth/*` at 10 requests / 15 min / IP. The global limiter caps the rest at 300 req / 5 min / IP. |
| Injection (SQL) | Every query in the codebase is parameterised (`$1`, `$2`, …). The few queries that interpolate user input into the SQL string (`/api/dev/inspect/:table`) use a hardcoded allowlist. |
| Injection (XSS via stored content) | React auto-escapes JSX text. The two `innerHTML` writes (`SlideBuilder` rich-text editor and `export.docToHtml`) pass user content through `escapeHtml()` and only allow a whitelist of style attributes. |
| Open CORS to phishing origins | `Access-Control-Allow-Origin` is set per-request from the explicit `ALLOWED_ORIGINS` env var. Production refuses to boot without it. |
| Click-jacking | `X-Frame-Options: SAMEORIGIN` + CSP `frame-ancestors 'self'`. |
| MIME-type sniffing | `X-Content-Type-Options: nosniff`. |
| HTTP-only deployments | `Strict-Transport-Security: max-age=31536000; includeSubDomains; preload` in production. |
| Schema enumeration via Postgres error messages | Error handler returns a sanitised generic message in production; full message + stack only land in the server log along with a short correlation id. |
| Malformed / oversized request bodies | Global 2 MB JSON cap; helmet + body parser return 400 / 413 instead of 500. |
| Stuck handlers pinning workers | 25-second per-request timeout; the connection is destroyed and a 504 is returned to the client. |
| Boot-time misconfiguration | `validateEnv()` runs before `buildApp()`; missing `FIREBASE_ADMIN_KEY_B64`, malformed JSON, or `ALLOWED_ORIGINS` absent in production cause an immediate `process.exit(1)` with a readable log. |
| Unauthorised IP needs blocking | Every login records `last_login_ip` + `last_user_agent` on the teacher row, and `auth.login` / `auth.signup` writes an `audit_log` row. Admin can SQL-flip `status='suspended'` to revoke. |

### Defended at the platform (not by this codebase)

| Threat | Mitigated by |
|---|---|
| HTTPS termination | Vercel (frontend) + Render (backend) — both terminate TLS, neither permits HTTP. |
| Token storage on the client | Firebase JS SDK keeps the refresh token in IndexedDB (origin-isolated, not accessible from another origin). The short-lived ID token lives in memory; we never store it in `localStorage`. |
| DDoS at the edge | Vercel + Render front Cloudflare-style protection. Our in-app rate limit is the second line. |
| Account password compromise | Firebase Auth handles password hashing and reset flows. We never see passwords; we never store them. |
| Email verification | Firebase Auth flag (`email_verified` claim on the ID token). We can gate on it later by adding `if (!fb.email_verified)` in `requireAuth`. |
| MFA / 2FA | Firebase Auth supports it; toggle in the Firebase Console when desired. No app-side change required. |
| Service-account key rotation | Manual — see "What to do if a credential leaks" below. |

### Out of scope (knowingly deferred or accepted)

| Risk | Why it's deferred |
|---|---|
| Formal penetration test by a third party | Cost; defer until first paying customer or first 100 teachers. |
| Static analysis (SAST) in CI | Not configured yet. `npm audit` is the only tool in the loop. |
| Dependency-license audit | Not legally required at this stage. |
| Real-time anomaly detection on the audit log | The audit log captures the data; no alerting yet. A nightly query into a Slack webhook is the planned mitigation. |
| WAF rules (Cloudflare, AWS WAF) | Reverse-proxy layer at Vercel / Render is enough until traffic justifies more. |
| ~~Row-level security at the Postgres layer~~ | **No longer deferred — this is now the primary authorisation layer.** Tenant isolation is enforced by policies in `db/tune.sql`, not by application code, and there is no application layer left to enforce it in. |
| Encrypted-at-rest fields for PII (student records, guardian contacts) | Supabase encrypts the disk; column-level encryption would require key management we don't have yet. |
| Stripe / payment integration | Out of scope — subscription state is admin-managed for now (`subscription_status`, `subscription_ends_at`). |
| Replay-attack defence on the audit log via append-only Postgres triggers | Not implemented; the `audit_log` table is a regular table that admins with DB access can edit. The application never offers a DELETE endpoint for it. |

## Authentication & authorisation

### Token shape

The client uses Firebase Web SDK (`signInWithPopup` for Google /
Microsoft). On success the SDK gives us a short-lived ID token
(JWT, ~1 hour) and a long-lived refresh token (rotated by Firebase).

Every `api()` call reads the current ID token from
`firebase/auth.currentUser.getIdToken()` and attaches it as
`Authorization: Bearer <token>`. The SDK auto-refreshes when the
token has expired.

### Server-side verification

`backend/lib/auth.js#requireAuth()` runs `verifyIdToken(token)` via
the Firebase Admin SDK on EVERY request — signature, expiry, audience,
and revocation are all checked. The decoded claims land on
`req.firebaseUser`; the teacher row is loaded from Neon and attached
to `req.teacher`.

### Trust boundary

Everything that touches the database (CRUD helpers, hand-written
handlers) reads `req.teacher.id` for tenancy scoping. No code path
trusts a `teacher_id` value from the request body except the admin
routes, which check `req.teacher.role === 'admin'` first.

### Sign-out

Sign-out clears the local mock account object AND calls Firebase
`signOut()` so the refresh token is invalidated. A foreign sign-out
(token revoked from another device) is caught by the
`onAuthStateChanged` listener in `src/App.jsx` which then clears
local state and routes back to landing.

## Data isolation

### Teacher rows

- `teachers.firebase_uid` is `UNIQUE` (partial index, `WHERE NOT NULL`).
- `teachers.email` has a non-unique index for the upsert in
  `/api/auth/firebase`.
- Seed teachers (e.g. `Sara Al-Mansoori`) have `firebase_uid = NULL`
  and are unreachable through any real sign-in.

### Owned-resource tables

Every owned table carries a `teacher_id` column with a non-NULL,
`ON DELETE CASCADE` foreign key to `teachers(id)`. The `crudRouter`
helper stamps it from `req.teacher.id` on insert and includes
`WHERE teacher_id = $N` on every read / update / delete.

### Child-resource tables

For tables that don't have their own `teacher_id` (e.g.
`quiz_questions`, `quiz_scores`, `homework_submissions`,
`activity_completions`, `attendance`), the route handler verifies the
parent's ownership before any write. The `assertOwnsX(req, id)`
helpers in `quizzes.js`, `homework.js`, `activities.js` exist for
this. `attendance` and `quiz-scores` additionally verify
`student.teacher_id = req.teacher.id` because their UNIQUE keys
include `student_id`, so a foreign student would otherwise allow an
`ON CONFLICT DO UPDATE` to overwrite another teacher's row.

## Audit log

Schema: `audit_log (id, teacher_id, action, target_table, target_id, ip, user_agent, detail, created_at)`.

Recorded actions (the vocab is in `backend/lib/audit.js`):

- `auth.signup`, `auth.login`, `auth.renew`
- `admin.teacher.create`, `admin.teacher.active`,
  `admin.teacher.suspended`, `admin.teacher.deleted`,
  `admin.teacher.delete`
- `dev.flag.toggle`
- `school.remove`

Reads: `GET /api/admin/audit?teacher_id=&action=&limit=` — admin role
only. No DELETE endpoint exists; rows accumulate forever (retention
is an ops decision, not an app one).

PII discipline: `detail` is a small JSONB blob. Don't put names,
emails, or contact info there — link by id and let the forensic
query join back to the source row at read time.

## Headers (production)

```
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
Content-Security-Policy:    default-src 'self'; script-src 'self' https://apis.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https://*.googleusercontent.com https://*.firebaseapp.com https://images.pexels.com; connect-src 'self' https://*.googleapis.com https://*.firebaseapp.com https://identitytoolkit.googleapis.com https://securetoken.googleapis.com https://www.googleapis.com; frame-src 'self' https://*.firebaseapp.com https://accounts.google.com https://login.microsoftonline.com; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'; upgrade-insecure-requests
Referrer-Policy:            strict-origin-when-cross-origin
X-Frame-Options:            SAMEORIGIN
X-Content-Type-Options:     nosniff
X-DNS-Prefetch-Control:     off
```

Dev mode allows `'unsafe-inline'` and `'unsafe-eval'` for scripts so
Vite's HMR works. Production builds are strict.

## Rate limits

- Global: 300 req / 5 min / IP (skip `/healthz`)
- Auth (`/api/auth/*`): 10 req / 15 min / IP
- Response includes `RateLimit-*` headers (RFC 9239 draft) so a polite
  client can self-throttle.

`app.set("trust proxy", 1)` is set so Render's X-Forwarded-For chain
is honoured — without it every request would look like
`::ffff:10.0.0.1` and the limit would collapse the world into a
single bucket.

## Input validation

`backend/lib/validate.js` exports zod schemas for the auth endpoints,
schools, students, and the `/api/me` profile patch. Each mutating
route is wrapped in `validateBody(SchemaName)`; unknown keys are
silently dropped (`.strip()`), wrong types / oversized / regex
mismatches return `400 { error, issues: [{ path, message }] }`.

Admin and dev routes have inline schemas in their own files because
their vocabularies don't overlap with teacher-facing forms.

## What to do if a credential leaks

1. **Firebase admin service-account key**: Firebase Console → Project
   settings → Service accounts → ⋮ on the key → Delete. Generate a
   new one, paste the new base64 into `.env` locally and into Render
   env vars, redeploy.
2. **Microsoft client secret**: Azure portal → App registrations →
   Murchid → Certificates & secrets → delete + create new → paste new
   value into Firebase Console → Authentication → Sign-in method →
   Microsoft → Save.
3. **A user's Firebase session is suspected compromised**: revoke
   their refresh tokens via Firebase Console → Authentication → Users
   → ⋮ → Revoke refresh tokens. All their sessions across all devices
   stop working within a minute.
4. **DATABASE_URL**: rotate the database password (Supabase dashboard →
   Project settings → Database → reset password) and update `.env`. It is
   read only by the migration scripts — no deployment carries it, so
   nothing needs redeploying.
5. **Supabase publishable key**: it is public by design and carries no
   privileges; leaking it is not an incident. The **secret** key
   (`sb_secret_…`) is, and belongs in no file in this repository.

## Reporting a vulnerability

Email **security@murchid** (replace with your real address) with:

- A description of the issue
- Steps to reproduce
- The impact / what an attacker could do

We aim to acknowledge within 3 business days and fix critical issues
within 14 days. Please don't publicly disclose until we've had a chance
to patch.

## Honest limits

- **No formal pen-test has been done.** This document is the result of
  an in-codebase audit, not an external assessment.
- **No SAST / DAST tools run in CI** — `npm audit` is the only static
  check. New advisories may not be patched immediately.
- **Audit log is application-trusted, not append-only at the DB
  level.** A database compromise could rewrite history.
- **Subscription enforcement is purely DB-driven.** When real billing
  lands, the source of truth shifts to Stripe webhooks; until then,
  admins can extend / expire accounts via direct SQL.
