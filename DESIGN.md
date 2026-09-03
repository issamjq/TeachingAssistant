---
name: Murchid
description: One world. Firozeh turquoise rationed across a matte plaster ground, Gambetta over Switzer, shared by the marketing site and the studio.
colors:
  paper: "#e1dfd6"
  paper-warm: "#d8d5ca"
  paper-cool: "#fbfaf7"
  surface: "#fbfaf7"
  ink: "#0e1516"
  ink-soft: "#333c3f"
  muted: "#586260"
  line: "#c2c0b4"
  line-soft: "#d4d1c6"
  line-strong: "#b3b0a2"
  accent: "#12585f"
  accent-hover: "#0d454b"
  accent-soft: "#dbe8e8"
  accent-on-ink: "#8fc9c4"
  on-accent: "#fbfaf7"
  ok: "#2f6e52"
  warn: "#94661f"
  crit: "#a0453c"
  ambient-deep: "#0b3c42"
  ambient-mid: "#17646c"
  ambient-lift: "#57a6ad"
  ambient-pale: "#e3efef"
typography:
  display:
    fontFamily: "Gambetta, Georgia, serif"
    fontSize: "clamp(28px, 4.2vw, 56px)"
    fontWeight: 400
    lineHeight: 1.04
    letterSpacing: "-0.016em"
  headline:
    fontFamily: "Gambetta, Georgia, serif"
    fontWeight: 400
    fontSize: "clamp(22px, 2.6vw, 36px)"
    lineHeight: 1.15
    letterSpacing: "-0.02em"
  title:
    fontFamily: "Switzer, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 600
    fontSize: "15px"
    lineHeight: 1.3
  body:
    fontFamily: "Switzer, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 400
    fontSize: "14px"
    lineHeight: 1.55
  label:
    fontFamily: "Switzer, ui-sans-serif, system-ui, sans-serif"
    fontWeight: 500
    fontSize: "clamp(11px, 1vw, 13px)"
    letterSpacing: "0.18em"
  arabic-display:
    fontFamily: "Reem Kufi, Cairo, ui-sans-serif, sans-serif"
    fontWeight: 600
  arabic-body:
    fontFamily: "Cairo, ui-sans-serif, sans-serif"
    fontWeight: 400
rounded:
  field: "10px"
  card: "16px"
  hero: "clamp(18px, 2vw, 26px)"
  pill: "999px"
spacing:
  gutter: "clamp(16px, 3.5vw, 40px)"
  block: "clamp(16px, 3vw, 32px)"
  card-pad: "24px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.paper-cool}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-primary-hover:
    backgroundColor: "{colors.ink-soft}"
    textColor: "{colors.paper-cool}"
  button-secondary:
    backgroundColor: "{colors.paper-cool}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.accent}"
    rounded: "{rounded.pill}"
    padding: "8px 16px"
  card-flat:
    backgroundColor: "{colors.paper-cool}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  card-raised:
    backgroundColor: "{colors.paper-cool}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "{spacing.card-pad}"
  nav-item:
    backgroundColor: "transparent"
    textColor: "{colors.ink-soft}"
    rounded: "{rounded.field}"
    padding: "8px 12px 8px 16px"
  nav-item-active:
    backgroundColor: "{colors.accent-soft}"
    textColor: "{colors.accent-hover}"
    rounded: "{rounded.field}"
  search-field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.pill}"
    padding: "7px 12px"
---

# Design System: Murchid

> **One visual world, used by both surfaces.**
>
> The marketing site was rebuilt on 2026-08-11 to use the product's own
> material rather than a separate marketing identity. An earlier pass gave
> marketing its own screenprinted world; the result was that the site and
> the product looked like two different companies, and every real product
> screenshot landed on the page as a foreign object. That world is deleted.
>
> The tokens below are therefore normative for **both** the studio and the
> marketing site. The marketing surface adds a type scale and motion rules
> of its own, documented immediately below, but no new colours.

