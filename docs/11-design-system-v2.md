# Murchid Design System v2.0 — "Editorial Calm"

> Locked 2026-05-21. The teacher's eye is the constraint, not the canvas.

A re-skin of Murchid that reads like a quiet library page. Paper-tone
surfaces, one editorial italic for emotion, one workhorse sans for
everything else, a single warm clay-ember used like a red marginal
mark — sparingly, only when something earns it. The dark theme is a
candlelit study, not a fintech terminal.

Direction inheritance: Notion's calm + Linear's precision + Apple's
polish + Duolingo's warmth. Explicitly **not** SaaS gradient slop,
glassmorphism, or "vibrant block-based" dashboard.

---

## 1. Color tokens (semantic, role-named)

### Light theme — "paper"

| Token | Hex | Purpose |
|---|---|---|
| `--surface-page` | `#F7F2E8` | App background |
| `--surface-card` | `#FDFAF3` | Cards, panels |
| `--surface-elevated` | `#FFFEF8` | Modals, popovers |
| `--surface-sunken` | `#EFE9DC` | Table headers, inputs |
| `--text-primary` | `#1F1B14` | Body & headings |
| `--text-secondary` | `#4A4338` | Captions |
| `--text-muted` | `#7A715F` | Placeholder |
| `--text-on-accent` | `#FDFAF3` | Text on filled accent |
| `--border-subtle` | `#E5DDC9` | Default border |
| `--border-strong` | `#C8BFA8` | Hover / focus border |
| `--accent` | `#9C4F37` | Clay-ember brand accent |
| `--accent-soft` | `#E3C4B0` | Accent chip backgrounds |
| `--secondary` | `#5A7A4A` | Sage secondary |
| `--gold` | `#9E7E36` | Premium tier accent |
| `--success` | `#5A7A4A` | Confirmations |
| `--warning` | `#9E7E36` | Cautions |
| `--danger` | `#A8392A` | Destructive only |
| `--focus-ring` | `#9C4F37` | 3px ring @ 35% opacity, 2px offset |

### Dark theme — "candlelit"

Warm dark, NOT pure black, NOT navy. Foreground is `#F0E9D9` (warm
cream), never pure white — prevents halation.

| Token | Hex |
|---|---|
| `--surface-page` | `#1A1714` |
| `--surface-card` | `#22201C` |
| `--surface-elevated` | `#2A2723` |
| `--surface-sunken` | `#141210` |
| `--text-primary` | `#F0E9D9` |
| `--text-secondary` | `#C2B89E` |
| `--text-muted` | `#8B8270` |
| `--text-on-accent` | `#1A1714` |
| `--border-subtle` | `#33302A` |
| `--border-strong` | `#4D4940` |
| `--accent` | `#D89E84` |
| `--accent-soft` | `#5D3D2A` |
| `--success` | `#92A878` |
| `--warning` | `#D9B97A` |
| `--danger` | `#D17A6B` |
| `--focus-ring` | `#D89E84` |

In dark mode, prefer surface-tint shift over shadows.

---

## 2. Typography

| Slot | Latin | Arabic |
|---|---|---|
| Editorial display | **Instrument Serif** (italic for accents) | **IBM Plex Sans Arabic** (extralight at display sizes) |
| UI / Body sans | **Geist** | **IBM Plex Sans Arabic** |
| Mono / Data | **Geist Mono** | **IBM Plex Sans Arabic** w/ tabular figures |

### Type scale

| Role | EN px | AR px | Line-height | Weight | Use |
|---|---|---|---|---|---|
| `display` | 48 | 44 | 1.10 | Serif italic 400 | Hero |
| `h1` | 36 | 34 | 1.20 | Sans 500 | Page title |
| `h2` | 28 | 26 | 1.25 | Sans 500 | Section |
| `h3` | 22 | 21 | 1.30 | Sans 500 | Sub-section |
| `h4` | 18 | 17 | 1.35 | Sans 600 | Inline group |
| `body-lg` | 18 | 17 | 1.65 | Sans 400 | Reading mode |
| `body` | 16 | 15 | 1.65 | Sans 400 | Default |
| `body-sm` | 14 | 13 | 1.55 | Sans 400 | Helper |
| `caption` | 12 | 12 | 1.40 | Sans 500 | Timestamps |
| `eyebrow` | 11 | 11 | 1.40 | Sans 600 | Tracked label |

