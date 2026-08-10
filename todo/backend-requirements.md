# Backend requirements

What the separate backend project has to provide. The Express API that
used to live in `backend/` is gone; this is everything it did that the
browser cannot.

**The test for whether something belongs here:** it needs a secret, or a
privilege, that a browser must never hold. Anything else already talks to
Supabase directly — see `src/lib/data/`.

## Implementation guides

This file is the map. `todo/backend/` has one file per feature with the
Node.js to write:

| | | |
|---|---|---|
| [00 · Setup](backend/00-setup.md) | project skeleton, auth, db, deploy | **start here** |
| [01 · AI Studio](backend/01-ai-studio.md) | generation, streaming, metering | the headline feature |
| [02 · Document parsing](backend/02-document-parsing.md) | CV and staff-ID reading | |
| [03 · Email verification](backend/03-email-verification.md) | sign-up codes | unblocks email sign-up |
| [04 · Admin consoles](backend/04-admin-consoles.md) | the five dashboards | |
| [05 · Images](backend/05-images.md) | uploads | mostly "do it in the browser" |
| [06 · Assistant](backend/06-assistant.md) | studio tool-calling | optional |

Suggested order: **00 → 03 → 01 → 02 → 04**. 03 is small and unblocks
email sign-up; 01 is the feature teachers are paying for.

---

## What already works without you

Do not rebuild these. 38 paths now go from the browser straight to
Postgres over PostgREST, with Row Level Security doing the authorisation
the API used to do in middleware:

profile · dashboard · students · classes · register · timetable ·
gradebook · notifications · schools · uploaded material · and all six
kinds of generated work (lesson plans, quizzes, homework, presentations,
activities, templates) including trash, restore, quiz questions and the
per-student submission grids.

RLS is on all 28 tables. 26 carry owner policies; `audit_log` and
`email_verifications` have RLS enabled with **no policy at all**, which
denies every client outright — they are yours alone.

---

## 1 · What you must implement

Base path `/api`. The frontend reaches you through `API_PROXY_TARGET`
(see §5). Every request arrives with a Supabase access token on
`Authorization: Bearer …`; verify it against the project's JWKS.

### 1.1 AI generation — `/api/studio/*`

Holds the model API key. This is the only reason these are not client
calls.

| Method | Path | Notes |
|---|---|---|
| POST | `/api/studio/generate` | Streams SSE. Body `{ kind, prompt, materials? }`. Frames: `{type:"delta",text}`, then `{type:"done",kind,stop_reason,usage}` |
| POST | `/api/studio/quiz` | Two model calls — a draft, then a pass that structures it into questions |
| POST | `/api/studio/quiz-tweak` | Edit an existing quiz |
| POST | `/api/studio/regenerate` | Redo one section |

- Gate on the `ai_studio` feature flag in `feature_flags` (off by default).
- **Write `usage_logs` on every call** — `user_id, model, operation,
  tokens_in, tokens_out, cost_usd`. Bill *both* model calls on the quiz
  path; charging one under-reports by about half.
- Decrement `credits.balance` with `GREATEST(0, balance - n)` so a
  teacher who runs out mid-generation still finishes the one they are in.
- The client saves the result itself, via Supabase. You do not write
  `ai_studio`.

### 1.2 Document reading — `/api/onboarding/parse`

| Method | Path |
|---|---|
| POST | `/api/onboarding/parse` |

Body: `{ documents: [{ name, text }] }` **or**
`{ documents: [{ name, mediaType, dataBase64 }] }`.

The browser extracts a PDF's text layer itself (`pdfjs-dist`) and sends
text when there is any — ~231 prompt tokens instead of thousands. It
sends bytes only for scans and photographed ID cards, which have no text
layer. Support both.

Returns `{ fields, found, missing }`. Fields: `first_name, last_name,
staff_id, email, phone, school, majors[], grade_levels[], languages[],
nationality, bio`.

- Fence uploaded text in a `<document>` tag. It comes from a stranger's
  file, and a CV containing "ignore the above" must read as a document
  that says something odd, not as an instruction.
- Accept `image/png|jpeg|webp|gif` and `application/pdf`. ~5 MB per file.
- The browser uploads the original to Supabase Storage under the
  teacher's own session and passes `filePath`; record it in
  `onboarding_documents` with the extracted fields as `extracted_data`.