## The marketing surface

**Single scroll.** `/` carries hero, steps, outputs, term timeline,
bilingual band, pricing, questions and close. `/pricing`, `/faq` and
`/how-it-works` survive as redirects onto the matching anchor so links
already shared or indexed still land correctly. `/signup`, `/signin` and
`/legal/*` are separate routes and use the same world.

### Evidence, not assertion

Every screenshot on the page is a real capture of the running studio holding
the seeded demonstration term, taken from `/planner`, `/studio`,
`/lesson-plans`, `/quizzes`, `/dashboard` and `/database/students`. They live
in `public/marketing/`.

**The No-Mock Rule.** A product preview built out of styled `div`s is
forbidden. If the page needs to show the product, it shows the product.
Demonstration data is labelled wherever a visitor could mistake it for a
specific real school.

**The Owner-Supplied Proof Rule.** No testimonial, customer name, logo,
statistic, or curriculum endorsement appears unless the owner supplied it
verbatim. A previous version of this page carried eight invented teachers, a
time-saved statistic from a product with no analytics, and a Ministry
alignment claim its own FAQ contradicted. All three are gone.

### Type scale

Gambetta at weight 400 for display, Switzer for everything else, Reem
Kufi for the Arabic lockup and Cairo for running Arabic. Eleven steps, each
with a job, declared as custom properties on `.page` in
`src/features/marketing/Landing.module.css`:

- `--t-1` 13px micro, `--t-2` 14.5px small, `--t-3` 15.5px default,
  `--t-4` 18px, `--t-5` 20px, `--t-6` 24px, `--t-body` fluid 15.5 to 18px
- `--d-1` step titles, `--d-2` auth title, `--d-3` section titles,
  `--d-4` hero and closing, `--d-5` the price

**The Eleven Steps Rule.** This scale replaced twenty ad hoc sizes that
included 13/13.5, 14/14.5 and 15/15.5 pairs differing by half a pixel. Add a
step only when no existing one can do the job, and add it here first.

**The No-Eyebrow Rule.** Zero, not one. This rule used to budget "at most one
per three sections" and claim the page used exactly one; by 2026-09-03 it was
carrying three (`mk.how.eyebrow`, `mk.faq.eyebrow`, `mk.final.kicker`), which
is how a budget of one ends. All three are gone, along with the decorative
`01`-`06` numbering on the FAQ, whose order carries no information a reader
needs. A label that restates the heading beneath it is furniture. The heading
carries its own weight.

**Zero em-dashes.** Not in headlines, labels, body, buttons or alt text. Use
a period, a comma, or a hyphen. Six were sitting in the shipped `mk.*` copy on
2026-09-03 (hero lede, both pricing lines, and three free-period strings) and
are gone from English and Arabic alike.

### The 2026-09-03 contrast re-measure

The page read as one flat grey field and the instinct was to blame the text.
The text was fine: ink 14.65:1, muted 4.55:1. The defect was **structural** —
the plaster ground sat 1.12:1 from the chalk surface and the hairline 1.29:1
from the ground, so cards, bento cells and table rules dissolved into the page.
A card whose edge you cannot see is not a card.

Every ground, surface and line hex moved; text colours barely did. Ground to
surface is now 1.28:1, hairline on surface 1.75:1, accent on ground 6.08:1.
All three palettes got the same treatment (firozeh, verdigris, dark) and every
text pair clears 4.5:1 — verdigris muted and the studio's muted were both
under the floor beforehand and are not now.

**Do not widen this further.** A bigger step turns plaster-and-chalk into
white-cards-on-grey, which is the generic SaaS ground this world exists to
avoid. The material difference should be felt, not announced.

### Motion

GSAP with ScrollTrigger, and **no Motion in this tree** — the two libraries
fight over the same frames.

- **The pinned term timeline** is the page's one ambitious moment: the track
  pans horizontally as you scroll down, so the term physically passes.
  Canonical shape, `start: "top top"`, `pin: true`, scrub, distance equal to
  `scrollWidth - innerWidth`.
