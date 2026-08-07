"use client";

// =====================================================================
// Murchid — Hero Atelier (2026 editorial title sequence)
//
// A bilingual editorial masthead. The signature is the type duality:
// a colossal Fraunces "Murchid" interlocked with a large Amiri "مرشد"
// watermark — the Latin and Arabic scripts in dialogue as one mark,
// fitting for a UAE-first product whose name *means* "the one who
// guides".
//
// ONE pinned act, start to finish. The masthead recedes, six artifacts
// deal out of a fan, resolve into a numbered editorial INDEX, gather to
// the side into a deck, and are then walked through one at a time with
// their descriptions.
//
// That last half used to be a second pinned section. It could not be:
// the hero's sticky element released and its row scrolled away, then the
// next section's sticky element entered with the SAME row — so the row
// left and came back, which reads as a duplicate, not a continuation.
// Two pins cannot hand off mid-flight. Folding it into this timeline
// also drops a whole viewport of track, because the duplicated hold at
// the seam is gone.
//
// Motion is a pure function of scroll (rAF → `p`), the same no-library
// technique the rest of the landing uses. Bilingual via useT(); RTL is
// mirrored through `dir` and logical CSS. Honors prefers-reduced-motion
// (entrance animations are CSS, which the media query disables; the
// scroll scrub falls back to the at-rest opening frame).
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { useT, useI18n } from "../lib/i18n";
import { HERO_CARDS, HeroCardFace } from "./HeroJourney";
import { CARD_H, deckCenterX, deckPos, indexLayout } from "../features/hero-artifacts/indexLayout";

import WalkthroughLayer, { WalkthroughStacked } from "../features/tool-walkthrough/WalkthroughLayer";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => t * t * (3 - 2 * t);
/** Eased 0→1 ramp across [a,b] of some progress value. */
const ramp = (v, a, b) => smooth(clamp01((v - a) / (b - a)));

const N = HERO_CARDS.length; // 6
const MID = (N - 1) / 2; // 2.5

// ── Track budget ─────────────────────────────────────────────────────
// The timeline is authored in viewport-heights rather than in abstract
// 0–1 fractions, because the thing that actually matters is how much
// scrolling a reader spends on each beat — and that was the bug: with the
// whole sequence packed into 240vh, each tool got about 16vh, roughly one
// notch of a wheel. Six cards went past before you had read one.
//
// INTRO covers masthead → fan → numbered index → gather. SLOT is what one
// tool gets. The section's height is derived from these, so the CSS and
// the choreography cannot drift apart.
const INTRO_VH = 112;
// 44vh per tool over eight of them. Sized against the reading, not the
// clock: the description is fully opaque from 30% to 90% of a slot, so a
// tool holds ~26vh of legible text before anything moves.
const SLOT_VH = 44;
const TRAVEL_VH = INTRO_VH + SLOT_VH * N;
export const HERO_TRACK_VH = TRAVEL_VH + 100; // + the pinned viewport
/** viewport-heights → progress fraction of the track's travel */
const at = (v) => v / TRAVEL_VH;

// Build the value line "The teacher directs. Murchid drafts." as a
// word list so each token can stagger in on load. The brand word is
// flagged so it renders in clay italic.
function useTaglineWords(t) {
  const out = [];
  for (const w of t("lp.hero.h1a").split(/\s+/)) if (w) out.push({ w, brand: false });
  out.push({ w: t("lp.hero.brand"), brand: true });
  for (const w of t("lp.hero.h1b").split(/\s+/)) if (w) out.push({ w, brand: false });
  return out;
}

// Placeholder viewport width for the server render, where there is no
// window. Corrected on mount — see the note inside the component.
const SSR_VIEWPORT_W = 1280;

