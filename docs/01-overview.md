# 01 — Overview

## What Mudir is

**Mudir** ("director" in Arabic) is an AI lesson director for teachers. It helps a teacher prepare, organize, and reuse lesson plans — with AI-assisted drafting, templating, scheduling, and review.

The name *Mudir* refers to the **product**, not the AI assistant inside it.

## Two surfaces, one app

The bundle ships with two distinct UIs:

1. **Landing page** — the marketing/explainer site shown at `/`. It pitches the product, walks through the four-step workflow, shows the eight tools, mocks the dashboard, and ends with an interactive prototype where you can fill in topic / grade / subject and watch a fake lesson generate. Defined in `src/views/Landing.jsx` + `src/landing.css`.
2. **Studio** — the actual teacher workspace. Sara's dashboard, templates library, drafts table, draft editor. Opened by clicking "Lesson Planner →" in the landing nav (or the link in the prototype section). Defined in `src/App.jsx` + `src/views/*` + `src/components/ui/*`.

The studio header has an × button that returns to the landing page. Top-level routing between the two lives in `src/main.jsx`.

## Target users

- School teachers, KG through G12
- UAE-focused initially (English-medium with Arabic support planned), but not UAE-only
- Single teacher per account today; multi-user / school-wide is on the roadmap

## Core idea

A teacher's day involves preparing many lessons across subjects, grades, and class sections. Mudir:

1. **Templates** — reusable lesson skeletons (e.g. "Reading comprehension", "Lab experiment") with subject, duration, grade, flow, and tags. Pick one and turn it into a draft.
2. **Drafts** — work-in-progress lesson plans, private to the teacher. Each has status (`In progress | Ready to use | Blocked | Paused`), progress %, and optional warnings (missing slides, lab time, etc.).
3. **Dashboard** — daily landing: today's schedule, AI activity feed, pending review queue, KPIs.
4. **AI assistance** — drafting suggestions, auto-grading, differentiation hints, homework generation, push-to-Classroom flows. (Currently shown as activity items; not yet wired to a real model.)

## Brand voice

Editorial, calm, paper-like. Cream backgrounds, Fraunces serif headings with red italic accent words, mono uppercase eyebrows, subtle dashed dividers. Visual quality is a high bar — it's compared against polished editorial design references, not generic dashboards.

See [Design system](05-design-system.md) for the full token set.