- **Hero entrance**: the headline arrives word by word out of a masked
  line (with descender clearance reserved in the mask), then lede, actions,
  and the screenshot settling last — hierarchy performed in reading order.
- **Hero parallax**, 7% drift on the screenshot, desktop only.
- **Section reveals**, a 26px rise, once, on entry; screenshot frames
  settle from a 1.045 over-scale (`data-reveal-scale`).
- **Week choreography**: each week card rises and straightens as it enters
  the pan, via `containerAnimation` so triggers measure inside the moving
  track.

**The Visible-By-Default Rule.** Nothing animates opacity. A reveal starting
at `opacity: 0` leaves content invisible to anything that does not scroll:
print, a full-page capture, a crawler. Transform only.

**The Motion-Stop Rule.** The accessibility toolbar sets
`#root.a11y-stop-anim { animation: none !important }`, which stops CSS but
**not** GSAP, because GSAP writes inline transforms from JavaScript. Every
animated component therefore reads `murchid.a11y` directly and does not run.
Under reduced motion or below 900px the timeline does not pin at all and its
track is a plain vertical stack, which is the CSS truth the markup ships.

### Dark mode

**Light is the default** (owner decision, 2026-08-11): a first-time visitor
sees light whatever their device prefers. Dark exists only through
`data-theme="dark"`, stamped before paint from the stored choice — Dark, or
Auto on a dark device. There is deliberately no `prefers-color-scheme` block
anywhere in the CSS; Auto is resolved in JS. The control lives in the
accessibility panel (Appearance: Light / Auto / Dark), reached through the
assistant — the page's single floating launcher.

Same world, different light: the ground drops to a near-black that keeps the
plaster's warmth, surfaces sit clearly above it, and the accent lifts so the
primary action carries.

- ground `#0f1517`, warm `#131b1d`, surface `#1b2629`
- text `#eef0ec`, soft `#c3ccc9`, muted `#90a09c`
- lines `#2e3b3e` and `#243033`
- accent `#7cc7bf`, hover `#99d6cf`, wash `#12292d`
- band `#1e2a2d` on `#edefe9`

**The Bands Lift, They Do Not Flip.** The two ink bands stay dark in dark
mode and rise *above* the ground instead of inverting to white. Inverting an
inversion would put a blinding slab mid-scroll and destroy the light-mode
rhythm the bands exist to create.

**The Tinted Shadow Rule.** Shadows carry the hue of the ground they fall on:
`rgba(16, 23, 24, …)` in light, `rgba(4, 8, 9, …)` in dark. Pure black is
flat and reads as a sticker.

**The screenshots switch with the theme.** The studio itself has dark mode
now, so dark pages show real dark captures (`<name>-dark.jpg`, swapped by
`ThemedShot` off the `data-theme` attribute) — never a dimmed light image
glaring on a dark ground.

### The studio in dark

The dark ground was always planned for: `globals.css` said "a dark ground is
a third block here rather than a rename across the codebase," and that held.
Because `@theme` maps Tailwind's colour tokens onto the `--p-*` palette layer
rather than onto literals, every `bg-paper`, `text-ink` and `border-line`
already in the studio re-themed with no component changes at all.

Ground `#0d1315`, surface `#1c2629`, text `#e9e7e1`, lines `#364447`, accent
lifted to `#4f9aa1` (Verdigris to `#5f9184`). Status colours lift too, since
the light-mode values go muddy on a dark ground.

**The Inverted-Surface Rule.** A surface that is deliberately the opposite of
the page ground uses `--p-invert` / `--p-on-invert`, never `--p-ink`.
`--p-ink` is the primary TEXT colour: on a dark ground it lightens, so
anything using it as a background inverts with it. The dashboard's plan card
turned cream in dark mode for exactly that reason, and text on it that
derived from `--p-paper-cool` went invisible for the mirror reason. Text on
an inverted surface derives from `--p-on-invert`.

