"use client";

// =====================================================================
// Murchid — Hero, stage-one variants (preview)
//
// Same pinned act as HeroAtelier, with its OPENING made swappable.
//
// The old opening dealt the eight modules out as a fan of cards. Cards
// are the wrong object for a first frame: eight of them at fan scale are
// eight unreadable rectangles, they say nothing about what the product
// IS, and they spend the most valuable screen in the funnel showing the
// reader a shuffling deck. So the frame now opens on ONE scene — a
// drawn studio — with the eight modules floating over it as named glyph
// tiles. A visitor can name all eight before scrolling a pixel.
//
// The act structure is unchanged, which is the point: this is a new
// opening bolted onto a sequence that already worked.
//
//   ACT 1  scene      the centre, eight sources, the lockup   ← varies
//   ACT 2  morph      each source flies to its slot and BECOMES its card
//   ACT 3  index      the numbered contents page (unchanged)
//   ACT 4  walkthrough the deck, one module at a time (unchanged)
//
// Only ACT 1 varies. A variant supplies a layout — where the eight
// sources rest and what sits behind them — and a `sourceKind` saying
// what they look like there. Acts 2-4 are drawn by one code path for all
// ten, which is what makes them genuinely comparable: whatever differs
// on screen is the design, not a second implementation.
//
// See features/hero-constellation/variants/ for the ten.
//
// The morph is a per-tile cross-fade in flight rather than one global
// swap: tile i and card i occupy the same transform at the same instant,
// and tile fades out across the middle of its own travel while the card
// fades in. Staggered by index, so it cascades left-to-right instead of
// eight things changing state on one frame.
//
// Motion is a pure function of scroll (rAF → `p`) — no animation
// library, same technique as the rest of the landing. Bilingual via
// useT(), mirrored for RTL through `dir`. Honors prefers-reduced-motion
// with a composed static frame.
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { useT, useI18n } from "../lib/i18n";
import { HERO_CARDS, HeroCardFace } from "./HeroJourney";
import { CARD_H, deckCenterX, deckPos, indexLayout } from "../features/hero-artifacts/indexLayout";
import { Glyph } from "../features/hero-constellation/glyphs";
import Centre from "../features/hero-constellation/variants/Centres";
import { variantById } from "../features/hero-constellation/variants";
import hx from "../features/hero-constellation/HeroConstellation.module.css";

import WalkthroughLayer, { WalkthroughStacked } from "../features/tool-walkthrough/WalkthroughLayer";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const smooth = (t) => t * t * (3 - 2 * t);
/** Eased 0→1 ramp across [a,b] of some progress value. */
const ramp = (v, a, b) => smooth(clamp01((v - a) / (b - a)));

const N = HERO_CARDS.length; // 8

// ── Track budget ─────────────────────────────────────────────────────
// Authored in viewport-heights, because what matters is how much
// scrolling a reader spends on each beat, not an abstract fraction.
//
// INTRO covers scene → morph → numbered index → gather. SLOT is what one
// module gets in the walkthrough. The section's height is derived from
// these, so CSS and choreography cannot drift apart.
//
// INTRO is longer than the fan cut's 112vh: the scene is something to
// READ, not a transition to sit through, so it holds before anything
// moves, and the morph itself is staggered across eight tiles and needs
// room to land rather than snap.
const INTRO_VH = 152;
const SLOT_VH = 44;
const TRAVEL_VH = INTRO_VH + SLOT_VH * N;
export const HERO_TRACK_VH = TRAVEL_VH + 100; // + the pinned viewport
/** viewport-heights → progress fraction of the track's travel */
const at = (v) => v / TRAVEL_VH;

/** Fraction of the morph window each successive tile is delayed by. */
const STAGGER = 0.055;
const MORPH_SPAN = 1 - (N - 1) * STAGGER;

// Build the value line "The teacher directs. Murchid drafts." as a word
// list so each token can stagger in on load. The brand word is flagged
// so it renders in clay italic.
function useTaglineWords(t) {
  const out = [];
  for (const w of t("lp.hero.h1a").split(/\s+/)) if (w) out.push({ w, brand: false });
  out.push({ w: t("lp.hero.brand"), brand: true });
  for (const w of t("lp.hero.h1b").split(/\s+/)) if (w) out.push({ w, brand: false });
  return out;
}

