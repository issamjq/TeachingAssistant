# Murchid — concept (v2)

Most LMS products pile on features without a coherent structure. The bet here
is depth in one flow — AI-assisted term planning, end to end — over breadth,
with a simple, teacher-first path from "curriculum in" to "term scheduled
out." This doc is the source of truth for that shape until it earns its own
design-system doc the way the old build had one.

## Roles

- **super_admin** — grants access to sub-admins and organisations; oversees
  the whole platform.
- **sub_admin** — approves teachers within a delegated scope (a set of
  organisations, a region), assigned by a super_admin.
- **organisation** — an institution account. Verifies its own teachers'
  applications and provides identity proof to the platform itself.
- **teacher** — the primary user. Builds classes, plans terms, teaches.
- **student** — invite-only, no self-registration. Views their own classes,
  calendar, notes, doubts, quizzes/exams, results, attendance.

## Auth & verification

- Teachers sign in with Google (Supabase Auth, Google provider — unchanged
  from the prior build).
- A new teacher account starts `pending`. It becomes `active` only once
  approved by one of: the super_admin, a sub_admin, or the specific
  organisation the teacher applied to. Only an `active` teacher can create
  classes or add students.
- Organisations apply with identity/proof documents; a super_admin or
  sub_admin reviews and approves the organisation before it can approve its
  own teachers.
- Students never sign up. A teacher or the institution invites a student
  (email invite → account provisioned on accept). No invite, no login.
  Self-serve student access is explicitly deferred — see
  [FUTURE-SCOPE.md](FUTURE-SCOPE.md).

## Landing page (marketing, pre-login)

Hero, About, Purpose/value proposition, FAQ — one scrolling page, sign-in
CTA. Marketing changes still wait for the owner's visual sign-off (see the
deploy policy in the root [CLAUDE.md](../CLAUDE.md)).

## Onboarding

- **Teacher** — after first Google sign-in: institution name, staff ID
  (photo or number), syllabus type (CBSE, ICSE, … an open, extensible list,
  not a hardcoded enum). Submitting puts the account into `pending`.
- **Organisation** — applies with whatever identity/proof documents the
  platform requires; reviewed by a super_admin/sub_admin.

## Dashboard (teacher)

- **Overview** — the relevant graphs/stats at a glance. Exact metrics follow
  once the data model is in place.
- **Goal Planner** — the core pipeline, below.
- **My Classes** — Batch → Grade → Division → Subject. Each subject-class
  has: Lessons, Presentations, Activities, Homework, Notes & Text, Exams,
  Quizzes, Results, Attendance, Students list, Settings — one tab per
  Goal Planner output kind, plus the class-management tabs.
- **Profile → Settings**
- **Support** — a help screen plus a site-wide support assistant.

## The Goal Planner pipeline

1. Teacher provides input: a curriculum outline, a detailed prompt, source
   documents (textbooks, notes), or picks from the platform's shared
   material library (built up over time from institutions and
   universities).
2. AI generates a full term's material from that input: slide decks, notes,
   quizzes, exams, activities, homework.
3. Teacher reviews and edits the draft (see Studio assistants, below), then
   approves it.
4. On approval, everything is scheduled onto the calendar automatically —
   no manual re-entry.
5. Enrolled students get notified of what's coming; deadlines live on the
   underlying content itself (the homework, the quiz, the exam).

**Constraint, load-bearing:** if the AI doesn't have enough to go on — a thin
prompt, no curriculum, no reference material — it must ask the teacher for
the missing reference or detail instead of inventing curriculum content.
This applies at every generation step, not only the first one.

## Notes & doubts (inside a subject-class)

- A note/lesson document is either picked from the shared deck or uploaded
  and AI-extracted into structured text.
- Students raise a doubt anchored to a specific position in the document,
  not just appended at the bottom.
- Faculty or the AI can answer a doubt. An AI answer is provisional until a
  faculty member approves it; once approved it becomes visible to the whole
  class studying that subject, not just the asking student — so doubt
  threads accumulate into shared class material over time.
- A document can be copied from one class into another class/grade/batch
  when a teacher wants to reuse it, instead of rebuilding it from scratch.

## Studio assistants (scoped AI)

- Every lesson, exam, note, etc. has its own assistant scoped to just that
  record — a teacher edits that one artifact by prompting it, and the
  assistant has no reach beyond it.
- Separately, a site-wide assistant (the support bot) has full access
  across the teacher's own data and the site, for anything broader than
  "edit this one document."

## Super admin / sub admin / organisation consoles

Carried forward conceptually from the prior build: access grants,
approvals, oversight. Scope narrows going down the role list — super_admin
sees everything, a sub_admin sees their delegated scope, an organisation
sees only itself.

## Content storage — recommendation

- **Structured, queryable data** (attendance, results, rosters, quiz/exam
  schema, scheduling) → normal Postgres tables/columns in Supabase, with a
  JSON column only where a record's shape is genuinely variable (e.g. a
  quiz's question list). This is what RLS, indexing, and joins need.
- **Long-form generated text** (lesson notes, explanations, doubt answers)
  → Markdown, stored as a text column or in Supabase Storage, rendered
  client-side. Easy to diff, edit, and hand back to a Studio assistant as
  context.
- **TOON** (Token-Oriented Object Notation) is worth using as the wire
  format when sending structured context *into* the AI model — it's
  meaningfully cheaper in tokens than JSON for the same data — but it is not
  a storage format. Whatever comes back from the model still gets
  normalized into the two buckets above before it's persisted.

This is a recommendation, not yet locked in — say the word if you want it
different.

## Route map (Next.js App Router)

See the scaffolded segments under `app/`. Route groups: `(marketing)`,
`(dashboard)`, `(admin)`, `(portal)`, plus a real `onboarding/` segment
(not a group — its two pages need distinct URLs, `/onboarding/teacher`
and `/onboarding/organisation`, not the bare `/teacher` a group would
give them). Every page is
currently a thin placeholder; business logic lands in
`src/features/<feature>/` as each one is actually built, per the existing
project convention in [CLAUDE.md](../CLAUDE.md).