In dark mode the inverted surface **lifts** to `#202b2e`, above the ground,
rather than flipping to white.

**Known gap:** `bg-ink` is still used as an inverted surface in roughly
thirty files across the studio. Only the dashboard has been audited against
this rule; the remaining screens need the same pass.

**Theme is applied twice, on purpose.** A blocking script stamps
`data-theme` on `<html>` before paint so nothing flashes, and `ThemeSync`
re-applies it after hydration because React removes an attribute the server
never rendered. Removing either half breaks a different one.

### Shape and depth

One radius family: `--r-lg` 20px surfaces, `--r-md` 14px frames, `--r-sm`
10px chips, and full pill for anything pressable. Shadows are tinted to the
ground, always with both offset and blur.

**The Two Grounds Rule.** The page is light. Exactly two bands invert to ink:
the term timeline and the closing call to action, used as bookends around the
argument. A third would be drift rather than rhythm.

## The Teacher's Ledger — the studio world (unchanged)

## Overview

**Creative North Star: "The Teacher's Ledger"**

Murchid looks like a working record book, not like software. Ruled hairlines
instead of boxes, matte plaster-coloured paper instead of white, one ink for
content and one rationed jewel colour for the things that matter. It is dense
without being cramped, because a teacher opens it between classes and needs to
read a week at a glance — but every surface is built to be written in daily
rather than admired once.

The ground does the heavy lifting. Nothing in the palette is bright except the
accent, which is turquoise the way it appears in tilework and dome glaze —
*firozeh*, the stone the colour is named after — sitting on cool lime plaster.
That contrast is the entire visual argument: a single saturated thing in a
desaturated room reads as important without needing size, weight, or a badge to
say so. Type reinforces it. Gambetta carries display and headline with a
modest negative track; Switzer carries everything else,
including the uppercase tracked eyebrows that used to be a separate mono face.
One serif, one sans, no third voice.

The confirmed anti-reference is **generic AI-product signalling**: purple-blue
gradients, glowing sparkle icons, dark glassmorphism, "powered by AI" chrome.
Murchid sells AI assistance and must never look like it was generated by the
thing it sells. When a screen needs to feel special, it earns it through
material — a washed gradient ground, a serif set large, real content — never
through the visual vocabulary of an AI demo.

**Key Characteristics:**

- Matte plaster ground (`#e1dfd6`), never white
- One rationed jewel accent; status colours deliberately separate from it
- Gambetta + modest tracking for display, Switzer for everything else
- Hairline borders as the primary separator; shadow reserved for hierarchy
- Full-pill buttons, 16px cards, 10px nav items
- Two shipped palettes, swapped on `<html data-palette>` with zero component changes

## Colors

A desaturated mineral ground with exactly one saturated voice. The system ships
**two complete palettes** selected on `<html data-palette="...">`; the frontmatter
records the default, **Firozeh & Plaster**. The alternate, **Verdigris & Bone**,
is greyer and more archival, and pushes success bluer so it stays distinguishable
from a brand colour that has moved toward green. Because `@theme` maps Tailwind's
colour tokens onto the palette variables rather than onto literals, every
`bg-paper` / `text-ink` / `border-line` utility already in the JSX re-themes for
free. **Any new colour must enter through the palette layer**, or it will not
survive the swap.

### Primary
- **Firozeh** (`accent`): the glaze turquoise. Primary actions, active navigation
  state, links, focus rings, and the italic accent word in serif headings. The
  most saturated value in the system by a wide margin.
- **Firozeh Deep** (`accent-hover`): pressed and hovered accent states, and the
  text colour of active navigation against its own tinted ground.
- **Glaze Wash** (`accent-soft`): the barely-there tint behind an active nav item
  or a selected row. A ground, never a text colour.

