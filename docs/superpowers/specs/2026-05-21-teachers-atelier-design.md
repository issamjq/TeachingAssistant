# Murchid v3.0 — "The Teacher's Atelier"

> Premium 2026 UI/UX redesign. Frontend only. Branched from v1.1 (commit `2fdf076`).
> Direction approved 2026-05-21.

## 1. Vision

A working journal that breathes. The interface is organised like an open notebook:
the sidebar is the leather binding, the main area is the page, the AI co-pilot
lives in the margin like a thoughtful editor's annotation — never a glowing
marketing pill. Motion is page-turn quality. Color is paper + ink + sage, with a
clay-ember accent used like a marginal underline.

**Why this direction:** honors the cream/Murchid identity that's already strong,
delivers on the brief's "calm for 8-hour teacher sessions", and forces *cutting
ornament* rather than adding it — the opposite of where v2.0/v2.1 failed.

**Audience:** UAE MoE teachers (KG–G12), 25–55, mixed tech-literacy, 4–8hr daily
sessions, desktop primary + iPad landscape/portrait + mobile.

**Out of scope** (deliberate guardrails, not gaps):

- `src/views/Studio.jsx` internals — 4,704 lines of AI-generation logic; too
  risky in one pass. Cosmetic token cascade only.
- `src/views/Landing.jsx` HeroJourney — a 600vh scroll-driven multi-scene
  choreography; its own project. Cosmetic token cascade only.
- Backend (`backend/`) — untouched per the user's brief.

## 2. Design tokens

### 2.1 Color (semantic, role-named)

**Light theme — "paper":**

| Token | Hex | Notes |
|---|---|---|
| `--surface-page` | `#F7F2E8` | warm cream |
| `--surface-card` | `#FDFAF3` | one stop lighter than page so cards float without shadow |
| `--surface-elevated` | `#FFFEF8` | modals, popovers |
| `--surface-sunken` | `#EFE9DC` | inputs, table headers |
| `--text-primary` | `#1F1B14` | warm near-black, NOT pure black |
| `--text-secondary` | `#4A4338` | |
| `--text-muted` | `#7A715F` | |
| `--text-on-accent` | `#FDFAF3` | |
| `--border-subtle` | `#E5DDC9` | |
| `--border-strong` | `#C8BFA8` | |
| `--accent` | `#9C4F37` | clay-ember (calmer than v1.1 `#C8472B`) |
| `--accent-soft` | `#D89E84` | clay-cream tints |
| `--secondary` | `#5A7A4A` | sage |
| `--gold` | `#9E7E36` | premium-tier accent |
| `--success` | `#5A7A4A` | |
| `--warning` | `#9E7E36` | |
| `--danger` | `#A8392A` | used sparingly, destructive only |
| `--focus-ring` | `#9C4F37` | 3px ring @ 35% opacity, 2px offset |

**Dark theme — "candlelit":**

Warm dark, NOT pure black, NOT navy. Foreground is `#F0E9D9` warm cream
(never pure white — prevents halation on long sessions).

| Token | Hex |
|---|---|
| `--surface-page` | `#1A1714` |
| `--surface-card` | `#22201C` |
| `--surface-elevated` | `#2A2723` |
| `--surface-sunken` | `#141210` |
| `--text-primary` | `#F0E9D9` |
| `--text-secondary` | `#C2B89E` |
| `--text-muted` | `#8B8270` |
| `--accent` | `#D89E84` |
| `--accent-soft` | `#5D3D2A` |
| `--success` | `#92A878` |
| `--warning` | `#D9B97A` |
| `--danger` | `#D17A6B` |

Tri-state ThemeToggle: **Light / System / Dark**, persists to `localStorage`,
defaults to Light.

### 2.2 Typography

| Slot | Latin | Arabic |
|---|---|---|
| Editorial display | **Instrument Serif** italic | **IBM Plex Sans Arabic** weight 200 |
| UI / body sans | **Geist** | **IBM Plex Sans Arabic** |
| Mono / data | **Geist Mono** | **IBM Plex Sans Arabic** tabular |

