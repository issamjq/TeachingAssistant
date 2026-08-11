---
target: the landing page (/)
total_score: 21
max_score: 40
na_heuristics: 
p0_count: 1
p1_count: 2
timestamp: 2026-08-11T06-38-08Z
slug: app-marketing-page-tsx
---
Method: dual-agent (A: design review · B: detector + browser evidence)

## Design Health Score

| # | Heuristic | Score | Key Issue |
|---|-----------|-------|-----------|
| 1 | Visibility of System Status | 2 | No active-section nav state; anchor jumps land mid-scrub with content at partial opacity (Annual plan card captured at ~50%, price barely legible). |
| 2 | Match System / Real World | 3 | Genuine teacher language ("Sunday night", "the night before they teach"), undercut by internal vocabulary and a page that contradicts its own counts. |
| 3 | User Control and Freedom | 1 | Primary CTA does not change the URL. Back from sign-up leaves the site entirely (about:blank). 35 buttons, 1 anchor. |
| 4 | Consistency and Standards | 2 | Two visual worlds; "EIGHT MODULES" (hero) vs "Six tools" (lineup) vs "SIX TOOLS" (mobile menu); Slides/Deck/Presentations name overlapping things. |
| 5 | Error Prevention | 2 | Sign-up Continue renders disabled at opacity 1 with the enabled-button background; the consent checkbox gating it sits below it in reading order. |
| 6 | Recognition Rather Than Recall | 2 | Same eight modules presented three times in three visual languages with drifting names. Nav numerals 01-05 correspond to nothing. |
| 7 | Flexibility and Efficiency | 2 | Applicable, not n/a — anchor nav and returning-user sign-in exist, but there is no way to skip ~4 viewports of pinned showreel to reach pricing. |
| 8 | Aesthetic and Minimalist Design | 2 | 10,436px desktop; 5,885px under prefers-reduced-motion. 44% of scroll length is choreography, not content. |
| 9 | Error Recovery | 2 | Rate-limit copy is excellent writing; auth still falls back to native alert() for expired links, and the disabled-button dead end says nothing. |
| 10 | Help and Documentation | 3 | Applicable, not n/a — seven real questions in semantic <details>, a human email. Docked because two answers make claims the page can't support. |
| **Total** | | **21/40** | **Below average — real craft, unedited** |

## Design Specificity Verdict

**LLM assessment.** The hero is authored and could not be lifted onto another company's site: the Fraunces wordmark with مرشد curled into the letterform, the etymology gloss, eight modules arranged as architecture around a real studio window. Then the page forgets what it is. From the second viewport down it is the 2023 vertical-SaaS template — dark saturated gradient ground, glassmorphic tilted UI cards, pinned scroll-scrubbed carousel, big-number stat band, two-rail testimonial marquee with flag emoji, three pricing cards with a POPULAR badge, accordion FAQ, full-bleed closing CTA. Swap turquoise for purple and this is a fintech.

The specific betrayal: DESIGN.md names its own anti-reference — "generic AI-product signalling: purple-blue gradients, glowing sparkle icons, dark glassmorphism" — and the page ships that exact vocabulary in teal, including a literal glowing sparkle-wand icon on module 01. DESIGN.md's north star is matte plaster, *never* white, with one rationed jewel accent in a desaturated room. The landing inverts it: the ground IS the jewel colour, drenched for ~6,000 of 10,436 vertical pixels, spending the accent so completely that when plaster finally appears it reads as a different website.

**Deterministic scan.** 88 findings, exit 2, across the landing markup. 58 design-system-color (raw hex/oklch literals inline in JSX: Landing.jsx 35 hits, LandingHome.jsx 6 — a direct violation of the Palette-Layer Rule, meaning these will not re-theme under the alternate palette), 19 design-system-font-size, 5 overused-font, 4 design-system-font, 1 radius, 1 broken-image.

Coverage gap worth knowing: src/landing.css (3,271 lines) is the stylesheet for this entire surface, and the detector's import traversal never reached it. Scanned directly it returns **347 more findings** — the markup scan covers roughly a fifth of the surface.

False positives, cleared: all 32 PreviewGallery.module.css hits are off-target (that file renders only at /preview, not /); broken-image at HeroAtelier.jsx:632 is a regex match on prose inside a block comment; the 5 overused-font hits are Fraunces and Inter, the pinned brand faces — false by brief. The detector fired on no other family.