### Neutral
- **Plaster** (`paper`): the page ground. Matte, slightly cool, never white.
- **Plaster Shadow** (`paper-warm`): hover ground and subtle recession.
- **Chalk** (`paper-cool` / `surface`): card, input, and header ground — the
  lighter surface that sits *on* plaster.
- **Ink** (`ink`): primary text and the fill of primary buttons.
- **Ink Soft** (`ink-soft`): secondary text and resting navigation labels.
- **Graphite** (`muted`): eyebrows, captions, metadata, timestamps.
- **Rule** (`line`, with `line-soft` and `line-strong` variants): every hairline
  border and divider in the system.

### Tertiary
- **Ambient Deep / Mid / Lift / Pale**: the gradient and glow tones. Named for
  role, not hue, so a palette swap doesn't leave a colour name lying. Use only
  for washes, glows, and painted grounds — never for text or borders.

### Named Rules

**The Rationed Accent Rule** *(guidance, not enforced)*. The accent is meant to
stay rare — roughly one accent-filled primary action per screen. Active
navigation, italic heading words, accent-tinted borders and washes don't count
against it. Dense surfaces like the admin consoles may legitimately need more;
the direction still holds that if a screen has three equally accented buttons,
none of them is primary.

**The Meaning-Is-Not-Decoration Rule.** `ok`, `warn`, and `crit` are deliberately
*not* derived from the accent. A teacher must be able to tell "ready to use" from
"brand colour" at a glance. Never restyle a status token to match the palette,
and never use a status colour decoratively.

**The Palette-Layer Rule.** Raw colour values are written in exactly one place —
the `--p-*` palette block. A hex or `oklch()` literal anywhere else is a bug: it
will not re-theme, and it will silently break the alternate palette.

## Typography

**Display Font:** Gambetta (with Georgia, serif) — self-hosted variable range
`300..700`, roman and italic, so weight can be interpolated, not stepped.
**Body / UI / Label Font:** Switzer (with system sans fallback) — self-hosted
variable range `100..900`, roman and italic.

Both replaced their predecessors on 2026-09-03: Fraunces became Gambetta and
Inter Tight became Switzer. Inter Tight was the generic half of the pairing,
and the brief was explicitly to get off the face every AI-built interface
reaches for. They are **self-hosted from `/public/fonts`** (four woff2 files,
156KB total) rather than fetched, which took two families off the critical
path and out of a third-party origin; the Google request that remains carries
Reem Kufi alone. ITF Free Font License, which permits self-hosting.

**The values did not carry over.** Fraunces is a wide, high-x-height soft
serif that stays sturdy when light and needs pulling in; Gambetta is
calligraphic with real stroke modulation. At the inherited weight 300 and
`-0.035em` it went spindly and its terminals collided. Every serif heading is
weight 400 now and the negative tracking is roughly halved. Re-tune before
assuming a Fraunces-era number transfers.
**Arabic:** Amiri — the product ships full English/Arabic with RTL.

**Character:** A calligraphic serif set large against a workmanlike sans. Gambetta at weight 400 with `-0.016em` tracking reads
editorial rather than institutional; Switzer underneath keeps dense tables
and forms legible at 13–14px. There is **no mono face** — eyebrows kept their
uppercase and 0.18em tracking but now render in Switzer, so the project reads
as one type system instead of three.

### Hierarchy
- **Display** (Gambetta, 400, `clamp(28px, 4.2vw, 56px)`, 1.04, `-0.016em`): hero
  and page-defining headings. `text-wrap: balance`.
- **Headline** (Gambetta, 400, `clamp(22px, 2.6vw, 36px)`, 1.15): section
  headings inside a screen.
- **Title** (Switzer, 600, 15px): card titles, table headers, row leads.
- **Body** (Switzer, 400, 14px, 1.55): all running copy and form values.
- **Label** (Switzer, 500, `clamp(11px, 1vw, 13px)`, `0.18em`,
  uppercase): eyebrows, status pills, tags, metadata.

### Named Rules