- Must be authenticated but must **not** require a `faculty` row — it
  runs during sign-up, before one exists.

### 1.3 Email verification — `/api/auth/email-verify/*`

| Method | Path |
|---|---|
| POST | `/api/auth/email-verify/send` |
| POST | `/api/auth/email-verify/check` |

A 6-digit code proving an address before an account exists. Store it
bcrypt-hashed in `email_verifications`, never the digits.
That table has RLS enabled with **no policy**, so it is unreachable from
any client — it is yours alone.

Rate-limit both hard. They are the only guessable endpoints left.

> **Everything else under `/api/auth` is gone, not moved.** Sign-in
> provisioning and single-device claiming are now the database's job:
>
> - `provision_faculty()` fires on INSERT to `faculty` and creates the
>   credits balance and the trial subscription. SECURITY DEFINER, so it
>   writes tables the browser cannot — a teacher must not be able to
>   grant themselves a plan. The browser creates only its own `faculty`
>   row; everything it is entitled to follows.
> - Claiming a device is one UPDATE to `users.active_session_id`.
>
> Do **not** rebuild `/api/auth/supabase` or `/api/auth/claim-session`.
> `src/lib/data/entities.ts` handles both.

`POST /api/auth/renew` is still yours — changing plan is a payment, and a
teacher cannot write `subscriptions`.

### 1.4 Privileged consoles

| Prefix | Role |
|---|---|
| `/api/admin/*` | admin, super_admin, dev |
| `/api/superadmin/*` | super_admin, dev |
| `/api/owner/*` | owner, super_admin, dev |
| `/api/moe/*` | moe, super_admin, dev |
| `/api/dev/*` | dev |
| `/api/teachers/*` | admin, super_admin, dev |

Endpoints the frontend calls: `admin/{stats,dashboard,teachers,signups}`,
`admin/teachers/:id/{role,status}`, `superadmin/{overview,signups,logins,
recent-activity}`, `superadmin/account/:id[/permissions]`,
`owner/{overview,signups,activity}`, `moe/{overview,schools,content-trend}`,
`dev/{feature-flags,system-stats,health-detail,inspect/:id,account/:id}`.

Two things make these server-only: they read across *all* teachers, which
RLS forbids, and they write `audit_log`, which no client can reach.

**Reporting views already exist in the database.** `accounts`, `drafts`,
`quizzes`, `homework`, `presentations`, `activities`, `templates` and
`account_schools` are views over the real tables, presenting the old flat
shape. Reads work unchanged. **Writes do not** — a view over three tables
is not auto-updatable, so it fails loudly. Write to `users`, `faculty`
and `subscriptions` directly.

An admin **cannot create a teacher.** `users.id` is FK'd to `auth.users`,
and minting an auth user needs a service-role key. Attach a role to
someone who has already signed up, and say so when they have not.

### 1.5 Images — `/api/images/*`

`POST /api/images/upload`, `GET /api/images/:id`. Currently base64 in a
table. Better: have the browser upload to the `imports` bucket and store
only the path — the bucket and its policies already exist.

### 1.6 The assistant (optional, was working)

Deleted from this repo but in git history at `backend/routes/chat.js`,
`lib/chatTools.js`, `lib/chatKnowledge.js`. The landing bot answers from
`src/features/assistant/knowledge.json` in the browser and needs nothing
from you. The **studio** assistant did: tool-calling that could read a
teacher's counts and create real lesson plans.

If you port it: scope must be derived from whether the request
authenticated, never from the body, or a visitor can ask for the tools.
There was deliberately no delete tool. Gemini attaches a
`thoughtSignature` to a function call and rejects the next turn with 400
unless it is echoed back verbatim.

---

## 2 · The two gates — implemented, in RLS

Both used to be Express middleware. They are database predicates now, so
they hold even though the browser talks to Postgres directly. Do not
re-implement them; do respect them.

`db/tune.sql` §27–28.

### `is_current_device()`

Every Supabase access token carries a `session_id` claim, unique per
sign-in. The check compares it to `users.active_session_id`. The claim is
inside the signed token, so it cannot be forged and needs no custom
header.

- Claiming is one UPDATE, plus `signOut({ scope: "others" })` to revoke
  the other device's refresh token.
- A NULL `active_session_id` means "not claimed" and is allowed — accounts
  predating this, and the moment between signing in and claiming, must not
  be locked out.
