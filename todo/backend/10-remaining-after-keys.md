# Everything still open on the backend, after Keys

Compiled from: `final/backend`'s own scope note (only Keys is on that
branch), the older `backendv2`/`main` branches (read via GitHub access,
not merged anywhere), and this repo's own `todo/backend-integration.md`
and `08-skills-refinement.md`. Superseding `00-open.md` where the two
disagree, since that file describes `backendv2`'s feature set and
`final/backend` — the one actually deployed — doesn't have most of it.

## 1. The decision that scopes everything below

`final/backend` is a deliberate scaffold: boot, auth, health, the key
pool. 2,700 lines, against 18,700 on `backendv2`. Nothing else was
ported over on purpose — not because it's broken, but because it reads
a schema (`faculty`, `ai_studio`, `subscriptions`, `teaching_skills`, …)
that no longer matches the rebuilt frontend's `profiles`/`classes`/
`batches`/`grades`/`divisions`/`materials`/`goal_items`/`assessments`.

Before picking up any item below, decide: reconnect the old routes
against the new schema, rebuild each from scratch against it, or some
mix. `backendv2` and `main` are both intact and readable on GitHub if
reusing logic from either is worth it — nothing there was deleted.

## 2. Not reachable at all right now

Every one of these exists on `backendv2`/`main` but isn't on
`final/backend`, so calling it 404s — not "broken," just not deployed.
This is also why every studio composer bar in the current frontend
simulates its output with a `setTimeout`: there's nothing real to call.

| Feature | Old route(s) | Notes |
|---|---|---|
| AI generation (lessons, decks, quizzes, homework, activities, exams) | `POST /api/studio/{generate,quiz,quiz-tweak,regenerate}` | The main one — everything the composer bars are waiting for |
| Studio conversation agent | `POST /api/studio/agent` | "Make the AI Studio a conversation rather than a pipeline" |
| Chat assistant | `POST /api/chat` | Separate from the studio routes |
| Onboarding document parsing | `POST /api/onboarding/parse` | CV/document → structured profile fields |
| Curriculum derive | `POST /api/curriculum/derive` | Syllabus upload → term structure. Logic was verified against a real CBSE syllabus on `backendv2`; the HTTP route itself was never exercised end-to-end even there |
| Corpus / grounding | `POST /api/corpus/search` + injection into generation | Ingest + search shipped and were verified (scope wall, tenant isolation) on `backendv2`; injecting retrieved passages into prompts was the one piece never finished even there |
| Materials extraction (OCR/text) | `POST /api/materials/:id/extract`, `POST /api/materials/extract-pending` | This is what the current frontend's "paste the extracted text yourself" honesty notice (Notes tab, shared library) is standing in for |
| Template library + moderation | `/api/library/*` | See `docs/templates.md` on the backend repo |
| Billing / Stripe checkout + webhook | — | Whole billing system, gone with the rewrite |
| Student invites | Brevo-based invite email | Class-named invite links |
| Skill-profile refinement | `POST /api/studio/skill-profile` | See §3 below — this one needs a bigger call than "reconnect" |
| Images compatibility tail | `GET /api/images/:id` | Marked "compatibility tail only" even on `backendv2` |

## 3. `08-skills-refinement.md` is orphaned, not just unbuilt

That spec targets `/teaching-skills`, a `teaching_skills` table, and a
`skill_assignments` table keyed on `faculty_id` — none of which exist
in the rebuilt frontend. It's not "next in the queue," it's a spec for
a feature the current frontend doesn't have a UI for at all. Worth
reading for the *shape* of assignment-aware grounding (a skill applies
where grade/section/subject match, or globally if unassigned) if a v2
equivalent gets designed, but the table names and request/response
shapes in that file don't map onto anything live today.

## 4. Product decisions needed before code

- **Single-device session enforcement.** Removed in the auth fix
  because `users.active_session_id` doesn't exist in the new schema and
  enforcing it only in the backend while the browser's own direct
  Supabase writes go unchecked would be theatre. If this still matters:
  design the column + RLS predicate on the new schema **first**, then
  add the backend check second — not the other way round.
- **`estimateCredits()`'s rule for a multi-document lesson.** Asked in
  `00-open.md`: the composer quoted ~6 credits, the real spend was 9
  (a lesson plan + student notes, +5 and +4). Whatever answers this
  needs to exist before credits/billing comes back at all.
- **Gemini's tier.** Still free as of the last note; blast radius is
  smaller than once thought since generation runs a separate provider
  and Gemini now only serves embeddings — but retrieval quality is
  gated on this until it's decided.

## 5. Ops, not code

- A **Brevo-validated sender address** — until one exists, Brevo
  answers 201 and silently drops every email.
- A **scheduled pinger on `/api/keepwarm`**, every ~10 minutes. The
  route already exists and answers 200; this is a monitor to point at
  it, not a build.
- **`EMBEDDING_API_KEY`/`GEMINI_EMBED_MODEL`** in the backend
  environment, if retrieval comes back — currently falls back to
  `GEMINI_API_KEY`.

## 6. Worth re-verifying once the relevant routes come back

These were real, specific bugs on `backendv2`/`main`. They may or may
not survive into whatever replaces those routes — flagging so nobody
assumes they're already fixed just because the code they lived in is
gone:

- **A real 404 must carry a `code` field.** Without one, the frontend's
  own error handling can't distinguish "this genuinely doesn't exist"
  from "not connected yet," and renders the more alarming message for
  both.
- **An SSE heartbeat** (a `:` comment frame at least every ~90s) on any
  streaming route. Its absence meant a slow-thinking model on a long
  turn got killed mid-generation once the frontend's own 90s idle
  timeout fired.

## 7. Not backend, but adjacent and still open

The privacy policy needs a line added once generation reads class-level
performance (marks/submissions) to ground lessons — the current wording
promises it doesn't. Written and sitting on branch
`privacy-performance-line` in the old repo history, waiting on whoever
owns product copy. Only relevant once grounded generation (item 2,
Corpus row) actually ships.