**Type scale:**

| Role | EN px | AR px | LH | Weight |
|---|---|---|---|---|
| `display` | 48 | 44 | 1.10 | Serif italic 400 |
| `h1` | 36 | 34 | 1.20 | Sans 500 |
| `h2` | 28 | 26 | 1.25 | Sans 500 |
| `h3` | 22 | 21 | 1.30 | Sans 500 |
| `h4` | 18 | 17 | 1.35 | Sans 600 |
| `body-lg` | 18 | 17 | 1.65 | Sans 400 |
| `body` | 16 | 15 | 1.65 | Sans 400 |
| `body-sm` | 14 | 13 | 1.55 | Sans 400 |
| `caption` | 12 | 12 | 1.40 | Sans 500 |
| `eyebrow` | 11 | 11 | 1.40 | Sans 600 |

AR is 1–2px smaller than Latin because Arabic has a taller x-height — without
this adjustment AR feels oversized next to EN. AR eyebrows drop uppercase (no
meaning in Arabic) and bump weight to 700.

### 2.3 Spacing

4pt grid: `0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 96`.
Touch target floor 44×44px.

### 2.4 Radius

`xs 4 · sm 8 · md 12 · lg 16 · xl 20 · 2xl 28 · pill 999`.

### 2.5 Elevation (deliberately quiet)

| Token | Light | Dark |
|---|---|---|
| shadow-0 | none | none |
| shadow-1 | `0 1px 2px rgba(31,27,20,.04)` | `0 1px 2px rgba(0,0,0,.30)` |
| shadow-2 | `0 4px 12px -4px rgba(31,27,20,.06)` | `0 4px 12px -4px rgba(0,0,0,.40)` |
| shadow-3 | `0 8px 24px -8px rgba(31,27,20,.10)` | `0 8px 24px -8px rgba(0,0,0,.50)` |
| shadow-4 | `0 16px 48px -16px rgba(31,27,20,.14)` | `0 16px 48px -16px rgba(0,0,0,.60)` |

In dark mode prefer surface-tint shift over shadow.

### 2.6 Motion

| Token | Value |
|---|---|
| `--duration-instant` | 80ms |
| `--duration-fast` | 150ms |
| `--duration-base` | 240ms |
| `--duration-slow` | 360ms |
| `--ease-out` | `cubic-bezier(.22,1,.36,1)` |
| `--ease-in-out` | `cubic-bezier(.45,0,.55,1)` |
| `--ease-in` | `cubic-bezier(.4,0,1,1)` |
| `--ease-natural` | `cubic-bezier(.32,.72,0,1)` |

Forbidden: bouncy curves (overshoot >1.02), `linear` except for opacity
crossfades, anything >500ms in the app shell.

Reduced-motion: durations collapse to 1ms, transition-property restricted to
opacity globally via one CSS layer.

### 2.7 Reading mode

Toggle in `AccessibilityWidget`. When on: body 16 → 18px, line-height 1.65 →
1.78, sidebar narrows to icon rail (saves ~200px), top strip slims, mascot
float pauses, max content width caps at 72ch.

## 3. Surface architecture

### 3.1 Sidebar (240px leather rail)

- **Brand:** italic Instrument Serif "Murchid" + small accent square mark.
  No breathing halo, no hover-rotate (cut from v1.1).
- **Section labels:** mono uppercase eyebrows in EN; weight-700 IBM Plex Sans
  Arabic in AR (no uppercase).
- **Studio launcher** (the most-visible chrome change): replaces the v1.1 dark
  aurora card. Now a quiet open-notebook surface — italic serif "Studio" title
  in cream-on-ink, single 6px accent dot, slim text-only CTA. No aurora, no
  sheen sweep, no infinite pulse.