**The One Italic Word Rule.** The signature is a serif heading with exactly one
word set in italic and coloured in the accent (`<em className="italic text-accent">`).
One per heading — a second italic word spends the device and it stops reading as
emphasis.

**The Dash Prefix Rule.** Page-level eyebrows carry a short accent rule before the
text (a ~22px hairline). Inline metadata omits it. The prefix marks page-level
orientation, so putting it on every small label flattens the distinction.

**The Single Sans Rule.** Eyebrows are uppercase and tracked, not a different
family. Do not reintroduce a mono or third display face; the `font-mono` utility
deliberately resolves to Switzer.

## Layout

A fixed left sidebar carries studio navigation; content sits in a fluid pane
beside it. Horizontal gutters and vertical rhythm are both fluid rather than
stepped — `padding-inline: clamp(16px, 3.5vw, 40px)` and
`padding-block: clamp(16px, 3vw, 32px)` — so a screen compresses gracefully from
phone to ultra-wide without breakpoint-specific overrides. Signature surfaces
size their radius and padding the same way (`clamp()` on both), which is why the
hero card looks proportionate at every width instead of correct at one.

Density is working-tool density: 13.5px navigation, 14px body, 8–12px control
padding, cards padded at 24px. The system prefers a hairline rule to a gap when
separating rows, and a gap to a box when separating groups.

The layout must survive the shipped accessibility toolbar, which applies zoom up
to 1.5×, letter/word/line-spacing steps, and colour filters to `#root`. Fixed
heights and clipped text containers break under it; fluid type and
`min-height` do not.

## Elevation & Depth

**Depth is layered by permanence, not by interaction.** Three multi-layer shadow
tokens encode a stable hierarchy that can be read at a glance: page-level
surfaces sit flat, cards are raised, overlays and floating panels sit highest.
Each token combines a tight contact shadow, a wide ambient shadow, and a
hairline colour ring in one value, so a surface holds its edge on any ground
where a plain border would disappear. Hover adds *movement* (a 2px lift) on top
of that hierarchy; it does not invent a level.

### Shadow Vocabulary
- **`--shadow-1`** (`0 1px 2px … , 0 0 0 1px …`): resting cards and inline tiles.
- **`--shadow-2`** (contact + `0 8px 24px` + ring): raised cards, primary buttons,
  the dashboard hero.
- **`--shadow-3`** (contact + `0 24px 56px` + ring): hovered cards, floating
  overlays, menus, drawers.

### Named Rules

**The Ring-In-The-Shadow Rule.** Every shadow token carries its own `0 0 0 1px`
ring. Don't add a `border` to a shadowed surface as well — you get a double edge
that reads as a rendering fault.

## Shapes

Corners are generous and role-specific rather than uniform: **fully pilled**
(999px) for anything pressable or field-shaped — buttons, search, chips, status
pills; **16px** for cards and content containers; **10px** for navigation items
and small controls; **`clamp(18px, 2vw, 26px)`** for signature hero surfaces. The
pill is the identity shape, inherited from the landing hero's primary CTA, and it
is why square icon-only buttons resolve into clean circles.

Borders are hairlines (1px) in `line`, and they are the default separator. The
form language is soft-cornered and low-contrast at rest; nothing in the system
uses a hard square corner or a heavy border.

## Components

Character line for the whole set: **tactile and confident.** Controls read as
physical objects — pills you can feel press, cards that rise to meet the cursor —
and interaction is a deliberate part of the pleasure of using the tool. Every
pressable element carries `.murchid-pressable` (a 0.97 press scale plus
tokenised transitions) and `.murchid-focus`.

### Buttons
- **Shape:** fully pilled (999px). Sizes change padding and font-size only, never
  visual style: `xs` through `lg`, plus square `icon` sizes that render circular.
- **Primary:** ink fill on chalk text, carrying `--shadow-2` and lifting to
  `--shadow-3` on hover. The workhorse — the studio is a tool, so the default
  primary is ink, not brand colour.
