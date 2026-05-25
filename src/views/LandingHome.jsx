// =====================================================================
// Murchid — Landing home (2026 cinematic rebuild)
//
// Drench-warm × cinematic narrative. Replaces the old HeroJourney /
// TeacherShowcase / Membership / CTA stack with a seven-section scroll
// composition: cinema hero, manifest reveal, studio stage, asymmetric
// lineup, voices marquee, plans, final crescendo.
//
// Bilingual via useT() — every visible string falls through to the
// shared dictionary, so Arabic + RTL come for free. Responsive via
// clamp() and grid auto-fit; nothing breakpoint-snapped. All motion
// is honored by prefers-reduced-motion (see landing.css).
// =====================================================================
import React, { useEffect, useRef, useState } from "react";
import { useT, useI18n } from "../lib/i18n";
import { PLANS } from "../lib/plans";
import HeroAtelier from "./HeroAtelier";
import Showreel from "./Showreel";

// ── reveal hook ────────────────────────────────────────────────────
// Adds `.in` to the element when it crosses the viewport. Used by
// any block whose entrance animation depends on scroll position.
function useReveal({ threshold = 0.18, once = true, margin = "0px 0px -10% 0px" } = {}) {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (typeof window === "undefined") return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.classList.add("in");
      return undefined;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            e.target.classList.add("in");
            if (once) obs.unobserve(e.target);
          } else if (!once) {
            e.target.classList.remove("in");
          }
        }
      },
      { threshold, rootMargin: margin }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [threshold, once, margin]);
  return ref;
}

// ── scroll-driven motion helpers ───────────────────────────────────
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const lerp = (a, b, t) => a + (b - a) * t;
const easeInOut = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const prefersReduced = () =>
  typeof window !== "undefined" &&
  window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// Viewport-pass progress 0→1: 0 as the element's top reaches the viewport
// bottom, 1 as its bottom reaches the top. Drives scroll-linked reveals on
// normal-flow sections (no pin) — motion always tied to scroll position.
function useViewportProgress(ref) {
  const [vp, setVp] = useState(0);
  useEffect(() => {
    if (typeof window === "undefined") return undefined;
    if (prefersReduced()) { setVp(1); return undefined; }
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const vh = window.innerHeight;
        setVp(clamp01((vh - r.top) / (vh + r.height)));
      });
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
      if (raf) cancelAnimationFrame(raf);
    };
  }, [ref]);
  return vp;
}

// ── 1. CINEMA HERO ─────────────────────────────────────────────────
// The Murchid wordmark hero is now the opening frame of HeroJourney
// itself — the cards' floating journey begins right under the mark,
// rather than in a separate section below it. The standalone
// CinemaHero / CinemaHeroCardArc that used to live here were folded
// into HeroJourney.jsx (Scene A + the receding cinema drench), so
// nothing renders here anymore. See ./HeroJourney.

// ── 2. MANIFEST ────────────────────────────────────────────────────
// A long bilingual sentence that materializes word-by-word as the
// section crosses the viewport. Each word has --i set so the CSS
// stagger picks it up.
// Tokenize a sentence into per-word chunks, preserving an `em` flag
// for words that sit inside a |em|...|/em| span (which can itself
// hold multiple words). Translators write the markers; React renders
// the italic. The em phrase can include trailing punctuation that
// stays attached to its final word.
function tokenizeManifest(raw) {
  const segments = [];
  const re = /\|em\|([\s\S]+?)\|\/em\|/g;
  let pos = 0;
  let m;
  while ((m = re.exec(raw)) !== null) {
    if (m.index > pos) segments.push({ text: raw.slice(pos, m.index), em: false });
    segments.push({ text: m[1], em: true });
    pos = m.index + m[0].length;
  }
  if (pos < raw.length) segments.push({ text: raw.slice(pos), em: false });

  const tokens = [];
  for (const seg of segments) {
    for (const w of seg.text.split(/\s+/)) {
      if (!w) continue;
      tokens.push({ text: w, em: seg.em });
    }
  }
  return tokens;
}