- **Nav items:** flat rows, active = `surface-sunken` background + accent badge
  color. Cut from v1.1: the growing accent rail, the active box-shadow, the
  hover x-translate, the active-badge rotation.
- **Account card:** simplified at bottom — avatar + name + role chevron.
- **Premium card:** removed (clutter — the upgrade flow lives in the account
  menu already).

### 3.2 App shell desktop top strip (NEW — 40px)

Sibling band above the content area (NOT an absolute overlay):

- `border-b` hairline, `surface-card` background
- Left: sidebar-expand glyph (collapsed state only)
- Spacer
- Right: ThemeToggle · LangToggle · Close X

Replaces the v1.1 floating absolute cluster which collided visually with
section-specific toolbars (the Planner Schedule/Today/prev/next, etc.).

### 3.3 Planner — full re-layout (the main surgery)

The teacher's daily landing surface. Currently v1.1: month headline + a
4-card cluster (StudioHero / ThisMonthOverview / Upcoming / QuickActions) +
6-row calendar. Scrolls on most screens.

**New layout (fits one viewport, desktop primary):**

1. **Month hero bento (top row):**
   - Left ~⅔: Instrument Serif italic "May *2026*" at 44–52px. Year italic, in
     accent color. Below: italic-serif subtitle.
   - Right ~⅓: compact "month at a glance" mini-strip — Planned / Completed /
     To-do count. Numbers in tabular figures. No separate card chrome.

2. **Filter + nav row (single tight line):**
   - Category chips on the start side (All · Lesson Plans · Schedule · Quizzes …)
   - Spacer
   - Inline Schedule (+) · Today (italic serif) · Prev · Next

3. **Calendar grid (fills remaining viewport):**
   - 7 columns × 5–6 rows (auto by month)
   - Each cell is a **mini day-card**: `surface-card` background,
     `border-subtle`, day number top-end, events as ink-on-paper chips.
   - Today gets an accent inset border.
   - Hover: `-translateY 1px + shadow-2` (150ms ease-out).
   - Past days: subtle text-muted desaturation.
   - Click → DayList popup (existing).

4. **AI margin card (last in flow, not fixed-position):**
   - One quiet card sitting as the final element of the Planner page, *below*
     the calendar grid but still inside the viewport's `overflow-hidden`
     container. Sized to its content; the calendar `flex-1` shrinks to
     accommodate it.
   - Content: italic serif "Murchid is ready. What would you like to draft
     today?" + 4 verb chips (Lesson · Quiz · Homework · Presentation).
   - Reads as an editor's marginal note, NOT a marketing hero.
   - Replaces the v1.1 StudioHero card.

**Cut from v1.1 Planner:**

- StudioHero with PNG `planner-hero-bg.png` + sparkles pill + 4-icon grid
- ThisMonthOverview card (merged into bento hero)
- Upcoming card (merged into AI margin card secondary slot)
- QuickActions card (merged into AI margin card)
- Concentric orbit ring + glowing sphere + infinite sparkle on today cell
- Whole `planner-orb` CSS class

### 3.4 Section transitions

`PageTransition` wraps `mainContent` in App.jsx. AnimatePresence on
`section/sub/extraId` key. Enter `opacity 0→1 + translateY 8→0` 280ms ease-out.
Exit `opacity 1→0 + translateY 0→-4` 200ms ease-in. Cron-style.

When `section === "planner"`: main container switches to `overflow-hidden
min-h-0` and PageTransition receives `h-full` so the height chain reaches the
calendar.

### 3.5 Base components (in `src/components/ui/`)