**Browser overlay.** Injection preflight passed all three checks; live-server ran on :8400, detect.js injected and executed in-page, server stopped afterward (verified dead). In-page detector reported **147 anti-patterns**: 59 undersized-ui-text (8.5px "AI Studio", "Dashboard"; 9.5px nav numerals), 20 tiny-text, 20 kicker-above-heading, 9 gpt-thin-border-wide-shadow, 9 dark-glow, 4 radial-spotlight-glow, 1 skipped heading (h2 to h4), 1 blinking cursor.

Note: 12 of the in-page detector's 13 distinct low-contrast pairs are measurement artifacts — the rule walks CSS colors and cannot see the hero's painted gradient, so it compares text against a token it isn't sitting on. Assessment B re-measured by pixel sampling instead, which is where the real numbers below come from.

## Overall Impression

There is a genuinely beautiful page here wearing a template. The hero, the Arabic art direction, the FAQ and the "From one line, the whole quiz" demo are better than most funded edtech ships. Everything between them is length without argument, and the page currently asserts three things the product cannot back. The single biggest opportunity is subtraction: cut the fabrications, cut the repetition, and let the four authored sections carry the whole surface.

## What's Working

1. **The hero is real design, not template fill.** Three decisions reinforce each other: the wordmark carries Arabic as part of the letterform rather than beside it, the etymology gloss turns the brand name into the proposition, and the eight modules are architecture around a real window with real captions. It earns specialness through material and content — exactly what the design system asks for.
2. **The FAQ is the most honest, best-engineered section on the page.** Seven semantic <details> elements, keyboard-native, zero JS state, questions written the way heads of department actually ask them, and a curriculum answer that refuses to overclaim. It understands the brand voice better than anything above it.
3. **Bilingual and RTL are load-bearing, not bolted on.** Toggling to Arabic mirrors pricing, module grid, nav and footer, swaps the display face, and produces zero horizontal overflow. Measured at 390px: scrollWidth 390 = innerWidth 390, no horizontal scroll anywhere. The Arabic hero is a considered inversion of the English frame, not a translation.

## Priority Issues

**[P0] The page makes three claims PRODUCT.md forbids.**
- *What:* (a) Eight testimonials with invented names, emirates, grades and avatars — "Layla H. / Dubai · KG", "Omar K. / Abu Dhabi · G6 Science" — at src/views/LandingHome.jsx:460-468, quotes at src/shared/i18n/en.ts keys ch.voices.q1-q8. (b) A time-saved statistic, "5 min — From topic to teaching package" (src/features/landing-stats/StatsBand.tsx:30), from a product with no analytics installed to measure it. (c) A regulatory claim, "MoE — Aligned to UAE Ministry standards", repeated as a badge, card metadata and a footer link — which the page's own FAQ then contradicts by saying alignment is the teacher's job.
- *Why it matters:* This is material risk, not taste. Real quotes exist, but PRODUCT.md records that their wording is not in this repo and only owner-supplied text may be used. Fabricated teachers attributed to specific emirates and grades are exactly what a pilot school recognises as false; a Ministry-alignment claim is a regulatory assertion in the market being sold to; "5 min" is a performance claim.
- *Fix:* Delete all eight voices, the 5 min stat and the MoE claim today. Replace the voices section with owner-supplied verbatim quotes, or better and available now — real product imagery, since `npm run db:demo` produces a genuine term of roster, timetable, marks and a nine-week library, and PRODUCT.md explicitly blesses real screenshots. Reduce the stat band to what is product-true: KG-12 and 2 lang.
- *Suggested command:* /impeccable clarify

**[P1] The first viewport fails contrast 23 ways, and the header is illegible over half the page.**
- *What:* Pixel-sampled measurement over the real painted gradient, 49 text samples in the first viewport at 1440x900: 23 fail. Worst offenders — "Make the material" 2.03:1, "Eight modules. One studio." 2.10:1, "One studio, eight modules" 2.28:1, "AI Studio" 2.48:1, nav numeral "01" 2.57:1, the eyebrow "For teachers, KG-G12" 2.68:1, the etymology line "Murchid · مُرشِد — the one who guides" 2.72:1, nav label "Features" 2.79:1, and the trust line "Free for 7 days · No card required" 3.84:1. The h1 at 150px scrapes 3.43:1, clearing large-text 3:1 but nothing clearing 4.5:1. Separately, header text is hard-coded cream at every scroll position with only a 6px blur, so over the stats band, plans, FAQ and footer the wordmark, all five nav items and SIGN IN sit cream-on-near-white.
- *Why it matters:* The etymology line is the brand's single best idea and it is nearly invisible. The trust line is the conversion reassurance. SIGN IN is the returning-teacher path and it disappears for half the scroll. This is on a product whose own brand commitment is that accessibility is a shipped feature.
- *Fix:* Lift the small-text layer off the gradient — either darken the hero ground under text, or raise those tokens toward the chalk end. Make the header's colour scheme a function of the section beneath it (data-ground="light|dark" per section, or an IntersectionObserver) instead of a constant, and give it an opaque ground once scrolled past the hero.
- *Suggested command:* /impeccable audit