function Manifest() {
  const t = useT();
  const { isRTL } = useI18n();
  const ref = useReveal({ threshold: 0.25 });
  const tokens = tokenizeManifest(t("ch.manifest.body"));

  return (
    <section className="manifest-stage">
      <div ref={ref} className="manifest-shell">
        <div className="manifest-kicker">{t("ch.manifest.kicker")}</div>
        <p className="manifest-body" dir={isRTL ? "rtl" : "ltr"}>
          {tokens.map((tok, i) => (
            <React.Fragment key={i}>
              <span className="manifest-word" style={{ "--i": i }}>
                {tok.em ? <em>{tok.text}</em> : tok.text}
              </span>{" "}
            </React.Fragment>
          ))}
        </p>

        <div className="manifest-coda">
          <div className="manifest-stat">
            <div className="manifest-stat-n">
              5<em>min</em>
            </div>
            <div className="manifest-stat-l">{t("ch.manifest.stat1")}</div>
          </div>
          <div className="manifest-stat">
            <div className="manifest-stat-n">
              KG<em>–12</em>
            </div>
            <div className="manifest-stat-l">{t("ch.manifest.stat2")}</div>
          </div>
          <div className="manifest-stat">
            <div className="manifest-stat-n">
              MoE<em>·</em>
            </div>
            <div className="manifest-stat-l">{t("ch.manifest.stat3")}</div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 3. STAGE — studio reveal ───────────────────────────────────────
// A floating cream slab that holds the actual studio surface. The
// inside cards drop from above with stagger, one at a time, so it
// reads as the studio assembling itself.
function Stage({ onEnter }) {
  const t = useT();
  const ref = useReveal({ threshold: 0.2 });

  const cards = [
    {
      eyebrow: t("ch.stage.card1.eyebrow"),
      title: t("ch.stage.card1.title"),
      meta: [t("ch.stage.card1.meta1"), t("ch.stage.card1.meta2"), t("ch.stage.card1.meta3")],
      progress: 78,
      tilt: "-1.4deg",
    },
    {
      eyebrow: t("ch.stage.card2.eyebrow"),
      title: t("ch.stage.card2.title"),
      meta: [t("ch.stage.card2.meta1"), t("ch.stage.card2.meta2"), t("ch.stage.card2.meta3")],
      progress: 46,
      tilt: "1.2deg",
    },
    {
      eyebrow: t("ch.stage.card3.eyebrow"),
      title: t("ch.stage.card3.title"),
      meta: [t("ch.stage.card3.meta1"), t("ch.stage.card3.meta2"), t("ch.stage.card3.meta3")],
      progress: 92,
      tilt: "-0.6deg",
    },
  ];

  const sideItems = [
    { label: t("ch.stage.side.planner"), active: true },
    { label: t("ch.stage.side.lessons"), active: false },
    { label: t("ch.stage.side.quizzes"), active: false },
    { label: t("ch.stage.side.slides"), active: false },
    { label: t("ch.stage.side.activities"), active: false },
    { label: t("ch.stage.side.students"), active: false },
  ];

  return (
    <section className="stage-stage" id="ch-stage">
      <div ref={ref} className="stage-shell">
        <header className="stage-head">
          <h2 className="stage-h1">
            {t("ch.stage.h1.a")} <em>{t("ch.stage.h1.em")}</em> {t("ch.stage.h1.b")}
          </h2>
          <p className="stage-h1-sub">{t("ch.stage.sub")}</p>
        </header>

        <div className="stage-frame">
          <div className="stage-frame-glow" aria-hidden="true" />
          <div className="stage-frame-bar">
            <div className="stage-dot" />
            <div className="stage-dot" />
            <div className="stage-dot" />
            <span className="stage-frame-title">{t("ch.stage.frameTitle")}</span>
          </div>

          <div className="stage-frame-body">
            <aside className="stage-side">
              {sideItems.map((it, i) => (
                <div key={i} className={`stage-side-item${it.active ? " active" : ""}`}>
                  {it.active ? <span className="stage-side-tag" /> : <span style={{ width: 6 }} />}
                  {it.label}
                </div>
              ))}
            </aside>

            <div className="stage-main">
              {cards.map((c, i) => (
                <article
                  key={i}
                  className="stage-card"
                  style={{ "--i": i, "--tilt": c.tilt, "--p": `${c.progress}%` }}
                >
                  <div className="stage-card-eyebrow">{c.eyebrow}</div>
                  <h3 className="stage-card-h">{c.title}</h3>
                  <div className="stage-card-meta">
                    {c.meta.map((m, j) => <span key={j}>{m}</span>)}
                  </div>
                  <div className="stage-card-progress" />
                </article>
              ))}
              <button
                type="button"
                onClick={onEnter}
                className="cinema-pill"
                style={{
                  justifySelf: "start",
                  marginBlockStart: 14,
                  ["--bg"]: "var(--cm-ink)",
                  ["--fg"]: "var(--cm-cream)",
                }}
              >
                {t("ch.stage.tryCta")}
              </button>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 4. LINEUP — asymmetric grid of tools ───────────────────────────
// Six tiles, intentionally unequal spans. Each tile has a unique SVG
// art piece with a slow ambient animation; on hover it lifts and the
// arrow rotates. Pure CSS — no JS magnetic-cursor library.
const TileArt = ({ kind }) => {
  if (kind === "lesson") {
    return (
      <svg viewBox="0 0 180 140" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <g className="art-drift">
          <rect x="22" y="14" width="124" height="116" rx="8" fill="oklch(0.96 0.025 80)" stroke="oklch(0.18 0.03 40 / 0.16)" />
          <line x1="36" y1="36" x2="118" y2="36" stroke="oklch(0.42 0.13 30)" strokeWidth="2" strokeLinecap="round" />
          <line x1="36" y1="50" x2="132" y2="50" stroke="oklch(0.18 0.03 40 / 0.4)" />
          <line x1="36" y1="62" x2="124" y2="62" stroke="oklch(0.18 0.03 40 / 0.4)" />
          <line x1="36" y1="74" x2="132" y2="74" stroke="oklch(0.18 0.03 40 / 0.4)" />
          <line x1="36" y1="86" x2="100" y2="86" stroke="oklch(0.18 0.03 40 / 0.4)" />
          <circle cx="46" cy="108" r="6" fill="oklch(0.72 0.16 65)" />
          <line x1="60" y1="108" x2="124" y2="108" stroke="oklch(0.18 0.03 40 / 0.3)" />
        </g>
        <path d="M132 12 L154 12 L154 36 L143 30 L132 36 Z" fill="oklch(0.42 0.13 30)" />
      </svg>
    );
  }
  if (kind === "quiz") {
    return (
      <svg viewBox="0 0 180 140" fill="none" aria-hidden="true">
        <g className="art-drift">
          <rect x="22" y="22" width="136" height="96" rx="10" fill="oklch(0.92 0.04 75)" />
          <line x1="38" y1="42" x2="120" y2="42" stroke="oklch(0.18 0.03 40 / 0.5)" strokeWidth="2" />
          <circle cx="44" cy="62" r="6" fill="none" stroke="oklch(0.18 0.03 40 / 0.3)" strokeWidth="1.5" />
          <circle cx="44" cy="80" r="6" fill="oklch(0.72 0.16 65)" />
          <circle cx="44" cy="98" r="6" fill="none" stroke="oklch(0.18 0.03 40 / 0.3)" strokeWidth="1.5" />
          <line x1="58" y1="62" x2="130" y2="62" stroke="oklch(0.18 0.03 40 / 0.3)" />
          <line x1="58" y1="80" x2="118" y2="80" stroke="oklch(0.18 0.03 40 / 0.5)" strokeWidth="2" />
          <line x1="58" y1="98" x2="124" y2="98" stroke="oklch(0.18 0.03 40 / 0.3)" />
        </g>
      </svg>
    );
  }
  if (kind === "deck") {
    return (
      <svg viewBox="0 0 180 140" fill="none" aria-hidden="true">
        <g className="art-drift">
          <rect x="40" y="18" width="100" height="76" rx="6" fill="oklch(0.42 0.13 30)" transform="rotate(-3 90 56)" />
          <rect x="40" y="30" width="100" height="76" rx="6" fill="oklch(0.72 0.16 65)" transform="rotate(2 90 68)" />
          <rect x="40" y="42" width="100" height="76" rx="6" fill="oklch(0.96 0.025 80)" stroke="oklch(0.18 0.03 40 / 0.15)" />
          <rect x="52" y="58" width="58" height="6" rx="3" fill="oklch(0.42 0.13 30)" />
          <rect x="52" y="72" width="76" height="3" rx="1.5" fill="oklch(0.18 0.03 40 / 0.3)" />
          <rect x="52" y="80" width="60" height="3" rx="1.5" fill="oklch(0.18 0.03 40 / 0.3)" />
          <rect x="52" y="88" width="40" height="3" rx="1.5" fill="oklch(0.18 0.03 40 / 0.3)" />
        </g>
      </svg>
    );
  }
  if (kind === "presentation") {
    return (
      <svg viewBox="0 0 180 140" fill="none" aria-hidden="true">
        <g className="art-drift">
          <rect x="20" y="20" width="140" height="90" rx="8" fill="oklch(0.28 0.09 28)" />
          <rect x="32" y="34" width="116" height="62" rx="4" fill="oklch(0.96 0.025 80)" />
          <polygon points="78,52 78,78 102,65" fill="oklch(0.42 0.13 30)" />
          <line x1="74" y1="118" x2="106" y2="118" stroke="oklch(0.18 0.03 40 / 0.4)" strokeWidth="2" strokeLinecap="round" />
          <line x1="86" y1="110" x2="94" y2="118" stroke="oklch(0.18 0.03 40 / 0.4)" strokeWidth="2" strokeLinecap="round" />
        </g>
      </svg>
    );
  }
  if (kind === "activity") {
    return (
      <svg viewBox="0 0 180 140" fill="none" aria-hidden="true">
        <g>
          <circle cx="58" cy="56" r="22" fill="oklch(0.72 0.16 65)" className="art-drift" />
          <rect x="92" y="32" width="44" height="44" rx="6" fill="oklch(0.58 0.08 145)" transform="rotate(8 114 54)" className="art-drift" />
          <polygon points="60,104 80,86 100,104" fill="oklch(0.42 0.13 30)" className="art-drift" />
          <circle cx="124" cy="100" r="14" fill="oklch(0.86 0.13 60)" className="art-drift" />
        </g>
      </svg>
    );
  }
  if (kind === "homework") {
    return (
      <svg viewBox="0 0 180 140" fill="none" aria-hidden="true">
        <g className="art-drift">
          <rect x="30" y="22" width="120" height="96" rx="6" fill="oklch(0.92 0.04 75)" stroke="oklch(0.18 0.03 40 / 0.15)" />
          <rect x="30" y="22" width="120" height="22" rx="6" fill="oklch(0.42 0.13 30)" />
          <line x1="46" y1="58" x2="134" y2="58" stroke="oklch(0.18 0.03 40 / 0.4)" />
          <line x1="46" y1="72" x2="120" y2="72" stroke="oklch(0.18 0.03 40 / 0.4)" />
          <line x1="46" y1="86" x2="126" y2="86" stroke="oklch(0.18 0.03 40 / 0.4)" />
          <rect x="46" y="96" width="14" height="14" rx="2" fill="none" stroke="oklch(0.42 0.13 30)" strokeWidth="1.5" />
          <path d="M48 102 l4 4 l8 -10" stroke="oklch(0.42 0.13 30)" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      </svg>
    );
  }
  return null;
};

function LineupTile({ tile, i, onEnter }) {
  const ref = useReveal({ threshold: 0.15 });
  return (
    <article
      ref={ref}
      data-span={tile.span}
      onClick={onEnter}
      className="lineup-tile cm-reveal"
      data-d={(i % 4) + 1}
      style={{ "--tile-glow": tile.glow }}
    >
      <div className="lineup-art">
        <TileArt kind={tile.kind} />
      </div>
      <div className="lineup-meta">
        <div>
          <h3 className="lineup-tile-name">
            <em>{tile.em}</em> {tile.name}
          </h3>
          <p className="lineup-tile-desc">{tile.desc}</p>
        </div>
        <span className="lineup-tile-arrow" aria-hidden="true">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 11 L11 3 M11 3 H5 M11 3 V9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </span>
      </div>
    </article>
  );
}

function Lineup({ onEnter }) {
  const t = useT();
  const headRef = useReveal({ threshold: 0.3 });

  // Span budget: 12 columns per row × 3 rows = 36. Each row's spans sum
  // to 12 so no tile is left orphaned next to dead space.
  //   row 1 — lesson (7) + quiz (5)
  //   row 2 — deck (5)   + presentation (7)
  //   row 3 — activity (5) + homework (7)
  const tiles = [
    { kind: "lesson", span: 7, name: t("ch.lineup.lesson.name"), em: t("ch.lineup.lesson.em"), desc: t("ch.lineup.lesson.desc"),
      glow: "radial-gradient(ellipse at 80% 10%, oklch(0.85 0.14 55), transparent 60%)" },
    { kind: "quiz", span: 5, name: t("ch.lineup.quiz.name"), em: t("ch.lineup.quiz.em"), desc: t("ch.lineup.quiz.desc"),
      glow: "radial-gradient(ellipse at 20% 80%, oklch(0.78 0.18 70), transparent 60%)" },
    { kind: "deck", span: 5, name: t("ch.lineup.deck.name"), em: t("ch.lineup.deck.em"), desc: t("ch.lineup.deck.desc"),
      glow: "radial-gradient(ellipse at 50% 100%, oklch(0.55 0.13 36 / 0.5), transparent 70%)" },
    { kind: "presentation", span: 7, name: t("ch.lineup.presentation.name"), em: t("ch.lineup.presentation.em"), desc: t("ch.lineup.presentation.desc"),
      glow: "radial-gradient(ellipse at 50% 100%, oklch(0.78 0.18 70), transparent 70%)" },
    { kind: "activity", span: 5, name: t("ch.lineup.activity.name"), em: t("ch.lineup.activity.em"), desc: t("ch.lineup.activity.desc"),
      glow: "radial-gradient(ellipse at 100% 0%, oklch(0.58 0.08 145), transparent 60%)" },
    { kind: "homework", span: 7, name: t("ch.lineup.homework.name"), em: t("ch.lineup.homework.em"), desc: t("ch.lineup.homework.desc"),
      glow: "radial-gradient(ellipse at 0% 0%, oklch(0.85 0.14 55), transparent 60%)" },
  ];

  return (
    <section className="lineup-stage">
      <div className="lineup-shell">
        <header ref={headRef} className="lineup-head cm-reveal">
          <h2 className="lineup-h1">
            {t("ch.lineup.h1.a")} <em>{t("ch.lineup.h1.em")}</em> {t("ch.lineup.h1.b")}
          </h2>
          <p className="lineup-sub">{t("ch.lineup.sub")}</p>
        </header>
        <div className="lineup-grid">
          {tiles.map((tile, i) => (
            <LineupTile key={tile.kind} tile={tile} i={i} onEnter={onEnter} />
          ))}
        </div>
      </div>
    </section>
  );
}

// ── 5. VOICES — teacher community marquee ──────────────────────────
const VOICES = [
  { quote: "ch.voices.q1", name: "Layla H.", school: "Dubai · KG", flag: "🇦🇪", av: "L", bg: "oklch(0.78 0.18 70)" },
  { quote: "ch.voices.q2", name: "Omar K.", school: "Abu Dhabi · G6 Science", flag: "🇦🇪", av: "O", bg: "oklch(0.58 0.08 145)" },
  { quote: "ch.voices.q3", name: "Mariam B.", school: "Sharjah · G9 Arabic", flag: "🇦🇪", av: "م", bg: "oklch(0.85 0.14 55)" },
  { quote: "ch.voices.q4", name: "Hannah R.", school: "Dubai · G3", flag: "🇬🇧", av: "H", bg: "oklch(0.86 0.13 60)" },
  { quote: "ch.voices.q5", name: "Faisal A.", school: "Al Ain · G11 Physics", flag: "🇦🇪", av: "F", bg: "oklch(0.7 0.12 30)" },
  { quote: "ch.voices.q6", name: "Sara T.", school: "Ajman · G2", flag: "🇦🇪", av: "س", bg: "oklch(0.78 0.18 70)" },
  { quote: "ch.voices.q7", name: "Aisha M.", school: "Dubai · G7 English", flag: "🇦🇪", av: "A", bg: "oklch(0.58 0.08 145)" },
  { quote: "ch.voices.q8", name: "Rana D.", school: "RAK · KG", flag: "🇦🇪", av: "R", bg: "oklch(0.85 0.14 55)" },
];

function VoicesCard({ voice, t }) {
  return (
    <div className="voices-card">
      <p className="voices-quote">"{t(voice.quote)}"</p>
      <div className="voices-meta">
        <div className="voices-avatar" style={{ "--av-bg": voice.bg }}>{voice.av}</div>
        <div>
          <div style={{ color: "var(--cm-cream)", fontWeight: 500 }}>{voice.name}</div>
          <div>{voice.school}</div>
        </div>
        <div className="voices-flag" style={{ marginInlineStart: "auto" }}>{voice.flag}</div>
      </div>
    </div>
  );
}

// Pinned like the hero: while the section holds, the heading and the two
// rails scrub in (heading rises, rails counter-slide from opposite edges),
// then settle into their auto-marquee. Desktop-only pin; on phones it flows
// normally (rev = 1) so there's no scroll-jacking on touch.
function Voices() {
  const t = useT();
  const trackRef = useRef(null);
  // Tie the reveal to the section ENTERING the viewport (not the pinned
  // scrub). The heading + rails fade/slide in as the section rises into
  // view — so you see it the moment you reach it — and the short pin just
  // holds the beat afterward (marquee running). Fixes the dead-scroll gap.
  const vp = useViewportProgress(trackRef);
  // Split into two rails for visual rhythm; second rail goes the other way.
  const railA = [...VOICES, ...VOICES];
  const railBSrc = [...VOICES].reverse();
  const railB = [...railBSrc, ...railBSrc];

  const headIn = clamp01((vp - 0.14) / 0.16);
  const railsIn = easeInOut(clamp01((vp - 0.18) / 0.2));

  return (
    <section ref={trackRef} className="voices-pin-track">
      <div className="voices-pin">
        <div
          className="voices-shell"
          style={{ opacity: headIn, transform: `translateY(${lerp(34, 0, headIn)}px)` }}
        >
          <h2 className="voices-h1">
            {t("ch.voices.h1.a")} <em>{t("ch.voices.h1.em")}</em> {t("ch.voices.h1.b")}
          </h2>
          <p className="voices-sub">{t("ch.voices.sub")}</p>
        </div>
        <div className="voices-rails">
          <div
            className="voices-row"
            style={{ opacity: railsIn, transform: `translateX(${lerp(-120, 0, railsIn)}px)` }}
          >
            <div className="voices-track">
              {railA.map((v, i) => <VoicesCard key={`a-${i}`} voice={v} t={t} />)}
            </div>
          </div>
          <div
            className="voices-row rev"
            style={{ opacity: railsIn, transform: `translateX(${lerp(120, 0, railsIn)}px)` }}
          >
            <div className="voices-track">
              {railB.map((v, i) => <VoicesCard key={`b-${i}`} voice={v} t={t} />)}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 6. PLANS ───────────────────────────────────────────────────────
function PlanCard({ p, i, vp, onEnter }) {
  const t = useT();
  const featured = !!p.best;
  const cur = t("lp.plan.aed");
  const billed =
    p.cycle === "yr"
      ? t("lp.plan.billed.yr", { total: p.total, cur })
      : p.cycle === "q"
      ? t("lp.plan.billed.q", { total: p.total, cur })
      : t("lp.plan.billed.mo");
  // Scroll-linked reveal, staggered per card. The featured card rests at
  // translateY(-12px) in CSS, so reveal into that offset — and once fully
  // in, drop the inline transform so the CSS hover-lift takes over again.
  const r = easeInOut(clamp01((vp - 0.06 - i * 0.05) / 0.3));
  const revealStyle =
    r >= 1 ? { opacity: 1 } : { opacity: r, transform: `translateY(${lerp(56, 0, r)}px)` };
  return (
    <article
      className={`plans-card${featured ? " featured" : ""}`}
      style={revealStyle}
    >
      {featured && <div className="plans-badge">{t("lp.plan.best")}</div>}
      <div className="plans-name">{t(`lp.plan.name.${p.id}`)}</div>
      <div className="plans-price">
        <span className="plans-price-n">{p.perMonth}</span>
        <span className="plans-price-c">
          {cur} {t("lp.plan.perMo")}
        </span>
      </div>
      <div className="plans-bill">{billed}</div>
      {p.savePct > 0 && (
        <div className="plans-bill" style={{ opacity: 0.85 }}>
          {t("lp.plan.save", { n: p.savePct })}
        </div>
      )}
      <button type="button" className="plans-cta" onClick={onEnter}>
        {t("lp.plan.choose")}
      </button>
    </article>
  );
}

function Plans({ onEnter }) {
  const t = useT();
  const ref = useRef(null);
  const vp = useViewportProgress(ref);
  const headR = easeInOut(clamp01((vp - 0.02) / 0.3));

  return (
    <section ref={ref} className="plans-stage" id="ch-plans">
      <div className="plans-pin">
        <div className="plans-shell">
          <header
            className="plans-head"
            style={{ opacity: headR, transform: `translateY(${lerp(40, 0, headR)}px)` }}
          >
            <h2 className="plans-h1">
              {t("ch.plans.h1.a")} <em>{t("ch.plans.h1.em")}</em>
            </h2>
            <p className="plans-sub">{t("ch.plans.sub")}</p>
          </header>
          <div className="plans-grid">
            {PLANS.map((p, i) => (
              <PlanCard key={p.id} p={p} i={i} vp={vp} onEnter={onEnter} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── 7. FINAL CTA ───────────────────────────────────────────────────
function FinalCTA({ onEnter, signedIn }) {
  const t = useT();
  const ref = useRef(null);
  const vp = useViewportProgress(ref);
  const r = easeInOut(clamp01((vp - 0.02) / 0.32));
  return (
    <section ref={ref} className="final-stage">
      <div className="final-pin">
        <div className="final-shell" style={{ opacity: r, transform: `translateY(${lerp(46, 0, r)}px)` }}>
          <div className="final-kicker">{t("ch.final.kicker")}</div>
          <h2 className="final-q">
            {t("ch.final.q.a")} <em>{t("ch.final.q.em")}</em> {t("ch.final.q.b")}
          </h2>
          <p className="final-sub">{t("ch.final.sub")}</p>
          <div className="final-cta-row">
            <button type="button" className="cinema-pill" onClick={onEnter}>
              {signedIn ? t("landing.nav.openPlanner") : t("ch.final.cta")}
            </button>
            <button
              type="button"
              className="cinema-ghost"
              onClick={() => {
                const el = document.getElementById("ch-plans");
                if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
              }}
            >
              {t("ch.final.ctaGhost")}
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── exported home composition ──────────────────────────────────────
// HeroAtelier (2026) opens the page: a bilingual editorial title
// sequence — the Murchid/مرشد masthead on a warm drench that bleaches
// to cream as the six artifacts deal out and resolve into a contents
// index. The older HeroJourney is parked (snapshot v1.2) and its card
// faces are reused by HeroAtelier. Manifest / Stage / Lineup stay
// parked above (unrendered) in case any are wanted back later.
export default function LandingHome({ onEnter, signedIn }) {
  return (
    <>
      <HeroAtelier onEnter={onEnter} signedIn={signedIn} />
      <Showreel />
      <Voices />
      <Plans onEnter={onEnter} />
      <FinalCTA onEnter={onEnter} signedIn={signedIn} />
    </>
  );
}