// Placeholder viewport for the server render, where there is no window.
// Both renders MUST seed the same value: seeding the client from
// window.innerWidth makes the mount effect a no-op, React bails out of
// the same-value update, and hydration does not repair inline styles —
// so the DOM keeps the server's 1280px geometry on a 390px phone. See
// the long note in HeroAtelier.jsx.
const SSR_VIEWPORT_W = 1280;
const SSR_VIEWPORT_H = 800;

export default function HeroStageOne({ onEnter, signedIn, variant }) {
  const V = variantById(variant);
  const t = useT();
  const { isRTL } = useI18n();
  const dir = isRTL ? -1 : 1;
  const trackRef = useRef(null);
  const [p, setP] = useState(0);
  const [vw, setVw] = useState(SSR_VIEWPORT_W);
  const [vh, setVh] = useState(SSR_VIEWPORT_H);
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    setReduced(window.matchMedia("(prefers-reduced-motion: reduce)").matches);
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // Width first and unconditionally — it must not be skipped by the
        // ref guard below, or the hydration placeholder never clears.
        setVw(window.innerWidth);
        setVh(window.innerHeight);
        const el = trackRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        setP(span > 0 ? clamp01(-r.top / span) : 0);
      });
    };
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
  //   0–10vh    HOLD — the scene, untouched. The frame the page opens on.
  //   10–26vh   the cue and the filaments release
  //   18–50vh   the lockup recedes
  //   22–54vh   the studio plate dissolves
  //   26–94vh   the tiles fly out and become cards (staggered per tile)
  //   64–92vh   the index heading arrives
  //   84–114vh  01–08 labels
  //   114–126vh HOLD — the finished contents page
  //   126–152vh the row gathers to the side and stacks into a deck
  //   152vh+    44vh per module
  const cueOut = 1 - seg(p, at(9), at(22));
  const lockOut = easeInOut(seg(p, at(18), at(50)));
  const plateOut = 1 - easeInOut(seg(p, at(22), at(54)));
  const morph = seg(p, at(26), at(94));
  const swap = easeInOut(seg(p, at(60), at(84)));
  const headIn = seg(p, at(64), at(92));
  const tocIn = seg(p, at(84), at(114)); // suppressed on portrait — see the list

  /** Per-tile morph progress. Tile i starts a beat after tile i-1. */
  const mAt = (i) => smooth(clamp01((morph - i * STAGGER) / MORPH_SPAN));

  // ── gather: index row → deck ─────────────────────────────────────
  const GATHER_A = at(126);
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
  // The LAST module must not clear: there is no next card to make room
  // for, so it holds rather than ending the track on an empty screen.
  const isLast = active === N - 1;
  const outT = isLast ? 1 : 1 - ramp(local, 0.9, 1);
  const dotIn = ramp(local, 0.03, 0.13) * outT;
  const lineIn = ramp(local, 0.07, 0.24) * outT;
  const textIn = ramp(local, 0.12, 0.3) * outT;
  const advance = isLast ? 0 : ramp(local, 0.9, 1);

  const ctaLabel = signedIn ? t("landing.nav.openPlanner") : t("ch.hero.cta");
  const tagline = useTaglineWords(t);

  // ── layout ───────────────────────────────────────────────────────
  const L = indexLayout(N, vw, vh, dir, isRTL);
  const wordK = L.wordK;
  const C = V.layout(N, vw, vh, dir, wordK);
  // What the masthead block is scaled by. Named because the CTA row
  // divides it back out — see the note there.
  const lockTotal = wordK * C.lockScale;
  // Cards are their own source in the `card` variants, so there is no
  // cross-fade to run: they are simply visible from the first frame and
  // the morph is pure position and scale.
  const cardsAreSource = V.sourceKind === "card";
  // Centres built from live type scale as one block; centres built from
  // geometry fill the box they were given. See the centre block below.
  const centreFixed =
    !C.centre?.kind || C.centre.kind === "bureau" || C.centre.kind === "specimen";
  const tocK = L.tocK;
  const isPortrait = L.isPortrait;

  // ── deck geometry (the walkthrough half) ─────────────────────────
  const narrow = vw <= 900;
  const deckX = deckCenterX(vw, dir, narrow);
  // Phones stack deck over copy, so the deck gets the band between the
  // heading and the split and scales to whatever that band measures.
  // Both constants mirror ToolWalkthrough.module.css exactly.
  const SPLIT = 0.56;
  const padTop = Math.min(110, Math.max(72, vh * 0.12));
  const bandTop = padTop + 84;
  const bandH = SPLIT * vh - bandTop;
  const deckScale = narrow ? Math.max(0.5, Math.min(0.86, (bandH - 20) / CARD_H)) : 1;
  const deckY = narrow ? (bandTop + SPLIT * vh) / 2 - vh / 2 : 46;

  // Portrait keeps the index beat as a typographic contents LIST with the
  // cards riding above it as a tidy stack — eight legible cards will not
  // fit a phone as a grid, and skipping the beat cost phones the overview
  // that gives the section its point.
  const mShort = vh < 700;
  const M_STEP = 9;
  const mIndexScale = deckScale * (mShort ? 0.52 : 0.66);
  const mIndexY = -vh / 2 + padTop + 96 + (CARD_H * mIndexScale) / 2;

  const headBottomY = isPortrait
    ? Math.max(-vh / 2 + 64 + 112, mIndexY - (CARD_H * mIndexScale) / 2 - 30)
    : L.headBottomY;
  const mRowH = mShort ? 37 : 41;
  const mTiny = vh < 620;
  /** Per-row entrance for the phone list — each row lands on its own beat. */
  const mRowIn = (i) => ramp(tocIn, 0.04 + i * 0.05, 0.34 + i * 0.05);
  const mListH = N * mRowH;
  const mListTop = mTiny
    ? -vh / 2 + 196
    : Math.min(
        mIndexY + M_STEP * (N - 1) + (CARD_H * mIndexScale) / 2 + 40,
        vh / 2 - 20 - mListH
      );

  /** Settled position of card i — the 4×2 index grid, or the phone stack. */
  const bPos = isPortrait
    ? (i) => ({ x: 0, y: mIndexY + i * M_STEP, s: mIndexScale * (1 - i * 0.02) })
    : L.pos;

  // ── the morph ────────────────────────────────────────────────────
  // Tile and card share one path. Both are placed by lerping the tile's
  // constellation position to the card's settled position by that tile's
  // own morph progress — identical transforms, so the cross-fade between
  // them is a change of material and not a jump.
  const pathAt = (i, m) => {
    const a = C.tile(i);
    const b = bPos(i);
    return {
      x: lerp(a.x, b.x, m),
      y: lerp(a.y, b.y, m),
      s: { a: a.s, b: b.s },
    };
  };

  const cardStyle = (i) => {
    const m = mAt(i);
    const a = C.tile(i);
    const b = bPos(i);
    // The card starts at exactly the tile's footprint so the two
    // silhouettes coincide at the moment they trade places.
    const sa = C.cardStartScale * a.s;
    const pt = pathAt(i, m);
    // C — the deck. Distance from its front; before the gather starts,
    // `active` and `advance` are both 0, so this is simply i.
    const dp = deckPos(i - active - advance, dir);
    // Two lerps in sequence, not a blend: the tile resolves into the
    // index first, and only then does the row gather into the deck. The
    // windows do not overlap, so composing them this way is exact.
    const rs = lerp(sa, b.s, m);
    const x = lerp(pt.x, deckX + dp.x, gather);
    const y = lerp(pt.y, deckY + dp.y, gather);
    // Variants that set a resting rotation (Bureau's desk objects) unwind
    // it as the card travels, so every card still lands square in the
    // index grid however askew it started.
    const rot = lerp(lerp(a.rot || 0, 0, m), dp.rot, gather);
    const sc = lerp(rs, dp.s * deckScale, gather);
    // The card takes over from the source across the middle of the
    // flight — unless it IS the source, in which case it never fades.
    const cardIn = cardsAreSource ? 1 : ramp(m, 0.42, 0.8);
    let opacity = lerp(cardIn, dp.opacity, gather);
    if (mTiny) opacity *= 1 - 0.86 * (tocIn * indexOut);
    return {
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${rot}deg) scale(${sc})`,
      opacity,
      // In the phone stack the FIRST card sits on top, so the order is
      // reversed against the constellation's reading order.
      zIndex:
        gather >= 0.5
          ? 50 - Math.round(Math.abs(i - active - advance) * 6)
          : isPortrait && m > 0.6
          ? 50 - i
          : 20 + i,
    };
  };

  const tileStyle = (i) => {
    const m = mAt(i);
    const a = C.tile(i);
    const b = bPos(i);
    const pt = pathAt(i, m);
    // The tile grows toward the card's footprint as it travels, so it is
    // never a small square sitting inside a large card at the hand-off.
    const grow = lerp(a.s, (b.s * CARD_H) / (C.tileSize * 1.9), m);
    return {
      transform: `translate(-50%, -50%) translate(${pt.x}px, ${pt.y}px) scale(${grow})`,
      width: C.tileSize,
      height: C.tileSize,
      opacity: 1 - ramp(m, 0.32, 0.66),
      zIndex: 20 + i,
      "--i": i,
    };
  };

  // A type row travels the same path as a tile but keeps its own
  // proportions: it is a line of text, so it fades rather than growing
  // into the card's footprint — a row stretched to card width on the way
  // would read as the type breaking, not as it handing over.
  const typeStyle = (i) => {
    const m = mAt(i);
    const pt = pathAt(i, m);
    return {
      transform: `translate(-50%, -50%) translate(${pt.x}px, ${pt.y}px) scale(${lerp(1, 1.06, m)})`,
      width: C.sourceW,
      opacity: 1 - ramp(m, 0.14, 0.5),
      "--row-h": `${C.tileSize}px`,
      zIndex: 20 + i,
    };
  };

  // Caption sits under its tile and leaves EARLY — well before the tile
  // itself does. A caption still legible while its tile is halfway to the
  // grid reads as a label that has come unstuck from its object.
  const tileLabelStyle = (i) => {
    const m = mAt(i);
    const pt = pathAt(i, m);
    const above = C.labelAbove?.(i);
    const off = C.tileSize * 0.72;
    const fade = 1 - ramp(m, 0.1, 0.34);
    // "outside" hangs the caption away from the centre line instead of
    // under the tile. The arch variants need it: their interior is the
    // masthead, and a caption dropped under a niche lands on the wordmark.
    // A phone's two columns are narrower than the desktop caption box, so
    // the layout hands back the width it can actually spare.
    const w = C.labelW ? { width: C.labelW } : null;
    if (C.labelPlace === "outside") {
      const outward = C.tile(i).x >= 0 ? 1 : -1;
      const push = (C.tileSize / 2 + 10) * outward;
      return {
        ...w,
        transform: `translate(${outward > 0 ? "0" : "-100%"}, -50%) translate(${pt.x + push}px, ${pt.y}px)`,
        textAlign: outward > 0 ? "start" : "end",
        opacity: fade,
      };
    }
    return {
      ...w,
      transform: above
        ? `translate(-50%, -100%) translate(${pt.x}px, ${pt.y - off}px)`
        : `translate(-50%, 0) translate(${pt.x}px, ${pt.y + off}px)`,
      opacity: fade,
    };
  };

  // Reduced motion cannot scrub a deck, and the modules must not simply
  // vanish for those users. The pin is dropped (see the media query in
  // landing.css) and the sequence renders as a composed static frame:
  // the lockup, the scene, then the eight modules as a stacked list.
  if (reduced) {
    return (
      <section className="atl atl--static">
        {/* --lit-run is the variant's own tempo for one pass of its light.
          Set on the pin so the centre piece and the eight module glows
          read the same value and cannot drift. */}
      {/* height: 100dvh, not the stylesheet's 100vh. On a phone 100vh is
          the viewport WITHOUT browser chrome, so the pin ran taller than
          what you can actually see and its centre — which every position
          in these layouts is measured from — sat below the fold. The
          layout maths already use window.innerHeight, which is the dynamic
          height, so this makes the CSS agree with the JS. */}
      <div
        className="atl-pin"
        style={{ height: "100dvh", "--lit-run": `${C.pulseDur ?? 7}s` }}
      >
          <div className="atl-drench" aria-hidden="true">
            <span className="cinema-grain" />
          </div>
          <div className={`atl-lockup atl-lockup--static ${hx.lockCompact}`}>
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
            {/* No counter-scale. The masthead now renders at exactly the
              size it does at "/", so these are already the same buttons
              at the same size — only better lit. This used to divide out
              a shrunken masthead's scale; that shrinking is gone. */}
          <div className={hx.ctaRow}>
            <button type="button" className={`${hx.ctaPrimary} lp-magnetic`} onClick={onEnter}>
              {ctaLabel}
              <svg className={hx.ctaArrow} width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className={`${hx.ctaGhost} lp-magnetic`}
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
          <WalkthroughStacked />
        </div>
      </section>
    );
  }

  const plateOpacity = plateOut;

  return (
    <section ref={trackRef} className="atl" style={{ height: `${HERO_TRACK_VH}vh` }}>
      {/* Scroll target for the nav "Features" link — the depth at which
          the contents index is fully revealed. */}
      <span
        id="sec-features"
        aria-hidden="true"
        style={{ position: "absolute", top: "50%", left: 0, width: 1, height: 1, scrollMarginTop: "64px" }}
      />

      {/* --lit-run is the variant's own tempo for one pass of its light.
          Set on the pin so the centre piece and the eight module glows
          read the same value and cannot drift. */}
      {/* height: 100dvh, not the stylesheet's 100vh. On a phone 100vh is
          the viewport WITHOUT browser chrome, so the pin ran taller than
          what you can actually see and its centre — which every position
          in these layouts is measured from — sat below the fold. The
          layout maths already use window.innerHeight, which is the dynamic
          height, so this makes the CSS agree with the JS. */}
      <div
        className="atl-pin"
        style={{ height: "100dvh", "--lit-run": `${C.pulseDur ?? 7}s` }}
      >
        {/* Warm drench that the whole act plays on */}
        <div className="atl-drench" aria-hidden="true">
          <span className="cinema-grain" />
          <span className="cinema-orb cinema-orb-a" />
          <span className="cinema-orb cinema-orb-b" />
        </div>

        {/* ── ACT 1 — the centre ─────────────────────────────────── */}
        {/* Two families of centre, and they are scaled differently on
            purpose. Ones built from live type (the studio window, the
            cover plate) are drawn at a FIXED design size and scaled as
            one block, so their type keeps its proportions instead of
            reflowing into a different composition at every width. Ones
            built from geometry (arc, ring, rule, arch) have no internal
            type to hold, so they simply fill the box the layout gave
            them. */}
        {C.centre && (
          <div
            className={hx.stage}
            aria-hidden="true"
            style={
              centreFixed
                ? {
                    transform: `translate(-50%, -50%) translate(${C.centre.x}px, ${C.centre.y}px) scale(${C.centre.k * lerp(1, 0.94, 1 - plateOpacity)})`,
                    opacity: plateOpacity,
                  }
                : {
                    width: C.centre.w,
                    height: C.centre.h,
                    transform: `translate(-50%, -50%) translate(${C.centre.x}px, ${C.centre.y}px) scale(${lerp(1, 0.96, 1 - plateOpacity)})`,
                    opacity: plateOpacity,
                  }
            }
          >
            <Centre
              kind={C.centre.kind}
              compact={C.centre.compact}
              bays={C.centre.bays}
              size={{ w: C.centre.w, h: C.centre.h }}
              points={C.centre.points}
              isRTL={isRTL}
              t={t}
            />
          </div>
        )}

        {/* Filaments — the eight modules shown as things the studio
            emits. They release before the tiles move, so the tiles read
            as leaving rather than as dragging the lines with them. */}
        {C.centre && C.filaments && V.sourceKind === "tile" && (
        <svg
          className={hx.filaments}
          viewBox={`${-vw / 2} ${-vh / 2} ${vw} ${vh}`}
          preserveAspectRatio="none"
          aria-hidden="true"
          style={{ opacity: plateOpacity * cueOut * 0.55 }}
        >
          {HERO_CARDS.map((kind, i) => {
            const a = C.tile(i);
            return (
              <path
                key={kind}
                className={hx.filament}
                d={`M ${C.centre.x} ${C.centre.y} Q ${(C.centre.x + a.x) / 2} ${a.y} ${a.x} ${a.y}`}
                strokeOpacity={0.26 - Math.abs(a.x) / (vw * 5)}
              />
            );
          })}
        </svg>
        )}

        {/* Editorial gutter caption — a magazine spine */}
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

        {/* The bilingual lockup — the signature. Smaller and lifted here
            than in the fan cut: this is the one frame where the scene is
            the message and the wordmark is the caption. */}
        <div
          className={`atl-lockup ${hx.lockCompact}`}
          style={{
            opacity: 1 - lockOut,
            // lockX moves the whole masthead off centre — only Spread
            // uses it, to clear the module rail beside it.
            transform: `translate(-50%, 0) translate(${C.lockX || 0}px, ${C.lockShiftY + lockOut * -64}px) scale(${lockTotal * (1 - lockOut * 0.05)})`,
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
          {/* Same buttons, same size as "/" — the masthead is no longer
              scaled down by the variant, so these render identically. What
              changed is how visible they are: the ghost's boundary was a
              hairline at 0.3 alpha over a mid-tone drench, which is under
              3:1 and does not read as a control at all, and neither had
              anything drawing the eye back to it. */}
          <div className={hx.ctaRow}>
            <button type="button" className={`${hx.ctaPrimary} lp-magnetic`} onClick={onEnter}>
              {ctaLabel}
              <svg className={hx.ctaArrow} width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3 8h9M8.5 4l4 4-4 4" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
            <button
              type="button"
              className={`${hx.ctaGhost} lp-magnetic`}
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

        {/* ── the eight glyph tiles ──────────────────────────────── */}
        {/* Presentational: the walkthrough below takes each module in
            turn and shows it in place, so a second route into the same
            content would be redundant. The list is exposed to assistive
            tech once, as a list, rather than as eight loose graphics. */}
        {/* ── the eight sources ──────────────────────────────────── */}
        {/* Presentational: the walkthrough below takes each module in
            turn and shows it in place, so a second route into the same
            content would be redundant. Exposed to assistive tech once,
            as a list, rather than as eight loose graphics.

            `card` variants render nothing here — their cards ARE the
            sources and are drawn by the card layer below. */}
        {!cardsAreSource && (
          <div className={hx.tiles}>
            <ul style={{ position: "absolute", left: 0, top: 0, margin: 0, padding: 0, listStyle: "none" }}>
              {HERO_CARDS.map((kind, i) => (
                <li key={kind}>
                  {V.sourceKind === "type" ? (
                    // A numbered row set in Fraunces. The row is its own
                    // label, so these variants carry no separate caption.
                    <div className={hx.typeRow} style={typeStyle(i)}>
                      <span className={hx.typeNum}>{String(i + 1).padStart(2, "0")}</span>
                      <span className={hx.typeName}>{t(`atl.art.${kind}`)}</span>
                      <span className={hx.typeDesc}>{t(`atl.desc.${kind}`)}</span>
                    </div>
                  ) : (
                    <div className={hx.tile} style={tileStyle(i)}>
                      {/* The drift lives on the inner element: a CSS
                          animation's transform beats an inline one, so an
                          animated outer tile would discard its scroll
                          position entirely. */}
                      <div
                        className={`${hx.tileInner} ${morph > 0 ? hx.tileSettled : hx.tileFloat} ${morph < 0.02 ? hx.tileIn : ""}`}
                        style={{ "--i": i, "--pulse": C.pulseAt?.(i) ?? i / N }}
                      >
                        {/* Lit as the centre's travelling light reaches
                            this module. Its own element rather than a
                            second animation on the tile, because the tile
                            is already running the ambient drift and one
                            element can only hold one animation-delay per
                            property. Dropped once the morph starts — the
                            sources are in flight by then and a glow
                            following them reads as a rendering fault. */}
                        {C.pulseAt && morph < 0.02 && (
                          <>
                            <span className={hx.tileLit} aria-hidden="true" />
                            {/* The ping: a ring pushed outward on the beat
                                the light arrives, so it reads as reaching
                                this module rather than passing behind it. */}
                            <span className={hx.tileRing} aria-hidden="true" />
                          </>
                        )}
                        <span className={hx.tileNum} aria-hidden="true">
                          {String(i + 1).padStart(2, "0")}
                        </span>
                        <Glyph kind={kind} size={Math.round(C.tileSize * 0.4)} />
                      </div>
                    </div>
                  )}
                  {C.showLabels && V.sourceKind === "tile" && (
                    <div
                      className={`${hx.tileLabel} ${morph < 0.02 ? hx.tileLabelIn : ""}`}
                      style={{ ...tileLabelStyle(i), "--pulse": C.pulseAt?.(i) ?? i / N }}
                    >
                      <span className={hx.tileLabelName}>{t(`atl.art.${kind}`)}</span>
                      {C.showDesc && (
                        <span className={hx.tileLabelDesc}>{t(`atl.desc.${kind}`)}</span>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* The line that tells a reader the scene is a map. Sits under
            the lower band, clears as soon as the morph is imminent. */}
        <div
          className={hx.sceneCue}
          style={{
            opacity: C.showCue ? cueOut * 0.9 : 0,
            transform: `translate(-50%, -50%) translateY(${C.cueY}px)`,
          }}
        >
          {t("atl.index.over")}
        </div>

        {/* ── ACT 3 — editorial index header ─────────────────────── */}
        <div
          className={`atl-index-head${isPortrait ? " atl-index-head--m" : ""}`}
          style={{
            opacity: headIn * indexOut,
            // Portrait anchors from the TOP of the pin: bottom-anchoring
            // depends on the heading's own rendered height, which varies
            // with how the title wraps on a phone, so a clamp meant to
            // hold it below the nav still let it drift underneath.
            transform: isPortrait
              ? `translate(-50%, 0) translateY(${(1 - headIn) * 24}px)`
              : `translate(-50%, -100%) translateY(${headBottomY}px) translateY(${(1 - headIn) * 24}px) scale(${wordK})`,
          }}
        >
          <span className="atl-index-over">{t("atl.index.over")}</span>
          {/* The contents title blooms rather than fades: the curtain
              draws it down while Fraunces' weight and optical-size axes
              travel with it, so the type gains presence as it settles. */}
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

        {/* ── ACT 2/3 — the cards the tiles become ───────────────── */}
        {/* Each slot holds two faces: set A (Science) and set B (Math).
            They cross-fade with a blur as you scroll between them, so
            the eight "images" swap mid-journey. */}
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

        {/* Labels ride WITH their card into the deck rather than staying
            put: pinned to the row while the cards swept away, they read
            for a moment as eight stranded captions. */}
        <div
          className="atl-toc atl-toc--compact"
          style={{ opacity: isPortrait ? 0 : tocIn * indexOut, "--toc-k": tocK }}
          aria-hidden={isPortrait || tocIn * indexOut < 0.5}
        >
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

        {/* Phone contents list — the portrait form of the index stage. */}
        {isPortrait && (
          <ol
            className="atl-mlist"
            // `top`, not insetBlockStart: React does not map the logical
            // property, so it was dropped and the list pinned to 0.
            style={{ opacity: tocIn * indexOut, top: `calc(50% + ${Math.round(mListTop)}px)` }}
            aria-hidden={tocIn * indexOut < 0.5}
          >
            {HERO_CARDS.map((kind, i) => {
              const r = mRowIn(i);
              return (
                <li
                  key={kind}
                  className="atl-mrow"
                  style={{
                    opacity: r,
                    transform: `translateY(${lerp(14, 0, r)}px)`,
                    ["--row"]: r,
                  }}
                >
                  <span className="atl-mnum">{String(i + 1).padStart(2, "0")}</span>
                  <span className="atl-mname">{t(`atl.art.${kind}`)}</span>
                  <span className="atl-mdesc">{t(`atl.desc.${kind}`)}</span>
                </li>
              );
            })}
          </ol>
        )}

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
    </section>
  );
}
