# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Teachers are the primary user — the ones actually planning and running classes day to day. Institutions/organisations, sub-admins, and a super-admin sit above them, approving accounts and overseeing scope (super-admin sees everything, sub-admin a delegated slice, an organisation only itself). Students are a secondary, invite-only audience: no self-registration, view-only access to what a teacher schedules for them.

## Product Purpose

An AI-assisted lesson-planning and classroom pipeline for KG–G12 teachers: curriculum or a prompt goes in, a full term's material (slides, notes, quizzes, exams, activities, homework) is drafted, the teacher reviews and approves, and approved material schedules itself onto the calendar and notifies enrolled students automatically.

## Positioning

Depth in one coherent pipeline, not the feature-pile most LMS products become. Two distinct AI surfaces on purpose: a per-record Studio assistant scoped to editing exactly one lesson/quiz/exam/etc., and a separate Goal Planner for large-scale term generation — never one generic "AI button" trying to do both.

## Operating Context

Sign-in (Google or email/password) → a new account is auto-created `pending` → onboarding collects institution, staff ID, syllabus type → approval by a super_admin, sub_admin, or the named institution. A pending teacher can already use the dashboard to prepare (draft lessons, browse the Goal Planner, organize My Classes) but cannot reach real students — inviting a student, and scheduling a Goal Planner draft to students, both require `active` status, enforced at the database layer via RLS, not just a disabled button.

The class hierarchy is Batch (school year) → Grade → Division → Subject; a `classId` is always one subject taught to one division, never four nested route params. Each subject has its own tab set: Lessons, Presentations, Activities, Homework, Notes & text (with position-anchored student doubts), Exams, Quizzes, Results, Attendance, Students, Settings. A Calendar surfaces everything scheduled across every class.

## Capabilities and Constraints

Real backend: Supabase (Postgres + Row Level Security), live project, real Google/email auth, real schema for profiles/approval, the full class hierarchy, students/enrollment, materials + doubts, and the goals/goal_items/assessments/results/attendance set behind the Goal Planner pipeline.

Explicitly not real yet: actual AI generation. Both the Goal Planner and the per-item Studio currently simulate their responses (a timed "drafting…" step, no LLM call) — there is no AI backend wired into this build. This is a known, deliberate gap, not an oversight, and should not be hidden behind polish that implies otherwise.

Also not yet real: the admin-approval loop. The super-admin/sub-admin/organisation consoles exist with the right actions, but sign-in only ever creates `role='teacher'` — there is currently no way to become one of the other roles.

## Brand Commitments

Product name is **Murchid** — not the assistant's name, the product's. The prior visual system (a "Firozeh & Plaster" teal-on-plaster identity, Gambetta/Switzer fonts) belonged to an earlier product concept that has been explicitly discarded as a whole ("the old system was a flop"); it is evidence of what came before, not a constraint on what comes next, except where the user has explicitly asked to revive a piece of it for a specific isolated surface.

## Evidence on Hand

`docs/00-concept.md` is the full internal concept spec (roles, auth flow, pipeline, storage decisions) and is authoritative for product truth. The user has supplied reference screenshots of a separate, unrelated product ("EduAI Studio") purely as an aesthetic/visual reference for the redesign — its name and branding are not to be adopted, only its visual language. No other real usage data, logo, or brand asset exists yet.

## Product Principles

1. One pipeline done deeply beats many screens done shallowly.
2. Approval protects students, never blocks a teacher's own preparation.
3. Per-record edits and large-scale planning are two different tools, kept visibly distinct.
4. RLS is the authorization boundary — never re-implement it in application code.
5. Say plainly what's simulated versus real; polish should never imply a capability (like AI generation) that doesn't exist yet.
