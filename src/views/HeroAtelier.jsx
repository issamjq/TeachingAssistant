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
// ONE pinned scroll act: the warm drench bleaches to cream as the
// masthead recedes and the six teaching artifacts deal out of a fan,
// then resolve into an editorial INDEX — a magazine contents page
// (01 — Lesson plan, 02 — Quiz, …).
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
import { indexLayout } from "../features/hero-artifacts/indexLayout";

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

const N = HERO_CARDS.length; // 6
const MID = (N - 1) / 2; // 2.5

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

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        // Width first, and unconditionally — it must not be skipped by the
        // ref guard below, or the hydration placeholder above never clears.
        setVw(window.innerWidth);
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
  // The drench stays full-opacity now (the index lives ON the warm gradient,
  // matching Voices / membership / final CTA), so there's no bleach-to-cream.
  // Beats overlap deliberately. They used to run end-to-end, which left a
  // gap between the masthead finishing its exit (0.30) and the index header
  // starting (0.42) where the screen held nothing but cards in transit — a
  // dead frame that was easy to miss on a 300vh runway and obvious once the
  // track was compressed to 200vh. The header now begins as the masthead
  // clears, so something is always arriving.
  const lockOut = easeInOut(seg(p, 0.04, 0.28)); // masthead + lockup recede
  const cardsT = easeInOut(seg(p, 0.10, 0.55)); // fan → editorial index row
  const swap = easeInOut(clamp01((p - 0.24) / 0.18)); // card set A → B, blur crossfade
  const headIn = seg(p, 0.28, 0.52); // index header reveal
  const tocIn = seg(p, 0.42, 0.70); // 01–06 contents labels

  const ctaLabel = signedIn ? t("landing.nav.openPlanner") : t("ch.hero.cta");
  const tagline = useTaglineWords(t);

  // ── Responsive index row ─────────────────────────────────────────
  // Positions come from the shared module so ToolWalkthrough, which opens on
  // this exact row before collapsing it into a deck, can reproduce the last
  // frame of this section precisely. See features/hero-artifacts/indexLayout.
  const L = indexLayout(N, vw, dir, isRTL);
  const wordK = L.wordK;
  const bPos = L.pos;
  const tocK = L.tocK;
  const headBottomY = L.headBottomY;
  const isPortrait = L.isPortrait;
  // The opening fan is narrow, so it can be larger than the row and still fit.
  const fanK = Math.min(1, (vw - 24) / 780);

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
    const x = lerp(xa, b.x, cardsT);
    const y = lerp(ya, b.y, cardsT);
    const r = lerp(ra, 0, cardsT);
    const s = lerp(sa, b.s, cardsT);
    return {
      transform: `translate(-50%, -50%) translate(${x}px, ${y}px) rotate(${r}deg) scale(${s})`,
      zIndex: 20 + i,
    };
  };

  return (
    <section ref={trackRef} className="atl">
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
            opacity: headIn,
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

        <div className="atl-toc" style={{ opacity: tocIn, "--toc-k": tocK }} aria-hidden={tocIn < 0.5}>
          {HERO_CARDS.map((kind, i) => {
            const b = bPos(i);
            const labelY = b.y - (345 * b.s) / 2 - 14; // sit above the card top
            return (
            <div
              key={kind}
              className="atl-toc-item"
              style={{ transform: `translate(-50%, -100%) translate(${b.x}px, ${labelY}px)` }}
            >
              <span className="atl-toc-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="atl-toc-label">{t(`atl.art.${kind}`)}</span>
              <span className="atl-toc-desc">{t(`atl.desc.${kind}`)}</span>
            </div>
            );
          })}
        </div>
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