| Component | Behavior |
|---|---|
| `Button` | sm/md/lg, primary/secondary/ghost/destructive, 3-dot pulse on loading (no spinner), focus ring 3px @ 35% accent at 2px offset, legacy `outline`/`danger` variants preserved |
| `Card` | single-level rule, border-only default, `hoverable` adds shadow-2 + -1px lift, `elevated` no border + shadow-3 |
| `Input` | 1.5px border-subtle, focus = border-accent + ring 3px accent @ 25% |
| `Field` | label (eyebrow) + input + persistent helper, inline error replaces helper with `role="alert"` |
| `Skeleton` | pulse opacity 0.6→1 over 1400ms ease-in-out; respects reduced-motion |
| `EmptyState` | centered, icon at 64×64 in accent @ 40% tint, display headline + body + 1 primary action |
| `ThemeToggle` | tri-state pill (Light / System / Dark), morphing accent indicator |
| `Toast` | bottom-end (or top-end on desktop), shadow-3, `aria-live` per variant, auto-dismiss 4s |
| `PageTransition` | AnimatePresence + motion.div, accepts `className` (e.g. `h-full` for fit-to-viewport sections) |

## 4. Motion choreography

| Interaction | Motion |
|---|---|
| Page transition (sidebar nav) | fade + 8px translateY, 280ms ease-out in / 200ms ease-in out |
| Month switch | label crossfade + 4px calendar parallax, 320ms ease-out |
| Day card hover | `-translateY 1px + shadow-2`, 150ms ease-out |
| Sidebar item hover | bg crossfade only (no x-translate) |
| Theme switch | no transition on color tokens during theme swap — the change is instantaneous (transitioning between palettes causes intermediate-color flash) |
| Lang switch | dir flip with 320ms transform transition globally |
| Modal | scale 0.97→1 + fade, 240ms ease-out; backdrop blur 4px |
| Toast | slide-in 240ms ease-out, dismiss 180ms ease-in |
| Button hover | brightness 1.05 + `-translateY 1px`, 150ms |
| Button press | `scale 0.98`, 80ms |
| Number tick (stats) | translateY 6→0 + fade, 360ms ease-out (only on value change) |

**Every animation must answer: "what state did this communicate?"** If not, cut.

## 5. Bilingual + RTL

Hard rules:

- `[lang="ar"]` swaps font stack via CSS layer. Never force Latin on Arabic.
- AR eyebrow uses weight bump, not uppercase.
- New code uses logical properties only: `ps-* / pe-* / ms-* / me-* / start /
  end / inline-start / inline-end`. No `pl/pr/ml/mr/left/right`.
- AR layout flipped end-to-end: nav rail, breadcrumbs, progress, directional
  icons (arrows/chevrons), toast position.

## 6. Accessibility

- Focus ring `3px @ 35% accent, 2px offset` on all interactives (never
  `outline: none` without replacement)
- Body ≥ AA (4.5:1) on `surface-page`; reading mode ≥ AAA (7:1)
- Form errors via `role="alert"` / `aria-live="polite"`
- Touch targets ≥ 44×44px
- Theme + lang toggles reachable in ≤1 click from every screen (top strip)
- `prefers-reduced-motion` fallback for every keyframe

## 7. Responsive strategy

| Width | Layout |
|---|---|
| ≥1366 (desktop, iPad landscape primary) | Sidebar 240px + top strip 40px + content. Planner: full bento. |
| 1024–1365 (iPad portrait) | Sidebar collapsible to icon rail. Planner bento stacks if needed. |
| 768–1023 (tablet) | Sidebar in drawer, top strip persists. Planner: bento stacks vertically. |
| 320–767 (mobile) | Mobile top bar (h-14) replaces top strip. Sidebar as drawer. Planner: single-column with sticky filter chip strip. |

Use `dvh` not `vh` (iOS Safari).

## 8. Files

**Files modified:**