export default function HeroAtelier({ onEnter, signedIn }) {
  const t = useT();
  const { isRTL } = useI18n();
  const dir = isRTL ? -1 : 1;
  const trackRef = useRef(null);
  const [p, setP] = useState(0);
  // Viewport width drives the responsive index row (pitch + card scale) and
  // the wordmark/fan shrink-to-fit factors.
  //
  // The initial value MUST NOT read window, even though it is available on
  // the client. This used to be
  //   useState(() => typeof window !== "undefined" ? window.innerWidth : 1280)
  // which is subtly broken under server rendering:
  //
  //   - the server renders transforms computed from 1280
  //   - on the client the initialiser returns the REAL width, so state is
  //     already correct and the mount effect's setVw() is a no-op
  //   - React bails out of a same-value update, so no re-render happens
  //   - and React hydration does not repair mismatched inline styles (it
  //     only fixes text), so the DOM keeps the server's 1280 transforms
  //
  // On a phone that left a wordmark scaled for a 1280px viewport —
  // overflowing the screen with the card fan clipped — until the user
  // happened to resize or scroll, which finally forced a re-render. Under
  // Vite there was no SSR, so the first render was always correct.
  //
  // Seeding both renders with the same placeholder guarantees the mount
  // effect produces a real state change, and with it a corrected DOM.
  const [vw, setVw] = useState(SSR_VIEWPORT_W);
  const [vh, setVh] = useState(800);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // Width first, and unconditionally — it must not be skipped by the
        // ref guard below, or the hydration placeholder above never clears.
        setVw(window.innerWidth);
        setVh(window.innerHeight);
        const el = trackRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        setP(span > 0 ? clamp01(-r.top / span) : 0);
      });
    };
    // Synchronous correction on mount so the real width applies on the first
    // post-hydration render rather than a frame later.
    setVw(window.innerWidth);
    setVh(window.innerHeight);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  // ── Choreography — all pure functions of scroll `p` ──────────────
  // Beats are given in viewport-heights (see the track budget above) and
  // overlap on purpose: run end-to-end they leave frames where nothing is
  // arriving, which reads as the page having stalled rather than paused.
  //
  //   0–40vh    masthead recedes
  //   10–58vh   fan resolves into the numbered index row
  //   30–56vh   index heading arrives as the masthead clears
  //   44–74vh   01–06 labels
  //   74–92vh   HOLD — the finished index, the frame the page is "about"
  //   92–120vh  the row gathers to the side and stacks into a deck
  //   120vh+    52vh per tool
  const lockOut = easeInOut(seg(p, at(5), at(37)));
  const cardsT = easeInOut(seg(p, at(9), at(54)));
  const swap = easeInOut(seg(p, at(24), at(43)));
  const headIn = seg(p, at(28), at(52));
  const tocIn = seg(p, at(41), at(69)); // suppressed on portrait — see skipIndexRow

  // ── gather: index row → deck ─────────────────────────────────────
  const GATHER_A = at(86);
  const GATHER_B = at(INTRO_VH);
  const gRaw = clamp01((p - GATHER_A) / (GATHER_B - GATHER_A));
  const gather = smooth(gRaw); // geometry
  // The two headings share a slot. Cross-fading them symmetrically
  // superimposed two long serif lines and made both illegible, so the
  // outgoing one clears before the incoming one starts.
  const indexOut = 1 - smooth(clamp01(gRaw / 0.42));
  const twHeadIn = smooth(clamp01((gRaw - 0.62) / 0.38));

  // ── walkthrough slots ────────────────────────────────────────────
  const cProg = clamp01((p - GATHER_B) / (1 - GATHER_B)) * N;
  const active = Math.min(Math.floor(cProg), N - 1);
  const local = clamp01(cProg - active);
  // The annotation is up for most of the slot, not a sliver of it. It used
  // to arrive at 24% and start leaving at 88%, so a 16vh slot showed its
  // description for about 10vh. Now it lands by 30% and holds to 90%, which
  // over a 52vh slot is ~31vh of fully-legible text before anything moves.
  // The LAST tool must not clear. Fading every slot out at 90% left the
  // final one ending on an empty screen — the deck and its description
  // both gone, with the rest of the track still to scroll. There is no
  // next card to make room for, so it holds.
  const isLast = active === N - 1;
  const outT = isLast ? 1 : 1 - ramp(local, 0.9, 1);
  const dotIn = ramp(local, 0.03, 0.13) * outT;
  const lineIn = ramp(local, 0.07, 0.24) * outT;
  const textIn = ramp(local, 0.12, 0.3) * outT;
  // How far the deck has moved toward the NEXT card. Flat for the body of
  // the slot, then a quick hand-off inside the window where the annotation
  // has already cleared — otherwise the following card overtakes the
  // selected one at the front while its description is still on screen.
  const advance = isLast ? 0 : ramp(local, 0.9, 1);

  const ctaLabel = signedIn ? t("landing.nav.openPlanner") : t("ch.hero.cta");
  const tagline = useTaglineWords(t);

  // ── Responsive index row ─────────────────────────────────────────
  // Positions come from the shared module so ToolWalkthrough, which opens on
  // this exact row before collapsing it into a deck, can reproduce the last
  // frame of this section precisely. See features/hero-artifacts/indexLayout.
  const L = indexLayout(N, vw, vh, dir, isRTL);
  const wordK = L.wordK;
  const tocK = L.tocK;
  const headBottomY = L.headBottomY;
  const isPortrait = L.isPortrait;
  // The opening fan is narrow, so it can be larger than the row and still fit.
  const fanK = Math.min(1, (vw - 24) / 780);

  // ── deck geometry (the walkthrough half) ─────────────────────────
  const narrow = vw <= 900;
  const deckX = deckCenterX(vw, dir, narrow);
  // Phones stack deck over copy, so the deck gets the band between the
  // heading and the split, and scales to whatever that band measures —
  // derived rather than guessed, so it holds from a 667pt phone to a 932pt
  // one. Both constants mirror ToolWalkthrough.module.css exactly.
  const SPLIT = 0.56;
  const padTop = Math.min(110, Math.max(72, vh * 0.12));
  const bandTop = padTop + 84;
  const bandH = SPLIT * vh - bandTop;
  const deckScale = narrow ? Math.max(0.5, Math.min(0.86, (bandH - 20) / CARD_H)) : 1;
  const deckY = narrow ? (bandTop + SPLIT * vh) / 2 - vh / 2 : 46;

  // Eight cards cannot form a legible contents index on a phone. The
  // portrait grid is 3 columns, so eight needs three rows, and three rows of
  // card-plus-label do not fit a 100vh pin — the last row fell off the
  // bottom. Shrinking to fit put the labels at about 7px.
  //
  // So portrait skips the index arrangement altogether: the fan resolves
  // straight into the deck, and the walkthrough presents all eight one at a
  // time at full size, which is the better reading of them on a phone
  // anyway. Landscape and desktop keep the numbered row.
  const skipIndexRow = isPortrait;
  const bPos = skipIndexRow
    ? (i) => {
        const dp = deckPos(i, dir);
        return { x: deckX + dp.x, y: deckY + dp.y, s: dp.s * deckScale };
      }
    : L.pos;

  // Shared card transform — fan (hero) lerped to its settled position.
  const cardStyle = (i) => {
    const o = i - MID;
    const xa = o * 128 * dir * fanK; // A — confident opening fan
    // Sits below the CTA block. The taller lockup (bigger tagline, a second
    // button, and the trust line) grew downward into where the fan used to
    // start, so the arc was overlapping the reassurance copy.
    //
    // Narrow viewports need a smaller offset, not the same one: the lockup
    // is scaled down by wordK there, so it ends higher, and a fixed 262
    // stranded the fan near the bottom edge behind a band of empty screen.
    const ya = (isPortrait ? 172 : 262) + (MID * MID - o * o) * 10;
    const ra = o * 6 * dir;
    const sa = 0.64 * fanK;
    const b = bPos(i); // B — settled row or grid
    // C — the deck. Distance from its front; before the gather starts,
    // `active` and `advance` are both 0, so this is simply i.
    const dp = deckPos(i - active - advance, dir);
    // Two lerps in sequence, not a blend: the fan resolves into the row
    // first, and only then does the row gather into the deck. The windows
    // do not overlap, so composing them this way is exact.
    const rx = lerp(xa, b.x, cardsT);
    const ry = lerp(ya, b.y, cardsT);
    const rr = lerp(ra, 0, cardsT);
    const rs = lerp(sa, b.s, cardsT);
    const x = lerp(rx, deckX + dp.x, gather);
    const y = lerp(ry, deckY + dp.y, gather);
    const r = lerp(rr, dp.rot, gather);
    const sc = lerp(rs, dp.s * deckScale, gather);
    const opacity = lerp(1, dp.opacity, gather);
    return {
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${r}deg) scale(${sc})`,
      opacity,
      zIndex: gather < 0.5 ? 20 + i : 50 - Math.round(Math.abs(i - active - advance) * 6),
    };
  };

  // Reduced motion cannot scrub a deck, and the tools must not simply
  // vanish for those users — they were the whole second half of the
  // sequence. The pin is dropped (see the media query in landing.css) and
  // the six tools render as a plain stacked list after the masthead.
  if (reduced) {
    return (
      <section className="atl atl--static">
        <div className="atl-pin">
          <div className="atl-drench" aria-hidden="true">
            <span className="cinema-grain" />
          </div>
          <div className="atl-lockup atl-lockup--static">
            {isRTL ? (
              <h1 className="atl-word atl-word--ar">مرشد</h1>
            ) : (
              <h1 className="atl-word">Mu<em>r</em>chid</h1>
            )}
            <div className="atl-meaning">{t("atl.meaning")}</div>
            <h2 className="atl-tagline" dir={isRTL ? "rtl" : "ltr"}>
              {tagline.map((tok, i) => (
                <span key={i}>{tok.brand ? <em>{tok.w}</em> : tok.w} </span>
              ))}
            </h2>
            <div className="atl-cta-row">
              <button type="button" className="atl-pill" onClick={onEnter}>{ctaLabel}</button>
            </div>
            <div className="atl-trust">{t("atl.trust")}</div>
          </div>
          <WalkthroughStacked />
        </div>
      </section>
    );
  }

  return (
    <section ref={trackRef} className="atl" style={{ height: `${HERO_TRACK_VH}vh` }}>
      {/* Scroll target for the nav "Features" link. Sits ~halfway down the
          pinned track, which is the scroll depth where the "Six tools"
          index is fully revealed (p ≈ 0.75). */}
      <span
        id="sec-features"
        aria-hidden="true"
        style={{ position: "absolute", top: "50%", left: 0, width: 1, height: 1, scrollMarginTop: "64px" }}
      />
      {/* ───────────── DESKTOP — pinned title sequence ───────────── */}
      <div className="atl-pin">
        {/* Warm drench that bleaches to the cream page as the act begins */}
        <div className="atl-drench" aria-hidden="true">
          <span className="cinema-grain" />
          <span className="cinema-orb cinema-orb-a" />
          <span className="cinema-orb cinema-orb-b" />
        </div>

        {/* Editorial spine — a magazine gutter caption */}
        <span className="atl-spine" aria-hidden="true" style={{ opacity: 1 - lockOut }}>
          MURCHID — EST. 2026
        </span>

        {/* Masthead bar */}
        <div
          className="atl-masthead"
          style={{ opacity: 1 - lockOut, transform: `translateY(${lockOut * -28}px)` }}
        >
          <span className="atl-rule" />
          <span className="atl-eyebrow">{t("landing.hero.eyebrow")}</span>
          <span className="atl-meta" dir="ltr">
            مرشد · NO. 01
          </span>
        </div>

        {/* The bilingual lockup — the signature */}
        <div
          className="atl-lockup"
          style={{
            opacity: 1 - lockOut,
            transform: `translate(-50%, 0) translateY(${lockOut * -64}px) scale(${(1 - lockOut * 0.05) * wordK})`,
          }}
        >
          {/* The watermark mirrors the foreground in the *other* script:
              Latin page → Arabic مرشد behind; Arabic page → Latin Murchid. */}
          <span
            className={`atl-watermark${isRTL ? " atl-watermark--latin" : ""}`}
            aria-hidden="true"
          >
            {isRTL ? "Murchid" : "مرشد"}
          </span>
          {isRTL ? (
            <h1 className="atl-word atl-word--ar">مرشد</h1>
          ) : (
            <h1 className="atl-word">
              Mu<em>r</em>chid
            </h1>
          )}
          <div className="atl-meaning">{t("atl.meaning")}</div>
          <h2 className="atl-tagline" dir={isRTL ? "rtl" : "ltr"}>
            {tagline.map((tok, i) => (
              <span className="atl-tw" style={{ "--i": i }} key={i}>
                {tok.brand ? <em>{tok.w}</em> : tok.w}{" "}
              </span>
            ))}
          </h2>
          <div className="atl-cta-row">
            <button type="button" className="atl-pill lp-magnetic" onClick={onEnter}>
              {ctaLabel}
            </button>
            {/* A second path for anyone not ready to open the studio. Jumps to
                the Showreel, which is the "watch it draft" demo. */}
            <button
              type="button"
              className="cinema-ghost lp-magnetic"
              onClick={() => {
                const el = document.getElementById("sec-how");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {t("landing.hero.ctaGhost")}
            </button>
          </div>
          <div className="atl-trust">{t("atl.trust")}</div>
        </div>

        {/* First act — editorial index header (resolves on the cream page) */}
        <div
          className="atl-index-head"
          style={{
            opacity: headIn * indexOut,
            // Bottom-anchored to the card top → a clean gap above the labels.
            // Uses the larger bigK so "Everything teaching needs…" reads big
            // on phones (it's a standalone block, not the 6-across row).
            transform: `translate(-50%, -100%) translateY(${headBottomY}px) translateY(${(1 - headIn) * 24}px) scale(${wordK})`,
          }}
        >
          <span className="atl-index-over">{t("atl.index.over")}</span>
          {/* The contents title blooms rather than fades: the curtain draws it
              down while Fraunces' weight and optical-size axes travel with it,
              so the type gains presence as it settles. Both are pure functions
              of the same headIn segment — see .lm-mask / .vf-bloom. */}
          <h2
            className="atl-index-title lm-mask vf-bloom"
            style={{
              "--lm": `${lerp(0, 118, easeInOut(headIn))}%`,
              "--vf-wght": lerp(280, 420, easeInOut(headIn)),
              "--vf-opsz": lerp(18, 144, easeInOut(headIn)),
            }}
          >
            {t("atl.index.title")}
          </h2>
        </div>

        {/* The ONE card layer — fan → contents row */}
        {/* Each slot holds two faces: set A (Science — the hero arc) and set
            B (Math — the index). They cross-fade with a blur as you scroll
            between the two, so the six "images" swap mid-journey. */}
        {/* The cards are presentational here. They used to be buttons that
            opened a detail lightbox, but the walkthrough section below now
            takes each one in turn and shows the same content in place, so a
            second, modal route to it was redundant. */}
        <div className="atl-cards">
          {HERO_CARDS.map((kind, i) => (
            <div key={kind} className="atl-card" style={cardStyle(i)}>
              <div className="atl-card-in" style={{ "--i": i }}>
                <div className="atl-stack">
                  <div className="atl-face" style={{ opacity: 1 - swap, filter: `blur(${swap * 9}px)` }}>
                    <HeroCardFace kind={kind} />
                  </div>
                  <div
                    className="atl-face atl-face--b"
                    style={{ opacity: swap, filter: `blur(${(1 - swap) * 9}px)` }}
                  >
                    <HeroCardFace kind={kind} variant="b" />
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Labels ride WITH their card into the deck rather than staying put:
            pinned to the row while the cards swept away, they read for a
            moment as six stranded captions. */}
        <div className="atl-toc atl-toc--compact" style={{ opacity: skipIndexRow ? 0 : tocIn * indexOut, "--toc-k": tocK }} aria-hidden={skipIndexRow || tocIn * indexOut < 0.5}>
          {HERO_CARDS.map((kind, i) => {
            const b = bPos(i);
            const dp = deckPos(i, dir);
            const lx = lerp(b.x, deckX + dp.x, gather);
            const ly = lerp(b.y, deckY + dp.y, gather);
            const ls = lerp(b.s, dp.s * deckScale, gather);
            const labelY = ly - (CARD_H * ls) / 2 - 14; // sit above the card top
            return (
            <div
              key={kind}
              className="atl-toc-item"
              style={{ transform: `translate(-50%, -100%) translate(${lx}px, ${labelY}px)` }}
            >
              <span className="atl-toc-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="atl-toc-label">{t(`atl.art.${kind}`)}</span>
              <span className="atl-toc-desc">{t(`atl.desc.${kind}`)}</span>
            </div>
            );
          })}
        </div>

        {/* Selection dot on the trailing edge of the front card. */}
        <span
          className="atl-dot"
          style={{
            transform: narrow
              ? `translate(-50%, -50%) translate(${deckX}px, ${deckY + 150 * deckScale}px) scale(${lerp(0.2, 1, dotIn)})`
              : `translate(-50%, -50%) translate(${deckX + 118 * dir}px, ${deckY}px) scale(${lerp(0.2, 1, dotIn)})`,
            opacity: dotIn,
          }}
          aria-hidden="true"
        />

        <WalkthroughLayer
          active={active}
          local={local}
          gather={gather}
          headIn={twHeadIn}
          dotIn={dotIn}
          lineIn={lineIn}
          textIn={textIn}
          narrow={narrow}
          isRTL={isRTL}
        />
      </div>

      {/* The old static mobile fallback lived here. It was `display: none`
          with no media query anywhere that revealed it — the pinned sequence
          above renders at every width, phone included (see the isPortrait
          branch in bPos, which reflows the index into a 3×2 grid). Harmless
          while the cards were <img>s; now that they are live components it
          was mounting six of them off-screen with their animations running.
          Removed rather than left to rot. */}
    </section>
  );
}
