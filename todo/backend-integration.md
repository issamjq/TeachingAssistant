# Backend integration — how the two halves connect

Against `https://murchid-backend-no24.onrender.com`.

**This is reference, not a task list.** The live queue is
[backend/00-open.md](backend/00-open.md); what follows is how the
frontend and the service are wired, which is the part worth keeping
accurate because breaking it takes the whole AI surface down at once.

## How the two are connected (keep this working)

`API_PROXY_TARGET=https://murchid-backend-no24.onrender.com` makes
`next.config.ts` rewrite `/api/*` to the service **server-side** — no
CORS, no preflight, the token never crosses an origin. **It must be set
in the Vercel project environment too**, or every AI path 404s in
production. It is deliberately not `NEXT_PUBLIC_`. Streaming works
through the rewrite (verified: chunks arrive incrementally).

The service also carries a hardcoded `ALLOWED_ORIGINS` list
(localhost:5173/3000 + murchid.com variants); any new domain must be
added there **and** to the Supabase redirect list.

The SSE vocabulary the frontend reads (reference):

```
data: {"type":"batch"|"status"|"scope"|"artifact_start"|"delta"|
       "artifact"|"artifact_end"|"done"|"error"}     generate (batch)
data: {"type":"session"|"tool"|"action"|"delta"|"done"|"error"}  chat
```

## Open items

**Moved.** The live queue is [backend/00-open.md](backend/00-open.md) —
one page, kept current, and the only thing to hand the backend team.

Of the seven items that were listed here, five shipped between 12 Aug
and 2 Sep: the 429 split, `id` on `done`, cold-start keep-warm (the
route exists; the pinger is an ops task), extraction, and the whole
phase 0–5 chain. What remains from this file:

- **`POST /api/studio/skill-profile`** and assignment-aware
  `skill_ids` — [backend/08-skills-refinement.md](backend/08-skills-refinement.md).
- **Per-field confidence in `/api/onboarding/parse`** — the funnel wants
  to flag low-confidence auto-filled fields for review; today it only
  gets the `found`/`missing` split. Cosmetic, and the reason it has
  never been urgent.
- **The single-device NULL nit** — a token whose `users.active_session_id`
  is NULL gets `401 session_superseded`, while Postgres's own
  `is_current_device()` treats NULL as *unclaimed* and allows it.
  Harmless in practice, since sign-in claims before anything else runs,
  but the two definitions should agree.

This file stays for the section above it: the proxy arrangement, the
`ALLOWED_ORIGINS` list and the SSE vocabulary are reference, not tasks.
