# Backend integration — what is still open

Against `https://murchid-backend.onrender.com`. Pruned **2026-08-12**
to open work only — everything that shipped and verified (routes, batch
protocol, tool-calling chat, goal-plan, parse, image search, consoles,
metering) is catalogued in `new-docs/FEATURES.md`. The one unbuilt
spec: [backend/08-skills-refinement.md](backend/08-skills-refinement.md).

## How the two are connected (keep this working)

`API_PROXY_TARGET=https://murchid-backend.onrender.com` makes
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

1. **Build `POST /api/studio/skill-profile`, `skill_ids` on generate,
   and assignment-aware skill selection** — the full contract with
   request shapes, selection rules, and test plan is
   [backend/08-skills-refinement.md](backend/08-skills-refinement.md).
   The frontend calls all of it today and degrades gracefully.

2. **Gemini key is on the free tier** (~429 after ~20 requests/day).
   Enable billing with a spend cap before real teachers arrive — the
   studio's multi-kind batches and the chat's tool round-trips multiply
   call counts. Also worth surfacing `quota_exhausted` vs
   `rate_limited` as distinct `code`s; the frontend renders whatever
   `message` arrives.

3. **Resend is in test mode** — verification codes only deliver to the
   Resend account owner's address. Verify a sending domain before
   launch.

4. **`id` on `generate`'s `done` frame** (server-side persist). The
   dedicated quiz route already returns structured output; `generate`
   streams `artifact` frames but `done` carries no `id`, so the browser
   writes the library row itself. The frontend already reads `ev.id`
   when present — persist server-side and put the `ai_studio` uuid on
   `done`, and the studio links straight to the saved item with no
   frontend change.

5. **Per-field confidence in `/api/onboarding/parse`'s response** — the
   funnel wants to highlight low-confidence auto-filled fields for
   review; today it only gets the `found`/`missing` split.

6. **Cold starts.** Render's free tier spins down; first byte on a cold
   generate was ~6.2 s vs ~175 ms warm. The studio shows a streaming
   placeholder so it doesn't look frozen, but a paid instance or a
   keep-warm ping is the single biggest perceived-speed win available.

7. **Nit: the single-device check treats NULL as superseded.** A token
   whose `users.active_session_id` is NULL gets `401
   session_superseded`, while Postgres's own `is_current_device()`
   treats NULL as *unclaimed* and allows it. Harmless in practice
   (sign-in claims before anything else runs), but the two definitions
   should agree — yours is the stricter one.
