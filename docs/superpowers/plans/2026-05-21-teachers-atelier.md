# Teacher's Atelier (v3.0) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the v3.0 "Teacher's Atelier" redesign per `docs/superpowers/specs/2026-05-21-teachers-atelier-design.md` — a calm, page-turn-motion, cream-paper interface for UAE MoE teachers — branched cleanly off v1.1.

**Architecture:** Token-driven CSS layer + new React primitives + targeted surface surgery. New files under `src/components/ui/` and `src/lib/theme.jsx`. Existing files modified surgically. No backend touched. v1.1 (`2fdf076`) stays tagged as the rollback point.

**Tech Stack:** Vite 5, React 18, Tailwind v4 (via `@theme` directive in CSS), Framer Motion 12 (added in Task 1), Lucide-react icons (already present).

---

## Verification model

This is a UI redesign, not a feature with unit tests. Each task's verification is:
1. `npm run build` exits 0 (compile passes)
2. Visual spot-check on the touched surface (described per task)
3. Smoke that adjacent surfaces still render (no token regression)

The full visual smoke + anti-slop audit is **Task 21**.

---

## File map (locked decomposition)

**Created:**
- `src/lib/theme.jsx` — tri-state ThemeProvider + `useTheme`
- `src/components/ui/Input.jsx`
- `src/components/ui/Field.jsx`
- `src/components/ui/Skeleton.jsx`
- `src/components/ui/EmptyState.jsx`
- `src/components/ui/ThemeToggle.jsx`
- `src/components/ui/Toast.jsx`
- `src/components/ui/PageTransition.jsx`

**Modified:**
- `index.html` — font preload swap
- `package.json` + `package-lock.json` — `framer-motion` dep
- `src/index.css` — full token rebuild + dark theme + motion + reading mode + RTL helpers + decorative-chrome cuts
- `src/main.jsx` — wrap with ThemeProvider + ToastProvider + PageTransition
- `src/App.jsx` — desktop top strip, mobile bar update, Planner overflow case, ThemeToggle placement
- `src/lib/i18n.jsx` — animated dir flip + LangToggle restyle
- `src/views/AccessibilityWidget.jsx` — reading-mode toggle + hex→token sweep
- `src/components/ui/button.jsx` — variants + sizes + 3-dot loading (preserve legacy variant aliases)
- `src/components/ui/card.jsx` — `default / hoverable / elevated / sunken` variants
- `src/views/_data-view.jsx` — DataCard token migration + CardsGrid stagger
- `src/views/Planner.jsx` — full re-layout (the main surgery)
- `src/views/Landing.jsx` — font swap + token sweep (HeroJourney NOT re-choreographed)
- `src/landing.css` — landing-scope CSS vars remapped + AR rules
- `src/views/onboarding/ProfileForm.jsx` — inline CSS hex → token vars

**Out of scope (token cascade only — do NOT touch internals):**
- `src/views/Studio.jsx` (4,704 lines)
- `src/views/SlideBuilder.jsx` (slide-theme presets are user content)
- `backend/**`
- `src/lib/{account,currentUser,enums,plans,role,route,markdown}.js` (business logic)

---

## Task 1: Install framer-motion + swap font stack in index.html

**Files:**
- Modify: `package.json`, `package-lock.json` (npm-managed)
- Modify: `index.html`

- [ ] **Step 1: Install framer-motion**

```bash
npm install framer-motion
```

Expected: `framer-motion ^12.x` added to dependencies.

- [ ] **Step 2: Replace `index.html` with the new font stack**

Overwrite `index.html` with:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
    <meta name="color-scheme" content="light dark" />
    <meta name="theme-color" content="#F7F2E8" media="(prefers-color-scheme: light)" />
    <meta name="theme-color" content="#1A1714" media="(prefers-color-scheme: dark)" />
    <title>Murchid — The lesson director</title>
    <link rel="preconnect" href="https://fonts.googleapis.com" />
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
    <link
      href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital,wght@0,400;1,400&family=Geist:wght@400;500;600;700&family=Geist+Mono:wght@400;500&family=IBM+Plex+Sans+Arabic:wght@200;400;500;600;700&display=swap"
      rel="stylesheet"
    />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

- [ ] **Step 3: Build passes**

```bash
npm run build
```

Expected: `✓ built in <Ns>` with no errors.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json index.html
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: add framer-motion + swap font stack to Instrument Serif / Geist / IBM Plex Sans Arabic"
```

---

## Task 2: Rebuild src/index.css — semantic tokens, dark theme, motion, base, reading mode, RTL helpers

**Files:**
- Modify: `src/index.css` (the foundational rewrite — top of file)

- [ ] **Step 1: Replace the existing `@theme` block at the top of `src/index.css`**

Find the existing `@theme { ... }` block at the top of the file. Replace it AND insert the new dark-theme + motion + base + reading-mode + RTL helpers block. The structure below replaces lines from the start of the file through the first existing keyframe definition (e.g. `.studio-card-flip-in`).

Replace lines 1–23 (the old `@import` + old `@theme`) with:

```css
@import "tailwindcss";

/* === Murchid Design System v3.0 — "The Teacher's Atelier" ====================
   Tokens are role-named and semantic. Swapping data-theme on <html>
   re-skins every surface using these vars.
   See docs/superpowers/specs/2026-05-21-teachers-atelier-design.md. */

@theme {
  /* ── Semantic surfaces + text + border ─────────────────────────── */
  --color-surface-page: #F7F2E8;
  --color-surface-card: #FDFAF3;
  --color-surface-elevated: #FFFEF8;
  --color-surface-sunken: #EFE9DC;
  --color-text-primary: #1F1B14;
  --color-text-secondary: #4A4338;
  --color-text-muted: #7A715F;
  --color-text-on-accent: #FDFAF3;
  --color-border-subtle: #E5DDC9;
  --color-border-strong: #C8BFA8;

  /* ── Brand ────────────────────────────────────────────────────── */
  --color-accent: #9C4F37;
  --color-accent-soft: #D89E84;
  --color-secondary: #5A7A4A;
  --color-gold: #9E7E36;
  --color-success: #5A7A4A;
  --color-warning: #9E7E36;
  --color-danger: #A8392A;
  --color-focus-ring: #9C4F37;

  /* ── Legacy aliases (preserved so bg-paper / text-ink etc. still
       resolve, but now point at the new palette). */
  --color-paper: #F7F2E8;
  --color-paper-warm: #EFE9DC;
  --color-paper-cool: #FDFAF3;
  --color-ink: #1F1B14;
  --color-ink-soft: #4A4338;
  --color-line: #E5DDC9;
  --color-muted: #7A715F;
  --color-sage: #5A7A4A;

  /* ── Type ────────────────────────────────────────────────────── */
  --font-sans: "Geist", "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
  --font-serif: "Instrument Serif", "IBM Plex Sans Arabic", Georgia, serif;
  --font-mono: "Geist Mono", "IBM Plex Sans Arabic", ui-monospace, monospace;
  --font-arabic: "IBM Plex Sans Arabic", ui-sans-serif, system-ui, sans-serif;
}

/* Motion + elevation as plain CSS vars (not @theme — they don't need
   to generate utility classes). */
:root {
  --duration-instant: 80ms;
  --duration-fast: 150ms;
  --duration-base: 240ms;
  --duration-slow: 360ms;
  --duration-marketing: 480ms;
  --ease-out: cubic-bezier(0.22, 1, 0.36, 1);
  --ease-in: cubic-bezier(0.4, 0, 1, 1);
  --ease-in-out: cubic-bezier(0.45, 0, 0.55, 1);
  --ease-natural: cubic-bezier(0.32, 0.72, 0, 1);

  --shadow-1: 0 1px 2px rgba(31, 27, 20, 0.04);
  --shadow-2: 0 4px 12px -4px rgba(31, 27, 20, 0.06);
  --shadow-3: 0 8px 24px -8px rgba(31, 27, 20, 0.10);
  --shadow-4: 0 16px 48px -16px rgba(31, 27, 20, 0.14);
}

/* ── Dark theme: "candlelit" ─────────────────────────────────────
   Warm dark, NOT pure black, NOT navy. Foreground is warm cream,
   never pure white — prevents halation on long teaching sessions. */
[data-theme="dark"] {
  --color-surface-page: #1A1714;
  --color-surface-card: #22201C;
  --color-surface-elevated: #2A2723;
  --color-surface-sunken: #141210;
  --color-text-primary: #F0E9D9;
  --color-text-secondary: #C2B89E;
  --color-text-muted: #8B8270;
  --color-text-on-accent: #1A1714;
  --color-border-subtle: #33302A;
  --color-border-strong: #4D4940;
  --color-accent: #D89E84;
  --color-accent-soft: #5D3D2A;
  --color-secondary: #92A878;
  --color-gold: #D9B97A;
  --color-success: #92A878;
  --color-warning: #D9B97A;
  --color-danger: #D17A6B;
  --color-focus-ring: #D89E84;

  --color-paper: #1A1714;
  --color-paper-warm: #141210;
  --color-paper-cool: #22201C;
  --color-ink: #F0E9D9;
  --color-ink-soft: #C2B89E;
  --color-line: #33302A;
  --color-muted: #8B8270;
  --color-sage: #92A878;

  --shadow-1: 0 1px 2px rgba(0, 0, 0, 0.30);
  --shadow-2: 0 4px 12px -4px rgba(0, 0, 0, 0.40);
  --shadow-3: 0 8px 24px -8px rgba(0, 0, 0, 0.50);
  --shadow-4: 0 16px 48px -16px rgba(0, 0, 0, 0.60);

  color-scheme: dark;
}

