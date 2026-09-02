# 09 · Phase 0 — operational unblocking

> **Status (2026-09-02): 🔴 OPEN — this file is the request.** The
> frontend half of Phase 0 shipped today (timeouts on every AI call, a
> Retry that replays materials, an abortable recovery poll, the
> password-reset screen). Nothing below is code the frontend can write:
> all four items live in the backend service or in a provider dashboard.

No new endpoints. Four changes, in severity order. Items 1–3 are why
sign-up and generation are unreliable for anyone who is not the
developer; item 4 closes a data race that already exists.

Requires the same auth, single-device gate and credit metering as every
other route — see [00 · Setup](00-setup.md) if it exists, and §5 below
for the parts of the contract these items touch.

---

## §1 · Gemini is on the free tier

**Symptom.** Around the twentieth generation *for the entire product,
per day*, every teacher gets a 429. The frontend renders whatever
`message` arrives, verbatim, because it cannot tell quota exhaustion
from rate limiting (§3).

**Do.** Move the key to a paid tier. This is a billing change, not a
code change, but it gates every other AI item in the roadmap — Phase 1
and Phase 2 both increase generation volume.

---

## §2 · Resend is in test mode

**Symptom.** Email verification codes deliver **only to the Resend
account owner's address**. Every teacher who signs up with email and
password never receives a code, and the funnel sits on the
"Enter your 6-digit code" screen forever.

**Do.** Verify a sending domain in Resend and switch off test mode.

**Related, and not ours to fix from the frontend:** Supabase Auth still
has **Confirm email ON** (`mailer_autoconfirm: false`). That makes
`signUp()` return a user with **no session**, so the very next call —
`POST /api/auth/email-verify/send` — has no bearer token to send. Turn
it off in the Supabase dashboard (Authentication → Providers → Email).
Until both are done, email sign-up is degraded for everyone.

---

## §3 · Distinguish quota from rate-limiting on 429

**Now.** A 429 returns a raw provider message that reaches the teacher
unedited.

**Do.** Return the standard error envelope with a machine code:

```json
{ "error": "Murchid's AI is at today's limit. It resets at midnight UTC.", "code": "quota_exhausted" }
```
```json
{ "error": "Too many requests at once — try again in a few seconds.", "code": "rate_limited" }
```

Both as HTTP 429. The frontend branches on `code`; `rate_limited` is
worth retrying immediately, `quota_exhausted` is not, and today it
cannot tell the difference so it offers Retry for both.

---

## §4 · Emit `id` on the `done` frame of `/api/studio/generate`

**Now.** The `done` frame carries `quiz`, `slides`, `structured` — but
no row id. So the **browser** writes the library row itself, and a
stream that dies after the service has already saved leaves an orphan:
the service's row and the browser's row, both for one generation.

**Do.** Include the persisted `ai_studio` uuid:

```
data: {"type":"done","id":"<uuid>","batch_id":"<uuid>"}
```

The frontend already reads `ev.id` and skips its own write when it is
present. This is a one-field change that closes the race.

**While you are there — the obligation this depends on.** Every
generated row must carry the `batch_id` you announced on the `batch` /
`artifact_start` / `done` frames, and must be **persisted before the
response ends**. A proxy cut at ~30s kills the stream, not the work: the
frontend polls the library for that `batch_id` for 60 seconds before it
declares failure, and turns anything it finds into a finished,
already-saved turn. If rows are written after the response closes, that
recovery finds nothing and the teacher is told her work was lost when it
was not.

---

## §5 · Contract notes these items touch

Everything here is already true in production; it is repeated because
`docs/07-api.md` in the frontend repo is **stale** (it describes a
deleted in-repo Express server) and should not be used as a reference.

### Transport and auth

- The browser calls its own origin. `next.config.ts` rewrites `/api/*`
  to `API_PROXY_TARGET` server-side, so headers pass through verbatim
  and there is no CORS preflight.
- Auth is `Authorization: Bearer <Supabase access token>`. Verify
  against the project JWKS; `sub` is `auth.uid()`. Resolve `faculty_id`
  the way Postgres's `current_faculty_id()` does.
- `X-Session-Id` is sent on plain JSON calls but **not** on SSE streams.
  Do not require it there.

### SSE framing

```
data: {"type":"delta","kind":"lesson_plan","text":"…"}

: keep-alive

data: {"type":"done","id":"<uuid>","batch_id":"<uuid>"}
```

- One JSON object per `data:` line, **single line only** — the client
  reads just the first `data:` line in a frame.
- Frames separated by a blank line. `: comment` keep-alives are ignored
  safely and reset the client's idle timer.
- **New in this phase:** every AI call now carries a timeout —
  `firstByteMs: 45s`, `idleMs: 90s`. Previously only the studio did, and
  the rest waited forever. **Send something more often than 90 seconds
  while thinking**, or a long generation will be cut by the client.
- An `{"type":"error"}` frame after a 200 does not abort the read — the
  stream drains and the error is thrown at the end. Add
  `"refusal": true` for a model refusal, which the studio renders as an
  answer and does not invite a retry for.

### Error bodies

```json
{ "error": "A sentence shown verbatim to the teacher.", "code": "machine_code" }
```

**Always include `code` on a 404.** A 404 with no code on a server-only
path is rewritten by the frontend into "this part of Murchid needs the
API service, which isn't connected yet" — the wrong message entirely for
a record that genuinely does not exist.

### Materials

The browser sends only `{ id, name }`. Resolve bytes yourself: read
`public.materials` by id, verify `faculty_id`, take `file_path`, and
download from the private `imports` bucket with the service credential.
Report anything unreadable in `unread_materials`, echoing the **exact
display names** you were sent — generation should still succeed without
them.

### Credits

The service charges from real token counts via
`consume_credits(feature, ref)`; the browser never bills and learns the
new balance by refetching. Current costs: `lesson_plan` 6,
`goal_plan` 4, `presentation` 3, `materials` 3, `quiz` / `homework` /
`activity` / `template` / `regenerate` 2, `quiz_tweak` / `bulletin` /
`skill_profile` 1, `chat` and `scheduling` 0. Also fill the
`usage_logs` token columns — only the service can see them.

Keep the service's `estimateCredits()` in step with the frontend's
`estimateFor()` in `src/features/studio-ai/CreditMeter.jsx`, which
mirrors it to show a pre-flight estimate.

---

## §6 · Not a backend item, but part of Phase 0

`/api/keepwarm` exists in the **frontend** repo
(`app/api/keepwarm/route.ts`) and pings `API_PROXY_TARGET` server-side.
Nothing calls it on a schedule, so Render still cold-starts (~6.2s to
first byte vs ~175ms warm) on the first request of the day.

Point any free external pinger at
`https://<the-vercel-domain>/api/keepwarm` every ~10 minutes
(cron-job.org, UptimeRobot, or a GitHub Actions schedule). Vercel's own
crons on Hobby run at most daily, which is far too slow. A paid
always-on Render instance supersedes this entirely.

---

## Definition of done

- A teacher on a fresh email address receives a verification code.
- A forgotten-password link opens `/reset-password` and actually sets a
  new password. *(Frontend side shipped; this only needs §2's mail to
  arrive.)*
- The twenty-first generation of the day succeeds.
- A 429 tells the teacher whether waiting will help.
- A generation whose stream is cut at 30s leaves exactly one library
  row, and the teacher sees it as saved rather than failed.
