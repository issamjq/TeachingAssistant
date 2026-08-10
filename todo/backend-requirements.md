# Backend requirements

What the separate backend project has to provide. The Express API that
used to live in `backend/` is gone; this is everything it did that the
browser cannot.

**The test for whether something belongs here:** it needs a secret, or a
privilege, that a browser must never hold. Anything else already talks to
Supabase directly — see `src/lib/data/`.

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

### 1.3 Auth bootstrap — `/api/auth/*`

| Method | Path | Notes |
|---|---|---|
| POST | `/api/auth/supabase` | First sign-in. Body `{ plan }` |
| POST | `/api/auth/claim-session` | Rotate the single-device session |
| GET | `/api/auth/me` | The account, from the token alone |
| POST | `/api/auth/renew` | Change plan |
| POST | `/api/auth/email-verify/send` | 6-digit code, bcrypt hashed |
| POST | `/api/auth/email-verify/check` | Verify it |

`/api/auth/supabase` must create, idempotently and in one transaction:

1. `users` — normally the `handle_new_user` trigger's job, but that
   trigger swallows its own errors by design, so do not assume it ran.
2. `faculty` — `ON CONFLICT (user_id) DO NOTHING`.
3. `credits` — 200 balance and allowance.
4. `subscriptions` — plan, status, `trial_ends_at`.

**Key on the auth uid, never the email.** Two providers can hand over the
same address; merging on it joins two different people into one account.

Plans come from `src/lib/plans.js`: `trial` (7 days), `monthly` (30),
`quarterly` (90), `annual` (365). Subscription status uses Stripe's
vocabulary — `trialing`, not `trial`. The CHECK constraint enforces it.

`email_verifications` is RLS-denied to clients, so only you can read it.
Codes are bcrypt hashes, never the digits. Rate-limit `send` and `check`
hard — they are the only guessable endpoints.

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

## 2 · Two enforcement gaps — decide before you build

Both lived in Express middleware. **Neither is enforced now**, and no
amount of backend work fixes them alone, because the browser reaches
Postgres without passing through you.

### Single-device sign-in

`users.active_session_id` held the one session allowed to act, and
`requireAuth` compared it to an `X-Session-Id` header. Direct Supabase
access does not carry that header, so an old device keeps working.

To keep it, it has to become an RLS predicate — the policies would need
to compare a session claim in the JWT against the stored id. Otherwise
the feature is gone; say so in the UI rather than leaving a promise the
system no longer keeps.

### Subscription expiry

`requireAuth` rejected an expired teacher. The RLS policies only ask *is
this yours*, never *are you paid up* — so an expired teacher can still
read and write their own data.

To keep it, add a subscription check to the owner policies, e.g.

```sql
USING (
  faculty_id = current_faculty_id()
  AND EXISTS (
    SELECT 1 FROM subscriptions s
     WHERE s.faculty_id = current_faculty_id()
       AND s.status IN ('trialing','active')
  )
)
```

Weigh it: applied to every table it is also the fastest way to lock a
paying customer out over a webhook that arrived late.

---

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