/* ── Global base ─────────────────────────────────────────────── */
html, body, #root {
  background: var(--color-surface-page);
  color: var(--color-text-primary);
}

body {
  font-family: var(--font-sans);
  font-size: 16px;
  line-height: 1.65;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
  font-feature-settings: "cv11", "ss01";
}

@media (min-width: 768px) and (max-width: 1023px) {
  body { font-size: 17px; }
}

html[lang="ar"] body,
html[dir="rtl"] body {
  font-family: var(--font-arabic);
}
html[lang="ar"] .font-serif,
html[dir="rtl"] .font-serif {
  font-family: var(--font-arabic);
  font-weight: 200;
  font-style: normal;
}

html.lang-transition * {
  transition: transform 320ms var(--ease-out),
              opacity 200ms var(--ease-out) !important;
}

:where(button, a, input, textarea, select, [tabindex]):focus-visible {
  outline: none;
  box-shadow: 0 0 0 2px var(--color-surface-page),
              0 0 0 5px color-mix(in oklab, var(--color-focus-ring) 35%, transparent);
  border-radius: var(--radius-sm, 8px);
}

@supports (scrollbar-color: auto) {
  html {
    scrollbar-color: var(--color-border-strong) var(--color-surface-sunken);
    scrollbar-width: thin;
  }
}

/* ── Reading mode ──────────────────────────────────────────────── */
.reading-mode body { font-size: 18px; line-height: 1.78; }
.reading-mode .reading-target { max-width: 72ch; }
.reading-mode .reading-hide { display: none !important; }

/* ── Motion utilities ───────────────────────────────────────────── */
.motion-base { transition: all var(--duration-base) var(--ease-out); }
.motion-fast { transition: all var(--duration-fast) var(--ease-out); }

/* ── Logical-property utilities (RTL-safe) ─────────────────────── */
.ps-2 { padding-inline-start: 8px; }
.pe-2 { padding-inline-end: 8px; }
.ps-3 { padding-inline-start: 12px; }
.pe-3 { padding-inline-end: 12px; }
.ps-4 { padding-inline-start: 16px; }
.pe-4 { padding-inline-end: 16px; }
.ms-2 { margin-inline-start: 8px; }
.me-2 { margin-inline-end: 8px; }
.ms-3 { margin-inline-start: 12px; }
.me-3 { margin-inline-end: 12px; }
.ms-auto { margin-inline-start: auto; }
.me-auto { margin-inline-end: auto; }
.text-start { text-align: start; }
.text-end { text-align: end; }
.border-s { border-inline-start: 1px solid var(--color-border-subtle); }
.border-e { border-inline-end: 1px solid var(--color-border-subtle); }
html[dir="rtl"] .rtl-flip { transform: scaleX(-1); }

/* Global reduced-motion guard — overrides every keyframe + transition */
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    animation-delay: 0ms !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build
```

Expected: `✓ built in <Ns>` clean.

- [ ] **Step 3: Commit**

```bash
git add src/index.css
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: rebuild index.css foundation — semantic tokens, dark theme, motion, reading mode, RTL helpers"
```

---

## Task 3: Cut decorative chrome from index.css

**Goal:** Remove the v1.1 sidebar aurora launcher, breathing brand-mark halo, active-nav rail-and-shadow, planner orb, today-cell sparkle pulse, studio-card scale+blur, and sweep old-accent rgb values to the new palette.

**Files:**
- Modify: `src/index.css` (the rest of the file, below the foundation rebuild from Task 2)

- [ ] **Step 1: Replace the sidebar studio launcher CSS**

Find the existing `.murchid-studio-launcher` block in `src/index.css` (a long block with `radial-gradient` background, `::before` aurora, `::after` sheen sweep, multiple `@keyframes`). Replace the entire block (from `.murchid-studio-launcher {` through the closing `}` of `.murchid-studio-launcher:hover .murchid-studio-launcher-cta-arrow`) with:

```css
/* Studio launcher — editorial calm (v3.0). The aurora-gradient version
   was the "AI dashboard" tell; replaced with a quiet ink card: serif
   italic title, a single accent dot, restrained typography. */
.murchid-studio-launcher {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 14px;
  width: calc(100% - 24px);
  margin: 6px 12px 18px;
  padding: 18px 18px 16px;
  border-radius: 16px;
  background: var(--color-text-primary);
  color: var(--color-surface-card);
  border: 0;
  text-align: start;
  cursor: pointer;
  isolation: isolate;
  transition:
    transform var(--duration-fast) var(--ease-out),
    box-shadow var(--duration-fast) ease;
  animation: studio-launcher-in 480ms var(--ease-out) 180ms both;
}
.murchid-studio-launcher:hover { transform: translateY(-1px); }
.murchid-studio-launcher:active { transform: translateY(0); }
.murchid-studio-launcher-active {
  outline: 1.5px solid var(--color-accent);
  outline-offset: 2px;
}
@keyframes studio-launcher-in {
  from { opacity: 0; transform: translateY(6px); }
  to   { opacity: 1; transform: translateY(0); }
}
.murchid-studio-launcher-head {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
}
.murchid-studio-launcher-brand {
  display: inline-flex;
  align-items: baseline;
  gap: 10px;
}
.murchid-studio-launcher-icon {
  display: inline-block;
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: var(--color-accent);
  transform: translateY(-3px);
}
.murchid-studio-launcher-icon > svg { display: none; }
.murchid-studio-launcher-title {
  font-family: var(--font-serif);
  font-style: italic;
  font-size: 24px;
  font-weight: 400;
  letter-spacing: -0.01em;
  color: var(--color-surface-card);
  line-height: 1;
}
.murchid-studio-launcher-pill {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 500;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(240, 233, 217, 0.55);
  background: transparent;
  border: 0;
  padding: 0;
}
.murchid-studio-launcher-body {
  display: flex;
  flex-direction: column;
  gap: 2px;
}
.murchid-studio-launcher-subtitle {
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: 400;
  color: rgba(240, 233, 217, 0.78);
  line-height: 1.4;
  letter-spacing: -0.003em;
}
.murchid-studio-launcher-tagline { display: none; }
.murchid-studio-launcher-cta {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  margin-top: 2px;
  padding: 0;
  background: transparent;
  border: 0;
  color: var(--color-accent-soft);
  font-family: var(--font-sans);
  font-size: 12.5px;
  font-weight: 500;
}
.murchid-studio-launcher-cta-arrow {
  transition: transform var(--duration-fast) var(--ease-out);
}
.murchid-studio-launcher:hover .murchid-studio-launcher-cta-arrow {
  transform: translateX(3px);
}
html[dir="rtl"] .murchid-studio-launcher-cta-arrow { transform: scaleX(-1); }
html[dir="rtl"] .murchid-studio-launcher:hover .murchid-studio-launcher-cta-arrow {
  transform: translateX(-3px) scaleX(-1);
}
```

- [ ] **Step 2: Replace the sidebar brand mark CSS**

Find `.murchid-sidebar { ... }`, `.murchid-sidebar-brand { ... }`, `.murchid-sidebar-brand-mark { ... }`, and `@keyframes murchid-sidebar-brand-halo`. Replace through the end of the brand-halo keyframe with:

```css
.murchid-sidebar {
  background: var(--color-surface-card);
  border-inline-end: 1px solid var(--color-border-subtle);
}

.murchid-sidebar-brand { position: relative; }
.murchid-sidebar-brand-mark {
  display: inline-grid;
  place-items: center;
  height: 24px;
  width: 24px;
  border-radius: 8px;
  background: var(--color-accent);
  color: var(--color-surface-card);
  font-family: var(--font-serif);
  font-style: italic;
  font-weight: 400;
  font-size: 14px;
  line-height: 1;
  transition: transform var(--duration-fast) var(--ease-out);
}
.murchid-sidebar-brand:hover .murchid-sidebar-brand-mark {
  transform: scale(1.06);
}
```

- [ ] **Step 3: Replace sidebar nav-item + badge styling**

Find `.murchid-sidebar-section { ... }` through `.murchid-sidebar-item-active .murchid-sidebar-badge { ... }`. Replace with:

```css
.murchid-sidebar-section + .murchid-sidebar-section { margin-top: 14px; }
.murchid-sidebar-section-label {
  font-family: var(--font-mono);
  font-size: 9.5px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.14em;
  color: var(--color-text-muted);
  padding: 0 16px 8px;
}
html[lang="ar"] .murchid-sidebar-section-label,
html[dir="rtl"] .murchid-sidebar-section-label {
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0;
  font-family: var(--font-arabic);
}