**[P1] Nothing has a URL, and Back exits the site.**
- *What:* "Try the studio" sets React state; the address bar stays at /. Pressing browser Back from the sign-up form navigates away from the site entirely. Pricing, FAQ, contact, privacy, terms and the whole funnel are equally unaddressable. The page contains 35 buttons and exactly one anchor.
- *Why it matters:* On a Persuade surface this is the conversion mechanism. A teacher who opens sign-up, hesitates and hits Back is gone rather than returned to the pitch. Nobody can send /pricing to a head of department, nothing is bookmarkable or crawlable, and no ad or referral can deep-link.
- *Fix:* The migration already gives you the tool. Peel app/(marketing)/pricing, /faq, /signup, /signin and /legal/* as real segments and make every nav item and CTA a next/link. Additive per the repo's own peel rule — nothing needs removing.
- *Suggested command:* /impeccable harden

**[P2] Forty-four percent of the page is choreography, and the same content is told three times.**
- *What:* 10,436px desktop; 5,885px under prefers-reduced-motion — the difference is pure pinning and scrubbing. The same eight modules appear in the hero fan, again as a numbered grid, and again in a pinned four-viewport scrub, with names drifting between them. The page says "EIGHT MODULES" in the hero, "Six tools" in the lineup and "SIX TOOLS" in the mobile menu. On mobile the scrub dot renders on top of each card's own footer text.
- *Why it matters:* PRODUCT.md's first principle is optimising for someone returning between classes with fifteen minutes. Eleven-and-a-half screens — four of them repeating — to reach a price loses that person.
- *Fix:* Cut the pinned showreel entirely. Keep the hero fan as identity and the lineup grid as reference, and promote "From one line, the whole quiz" to directly follow the hero — it is the only section that proves rather than asserts. Target 5-6 viewports. Settle on one number.
- *Suggested command:* /impeccable distill

**[P2] The font pipeline requests 23 families, uses 4, and the one the page relies on most never loads.**
- *What:* app/layout.tsx ships one render-blocking stylesheet requesting 23 families. Measured on /: 7 requests, 526,246 bytes total, CSS 113,670 bytes decoded, renderBlockingStatus "blocking", 315-396ms to load. FCP 452ms/540ms with fonts vs 172ms with them aborted — roughly 280-370ms of FCP, on localhost where everything else is zero-latency. Only 4 families actually download; 19 are referenced nowhere on this surface. Amiri alone is 208KB (40% of all font bytes) for two glyph runs, one of them a decorative watermark at opacity 0.1. The inverse problem is worse: **JetBrains Mono is referenced 53 times** across landing.css, globals.css and four module stylesheets, is absent from the font URL, and therefore falls through to generic monospace — platform-dependent. Most of the small hero text renders in a font nobody chose. src/landing.css:61 also overrides globals.css:150's deliberate "no more JetBrains Mono" decision back on.
- *Why it matters:* A blocking third-party stylesheet is the first thing between a teacher and the page, and 19/23 of it is dead weight. And the typographic layer that carries every eyebrow, numeral and label is currently rendering in a system fallback that differs per machine — so the page you designed is not the page anyone sees.
- *Fix:* Split the font request: load only Fraunces, Inter Tight and IBM Plex Mono on the marketing and studio shell; load the 19 deck typefaces lazily, on the slide builder that actually offers them. Resolve JetBrains Mono in one direction — either add it to the request or, consistent with the Single Sans Rule, delete all 53 references. Defer Amiri until Arabic is selected.
- *Suggested command:* /impeccable optimize

## Persona Red Flags

**Amira — G6 science teacher, evaluating on a laptop in a 15-minute free period.** (1) The pinned showreel puts ~4 viewports between her and pricing; on a trackpad the pin reads as a stuck page. (2) She reaches for the nav to shortcut to "04 PRICING" but past the hero it is cream on near-white and she can't read it; if she clicks anyway she can land mid-scrub with the Annual card's price washed to near-invisible. (3) She counts eight modules in the hero, reads "Six tools" two sections later, and doesn't know which is true. (4) The one screen that would answer her — the quiz demo with real questions — is at 65% scroll depth. (5) If she reaches sign-up and hesitates, Back exits the site.

**Khalid — head of secondary, due diligence before a department purchase.** (1) "MoE — Aligned to UAE Ministry standards" is the first thing he verifies, and the page's own FAQ contradicts it three viewports below — on his screen, that is disqualifying. (2) Eight named teachers with emirates and grades: he knows people in Sharjah G9 Arabic; one phone call ends the page's credibility. (3) "5 min from topic to teaching package" with no methodology or source. (4) The FAQ promises department plans and school-level dashboards, but pricing shows three single-teacher tiers, there is no school CTA anywhere, and no URL he can forward to procurement. (5) "Who can see my students' data?" is buried in an accordion rather than surfaced where a buyer looks.

**Noura — Arabic-medium KG teacher who switches the site to Arabic.** The RTL mirroring is genuinely good, which makes the gap sharper. (1) In Arabic, the studio window in the hero stays entirely in English — "Make the material", the prompt, "Lesson / Quiz / Deck", "READY TO HAND OUT", all eight sidebar items. The single most important piece of evidence, for the visitor who most needs to see Arabic output, is in English. (2) The one card that speaks directly to her — "Arabic-first lesson plans, finally. Not translations from English" — is fabricated. (3) On mobile the language toggle is inside the hamburger, so an Arabic-first visitor must open a menu to discover the site speaks her language.

## Minor Observations

- **Sign-up, the last screen before conversion, is the weakest on the surface.** Continue is disabled but renders at opacity 1 with the same background as the enabled provider buttons — it looks pressable, does nothing, explains nothing. The consent checkbox gating it sits below it. 43% of the viewport is an empty teal slab while "No card required" is 11px at its bottom-left, nowhere near the button. "Forgot password?" appears on a screen titled "Start with Murchid."
- No <main> landmark anywhere; four separate <header> elements; no skip link. First Tab stop is the logo; 16 tabs to reach the pricing CTA.
- No aria-live region — the sign-up error "Email is required." appears silently to screen readers. Nav items have no aria-current. 3 SVGs have no accessible name and no aria-hidden.
- Under prefers-reduced-motion the voices rails stop but the marquee edge mask stays applied, leaving ~3 of 8 quotes permanently faded to unreadable.
- The .voices-avatar initials measure 4.3:1 against their fill — a genuine marginal miss (needs 4.5:1), and the only real contrast finding the in-page detector caught.
- The closing CTA sets two words in the italic accent ("Sunday night"), against the One Italic Word Rule.
- The accessibility toolbar — a shipped, genuinely impressive feature — is reachable on this page only from inside the AI assistant chat bubble. A visitor who needs 1.5x text has to open an AI chat to find it.
- 41 raw hex/oklch literals inline in Landing.jsx and LandingHome.jsx will not re-theme under the Verdigris palette.
- Landing.jsx neutralises framer-motion with a no-op proxy while still shipping variants, fadeUp, EASE and a useInView that always returns true. Five parallel scroll-reveal implementations exist (Reveal, CardReveal, useRevealQ, useReveal, useViewportProgress), each with its own reduced-motion check.
- alert() is still the failure UI for expired magic links and failed provisioning.
- One preload warning: a LangToggle CSS chunk is preloaded but unused. Zero page errors, zero failed requests.

## Questions to Consider

1. Your own anti-reference is "purple-blue gradients, sparkle icons, dark glassmorphism." You shipped a teal gradient, a sparkle-wand icon on module 01, and glassmorphic floating cards. If the only difference from the anti-reference is the hue, is it still an anti-reference?
2. DESIGN.md says the ground is matte plaster, never white, and the jewel accent stays rare. This page paints ~6,000px of ground in the jewel accent. Is the landing exempt from the design system, or has the system already lost and the plaster studio is now the off-brand thing?
3. PRODUCT.md says positioning is deliberately unresolved and marketing must not invent one. But "5 min", "MoE-aligned" and eight testimonials about Sunday nights *are* a positioning — they assert speed, compliance and social proof. Who decided that, and does the owner know the site is currently making that argument?
4. You have db:demo producing a genuine term of real data, and PRODUCT.md explicitly says screenshots can and should be genuine. Why is the entire page mockups?
5. The showreel spends four viewports and the lineup one to say what the hero already said. If you deleted both, what would a visitor actually not know?
6. Is it eight modules or six tools?
7. The FAQ is the most honest, best-written, most semantically correct thing on this page — and it's the last section before the footer. What would the page look like if the FAQ's voice had written the hero?
