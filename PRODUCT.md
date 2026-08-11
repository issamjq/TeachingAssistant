# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

**Primary — and the one design optimizes for: the classroom teacher.** KG
through G12, UAE-focused first (English-medium, with Arabic in the product
today), but not UAE-only. One teacher per account. They arrive with a real
timetable, a real roster, and a finite window between classes.

The five portal/console surfaces (`admin`, `owner`, `moe`, `superadmin`,
`dev`) exist and are real screens, but they are **administrative plumbing**.
They must stay coherent and usable; they do not set patterns, do not lead
design decisions, and should not pull attention away from the teacher
studio.

## Product Purpose

Murchid ("director" in Arabic) is an AI lesson director. It helps a teacher
prepare, organise, and reuse the material a teaching week actually consumes:
lesson plans, presentations, quizzes, homework, activities, marks, and
reports. Success is a teacher finishing preparation faster than they would
have alone, with material they are willing to put in front of a class
unedited.

The name refers to the **product**, not to the AI assistant inside it.

## Positioning

**Open decision — deliberately not settled.** The differentiating mechanism
has not been committed to. Three candidates are live in the product's own
evidence and none has been chosen: that it knows the teacher's actual
classes (roster, timetable, marks, attendance are in the product); that plan
→ present → quiz → homework → grade → report is one connected chain rather
than eight disconnected generators; that UAE/MoE curriculum shape is native.

Future work must **not** invent a positioning claim to fill this gap, and
must not write marketing copy that asserts one. Resolve it with the owner
first.

## Operating Context

A teacher's day spans multiple subjects, grades, and class sections. The
product is used in the gaps around teaching, on a laptop, under time
pressure — not in a long uninterrupted design session.

- **The studio** is the workspace: dashboard, planner, lesson plans,
  presentations, quizzes, homework, activities, goals, schedule, reports,
  student database (roster, attendance, grades, scores), bulletin board,
  account, and an AI assistant.
- **The landing page** is the marketing surface at `/`, a separate world
  from the studio.
- Terminology that is product-factual: **templates** (reusable lesson
  skeletons), **drafts** (work-in-progress plans, private to the teacher,
  carrying a status of `In progress | Ready to use | Blocked | Paused` plus
  progress and warnings), **term**, **section**, **roster**.

## Capabilities and Constraints

- Next.js App Router frontend on Supabase. The browser reads and writes
  Supabase directly; **Row Level Security is the authorisation layer**, not
  application code.
- Endpoints needing a secret — AI generation, CV parsing, the assistant, the
  privileged consoles — live in a **separate backend service** and are
  reached through a server-side rewrite. AI paths therefore depend on
  deploy-time configuration and can fail independently of the UI.
- `credits`, `subscriptions`, `usage_logs`, `feature_flags`, and `audit_log`
  are deliberately not writable from the browser. A teacher cannot top up
  their own balance or extend their own plan.
- **Bilingual: English and Arabic** are both shipped, with RTL handling.
  Copy is dictionary-backed; new user-facing strings are a translation
  obligation, not a literal.
- Every list screen currently loads its full set and filters client-side.
  Correct at teacher scale, wrong at console scale — a known constraint on
  designs that assume large result sets.
- Frontend is mid-migration (Vite → Next.js/TypeScript/Tailwind/CSS
  Modules). New work goes in `src/features/<feature>/`; `src/views/*` is
  legacy being dismantled route by route.
- No error tracking, logging, or analytics of any kind is installed.
  Designs must not assume behavioural data exists.

## Brand Commitments

- **Name:** Murchid. Product, not assistant.
- **Voice:** editorial, calm, paper-like. Not a chirpy edtech tone, not a
  generic SaaS dashboard tone.
- **Binding visual constraints already committed in code** (recorded here as
  product facts, not as a visual specification): cream paper background,
  Fraunces serif headings with a single red italic accent word, uppercase
  tracked mono eyebrows, Inter Tight body, Amiri for Arabic. Visual quality
  is judged against polished editorial design references.
- **Accessibility is a shipped product feature**, not a checklist: a native
  accessibility toolbar offers text scaling, readable font, letter/word/line
  spacing, contrast, grayscale, low saturation, three colour-blindness
  filters, large cursor, link highlighting, motion stop, and read-aloud,
  persisted per device. New surfaces must not break it — in particular, it
  portals outside `#root` so the visual filters applied to `#root` don't
  affect it.

## Evidence on Hand

Confirmed real, and usable:

- **The working product itself.** It runs end to end. `npm run db:demo`
  fills a real account with a full term — roster, timetable, marks,
  attendance, a nine-week library — plus a second deliberately empty account
  for empty states. Screenshots and product footage can therefore be
  genuine, and should be, rather than mocked.
- **Live pilot schools and real teachers using Murchid.** Referencing them
  may require permission; names and details must come from the owner.
- **Real quotes / testimonials from teachers or school leaders exist.** The
  wording is **not** in this repository. Use only text the owner supplies
  verbatim.

Absent, and forbidden to fabricate: customer logos, press coverage,
benchmarks, user counts, pricing, time-saved statistics, awards, and any
testimonial wording not supplied by the owner. A real quote existing is not
permission to write a plausible one.

## Product Principles

1. **The teacher's week is the unit of design.** Optimise for someone
   returning between classes with fifteen minutes, not for a first-time
   visitor exploring.
2. **Real data over decoration.** The product holds actual rosters,
   timetables, and marks; surfaces should show that truth rather than
   generic placeholder states. Empty states are a designed case, not an
   oversight.
3. **Editorial calm is a functional choice.** The paper aesthetic exists to
   make a dense working tool feel unhurried. Restraint is the brand; loud
   AI-product signalling is off-brand.
4. **Claims stay behind the evidence.** Positioning is unresolved and
   external proof is owner-supplied; the product sells on what it visibly
   does.
5. **Accessibility and Arabic are load-bearing.** Both ship today. A design
   that only works in English, LTR, at default type size is unfinished.

## Accessibility & Inclusion

Established product requirements: full English/Arabic bilingual support with
RTL, and the shipped accessibility toolbar above (including a motion-stop
preference that new animation must honour). No formal external standard
(e.g. a specific WCAG level) has been committed to by the owner — treat that
as undecided rather than assuming one.