- **Last sign-in wins.** A superseded device can sign in again and take
  over. That is takeover, not a ban.
- Gated on **reads as well as writes**: sharing one account across a
  staffroom is what this exists to stop, and reading is most of what
  would be shared.

### `subscription_active()`

- **Reads are never blocked.** A teacher whose card failed must still be
  able to open, export and print a term's work. Holding someone's own
  work hostage over a payment is hostile and, in several jurisdictions,
  unlawful.
- **Writes are.** That is the product boundary.
- `past_due` counts as active, a NULL end date is open-ended, and there
  are three days of grace past the end. A late webhook must not lock out
  a paying customer.
- Privileged roles are exempt — they do not pay.

`users`, `faculty`, `subscriptions`, `credits`, `notifications`,
`onboarding_documents` and the chat tables are deliberately **not** gated.
A locked-out teacher has to be able to read their own account, or the app
cannot tell them why the screen is empty.

**If you add a table**, add all four policies. A single `FOR ALL` policy
re-opens both gates for that table. And drop existing policies by
enumeration, not by name — policies are OR'd, and a survivor from an
earlier schema silently grants what the new ones refuse. That exact bug
let a superseded device keep reading every lesson plan here.

## 3 · Secrets you need

| Variable | For |
|---|---|
| `DATABASE_URL` | Supabase **pooler** string, port 6543. The direct host is IPv6-only and Render cannot reach it. Do **not** append `sslmode=require` — pin the CA instead (`db/supabaseCa.js` here shows how) |
| `SUPABASE_URL` | JWKS for verifying access tokens |
| `GEMINI_API_KEY` *or* `ANTHROPIC_API_KEY` | Generation and CV parsing |
| `RESEND_API_KEY` | Verification emails |
| `ALLOWED_ORIGINS` | CORS allowlist — the frontend's origin |

**No service-role key.** The old backend deliberately held none: a leaked
service key *mints* tokens, not merely reads rows. Verify signatures with
the public JWKS. If you later need one for admin work, keep it in a
separate process from anything a request can reach.

---

## 4 · Things that will bite

Each of these cost real time here.

- **PostgREST cannot merge jsonb.** Sending `content` on a PATCH
  *replaces* it. Read, merge, write.
- **`ON CONFLICT` cannot target a partial index.** Attendance
  idempotence needed a generated column (`schedule_key`) folding "no
  session" into a fixed uuid so one ordinary constraint covers both cases.
- **A 204 from PostgREST is not proof a write happened.** With RLS
  filtering every row, an UPDATE that changes nothing returns 204. Verify
  through a privileged connection before believing a policy failed.
- **Gemini retires model names fast.** A pinned name 404'd within an
  hour of being written. Use the rolling alias (`gemini-flash-latest`)
  and make it env-overridable.
- **Policies are OR'd, and dropping them by name is fragile.** A
  leftover policy from an earlier schema grants what a new one refuses,
  and the list looks right unless you count it. Enumerate `pg_policies`
  and drop everything on the table first.
- **`users.id` is FK'd to `auth.users`.** Nothing can create a user row
  for someone who has not signed up. `students.user_id` is nullable for
  exactly this reason — a teacher types in a register long before those
  children have accounts, and `invitations` is the path by which one
  becomes a user.

---

## 5 · Wiring it to this frontend

Set `API_PROXY_TARGET` to your backend's origin in the Vercel project.
Next rewrites `/api/*` to it server-side, so the browser stays
same-origin and there is no CORS preflight.

**With the variable unset there is no rewrite at all** and those paths
404 as themselves. That is deliberate: the old default proxied into a
void and surfaced as an HTML error page, which the client could not read
and reported as a generic failure.

`src/lib/data/index.ts` lists the prefixes that reach you —
`SERVER_ONLY`. Anything not in that list is answered from Supabase and
must not be implemented.

---

## 6 · Database

Schema lives in `db/tune.sql` here (`npm run db:tune`), reference data in
`db/seed.js` (`npm run db:seed`). Both are idempotent and run in one
transaction.

Move them to the backend project if you would rather own migrations
there. They are kept here for now because this frontend's data layer
depends on the exact shape — the column renames it translates
(`section`↔`division`, `category`↔`label`, `majors`↔`expertise`,
`grade_levels`↔`eligible_grades`) are only correct against this schema.
