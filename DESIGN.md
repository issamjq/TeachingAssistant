# Design

<!-- impeccable:design-schema 1 -->

## Scope

Two coexisting systems, deliberately:

- **Marketing** (`/`, `/signin`, onboarding) — the original neutral/indigo shadcn-style tokens, unchanged. Per CLAUDE.md's deploy policy, marketing waits for its own visual sign-off; this redesign did not touch it.
- **App** (everything under the `(dashboard)` route group — Overview, Goal Planner, My Classes, Calendar, Profile, Support, and the Studio panel) — the system below, scoped to a `.theme-app` class on that route group's root wrapper (`app/(dashboard)/layout.tsx`), never leaking into `:root`.

## Source

User-supplied reference screenshots of a separate, unrelated product ("EduAI Studio") — visual reference only, never adopted as a name or brand. Treated as an approved comp per the pinned-brief rule: reproduced token-for-token where Murchid's existing structure allows, adapted to its own routes and content.

## Palette — Restrained strategy

One neutral-warm ramp plus one accent, applied at page scale (backgrounds and fields, not scattered chips):

| Token | Value | Use |
|---|---|---|
| `background` | `#f4efe2` | App content ground (warm cream) |
| `card` | `#ffffff` | Cards, popovers — distinct from the cream ground |
| `sidebar` | `#ffffff` | Sidebar ground — also distinct from the cream content column |
| `foreground` | `#21201b` | Body text (warm near-black, never pure black) |
| `primary` | `#1b4b3a` | Deep forest green — the one accent: primary buttons, active nav pill, floating action button |
| `secondary` / `sidebar-primary` | `#e7efe6` | Pale sage — active nav background, secondary surfaces |
| `muted-foreground` | `#837c6d` | Secondary text, timestamps, metadata |
| `border` | `#e8e2d2` | Card and sidebar borders |
| `success` / `warning` / `destructive` | `#2b6b4a` / `#9c5b12` / `#b23a2b` | Semantic only — status pills, rendered as `bg-{color}/12 text-{color}` (soft tint, not solid fill) |

Dark mode exists (`.theme-app.dark` inherits the `.dark` block's shape) but is not reachable yet — no theme toggle is wired up in this build.

## Type

- **Display/headings** — Lora (serif, self-hosted via `next/font/google`, `--font-lora`). Reserved for page titles (`PageHeader`'s `h1`) and the class-detail header — one serif moment per screen, not every card title.
- **UI/body** — Inter (`--font-sans`, already in place).
- Scale: page titles `text-xl font-medium`; card titles `text-base font-semibold`; body `text-sm`; metadata `text-xs`.

## Components

- **Radius** — base `0.75rem` inside `.theme-app` (vs. `0.625rem` for marketing), giving slightly softer cards and buttons; badges are fully rounded (`rounded-full`) pills.
- **Badges/status pills** — soft tint (`bg-{semantic}/12 text-{semantic}`), not solid fill — matches the reference's pale pill language and keeps solid `primary` fill unique to actual primary actions.
- **Sidebar** — white ground, green square wordmark, active item as a pale-sage pill with dark-green text (`sidebar-primary` / `sidebar-primary-foreground`) — inherited automatically by the existing `DashboardShell` since it was already token-driven; no structural change.
- **Floating action** — a pill-shaped `Sparkles` "Ask for help" button, fixed bottom-right, dark-green fill, links to `/support`. Persistent across every dashboard screen.
- **Studio panel** — retired its earlier separate "Firozeh & Plaster" old-brand CSS module (a prior, now-superseded direction); rebuilt on the same `.theme-app` tokens as everything else via plain Tailwind classes, so it's one system, not a third one.

## What this did not touch

Function, routes, data wiring, and the sidebar's structure (nav items, the classes timeline tree) are unchanged — this was a token- and component-styling pass only, per direction ("current structure is ok... functionality... the ui and ux should be improved").

## Known gap

I could not visually verify the rendered dashboard myself — every `(dashboard)` route sits behind real Supabase auth, and I have no way to complete a real sign-in (no Google account, and Supabase correctly rejects disposable test emails). Verified instead: the compiled CSS bundle contains the `.theme-app` rules and correct token values; marketing/signin render unchanged (confirmed via screenshot); `tsc` and the impeccable mechanical detector are both clean. The actual dashboard rendering needs your own confirmation.