.murchid-sidebar-item {
  position: relative;
  width: 100%;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 400;
  color: var(--color-text-secondary);
  background: transparent;
  border: 0;
  cursor: pointer;
  text-align: start;
  transition: background-color var(--duration-fast) var(--ease-out),
              color var(--duration-fast) var(--ease-out);
  animation: murchid-sidebar-item-in 320ms var(--ease-out) both;
  animation-delay: calc(var(--mi, 0) * 24ms + 80ms);
}
@keyframes murchid-sidebar-item-in {
  from { opacity: 0; transform: translateY(-2px); }
  to   { opacity: 1; transform: translateY(0); }
}
.murchid-sidebar-item:hover {
  background: var(--color-surface-sunken);
  color: var(--color-text-primary);
}
.murchid-sidebar-item-active {
  background: var(--color-surface-sunken);
  color: var(--color-text-primary);
  font-weight: 500;
}
.murchid-sidebar-item::before { display: none; }

.murchid-sidebar-badge {
  flex-shrink: 0;
  height: 22px;
  width: 22px;
  border-radius: 4px;
  font-family: var(--font-mono);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  display: inline-grid;
  place-items: center;
  background: transparent;
  color: var(--color-text-muted);
  border: 0;
  transition: color var(--duration-fast) var(--ease-out);
}
.murchid-sidebar-item-active .murchid-sidebar-badge {
  color: var(--color-accent);
}
```

- [ ] **Step 4: Replace the studio-card-flip-in keyframe**

Find `.studio-card-flip-in` and its `@keyframes studio-card-morph-in`. Replace with:

```css
.studio-card-flip-in {
  animation: studio-card-fade-in var(--duration-base) var(--ease-out) both;
}
@keyframes studio-card-fade-in {
  from { opacity: 0; }
  to   { opacity: 1; }
}
```

- [ ] **Step 5: Replace planner-hero (drop the PNG background)**

Find `.planner-hero { background: url(...) ... }`. Replace with:

```css
.planner-hero {
  background: var(--color-surface-card);
  border: 1px solid var(--color-border-subtle);
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.planner-hero::before {
  content: "";
  position: absolute;
  inset: auto -10% -40% auto;
  width: 360px;
  height: 360px;
  z-index: 0;
  border-radius: 999px;
  background: radial-gradient(
    circle,
    color-mix(in oklab, var(--color-accent) 8%, transparent) 0%,
    transparent 60%
  );
  pointer-events: none;
}
html[dir="rtl"] .planner-hero::before {
  inset: auto auto -40% -10%;
}
```

- [ ] **Step 6: Delete planner-orb and planner-cell-today-spark CSS**

Find and delete these blocks entirely:
- `.planner-orb { ... }` and `@keyframes planner-orb-float { ... }`
- `.planner-orb-ring { ... }`, `.planner-orb-ring-outer { ... }`, `.planner-orb-ring-inner { ... }`
- `.planner-orb-halo { ... }`
- `.planner-orb-sphere { ... }`
- `.planner-cell-today-spark { ... }` and `@keyframes planner-cell-today-spark { ... }`

- [ ] **Step 7: Bulk-swap accent rgb values to new palette**

Run these `Edit replace_all` operations against `src/index.css`:

| Old | New |
|---|---|
| `rgba(200, 71, 43,` | `rgba(156, 79, 55,` |
| `rgba(232, 122, 85,` | `rgba(216, 158, 132,` |
| `rgba(184, 137, 61,` | `rgba(158, 126, 54,` |
| `#c8472b` | `#9C4F37` |
| `#e6dccb` | `#E5DDC9` |
| `#1a1814` | `#1F1B14` |
| `#fdf8ee` | `#FDFAF3` |
| `#f0e6d2` | `#E5DDC9` |
| `#e8ddca` | `#C8BFA8` |
| `#6b675e` | `#7A715F` |

- [ ] **Step 8: Build passes**

```bash
npm run build
```

Expected: clean build.

- [ ] **Step 9: Commit**

```bash
git add src/index.css
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: cut decorative chrome — aurora launcher, brand halo, active-nav rail/shadow, planner orb, today sparkle, studio scale+blur"
```

---

## Task 4: Create ThemeProvider (src/lib/theme.jsx)

**Files:**
- Create: `src/lib/theme.jsx`

- [ ] **Step 1: Create the file**

```jsx
import React, { createContext, useContext, useEffect, useState, useCallback } from "react";

const STORAGE_KEY = "murchid.theme";

const ThemeContext = createContext({
  mode: "system",
  resolvedTheme: "light",
  setMode: () => {},
});

function readSystemPref() {
  if (typeof window === "undefined") return "light";
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function applyTheme(resolved) {
  if (typeof document === "undefined") return;
  if (resolved === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  } else {
    document.documentElement.removeAttribute("data-theme");
  }
}

export function ThemeProvider({ children }) {
  const [mode, setModeState] = useState(() => {
    if (typeof window === "undefined") return "light";
    return localStorage.getItem(STORAGE_KEY) || "light";
  });
  const [systemTheme, setSystemTheme] = useState(readSystemPref);

  const resolvedTheme = mode === "system" ? systemTheme : mode;

  useEffect(() => { applyTheme(resolvedTheme); }, [resolvedTheme]);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const handler = (e) => setSystemTheme(e.matches ? "dark" : "light");
    mq.addEventListener?.("change", handler);
    return () => mq.removeEventListener?.("change", handler);
  }, []);

  const setMode = useCallback((next) => {
    setModeState(next);
    try { localStorage.setItem(STORAGE_KEY, next); } catch {}
  }, []);

  return (
    <ThemeContext.Provider value={{ mode, resolvedTheme, setMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  return useContext(ThemeContext);
}
```

- [ ] **Step 2: Build passes** (`npm run build`)

- [ ] **Step 3: Commit**

```bash
git add src/lib/theme.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: add tri-state ThemeProvider (Light/Dark/System)"
```

---

## Task 5: Create ThemeToggle

**Files:**
- Create: `src/components/ui/ThemeToggle.jsx`

- [ ] **Step 1: Create the file**

```jsx
import React from "react";
import { Sun, Moon, Monitor } from "lucide-react";
import { useTheme } from "../../lib/theme";

const OPTIONS = [
  { value: "light", icon: Sun, label: "Light" },
  { value: "system", icon: Monitor, label: "System" },
  { value: "dark", icon: Moon, label: "Dark" },
];

export function ThemeToggle({ className = "" }) {
  const { mode, setMode } = useTheme();
  const idx = Math.max(0, OPTIONS.findIndex((o) => o.value === mode));

  return (
    <div
      role="radiogroup"
      aria-label="Theme"
      className={[
        "relative inline-flex items-center rounded-full p-1",
        "bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]",
        className,
      ].join(" ")}
    >
      <span
        aria-hidden
        className="absolute top-1 bottom-1 w-[32px] rounded-full bg-[var(--color-surface-card)] shadow-[var(--shadow-1)]"
        style={{
          left: 4,
          transform: `translateX(${idx * 32}px)`,
          transition: "transform 280ms var(--ease-out)",
        }}
      />
      {OPTIONS.map((opt) => {
        const Icon = opt.icon;
        const active = mode === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-label={opt.label}
            onClick={() => setMode(opt.value)}
            className={[
              "relative z-10 w-8 h-8 grid place-items-center rounded-full",
              "transition-colors duration-150",
              active ? "text-accent" : "text-muted hover:text-ink",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" strokeWidth={1.75} />
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Build passes** (`npm run build`)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/ThemeToggle.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: add ThemeToggle tri-state pill (Light/System/Dark) with morphing indicator"
```

---

## Task 6: Create Input + Field primitives

**Files:**
- Create: `src/components/ui/Input.jsx`
- Create: `src/components/ui/Field.jsx`

- [ ] **Step 1: Create Input.jsx**

```jsx
import React, { forwardRef } from "react";

export const Input = forwardRef(function Input(
  { className = "", invalid = false, ...props },
  ref,
) {
  return (
    <input
      ref={ref}
      aria-invalid={invalid || undefined}
      className={[
        "w-full rounded-[8px] bg-paper-cool text-ink",
        "border border-[var(--color-border-subtle)]",
        "px-3 py-2.5 text-[15px] leading-[1.4]",
        "placeholder:text-[var(--color-text-muted)]",
        "transition-[border-color,box-shadow] duration-150",
        "focus:outline-none focus:border-[var(--color-accent)]",
        invalid ? "border-[var(--color-danger)] focus:border-[var(--color-danger)]" : "",
        "disabled:opacity-50 disabled:cursor-not-allowed",
        className,
      ].join(" ")}
      {...props}
    />
  );
});
```

- [ ] **Step 2: Create Field.jsx**

```jsx
import React, { useId } from "react";

export function Field({
  label,
  helper,
  error,
  required = false,
  children,
  className = "",
}) {
  const id = useId();
  const helperId = helper || error ? `${id}-help` : undefined;

  const child = React.isValidElement(children)
    ? React.cloneElement(children, {
        id,
        "aria-describedby": helperId,
        invalid: Boolean(error),
      })
    : children;

  return (
    <div className={["flex flex-col gap-1.5", className].join(" ")}>
      {label && (
        <label
          htmlFor={id}
          className="text-[11px] font-semibold tracking-[0.06em] uppercase text-ink-soft"
        >
          {label}
          {required && (
            <span className="text-[var(--color-danger)] ms-0.5" aria-hidden>*</span>
          )}
        </label>
      )}
      {child}
      {error ? (
        <p
          id={helperId}
          role="alert"
          className="text-[13px] text-[var(--color-danger)] mt-0.5"
        >
          {error}
        </p>
      ) : helper ? (
        <p id={helperId} className="text-[13px] text-muted mt-0.5">
          {helper}
        </p>
      ) : null}
    </div>
  );
}
```

- [ ] **Step 3: Build passes** (`npm run build`)

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Input.jsx src/components/ui/Field.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: add Input + Field primitives (inline validation, role=alert)"
```

---

## Task 7: Create Skeleton + EmptyState primitives

**Files:**
- Create: `src/components/ui/Skeleton.jsx`
- Create: `src/components/ui/EmptyState.jsx`

- [ ] **Step 1: Create Skeleton.jsx**

```jsx
import React from "react";

export function Skeleton({ className = "", style }) {
  return (
    <div
      aria-hidden
      className={["rounded-md bg-[var(--color-surface-sunken)] skel-pulse", className].join(" ")}
      style={style}
    />
  );
}

const styleId = "murchid-skel-style";
if (typeof document !== "undefined" && !document.getElementById(styleId)) {
  const s = document.createElement("style");
  s.id = styleId;
  s.textContent = `
    .skel-pulse { animation: skel-pulse 1400ms ease-in-out infinite; }
    @keyframes skel-pulse {
      0%, 100% { opacity: 0.6; }
      50%      { opacity: 1; }
    }
    @media (prefers-reduced-motion: reduce) {
      .skel-pulse { animation: none; opacity: 0.8; }
    }
  `;
  document.head.appendChild(s);
}
```

- [ ] **Step 2: Create EmptyState.jsx**

```jsx
import React from "react";
import { Button } from "./button";

export function EmptyState({ icon: Icon, title, body, action, secondaryAction }) {
  return (
    <div className="flex flex-col items-center justify-center text-center max-w-md mx-auto py-12 px-6">
      {Icon && (
        <div
          aria-hidden
          className="w-16 h-16 rounded-2xl grid place-items-center mb-5"
          style={{ background: "color-mix(in oklab, var(--color-accent) 12%, transparent)" }}
        >
          <Icon className="w-7 h-7 text-accent" strokeWidth={1.5} />
        </div>
      )}
      {title && (
        <h3 className="font-serif italic text-[24px] leading-[1.2] text-ink mb-2">
          {title}
        </h3>
      )}
      {body && (
        <p className="text-[15px] text-ink-soft leading-[1.6] mb-5">
          {body}
        </p>
      )}
      {(action || secondaryAction) && (
        <div className="flex items-center gap-3">
          {action}
          {secondaryAction}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Build passes** (`npm run build`)

- [ ] **Step 4: Commit**

```bash
git add src/components/ui/Skeleton.jsx src/components/ui/EmptyState.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: add Skeleton (1400ms pulse, reduced-motion safe) and EmptyState primitives"
```

---

## Task 8: Create Toast + ToastProvider

**Files:**
- Create: `src/components/ui/Toast.jsx`

- [ ] **Step 1: Create the file**

```jsx
import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2, AlertTriangle, XCircle, X, Info } from "lucide-react";

const ToastContext = createContext({ toast: () => {} });

const VARIANTS = {
  neutral: { icon: Info, color: "var(--color-text-secondary)" },
  success: { icon: CheckCircle2, color: "var(--color-success)" },
  warning: { icon: AlertTriangle, color: "var(--color-warning)" },
  error: { icon: XCircle, color: "var(--color-danger)" },
};

export function ToastProvider({ children, duration = 4000 }) {
  const [toasts, setToasts] = useState([]);
  const idCounter = useRef(0);

  const dismiss = useCallback((id) => {
    setToasts((t) => t.filter((x) => x.id !== id));
  }, []);

  const toast = useCallback(
    (message, opts = {}) => {
      const id = ++idCounter.current;
      const variant = opts.variant || "neutral";
      setToasts((t) => [...t, { id, message, variant, title: opts.title }]);
      if (opts.duration !== 0) {
        setTimeout(() => dismiss(id), opts.duration ?? duration);
      }
      return id;
    },
    [duration, dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast, dismiss }}>
      {children}
      <div
        className="fixed z-[100] flex flex-col gap-2 pointer-events-none"
        style={{
          insetInlineEnd: 16,
          bottom: 16,
          maxWidth: "min(400px, calc(100vw - 32px))",
        }}
      >
        <AnimatePresence initial={false}>
          {toasts.map((t) => {
            const V = VARIANTS[t.variant] || VARIANTS.neutral;
            const Icon = V.icon;
            return (
              <motion.div
                key={t.id}
                role={t.variant === "error" || t.variant === "warning" ? "alert" : "status"}
                aria-live={t.variant === "error" ? "assertive" : "polite"}
                initial={{ opacity: 0, y: 12, scale: 0.97 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 8, scale: 0.98, transition: { duration: 0.18 } }}
                transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
                className="pointer-events-auto flex items-start gap-3 ps-3 pe-2 py-3 rounded-[12px] bg-[var(--color-surface-elevated)] border border-[var(--color-border-subtle)]"
                style={{ boxShadow: "var(--shadow-3)" }}
              >
                <span aria-hidden className="mt-0.5" style={{ color: V.color }}>
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </span>
                <div className="flex-1 min-w-0">
                  {t.title && (
                    <p className="text-[13px] font-semibold text-ink leading-tight mb-0.5">
                      {t.title}
                    </p>
                  )}
                  <p className="text-[13px] text-ink-soft leading-snug">{t.message}</p>
                </div>
                <button
                  onClick={() => dismiss(t.id)}
                  aria-label="Dismiss"
                  className="text-muted hover:text-ink p-1 -m-1 rounded"
                >
                  <X className="w-3.5 h-3.5" strokeWidth={2} />
                </button>
              </motion.div>
            );
          })}
        </AnimatePresence>
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}
```

- [ ] **Step 2: Build passes** (`npm run build`)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/Toast.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: add ToastProvider — aria-live, framer-motion presence, RTL-safe positioning"
```

---

## Task 9: Create PageTransition

**Files:**
- Create: `src/components/ui/PageTransition.jsx`

- [ ] **Step 1: Create the file**

```jsx
import React from "react";
import { AnimatePresence, motion } from "framer-motion";

export function PageTransition({ pageKey, children, className = "" }) {
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={pageKey}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -4 }}
        transition={{
          duration: 0.28,
          ease: [0.22, 1, 0.36, 1],
          exit: { duration: 0.2, ease: [0.4, 0, 1, 1] },
        }}
        className={className}
        style={{ minHeight: 0 }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}
```

- [ ] **Step 2: Build passes** (`npm run build`)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/PageTransition.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: add PageTransition (fade + 8px translateY, Cron-style)"
```

---

## Task 10: Rewrite Button (with legacy variant aliases)

**Files:**
- Modify: `src/components/ui/button.jsx`

- [ ] **Step 1: Replace the entire file**

```jsx
import React from "react";
import { Loader2 } from "lucide-react";

const sizes = {
  sm: "h-8 px-3 text-[13px] gap-1.5",
  md: "h-10 px-4 text-[14px] gap-2",
  lg: "h-12 px-5 text-[15px] gap-2.5",
};

const variants = {
  primary:
    "bg-accent text-paper-cool hover:brightness-105 active:scale-[0.98]",
  secondary:
    "bg-paper-cool text-ink border border-[var(--color-border-strong)] hover:border-[var(--color-accent)]",
  ghost:
    "bg-transparent text-ink-soft hover:bg-[var(--color-surface-sunken)] hover:text-ink",
  destructive:
    "bg-paper-cool text-[var(--color-danger)] border border-[var(--color-danger)] hover:bg-[color-mix(in_oklab,var(--color-danger)_12%,transparent)]",
  // Legacy aliases — preserved so v1.1 callers don't break.
  outline:
    "bg-paper-cool text-accent border border-[var(--color-accent)] hover:bg-paper-warm",
  danger:
    "bg-paper-cool text-accent border border-[var(--color-accent)] hover:bg-accent hover:text-paper-cool",
};

const base =
  "inline-flex items-center justify-center font-medium rounded-[8px] " +
  "transition-[transform,background-color,border-color,color,filter] duration-150 " +
  "disabled:opacity-50 disabled:pointer-events-none " +
  "select-none whitespace-nowrap";

function Dots() {
  return (
    <span className="inline-flex items-center gap-1" aria-hidden>
      <span className="dot-a w-1 h-1 rounded-full bg-current opacity-70" />
      <span className="dot-b w-1 h-1 rounded-full bg-current opacity-70" />
      <span className="dot-c w-1 h-1 rounded-full bg-current opacity-70" />
      <style>{`
        .dot-a, .dot-b, .dot-c { animation: dot-pulse 1100ms ease-in-out infinite; }
        .dot-b { animation-delay: 140ms; }
        .dot-c { animation-delay: 280ms; }
        @keyframes dot-pulse {
          0%, 60%, 100% { opacity: 0.4; transform: scale(1); }
          30% { opacity: 1; transform: scale(1.2); }
        }
        @media (prefers-reduced-motion: reduce) {
          .dot-a, .dot-b, .dot-c { animation: none; opacity: 0.7; }
        }
      `}</style>
    </span>
  );
}

export function Button({
  className = "",
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  ...props
}) {
  return (
    <button
      className={[
        base,
        sizes[size] || sizes.md,
        variants[variant] || variants.primary,
        className,
      ].join(" ")}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading ? <Dots /> : children}
    </button>
  );
}
```

- [ ] **Step 2: Build passes** (`npm run build`)

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/button.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: rewrite Button — sm/md/lg sizes, primary/secondary/ghost/destructive variants, 3-dot loading, legacy aliases preserved"
```

---

## Task 11: Rewrite Card (with variants)

**Files:**
- Modify: `src/components/ui/card.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import React from "react";

export function Card({
  className = "",
  variant = "default",
  children,
  ...props
}) {
  const base = "rounded-[16px] bg-paper-cool";
  const styles = {
    default:
      "border border-[var(--color-border-subtle)]",
    hoverable:
      "border border-[var(--color-border-subtle)] transition-[transform,box-shadow] duration-200 " +
      "hover:-translate-y-[0.5px] hover:shadow-[var(--shadow-2)] cursor-pointer",
    elevated:
      "bg-[var(--color-surface-elevated)] shadow-[var(--shadow-3)]",
    sunken:
      "bg-[var(--color-surface-sunken)] border border-[var(--color-border-subtle)]",
  };
  return (
    <div className={[base, styles[variant] || styles.default, className].join(" ")} {...props}>
      {children}
    </div>
  );
}

export function CardContent({ className = "", children, ...props }) {
  return (
    <div className={className} {...props}>
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Build passes**

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/card.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: Card — single-level rule, default/hoverable/elevated/sunken variants"
```

---

## Task 12: Wire main.jsx with ThemeProvider + ToastProvider + PageTransition

**Files:**
- Modify: `src/main.jsx`

- [ ] **Step 1: Replace the file**

```jsx
import React, { useEffect } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import StudioApp from "./App.jsx";
import Landing from "./views/Landing.jsx";
import { useRoute, navigate, clearRoute } from "./lib/route.js";
import { LanguageProvider } from "./lib/i18n.jsx";
import { ThemeProvider } from "./lib/theme.jsx";
import { ToastProvider } from "./components/ui/Toast.jsx";
import { PageTransition } from "./components/ui/PageTransition.jsx";
import AccessibilityWidget from "./views/AccessibilityWidget.jsx";

function Root() {
  const route = useRoute();
  const inStudio = route !== null;

  useEffect(() => {
    document.body.classList.toggle("studio-open", inStudio);
    if (!inStudio) window.scrollTo(0, 0);
  }, [inStudio]);

  return (
    <>
      <PageTransition pageKey={inStudio ? "studio" : "landing"}>
        {inStudio ? (
          <StudioApp onClose={() => clearRoute()} />
        ) : (
          <Landing onOpenStudio={() => navigate(["planner"])} />
        )}
      </PageTransition>
      <AccessibilityWidget />
    </>
  );
}

createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ToastProvider>
          <Root />
        </ToastProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>
);
```

- [ ] **Step 2: Build passes** (`npm run build`)

- [ ] **Step 3: Commit**

```bash
git add src/main.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: wire ThemeProvider + ToastProvider + PageTransition in main.jsx"
```

---

## Task 13: Update App.jsx — desktop top strip + mobile bar + Planner overflow + ThemeToggle placement

**Files:**
- Modify: `src/App.jsx`

- [ ] **Step 1: Add ThemeToggle + PageTransition imports**

After the existing `import AccountMenu from "./views/AccountMenu";` line, add:

```jsx
import HelpPopover from "./views/HelpPopover";
import { ThemeToggle } from "./components/ui/ThemeToggle";
import { PageTransition } from "./components/ui/PageTransition";
```

- [ ] **Step 2: Mobile top bar — insert ThemeToggle**

Find the mobile top bar block:
```jsx
          <button
            onClick={() => navigate([DEFAULT_ROUTE[role]])}
            className="font-serif text-lg font-medium text-ink leading-none flex-1 text-start truncate"
          >
            Murchid
          </button>
          <LangToggle />
```

Insert `<ThemeToggle />` between the Murchid button and `<LangToggle />`:

```jsx
          <button
            onClick={() => navigate([DEFAULT_ROUTE[role]])}
            className="font-serif text-lg font-medium text-ink leading-none flex-1 text-start truncate"
          >
            Murchid
          </button>
          <ThemeToggle />
          <LangToggle />
```

- [ ] **Step 3: Add the desktop top strip sibling and update the content container**

Find the existing `<div className="relative flex-1 overflow-y-auto bg-paper px-4 ... ">` content container and the floating absolute buttons inside it (the `sidebarCollapsed` PanelLeftOpen + the `onClose` X). Replace from BEFORE that container through the end of those two absolute buttons with:

```jsx
        {/* Desktop top strip — gives the global controls a dedicated zone */}
        <div className="hidden md:flex items-center gap-2 h-10 px-4 border-b border-line bg-paper flex-shrink-0 print:hidden">
          {sidebarCollapsed && (
            <button
              type="button"
              onClick={toggleSidebar}
              title="Show sidebar"
              aria-label="Show sidebar"
              className="h-8 w-8 rounded-md text-ink-soft hover:text-ink hover:bg-paper-warm flex items-center justify-center transition"
            >
              <PanelLeftOpen size={15} className="rtl:rotate-180" />
            </button>
          )}
          <span className="flex-1" />
          <ThemeToggle />
          <LangToggle />
          {onClose && (
            <button
              onClick={onClose}
              title="Back to landing page"
              aria-label="Back to landing page"
              className="h-8 w-8 rounded-md text-ink-soft hover:bg-paper-warm hover:text-ink flex items-center justify-center transition"
            >
              <X size={14} />
            </button>
          )}
        </div>

        <div
          className={`relative flex-1 bg-paper px-4 pt-3 pb-6 sm:px-6 md:pt-3 md:pb-2 md:ps-8 md:pe-8 ${
            section === "planner" ? "overflow-hidden min-h-0" : "overflow-y-auto"
          }`}
        >
```

The `pl-*/pr-*` removal (`md:ps-8 md:pe-8`) is intentional — the floating cluster's left/right offsets are no longer needed because the cluster moved into the top strip.

- [ ] **Step 4: Wrap mainContent in PageTransition with `h-full` for planner**

Find the existing mainContent render block:
```jsx
          {TEACHING_RAIL_SECTIONS.has(section) ? (
            <div className="lg:flex lg:gap-6 h-full">
              <div className="flex-1 min-w-0">{mainContent}</div>
              <div className="hidden lg:block flex-shrink-0">
                <TeachingRail />
              </div>
            </div>
          ) : (
            mainContent
          )}
```

Replace with:
```jsx
          <PageTransition
            pageKey={`${section}/${sub || ""}/${extraId || ""}`}
            className={section === "planner" ? "h-full" : ""}
          >
            {TEACHING_RAIL_SECTIONS.has(section) ? (
              <div className="lg:flex lg:gap-6 h-full">
                <div className="flex-1 min-w-0">{mainContent}</div>
                <div className="hidden lg:block flex-shrink-0">
                  <TeachingRail />
                </div>
              </div>
            ) : (
              mainContent
            )}
          </PageTransition>
```

- [ ] **Step 5: Replace any `bg-[#fbf2e6]` hardcoded color with `bg-paper`**

Run a `replace_all` on `bg-[#fbf2e6]` → `bg-paper` across `src/App.jsx`.

- [ ] **Step 6: Build passes** (`npm run build`)

- [ ] **Step 7: Commit**

```bash
git add src/App.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: App shell — desktop top strip (no more floating cluster), Planner overflow-hidden case, PageTransition wraps mainContent"
```

---

## Task 14: Update i18n.jsx — smooth dir flip + LangToggle restyle

**Files:**
- Modify: `src/lib/i18n.jsx`

- [ ] **Step 1: Replace `applyDocumentLang` (around line 1285)**

Find:
```jsx
function applyDocumentLang(lang) {
  if (typeof document === "undefined") return;
  const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;
}
```

Replace with:
```jsx
function applyDocumentLang(lang) {
  if (typeof document === "undefined") return;
  const dir = RTL_LANGS.has(lang) ? "rtl" : "ltr";
  const root = document.documentElement;
  const prevDir = root.getAttribute("dir");
  root.lang = lang;
  root.dir = dir;
  if (prevDir && prevDir !== dir) {
    root.classList.add("lang-transition");
    window.setTimeout(() => root.classList.remove("lang-transition"), 360);
  }
}
```

- [ ] **Step 2: Restyle LangToggle**

Find the LangToggle markup (around line 1338+):

```jsx
      className={`inline-flex items-center rounded-full border border-line bg-paper-cool p-0.5 ${className}`}
      role="group"
      aria-label="Language"
      dir="ltr"
    >
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setLang(o.v)}
          className={`px-2.5 py-1 rounded-full text-[11px] font-medium leading-none transition ${
            lang === o.v
              ? "bg-ink text-paper-cool"
              : "text-ink-soft hover:text-ink"
          }`}
```

Replace with:

```jsx
      className={`inline-flex items-center rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-sunken)] p-1 ${className}`}
      role="group"
      aria-label="Language"
      dir="ltr"
    >
      {opts.map((o) => (
        <button
          key={o.v}
          type="button"
          onClick={() => setLang(o.v)}
          className={`min-w-[28px] h-7 px-2.5 rounded-full text-[12px] font-medium leading-none transition-colors duration-150 ${
            lang === o.v
              ? "bg-[var(--color-surface-card)] text-ink shadow-[var(--shadow-1)]"
              : "text-muted hover:text-ink"
          }`}
```

- [ ] **Step 3: Build passes**

- [ ] **Step 4: Commit**

```bash
git add src/lib/i18n.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: i18n — smooth EN↔AR dir flip animation + LangToggle restyled to match ThemeToggle"
```

---

## Task 15: AccessibilityWidget — reading mode + hex→token sweep

**Files:**
- Modify: `src/views/AccessibilityWidget.jsx`
- Modify: `src/lib/i18n.jsx` (i18n strings for reading-mode label)

- [ ] **Step 1: Add reading mode to DEFAULTS**

In `src/views/AccessibilityWidget.jsx`, find:
```jsx
  stopAnim: false,
  readAloud: false,
};
```

Replace with:
```jsx
  stopAnim: false,
  readAloud: false,
  readingMode: false,
};
```

- [ ] **Step 2: Apply reading-mode class in `applyToRoot`**

Find the `applyToRoot` function end (after `cl.toggle("a11y-read-aloud", s.readAloud);`):

Add:
```jsx
  document.documentElement.classList.toggle("reading-mode", !!s.readingMode);
}
```

- [ ] **Step 3: Add BookOpen import**

In the lucide-react import block, add `BookOpen`:
```jsx
import {
  Accessibility, X, Type, Eye, Volume2, RotateCcw,
  MousePointer2, Link2, Pause, Contrast, Droplet, Minus, Plus,
  BookOpen,
} from "lucide-react";
```

- [ ] **Step 4: Insert the Reading Mode toggle in the panel body**

Find `<Toggle icon={<Volume2 size={17} />} label={t("a11y.readAloud")}` and insert BEFORE it:

```jsx
          <Toggle
            icon={<BookOpen size={17} />}
            label={t("a11y.readingMode")}
            hint={t("a11y.readingModeHint")}
            on={s.readingMode}
            onToggle={() => set({ readingMode: !s.readingMode })}
            tOn={t("a11y.on")}
            tOff={t("a11y.off")}
          />
```

- [ ] **Step 5: Sweep hardcoded hex to CSS-var references**

Run `replace_all` on `src/views/AccessibilityWidget.jsx`:

| Old | New |
|---|---|
| `#d4c9b3` | `var(--color-border-subtle)` |
| `#f4ede0` | `var(--color-surface-page)` |
| `#c8472b` | `var(--color-accent)` |
| `#6b6354` | `var(--color-text-muted)` |
| `#ede4d3` | `var(--color-surface-sunken)` |
| `#1a1814` | `var(--color-text-primary)` |
| `#faf6ec` | `var(--color-surface-card)` |
| `#2d2a24` | `var(--color-text-secondary)` |
| `#e87a55` | `var(--color-accent-soft)` |
| `#6b7f5a` | `var(--color-success)` |

- [ ] **Step 6: Add i18n strings**

In `src/lib/i18n.jsx`, find the EN dict around `"a11y.readAloud": "Read aloud",` and insert BEFORE it:

```jsx
  "a11y.readingMode": "Reading mode",
  "a11y.readingModeHint": "Larger type, calmer line height, less UI chrome",
```

In the AR dict around `"a11y.readAloud": "قراءة بصوت",` insert BEFORE it:

```jsx
  "a11y.readingMode": "وضع القراءة",
  "a11y.readingModeHint": "خط أكبر، مسافات أهدأ، واجهة أبسط",
```

- [ ] **Step 7: Build passes**

- [ ] **Step 8: Commit**

```bash
git add src/views/AccessibilityWidget.jsx src/lib/i18n.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: AccessibilityWidget — Reading mode toggle (EN+AR) + hex→token sweep"
```

---

## Task 16: Sweep hardcoded hex in remaining view files

**Files:**
- Modify: `src/views/Landing.jsx`, `src/views/onboarding/ProfileForm.jsx`

- [ ] **Step 1: Landing.jsx hex sweep**

Run `replace_all` operations on `src/views/Landing.jsx`:

| Old | New |
|---|---|
| `bg-[#fbf2e6]` | `bg-paper` |
| `#fffdf6` | `#FDFAF3` |
| `#c8472b` | `#9C4F37` |
| `#1a1814` | `#1F1B14` |
| `#e6dccb` | `#E5DDC9` |
| `'JetBrains Mono', monospace` | `'Geist Mono', monospace` |
| `'Fraunces', serif` | `'Instrument Serif', serif` |

- [ ] **Step 2: ProfileForm.jsx hex sweep**

Run `replace_all` operations on `src/views/onboarding/ProfileForm.jsx`:

| Old | New |
|---|---|
| `#d4c9b3` | `#E5DDC9` |
| `#c8472b` | `#9C4F37` |
| `rgba(200, 71, 43, 0.12)` | `rgba(156, 79, 55, 0.16)` |
| `background: #fffdf6;` | `background: var(--color-surface-card);` |

- [ ] **Step 3: Build passes**

- [ ] **Step 4: Commit**

```bash
git add src/views/Landing.jsx src/views/onboarding/ProfileForm.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: sweep hardcoded hex in Landing.jsx + ProfileForm.jsx to new palette + font stack"
```

---

## Task 17: DataCard + CardsGrid update

**Files:**
- Modify: `src/views/_data-view.jsx`

- [ ] **Step 1: Update DataCard styling**

Find the existing `export function DataCard(...) {` block. Replace the outer `<div>` className + the action-button cluster top-3 right-3:

```jsx
export function DataCard({ onEdit, onDelete, className = "", children }) {
  return (
    <div
      className={`relative rounded-2xl border border-[var(--color-border-subtle)] bg-paper-cool shadow-[var(--shadow-2)] hover:border-[var(--color-border-strong)] hover:shadow-[var(--shadow-3)] hover:-translate-y-[1px] transition-[transform,box-shadow,border-color] duration-200 p-5 flex flex-col ${className}`}
    >
      <div className="absolute top-3 end-3 flex items-center gap-1">
```

(The `end-3` swap is RTL-safe; v1.1 had `right-3`.)

- [ ] **Step 2: Update CardsGrid with stagger entrance**

Find:
```jsx
export function CardsGrid({ children }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {children}
    </div>
  );
}
```

Replace with:
```jsx
export function CardsGrid({ children }) {
  const items = React.Children.toArray(children);
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {items.map((child, i) => (
        <div
          key={i}
          className="data-card-stagger"
          style={{ animationDelay: `${Math.min(i * 40, 320)}ms` }}
        >
          {child}
        </div>
      ))}
      <style>{`
        .data-card-stagger {
          animation: data-card-stagger 420ms cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        @keyframes data-card-stagger {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}
```

- [ ] **Step 3: Build passes**

- [ ] **Step 4: Commit**

```bash
git add src/views/_data-view.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: DataCard — token border + shadow, end-3 RTL-safe placement; CardsGrid staggers entrance 40ms"
```

---

## Task 18: Landing scope CSS + AR rules

**Files:**
- Modify: `src/landing.css`

- [ ] **Step 1: Remap landing-scope CSS vars to v3.0 palette**

Find the `.murchid-landing { ... }` block at the top. Replace its CSS vars block (lines covering `--paper` through `--line-strong`) and the `font-family` line with:

```css
.murchid-landing {
  --paper:       #F7F2E8;
  --paper-2:     #EFE9DC;
  --paper-3:     #E5DDC9;
  --ink:         #1F1B14;
  --ink-2:       #4A4338;
  --ink-3:       #7A715F;
  --clay:        #9C4F37;
  --clay-deep:   #6F3324;
  --sage:        #5A7A4A;
  --brick:       #A8392A;
  --brick-deep:  #7A2A1E;
  --brick-soft:  #D89E84;
  --line:        rgba(31, 27, 20, 0.08);
  --line-strong: rgba(31, 27, 20, 0.14);

  font-family: 'Geist', 'IBM Plex Sans Arabic', system-ui, sans-serif;
  background: var(--paper);
  color: var(--ink);
  font-feature-settings: 'cv11', 'ss01';
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  min-height: 100vh;
}
```

- [ ] **Step 2: Swap landing font-display + font-mono + eyebrow + add AR rules**

Find:
```css
.murchid-landing .font-display {
  font-family: 'Fraunces', Georgia, serif;
  font-optical-sizing: auto;
  letter-spacing: -0.02em;
}

.murchid-landing .font-mono { font-family: 'JetBrains Mono', monospace; }

.murchid-landing .eyebrow {
  font-family: 'JetBrains Mono', monospace;
  font-size: 11px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: var(--ink-3);
}
```

Replace with:
```css
.murchid-landing .font-display {
  font-family: 'Instrument Serif', 'IBM Plex Sans Arabic', Georgia, serif;
  font-optical-sizing: auto;
  letter-spacing: -0.015em;
}

.murchid-landing .font-mono { font-family: 'Geist Mono', 'IBM Plex Sans Arabic', monospace; }

.murchid-landing .eyebrow {
  font-family: 'Geist Mono', 'IBM Plex Sans Arabic', monospace;
  font-size: 11px;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--ink-3);
}

/* Arabic on the landing scope */
html[lang="ar"] .murchid-landing,
html[dir="rtl"] .murchid-landing {
  font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif;
}
html[lang="ar"] .murchid-landing .font-display,
html[dir="rtl"] .murchid-landing .font-display {
  font-family: 'IBM Plex Sans Arabic', system-ui, sans-serif;
  font-weight: 200;
  font-style: normal;
}
html[lang="ar"] .murchid-landing .eyebrow,
html[dir="rtl"] .murchid-landing .eyebrow {
  text-transform: none;
  font-weight: 700;
  letter-spacing: 0;
}
```

- [ ] **Step 3: Update `.ui-tab` font-family**

Find `.murchid-landing .ui-tab { font-family: 'Inter Tight', sans-serif;` and replace with `font-family: 'Geist', 'IBM Plex Sans Arabic', sans-serif;`.

- [ ] **Step 4: Build passes**

- [ ] **Step 5: Commit**

```bash
git add src/landing.css
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: landing scope — CSS vars remapped to v3.0 palette + font stack swap + Arabic rules (weight bump for eyebrow)"
```

---

## Task 19: Planner full re-layout (the main surgery)

**Files:**
- Modify: `src/views/Planner.jsx`

This is the largest single visual surgery. The Planner currently has a 4-card cluster (StudioHeroCard, ThisMonthOverviewCard, UpcomingCard, QuickActionsCard) above + alongside the calendar grid. Per the spec, this becomes: **month bento hero + day-card grid + single AI margin card at bottom.**

- [ ] **Step 1: Replace the month hero block (was lines ~268–278)**

Find:
```jsx
      <div className="mb-3">
        <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink leading-none tracking-tight">
          <span key={monthLabel} className="studio-tick">
            {monthName}
          </span>{" "}
          <em className="italic font-medium text-accent">{anchor.getFullYear()}</em>
        </h1>
        <p className="font-serif italic text-[13px] text-muted leading-snug mt-1.5">
          {t("planner.subtitle")}
        </p>
      </div>
```

Replace with the bento month hero (headline + month-at-a-glance mini-strip):

```jsx
      {/* ── Month hero (bento). Big italic Instrument Serif headline on
          the start side, compact month-at-a-glance mini-strip on the end. */}
      <div className="mb-3 flex items-end gap-4 flex-wrap">
        <div className="min-w-0">
          <h1 className="font-serif text-[36px] md:text-[44px] lg:text-[52px] text-ink leading-[0.95] tracking-[-0.015em]">
            <span key={monthLabel} className="studio-tick">{monthName}</span>{" "}
            <em className="italic text-accent font-normal">{anchor.getFullYear()}</em>
          </h1>
          <p className="font-serif italic text-[13px] text-muted leading-snug mt-2">
            {t("planner.subtitle")}
          </p>
        </div>
        <span className="flex-1" />
        <PlannerAtAGlance events={events} monthDate={anchor} todayStart={todayStart} />
      </div>
```

- [ ] **Step 2: Add the PlannerAtAGlance component**

At the bottom of `Planner.jsx` (before the final `export default function Planner()` closing, OR as a sibling function in the file), add:

```jsx
function PlannerAtAGlance({ events = [], monthDate, todayStart }) {
  const t = useT();
  const monthEvents = useMemo(() => {
    const y = monthDate.getFullYear();
    const m = monthDate.getMonth();
    return events.filter((e) => {
      const d = new Date(e.date);
      return d.getFullYear() === y && d.getMonth() === m;
    });
  }, [events, monthDate]);
  const planned = monthEvents.length;
  const completed = monthEvents.filter((e) => new Date(e.date) < todayStart).length;
  const todo = planned - completed;
  const stats = [
    { label: t("planner.planned"),   value: planned },
    { label: t("planner.completed"), value: completed },
    { label: t("planner.todo"),      value: todo },
  ];
  return (
    <div className="flex items-baseline gap-5 shrink-0">
      {stats.map((s, i) => (
        <div key={i} className="text-end">
          <div className="font-serif text-[28px] leading-none text-ink tabular-nums">
            {s.value}
          </div>
          <div className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-muted mt-1">
            {s.label}
          </div>
        </div>
      ))}
    </div>
  );
}
```

- [ ] **Step 3: Replace the grid section (everything between the filter chip row and the existing `</div>` closing the Planner)**

Find the existing block:
```jsx
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] grid-rows-[auto_1fr] gap-x-6 gap-y-3 items-stretch flex-1 min-h-0">
        {/* Row 1: Studio AI hero (left) + AI Insights (right), heights
            match via items-stretch. */}
        <div className="min-w-0">
          <StudioHeroCard />
        </div>
        <div className="min-w-0">
          <ThisMonthOverviewCard events={events} monthDate={anchor} todayStart={todayStart} />
        </div>
        ...
```

Replace from this `<div className="grid grid-cols-1 lg:grid-cols-[1fr_300px]...` through its closing `</div>` (the one matching the grid wrapper, but NOT the outer planner-view) with:

```jsx
      {/* ── Calendar fills remaining viewport. Below it, a single quiet
          AI margin card replaces the v1.1 4-card cluster. */}
      <div className="flex-1 min-h-0 flex flex-col gap-3">
        <div className="planner-grid planner-card-frame rounded-2xl bg-paper-cool overflow-hidden flex-1 flex flex-col min-h-0">
          <div className="grid grid-cols-7 border-b border-line bg-paper-cool flex-shrink-0">
            {weekdayLabels.map((d, i) => (
              <div
                key={i}
                className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted px-2 py-1.5 text-center"
              >
                {d}
              </div>
            ))}
          </div>
          <div
            className="grid grid-cols-7 flex-1 auto-rows-fr"
            style={{ gridTemplateRows: `repeat(${grid.length / 7}, 1fr)` }}
          >
            {grid.map((d, i) => {
              const inMonth = d.getMonth() === anchor.getMonth();
              const isToday = sameYMD(d, today);
              const isPast = !isToday && d < todayStart;
              const dayEvents = eventsByDate.get(isoKey(d)) || [];
              const shown = dayEvents.slice(0, 2);
              const overflow = dayEvents.length - shown.length;
              const lastRowStart = grid.length - 7;
              return (
                <div
                  key={i}
                  role="button"
                  tabIndex={0}
                  onClick={() => setDayListDate(isoKey(d))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      setDayListDate(isoKey(d));
                    }
                  }}
                  className={`planner-cell border-b border-e border-line/70 px-2 pt-1.5 pb-1.5 min-h-[64px] flex flex-col gap-1 cursor-pointer transition-[transform,box-shadow,background-color] duration-150 ${
                    inMonth
                      ? isPast ? "bg-paper-cool/50" : "bg-paper-cool"
                      : "bg-paper-warm/40 text-muted/60"
                  } hover:-translate-y-[1px] hover:shadow-[var(--shadow-2)] focus:outline-none focus:ring-2 focus:ring-accent/40 focus:ring-inset ${
                    isToday ? "planner-cell-today" : ""
                  } ${(i + 1) % 7 === 0 ? "border-e-0" : ""} ${i >= lastRowStart ? "border-b-0" : ""}`}
                  style={{ animationDelay: `${(i % 14) * 18}ms` }}
                >
                  <div className="flex items-start justify-between gap-1">
                    <span
                      className={`font-mono text-[11px] leading-none ${
                        isToday
                          ? "h-6 w-6 rounded-full bg-accent text-paper-cool flex items-center justify-center font-medium text-[11.5px]"
                          : inMonth
                            ? isPast ? "text-muted/70" : "text-ink-soft"
                            : "text-muted/60"
                      }`}
                    >
                      {d.getDate()}
                    </span>
                    {dayEvents.length > 0 && (
                      <span className="font-mono text-[10px] text-muted">{dayEvents.length}</span>
                    )}
                  </div>
                  <div className={`flex-1 flex flex-col gap-1 min-h-0 ${isPast ? "opacity-60" : ""}`}>
                    {shown.map((e) => {
                      const cat = CATEGORIES.find((c) => c.key === e.kind);
                      const s = COLOR_STYLES[cat?.color || "ink"];
                      return (
                        <span
                          key={e.id}
                          title={`${cat?.label || e.kind} · ${e.title}${e.time ? ` · ${e.time}` : ""}`}
                          className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${s.chipBg} ${s.chipText} text-[10.5px] leading-tight pointer-events-none`}
                        >
                          <span className={`h-1 w-1 flex-shrink-0 rounded-full ${s.dot}`} />
                          <span className="truncate">{e.title}</span>
                        </span>
                      );
                    })}
                    {overflow > 0 && (
                      <span className="font-serif italic text-[10.5px] text-muted px-1.5">
                        +{overflow} more
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── AI margin card. Quiet, sits below the calendar, replaces the
            v1.1 StudioHero / ThisMonth / Upcoming / QuickActions cluster. */}
        <AIMarginCard />
      </div>
```

- [ ] **Step 4: Add the AIMarginCard component**

After the `PlannerAtAGlance` function (added in Step 2), add:

```jsx
function AIMarginCard() {
  const t = useT();
  const verbs = [
    { key: "lesson",       icon: BookOpen,      kind: "lesson_plan" },
    { key: "quiz",         icon: GraduationCap, kind: "quiz" },
    { key: "homework",     icon: ClipboardList, kind: "homework" },
    { key: "presentation", icon: Layout,        kind: "presentation" },
  ];
  return (
    <div className="rounded-2xl border border-[var(--color-border-subtle)] bg-paper-cool px-5 py-4 flex items-center gap-5 flex-wrap">
      <div className="min-w-0 flex-1">
        <p className="font-serif italic text-[15px] text-ink leading-snug">
          Murchid is ready. <span className="text-muted">What would you like to draft today?</span>
        </p>
      </div>
      <div className="flex items-center gap-2 flex-wrap">
        {verbs.map((v) => {
          const Icon = v.icon;
          return (
            <button
              key={v.key}
              type="button"
              onClick={() => navigate(["studio", v.kind])}
              className="inline-flex items-center gap-1.5 h-8 px-3 rounded-full border border-[var(--color-border-subtle)] bg-[var(--color-surface-card)] hover:border-accent hover:bg-[color-mix(in_oklab,var(--color-accent)_8%,transparent)] text-ink-soft hover:text-ink text-[12.5px] font-medium transition-colors duration-150"
            >
              <Icon size={13} strokeWidth={2} className="text-accent" />
              {t(`hero.${v.key}.noun`)}
            </button>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 5: Remove now-unused references**

Delete the `StudioHeroCard`, `ThisMonthOverviewCard`, `UpcomingCard`, and `QuickActionsCard` function calls' JSX (they were inside the grid we deleted). The function declarations can stay (harmless dead code) OR be deleted — the spec doesn't require removing them.

- [ ] **Step 6: Build passes**

```bash
npm run build
```

- [ ] **Step 7: Commit**

```bash
git add src/views/Planner.jsx
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" commit -m "v3.0: Planner — full re-layout (bento hero, day-card mini grid, AI margin card replaces 4-card cluster)"
```

---

## Task 20: Verification

**Files:** (no edits; verification only)

- [ ] **Step 1: Clean build**

```bash
rm -rf dist && npm run build
```

Expected: `✓ built in <Ns>` clean, CSS + JS chunks shipped.

- [ ] **Step 2: Dev server boots**

```bash
npm run dev > /tmp/murchid-dev.log 2>&1 &
DEV_PID=$!
sleep 4
if ps -p $DEV_PID > /dev/null; then
  echo "DEV_BOOTED_OK"
  kill $DEV_PID
fi
wait 2>/dev/null
```

Expected: log shows `VITE v5.x ready`, no error stack traces.

- [ ] **Step 3: Manual visual smoke checklist**

Open `http://localhost:5173/`, navigate to studio (#/planner). Verify each of:

- [ ] Landing renders, fonts loaded (Instrument Serif visible)
- [ ] Top strip on desktop has Theme + Lang + Close
- [ ] Theme toggle cycles Light → System → Dark with persistence
- [ ] Dark mode body text is warm cream `#F0E9D9`, not pure white
- [ ] Sidebar studio launcher is a quiet dark card (no aurora swirl)
- [ ] Sidebar nav item hover is a calm bg fade (no x-translate, no rail)
- [ ] Planner: month headline is 44–52px italic serif
- [ ] Planner: month-at-a-glance shows planned/completed/todo with tabular numbers
- [ ] Planner: AI margin card sits below calendar with 4 verb chips
- [ ] Planner fits the viewport on 1366×900 — no vertical scroll
- [ ] EN ↔ AR toggle flips direction smoothly (320ms transition)
- [ ] AR layout has navigation/icons mirrored; AR eyebrow uses weight bump
- [ ] AccessibilityWidget shows the Reading mode toggle
- [ ] Reading mode bumps body to 18px / 1.78 line-height
- [ ] `prefers-reduced-motion: reduce` (macOS Accessibility) collapses all animations

- [ ] **Step 4: Anti-slop guardrail re-check**

Re-read `docs/superpowers/specs/2026-05-21-teachers-atelier-design.md` §10 (Anti-slop guardrails). Confirm:

- [ ] No purple-blue gradients (`grep -rn 'via-purple\|via-blue\|from-purple\|from-blue' src/` returns 0)
- [ ] No glassmorphism outside modal backdrops
- [ ] No gradient text headings
- [ ] No nested cards introduced
- [ ] No animations >500ms in app shell (grep for `duration-[5-9]00` etc.)
- [ ] No `animate-spin` as primary loading feedback in v3.0 code

- [ ] **Step 5: No code changes; close any errant dev server**

```bash
pkill -f "vite" 2>/dev/null || true
```

---

## Task 21: Tag v3.0 + push

**Files:** (no edits; git operations only)

- [ ] **Step 1: Confirm working tree clean**

```bash
git status --short
```

Expected: empty output (or only untracked `design-motion-principles/` which is in `.gitignore` if added previously).

- [ ] **Step 2: Tag v3.0**

```bash
git -c user.name="Issa" -c user.email="issa.mjq@gmail.com" tag -a v3.0 -m "$(cat <<'EOF'
v3.0 — Murchid "The Teacher's Atelier"

Full visual surgery off v1.1 (commit 2fdf076). Per the approved spec
docs/superpowers/specs/2026-05-21-teachers-atelier-design.md:

- Semantic token layer + warm-light "paper" / warm-dark "candlelit" themes
- Tri-state ThemeToggle (Light / System / Dark), reachable from every screen
- Type stack: Instrument Serif + Geist + IBM Plex Sans Arabic + Geist Mono
- Calmer clay-ember accent (#9C4F37)
- Cut ornament: sidebar aurora launcher → quiet ink card, brand halo cut,
  active-nav rail+shadow cut, planner orb + today-cell sparkle cut,
  studio-card scale+blur replaced by PageTransition
- Planner full re-layout: bento month hero with at-a-glance mini-strip,
  day-card mini grid, single AI margin card replaces the v1.1 4-card cluster
- App shell: desktop top strip replaces floating control cluster
- New primitives: ThemeToggle, Toast, PageTransition, Input, Field,
  Skeleton, EmptyState
- Reading mode in AccessibilityWidget
- Smooth EN ↔ AR direction flip
- Logical CSS (ps/pe/ms/me/start/end) in newly-touched code
- prefers-reduced-motion fallback for every keyframe

Restore previous look: git checkout v1.1
EOF
)"
```

- [ ] **Step 3: Push main + tag**

```bash
git push origin main
git push origin v3.0
```

Expected: main pushed (fast-forward from v1.1), tag `v3.0` registered on origin.

- [ ] **Step 4: Update version-tags memory**

Append a line to `/Users/issa/.claude/projects/-Users-issa-Documents-MJQ-Projects-LessonPlanner-App-TeachingAssistant/memory/project_version_tags.md` under "Known versions":

```
- `v3.0` — saved 2026-05-21. "The Teacher's Atelier" redesign per docs/superpowers/specs/2026-05-21-teachers-atelier-design.md. Branched cleanly off v1.1; real layout surgery (not paint).
```

---

## Spec self-review

After writing this plan, looked at the spec with fresh eyes.

**Spec coverage** — every section in the spec has a task implementing it:

| Spec section | Task(s) |
|---|---|
| §2.1 Color tokens (light + dark) | Task 2 |
| §2.2 Typography stack | Task 1 + Task 2 |
| §2.3 Spacing | Task 2 (in @theme block) |
| §2.4 Radius | Task 2 |
| §2.5 Elevation | Task 2 |
| §2.6 Motion | Task 2 |
| §2.7 Reading mode | Task 2 (CSS) + Task 15 (toggle wiring) |
| §3.1 Sidebar | Task 3 (CSS cuts) |
| §3.2 App shell top strip | Task 13 |
| §3.3 Planner full re-layout | Task 19 |
| §3.4 Section transitions | Task 9 + Task 13 |
| §3.5 Base components | Tasks 5, 6, 7, 8, 9, 10, 11 |
| §4 Motion choreography | Task 2 + per-component |
| §5 Bilingual + RTL | Task 2 (helpers) + Task 14 + Task 18 |
| §6 Accessibility | Task 2 (focus-ring rule) + per-component |
| §7 Responsive | implicit in surface tasks |
| §8 Files | task-by-task mapping in this plan |
| §9 Verification | Task 20 |
| §10 Anti-slop guardrails | Task 20 §4 |
| §11 Rollback | covered by tag v1.1 + Task 21 commit message |

**Placeholder scan** — no TODOs / TBDs in the plan; every step has concrete code or commands.

**Type consistency** — Component prop names match across tasks (e.g. `pageKey` on PageTransition, `variant` on Button + Card, `toast()` signature on ToastProvider).

**Scope check** — this is one cohesive implementation; out-of-scope (Studio internals, Landing HeroJourney rebuild, backend) is explicit.