AR optical sizes run -1 to -2px vs Latin because AR has a taller
x-height. Eyebrow uppercase is meaningless in AR — use weight 700 bump
instead.

---

## 3. Spacing (4pt grid)

`0 / 4 / 8 / 12 / 16 / 20 / 24 / 32 / 40 / 48 / 64 / 96` — exposed as
`--space-0` through `--space-11`. Touch target floor 44px.

## 4. Radius

`xs 4 / sm 8 / md 12 / lg 16 / xl 20 / 2xl 28 / pill 999`

## 5. Elevation

```
shadow-0  none
shadow-1  0 1px 2px rgba(31,27,20,.04)
shadow-2  0 4px 12px -4px rgba(31,27,20,.06)
shadow-3  0 8px 24px -8px rgba(31,27,20,.10)
shadow-4  0 16px 48px -16px rgba(31,27,20,.14)
```

Long sessions = quiet shadows. Cards use border-only; shadows escalate
only at modal level.

## 6. Motion

| Token | Value |
|---|---|
| `--duration-instant` | 80ms |
| `--duration-fast` | 150ms |
| `--duration-base` | 240ms |
| `--duration-slow` | 360ms |
| `--duration-marketing` | 480ms (landing only) |
| `--ease-out` | `cubic-bezier(.22, 1, .36, 1)` |
| `--ease-in-out` | `cubic-bezier(.45, 0, .55, 1)` |
| `--ease-in` | `cubic-bezier(.4, 0, 1, 1)` |
| `--ease-natural` | `cubic-bezier(.32, .72, 0, 1)` (no bounce) |

Forbidden: bouncy curves (overshoot > 1.02), `linear` except for
opacity crossfades, any duration > 500ms inside the app shell.

Reduced-motion: durations collapse to 1ms, transition-property
restricted to opacity.

---

## 7. Component contract

- **Button** — sm/md/lg sizes; primary/secondary/ghost/destructive
  variants; 3-dot pulse instead of spinner on loading; focus ring 3px
  @ 35% accent at 2px offset.
- **Field** — label above (eyebrow), input, persistent helper,
  inline-replaced error w/ `role="alert"`. No placeholder-as-label.
- **Card** — single level only. No card-in-card. Border-only by
  default; shadow only when hoverable.
- **Modal** — backdrop 60% surface-page + 4px blur. Panel scale-in.
  Sheet variant for mobile.
- **Toast** — `aria-live="polite"`, auto-dismiss 4s, swipe to dismiss.
- **Skeleton** — pulse opacity 0.6→1 over 1400ms ease-in-out.
- **ThemeToggle** — tri-state Light / Dark / System. localStorage
  `murchid.theme`. Top-end of every screen.
- **PageTransition** — `opacity + translateY 8px`, 280ms ease-out
  enter, 200ms ease-in exit.

---

## 8. Anti-slop checklist

**Visual** — no purple-blue gradients · no glassmorphism · no gradient
text headings · no abstract 3D blobs · no emoji icons · no nested
cards · no double borders · no saturated red/orange > 5% viewport ·
no pure white-on-black.

**Motion** — every animation answers "what state did this
communicate?" · no bounce / elastic / overshoot > 1.02 · no animation
> 500ms in app shell · no infinite decorative loops · no
scroll-triggered reveals inside the app · reduced-motion fallback for
every keyframe · no spinner as primary loading feedback.

**Bilingual** — `lang="ar"` correctly swaps fonts · no
`pl/pr/ml/mr/left/right` in new code, only logical `ps/pe/ms/me/start/end`
· AR layout flipped end-to-end · AR eyebrow uses weight bump not
uppercase.

**Accessibility** — visible focus ring on every interactive · body ≥
AA, reading-mode ≥ AAA · form errors via `role="alert"` /
`aria-live` · touch targets ≥ 44×44 · theme toggle ≤ 1 click from
anywhere.

**Responsive** — verified at iPad landscape 1366×1024 (primary
classroom format) · iPad portrait 1024×1366 · small phone 375×667 ·
use `dvh` not `vh`.
