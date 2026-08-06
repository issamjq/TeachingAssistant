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
  const lockOut = easeInOut(seg(p, 0.05, 0.30)); // masthead + lockup recede
  const cardsT = easeInOut(seg(p, 0.12, 0.62)); // fan → editorial index row
  const swap = easeInOut(clamp01((p - 0.28) / 0.2)); // card set A → B, blur crossfade
  const headIn = seg(p, 0.42, 0.66); // index header reveal
  const tocIn = seg(p, 0.52, 0.8); // 01–06 contents labels

  const ctaLabel = signedIn ? t("landing.nav.openPlanner") : t("ch.hero.cta");
  const tagline = useTaglineWords(t);

  // ── Responsive index row ─────────────────────────────────────────
  // The six cards + their 01–06 labels scale and tighten to fit (and stay
  // centred) from the 1024px pin breakpoint up to the design width —
  // bigger than before on a normal desktop, never overflowing a small one.
  const ROW_SCALE = 0.84; // card scale at the full design width
  const ROW_PITCH = 210; // gap between card centres at the full width
  const ROW_W = ROW_PITCH * (N - 1) + 230 * ROW_SCALE; // ≈ row footprint
  // Two fit factors. The index ROW must fit six cards across, so it has to
  // stay compact on phones (k). But the opening FAN and the wordmark are
  // narrow — they can be much larger and still fit, so they use `bigK`
  // (sized to the ~760px wordmark width). The cards deal out big from the
  // fan, then settle into the tighter row as you scroll.
  const k = Math.min(1, (vw - 48) / ROW_W); // index-row shrink-to-fit
  // The fan and the wordmark have different widths, so they get their own
  // fit factors (sharing one made the wide Latin "Murchid" overflow). The
  // wordmark factor is per-script: مرشد is far narrower than Murchid, so
  // Arabic can scale up bigger and still fit.
  const fanK = Math.min(1, (vw - 24) / 780); // opening fan fit
  const wordK = Math.min(1, (vw - 32) / (isRTL ? 440 : 720)); // wordmark + tagline + heading

  // Index ROW (landscape / tablet / desktop) — six cards across.
  const pitch = ROW_PITCH * k;
  const cardScaleB = ROW_SCALE * k;
  const yb = 132; // row centre, just below the pin centre

  // Phone portrait can't fit six legible cards across, so the settled
  // INDEX state reflows there into a 3×2 grid (cards ~2× larger). The
  // opening fan, the wordmark, and the scroll choreography are unchanged —
  // only the final contents arrangement differs on this one breakpoint.
  const isPortrait = vw < 560;
  const G_COLS = 3;
  const gCardScale = Math.min(0.56, (vw - 40) / (G_COLS * 230 + (G_COLS - 1) * 16));
  const gColPitch = 230 * gCardScale + 16;
  const gRowPitch = 345 * gCardScale + 92; // card height + a roomy label band
  const gRow0Y = 150 - gRowPitch / 2; // two rows centred about y≈150

  // Settled (B-state) position per card — grid on portrait, row otherwise.
  const bPos = (i) => {
    if (isPortrait) {
      const col = i % G_COLS;
      const rowIdx = Math.floor(i / G_COLS);
      return {
        x: (col - (G_COLS - 1) / 2) * gColPitch * dir,
        y: gRow0Y + rowIdx * gRowPitch,
        s: gCardScale,
      };
    }
    const o = i - MID;
    return { x: o * pitch * dir, y: yb, s: cardScaleB };
  };
  // Label TYPE factor. On portrait the labels read bigger than the raw card
  // scale (capped so "PRESENTATIONS" still fits a card's width).
  const tocK = isPortrait ? Math.min(0.85, gCardScale * 1.6) : k;
  // Title anchor sits above the top row of the settled layout.
  const settledScale = isPortrait ? gCardScale : cardScaleB;
  const topCardY = isPortrait ? gRow0Y : yb;
  const topCardTopY = topCardY - (345 * settledScale) / 2;
  const headBottomY = topCardTopY - (isPortrait ? 96 : 118);

  // Shared card transform — fan (hero) lerped to its settled position.
  const cardStyle = (i) => {
    const o = i - MID;
    const xa = o * 128 * dir * fanK; // A — confident opening fan
    const ya = 204 + (MID * MID - o * o) * 10;
    const ra = o * 6 * dir;
    const sa = 0.67 * fanK;
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
            <button type="button" className="atl-pill" onClick={onEnter}>
              {ctaLabel}
            </button>
            <span className="atl-scroll">
              {t("ch.hero.scroll")}
              <span className="atl-scroll-line" />
            </span>
          </div>
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
          <h2 className="atl-index-title">{t("atl.index.title")}</h2>
        </div>

        {/* The ONE card layer — fan → contents row */}
        {/* Each slot holds two faces: set A (Science — the hero arc) and set
            B (Math — the index). They cross-fade with a blur as you scroll
            between the two, so the six "images" swap mid-journey. */}
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

        {/* Contents numbering — sits just above each card in its settled
            position (row or grid). --toc-k scales the label TYPE with the
            card size so labels track the cards and never overlap. */}
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

      {/* ───────────── MOBILE — static (no scrub) ───────────── */}
      <div className="atl-mobile">
        <div className="atl-m-hero">
          <span className="cinema-grain" aria-hidden="true" />
          <div className="atl-m-masthead">
            <span className="atl-rule" />
            <span className="atl-eyebrow">{t("landing.hero.eyebrow")}</span>
          </div>
          <div className="atl-m-lockup">
            <span
              className={`atl-watermark atl-watermark--m${isRTL ? " atl-watermark--latin" : ""}`}
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
                <span key={i}>{tok.brand ? <em>{tok.w}</em> : tok.w} </span>
              ))}
            </h2>
            <button type="button" className="atl-pill" onClick={onEnter}>
              {ctaLabel}
            </button>
          </div>
        </div>

        <div className="atl-m-index">
          <span className="atl-index-over">{t("atl.index.over")}</span>
          <h2 className="atl-index-title">{t("atl.index.title")}</h2>
          <div className="atl-m-grid">
            {HERO_CARDS.map((kind, i) => (
              <div key={kind} className="atl-m-cell">
                <span className="atl-m-cell-tag">
                  <span className="atl-toc-num">{String(i + 1).padStart(2, "0")}</span>
                  {t(`atl.art.${kind}`)}
                </span>
                <div className="atl-m-thumb">
                  <HeroCardFace kind={kind} />
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