- `index.html` — font preload swap (Instrument Serif / Geist / Geist Mono / IBM Plex Sans Arabic)
- `package.json` — add `framer-motion`
- `src/index.css` — full @theme rebuild + dark theme + motion + reading mode + RTL helpers + cut decorative animations
- `src/main.jsx` — wrap with ThemeProvider + ToastProvider + PageTransition
- `src/App.jsx` — top strip, mobile bar update, ThemeToggle placement, Planner overflow-hidden case
- `src/lib/i18n.jsx` — smooth dir-flip on language change, LangToggle styling
- `src/views/AccessibilityWidget.jsx` — reading mode toggle, swap hardcoded hex to CSS vars
- `src/components/ui/button.jsx` — new variants + sizes + loading-dots
- `src/components/ui/card.jsx` — variants (default/hoverable/elevated/sunken)
- `src/views/Planner.jsx` — full layout rebuild per §3.3
- `src/views/_data-view.jsx` — DataCard tokens, CardsGrid stagger entrance
- `src/landing.css` — landing scope CSS vars remapped, AR rules added
- `src/views/onboarding/ProfileForm.jsx` — inline CSS hex → tokens

**Files added:**

- `src/lib/theme.jsx` — tri-state ThemeProvider + useTheme
- `src/components/ui/Input.jsx`
- `src/components/ui/Field.jsx`
- `src/components/ui/Skeleton.jsx`
- `src/components/ui/EmptyState.jsx`
- `src/components/ui/ThemeToggle.jsx`
- `src/components/ui/Toast.jsx`
- `src/components/ui/PageTransition.jsx`
- `docs/11-design-system-v3.md` — published design system

**Files untouched:**

- `src/views/Studio.jsx` — token cascade only
- `src/views/Landing.jsx` — token cascade + font swap only; HeroJourney not re-choreographed
- `src/views/SlideBuilder.jsx` — slide theme presets are user content, not chrome
- `backend/**`
- `src/lib/{account,currentUser,enums,plans,role,route,markdown}` — business logic / contracts

## 9. Verification

Before claiming done:

1. `npm run build` passes clean
2. `npm run dev` boots without console errors
3. Visual smoke on (manual):
   - Desktop 1440 (primary), light + dark, EN + AR
   - iPad landscape 1366, light + dark
   - iPad portrait 1024
   - Mobile 375
4. Theme toggle reaches all states + persists
5. Reading mode toggles in AccessibilityWidget, body bumps to 18px
6. EN ↔ AR flip animates the direction change
7. `prefers-reduced-motion: reduce` (macOS Accessibility setting) → all
   keyframes collapse to 1ms
8. Planner fits a single viewport on desktop (no scroll)
9. Anti-slop guardrail re-check (§10)

## 10. Anti-slop guardrails

Must pass before "done":

- [ ] No purple-blue gradients anywhere
- [ ] No glassmorphism (modal backdrops are the only exception)
- [ ] No gradient text headings
- [ ] No abstract 3D blobs, glowing orbs, decoration-only swirls
- [ ] No emoji as functional icons — lucide-react only
- [ ] No nested cards. No card-on-card
- [ ] No double borders. No `border + shadow` on the same edge
- [ ] No saturated red/orange fills covering >5% of any viewport
- [ ] No `#FFFFFF` text on `#000000`. Light uses `#1F1B14` on `#F7F2E8`; dark
      uses `#F0E9D9` on `#1A1714`
- [ ] No SaaS "stat card triplet with arrows" unless the numbers are real
- [ ] Every animation answers "what state did this communicate?"
- [ ] No bounce, no elastic, no overshoot >1.02
- [ ] No animation >500ms in app shell
- [ ] No infinite decorative loops (mascot float and kind-button confirm pulse
      are documented exceptions)
- [ ] No scroll-triggered reveals inside the working app (landing/onboarding
      only)
- [ ] No spinner as primary loading feedback — use skeleton or 3-dot pulse
- [ ] AR layout flipped end-to-end; eyebrow uses weight not uppercase
- [ ] No `pl/pr/ml/mr/left/right` in newly touched code

## 11. Rollback

v1.1 is tagged at commit `2fdf076`. To restore at any time:

```
git reset --hard v1.1
git push --force origin main
```

This work will ship as `v3.0` once verification passes.