- **Secondary:** chalk ground, ink text, hairline border that darkens on hover.
- **Ghost:** transparent, soft-ink text, a 5% ink wash on hover.
- **Outline / Danger:** accent text on a transparent ground with an accent-tinted
  border; danger inverts to a filled accent on hover.
- **Press / Hover:** `scale(0.97)` at 120ms on press; colour and shadow at 220ms,
  both on `--ease-out-quart`.

### Cards / Containers
- **Corner:** 16px. **Ground:** chalk. **Border:** hairline `line`.
- **Elevation:** `flat` (`--shadow-1`) for inline tiles, `raised` (`--shadow-2`)
  for feature cards.
- **Interactive:** adds a 2px hover lift to `--shadow-3` on `--ease-out-quint`,
  plus a focus ring, so the whole card behaves as one pressable surface.
- **Padding:** 24px default; tighten to 16px for KPI tiles, drop to 0 to flush a
  table against the edge.

### Inputs / Fields
- **Style:** hairline border on the plaster or chalk ground, 10px radius (pill for
  search).
- **Focus:** the field lights **its own border** in the accent and lifts a soft
  halo (`0 0 0 3px` accent at 16%). It does **not** take an outside ring — a hard
  rectangle floating around a text box reads as a rendering fault. Fields respond
  to any focus, not only keyboard focus, because clicking into a box and seeing
  nothing change is the confusing case.
- **Button-shaped controls that behave as fields** (dropdown triggers) take the
  field treatment via `.murchid-field`, so one form never shows two ideas of focus.

### Navigation
- **Sidebar item:** 10px radius, 13.5px Switzer, soft-ink label, transparent
  ground, staggered entrance animation (40ms per index).
- **Active:** an 11% accent wash over chalk, accent-deep label at weight 600, an
  inset accent ring, and a soft accent glow beneath. Active state is expressed in
  colour and weight — never by a heavier border alone.

### Focus (system-wide)
Two treatments, both in the accent, never in ink. Buttons, links, and
role="button" elements take a 2px accent outline offset 2px. Fields light their
own border as above. Checkboxes and radios keep the ring, since they have no
border to light.

## Do's and Don'ts

### Do:
- **Do** add every new colour to the `--p-*` palette layer so both shipped
  palettes stay correct.
- **Do** use `clamp()` for type, padding, and radius on signature surfaces; the
  system is fluid, not breakpoint-stepped.
- **Do** reach for the motion tokens (`--ease-out-quart`, `--ease-out-quint`,
  `--ease-out-expo`, `--ease-snap`, `--dur-press` 120ms / `--dur-hover` 220ms /
  `--dur-transition` 420ms / `--dur-entrance` 720ms) instead of writing a
  cubic-bezier by hand.
- **Do** give a serif heading exactly one italic accent word.
- **Do** honour the accessibility toolbar: no fixed heights on text containers,
  and respect its motion-stop preference in new animation.
- **Do** add a new `<Button>` variant in the component when you need a different
  look.

### Don't:
- **Don't** write a hex or `oklch()` literal outside the palette layer. It won't
  re-theme, and it will break the alternate palette.
- **Don't** override `bg-*` or `text-*` on `<Button>` via `className` — class
  collisions produce invisible buttons.
- **Don't** put a border on a shadowed surface; the shadow tokens already carry a
  1px ring.
- **Don't** reintroduce a mono or third type family. `font-mono` resolves to Inter
  Tight on purpose.
- **Don't** use a status colour (`ok` / `warn` / `crit`) decoratively, or derive
  one from the accent.
- **Don't** wrap a focused text field in an outside ring; fields light their own
  border.
- **Don't** drift toward AI-product signalling — purple-blue gradients, sparkle
  icons, dark glassmorphism, or "powered by AI" chrome.
- **Don't** reuse the landing page's global class names (`.hero`, `.lesson-card`,
  `.dash-mock`) in studio components; that CSS is global and class-scoped.
