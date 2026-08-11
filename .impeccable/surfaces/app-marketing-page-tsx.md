---
version: 1
slug: "app-marketing-page-tsx"
primary_target: "app/(marketing)/page.tsx"
related_targets: ["src/features/marketing"]
---

# Marketing surface — `/`

**Scope:** the public marketing page and the routes peeled out of it
(`/pricing`, `/faq`, `/signup`, `/signin`, `/legal/*`). Not the studio.

**Visitor mode:** Persuade.

## Audience and job

A UAE schoolteacher, KG–G12, evaluating in a fifteen-minute free period or
on a Sunday evening. They arrive wanting to know two things: what does it
actually produce, and what does it cost. A second audience — a head of
department doing due diligence — needs a URL they can forward to
procurement and claims that survive a phone call.

## Action

Start the seven-day trial. Secondary: see a real lesson built; reach
pricing without scrolling the whole page.

## Proof and content rules

- Real product only. `npm run db:demo` seeds a genuine term (roster,
  timetable, marks, nine-week library) — screenshots and demonstrations
  come from it, labelled as demonstration data where a visitor could
  mistake them for a specific real school.
- **Murchid's own roadmap capabilities may speak in present tense**
  (owner's decision, 2026-08-11). Third-party claims may not: no
  testimonial wording that the owner has not supplied verbatim, no
  Ministry endorsement, no invented statistics.
- The quote slot ships deliberately empty and labelled until real quotes
  arrive — the pattern taken from `new-docs/Landing-Murchid.dc.html`.

## Chosen direction — "The Wall Chart"

Lineage: the laminated classroom didactic chart (the water cycle, the
periodic table, the anatomical poster). The page teaches itself the way a
classroom wall teaches photosynthesis: one labelled diagram with numbered
callouts, not a scroll of marketing sections. Saturated screenprint spot
inks on chart stock, heavy keylines, callout bubbles, dashed leader lines.

Seed key `0df4eaa5`, assigned index 4, chosen by the user over three
challengers on 2026-08-11.

**Memorable moment:** the dispatch — one prepared lesson resolving out
along leader lines to Divisions A–D, the four labels landing in sequence.
Borrowed from the split-flap challenger and bounded to this one interaction;
it degrades to a plain static chart under motion-stop.

**Why not the two obvious worlds:** the dark AI-SaaS gradient is the
category default and is what this page is replacing; cream-plus-editorial-
serif is its predictable opposite and is equally a generated-UI cluster.
Both were excluded from candidate derivation.

## Constraints

- Arabic and RTL are load-bearing; the chart must mirror, and the hero's
  product evidence must render in Arabic when Arabic is selected — the
  current page's worst gap.
- The shipped accessibility toolbar's motion-stop preference binds every
  animation here.
- No eyebrows above headings (craft floor, absolute). Numbered callouts
  are permitted only because the sequence is real.
- Every CTA and nav item is a real link with a real URL.

## Unresolved

- Positioning is deliberately undecided in PRODUCT.md; this page sells what
  the product does and must not assert a differentiator claim.
- Testimonial content, pilot-school names, and permission to use them.
- Whether the published prices are owner-approved.
