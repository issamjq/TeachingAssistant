// =====================================================================
// Murchid — Hero Journey (lifted from v1.1, commit 2fdf076)
//
// ONE pinned scroll section that re-stages the same six cards across
// three acts:
//   A  wide arc + "The teacher directs. Murchid drafts."
//   B  diagonal cascade + "Plan, draft, & teach… start to finish."
//   C  the cards file into a Library folder · "The library / One studio."
//
// The cards never unmount between acts, so there is no empty seam —
// it reads as a single continuous take. Pure-function-of-scroll motion
// (`seg` remaps progress slices, `lerp` blends states, `mix` blends
// colours). Lifted verbatim from v1.1 so the choreography is identical.
// =====================================================================
import React, { useState, useEffect, useRef } from "react";
import {
  BookOpen, Sparkles, Plus, CalendarDays, GraduationCap,
  ClipboardList, Presentation, Layers, Pencil, FileText,
} from "lucide-react";
import { useT, useI18n } from "../lib/i18n";

// Animations removed by request — no-op shims for the framer-motion
// API. Same approach v1.1 used so nothing in this section depends on
// a runtime motion library.
const ANIM_PROPS = new Set([
  "initial", "animate", "exit", "transition", "variants", "custom",
  "whileHover", "whileTap", "whileInView", "viewport", "layout",
  "layoutId", "drag",
]);
const makeMotion = (tag) =>
  React.forwardRef(function MotionShim(props, ref) {
    const clean = {};
    for (const k in props) if (!ANIM_PROPS.has(k)) clean[k] = props[k];
    return React.createElement(tag, { ...clean, ref });
  });
const motion = new Proxy(
  {},
  { get: (cache, tag) => cache[tag] || (cache[tag] = makeMotion(tag)) }
);
const AnimatePresence = ({ children }) => children;
const useScroll = () => ({ scrollYProgress: 0 });
const useTransform = (_v, _in, out) => (Array.isArray(out) ? out[0] : 0);
const useInView = () => true;


// ── Math + colour helpers (verbatim from v1.1) ─────────────────
const easeInOut = (t) =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

// Real bouncing-ball physics for the honeycomb drop. Pure function of
// elapsed seconds: constant gravity `g`, coefficient of restitution `e`
// (each impact keeps a fraction of the speed, so bounce heights AND the
// intervals between them decay geometrically — exactly like a ball
// dropped on a hard floor in real life). Returns the downward
// displacement (0 → H, settling at H) and a short impact-squash pulse.
const bounceState = (t, H, g, e) => {
  if (t <= 0) return { disp: 0, sq: 0 };
  const v0 = Math.sqrt(2 * g * H); // speed at the first impact
  const t0 = v0 / g; // duration of the initial free-fall
  if (t < t0) return { disp: 0.5 * g * t * t, sq: 0 };
  let tau = t - t0; // time since the first impact
  let vIn = v0; // speed coming into the current contact
  for (let n = 1; n <= 7; n++) {
    const vUp = vIn * e; // rebound speed off this contact
    const dn = (2 * vUp) / g; // up-and-down flight time of this arc
    // Squash fires at the contact that launched this arc, scaled by how
    // hard it hit, and decays over ~70ms.
    const sq = (vIn / v0) * Math.exp(-tau / 0.07);
    if (tau < dn) {
      const h = vUp * tau - 0.5 * g * tau * tau; // height above floor
      return { disp: H - h, sq };
    }
    tau -= dn;
    vIn = vUp; // next contact arrives at this speed
  }
  return { disp: H, sq: 0 }; // at rest on the floor
};

// Scroll-scrub math. `seg` remaps a slice [a,b] of the global scroll
// progress to a fresh 0→1 ramp; `lerp` blends between two states; `mix`
// blends two #rrggbb colours. Same no-library technique the rest of the
// page uses — every motion here is a pure function of scroll position.
const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
const seg = (p, a, b) => clamp01((p - a) / (b - a));
const lerp = (a, b, t) => a + (b - a) * t;
const hexRGB = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
];
const mix = (h1, h2, t) => {
  const a = hexRGB(h1);
  const b = hexRGB(h2);
  return `rgb(${Math.round(lerp(a[0], b[0], t))},${Math.round(
    lerp(a[1], b[1], t)
  )},${Math.round(lerp(a[2], b[2], t))})`;
};
const C_INK = "#2A1F17";
const C_INK3 = "#9B8B76";
const C_CLAY = "#B5754E";

// Real Murchid cards that fan out, then collapse + shrink as you scroll.

// ── Card faces + headlines + bubbles (verbatim from v1.1) ──────
export function HeroCardFace({ kind }) {
  const SHELL =
    "w-[230px] h-[300px] rounded-2xl border overflow-hidden flex flex-col p-5";
  const SH = { boxShadow: "0 30px 60px -28px rgba(26,24,20,0.45)" };
  const EBC = "font-mono text-[10px] uppercase tracking-[0.16em]";

  if (kind === "deck" || kind === "presentation") {
    const t =
      kind === "deck"
        ? { bg: "#1e3a44", tx: "#eaf3f4", soft: "#a8c4c8", dot: "#7fc6c0", k: "Slide deck", title: "The Water Cycle" }
        : { bg: "#5f7256", tx: "#f8f5ec", soft: "#dde3d2", dot: "#f0d9a8", k: "Presentation", title: "Photosynthesis" };
    return (
      <div
        className={`${SHELL} relative`}
        style={{ ...SH, background: t.bg, color: t.tx, borderColor: "rgba(255,255,255,0.12)" }}
      >
        <span className={EBC} style={{ color: t.soft }}>
          {t.k}
        </span>
        <h4 className="font-display text-2xl leading-tight mt-2">{t.title}</h4>
        <span className="mt-2 h-1 w-10 rounded-full" style={{ background: t.dot }} />
        <div className="absolute right-0 bottom-0 w-32 h-32 opacity-90">
          <SlideArt stroke={t.dot} fill={t.soft} full />
        </div>
      </div>
    );
  }

  const META = {
    lesson: { k: "Lesson plan", title: "Photosynthesis", icon: BookOpen, rows: ["00–05  Starter", "15–35  Worksheet", "45–50  Exit ticket"] },
    quiz: { k: "Quiz", title: "Cell respiration", icon: GraduationCap, rows: ["1  Which organelle…", "2  Word equation…", "3  Why anaerobic…"] },
    activity: { k: "Activity", title: "Group debate", icon: Sparkles, rows: ["Pair · 10 min", "Group · 20 min", "Solo · exit slip"] },
    homework: { k: "Homework", title: "Worksheet 4", icon: ClipboardList, rows: ["Due Thursday · 7A"] },
    worksheet: { k: "Worksheet", title: "Three levels", icon: FileText, rows: ["Foundation · 8 Qs", "Core · 10 Qs", "Extension · 12 Qs"] },
  }[kind] || {};
  const Icon = META.icon || BookOpen;
  return (
    <div
      className={SHELL}
      style={{ ...SH, background: "#fffdf6", borderColor: "var(--line)", color: "var(--ink)" }}
    >
      <div className="flex items-center justify-between mb-3">
        <span className={`${EBC}`} style={{ color: "var(--clay)" }}>
          {META.k}
        </span>
        <span
          className="inline-flex h-7 w-7 rounded-lg items-center justify-center"
          style={{ background: "var(--paper-2)", color: "var(--clay)" }}
        >
          <Icon size={14} strokeWidth={2} />
        </span>
      </div>
      <h4 className="font-display text-2xl leading-tight mb-4">{META.title}</h4>
      {kind === "homework" ? (
        <div className="mt-1">
          <div className="text-[12px] mb-2" style={{ color: "var(--ink-2)" }}>
            {META.rows[0]}
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--paper-3)" }}>
            <div className="h-full rounded-full" style={{ width: "64%", background: "var(--sage)" }} />
          </div>
          <div className="text-[12px] mt-2" style={{ color: "var(--ink-3)" }}>
            18 / 28 submitted
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          {META.rows.map((r) => (
            <div key={r} className="flex items-center gap-2 text-[12px]" style={{ color: "var(--ink-2)" }}>
              <span className="h-1 w-1 rounded-full flex-shrink-0" style={{ background: "var(--clay)" }} />
              <span className="truncate">{r}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export const HERO_CARDS = ["lesson", "quiz", "deck", "presentation", "activity", "homework"];

// Phase-C headline — each token fades + un-blurs + colour-shifts in turn.
// Per-language word lists so the reveal works in EN and AR (RTL).
const C_HEAD_EN = [
  { t: "Plan," }, { t: "draft," },
  { t: "&", accent: true }, { t: "teach", accent: true },
  { t: "every" }, { t: "lesson" }, { t: "—" },
  { t: "start" }, { t: "to" }, { t: "finish." },
];
const C_HEAD_AR = [
  { t: "خطِّط،" }, { t: "اصِغ،" },
  { t: "و", accent: true }, { t: "علِّم", accent: true },
  { t: "كل" }, { t: "درس" }, { t: "—" },
  { t: "من" }, { t: "البداية" }, { t: "إلى" }, { t: "النهاية." },
];

// Floating handle pill with a little speech tail.
function Bubble({ label, bg, style }) {
  return (
    <div style={{ position: "absolute", ...style }}>
      <div
        // Username handles are Latin/English (@ms.layla, @mr.idris,
        // @head.of.science…). Force LTR so the leading "@" stays on the
        // left even when the surrounding page is in Arabic/RTL.
        dir="ltr"
        style={{
          position: "relative",
          background: bg,
          color: "#F7F3EC",
          fontFamily: "'JetBrains Mono', monospace",
          fontSize: 11,
          letterSpacing: "0.03em",
          padding: "7px 13px",
          borderRadius: 999,
          whiteSpace: "nowrap",
          boxShadow: "0 14px 30px -14px rgba(42,31,23,0.55)",
        }}
      >
        {label}
        <span
          style={{
            position: "absolute",
            left: 20,
            bottom: -3,
            width: 9,
            height: 9,
            background: bg,
            transform: "rotate(45deg)",
            borderRadius: 2,
          }}
        />
      </div>
    </div>
  );
}

// ── SlideArt SVG (verbatim from v1.1) — used by the lesson-card face
function SlideArt({ stroke, fill, full = false }) {
  return (
    <svg
      viewBox="0 0 200 150"
      className={full ? "w-full h-full" : "h-full"}
      preserveAspectRatio="xMidYMid slice"
      aria-hidden
    >
      {/* sun */}
      <circle cx="158" cy="34" r="15" fill={fill} opacity="0.55" />
      {[...Array(8)].map((_, k) => {
        const a = (k / 8) * Math.PI * 2;
        return (
          <line
            key={k}
            x1={158 + Math.cos(a) * 19}
            y1={34 + Math.sin(a) * 19}
            x2={158 + Math.cos(a) * 25}
            y2={34 + Math.sin(a) * 25}
            stroke={fill}
            strokeWidth="2"
            strokeLinecap="round"
            opacity="0.5"
          />
        );
      })}
      {/* cloud */}
      <g fill={fill} opacity="0.85">
        <circle cx="74" cy="58" r="20" />
        <circle cx="98" cy="50" r="24" />
        <circle cx="122" cy="60" r="18" />
        <rect x="70" y="58" width="56" height="20" rx="10" />
      </g>
      {/* rain */}
      {[78, 94, 110].map((x) => (
        <line key={x} x1={x} y1="84" x2={x - 5} y2="100" stroke={stroke} strokeWidth="3" strokeLinecap="round" opacity="0.8" />
      ))}
      <path d="M0 132 Q 25 122 50 132 T 100 132 T 150 132 T 200 132 V150 H0 Z" fill={stroke} opacity="0.5" />
      <path d="M40 124 C 28 104, 40 86, 58 80" fill="none" stroke={stroke} strokeWidth="2.5" strokeDasharray="3 4" strokeLinecap="round" opacity="0.7" />
    </svg>
  );
}

// ── Vision headlines + supplementary colours (verbatim from v1.1) ──
const C_SAGE = "#7A8F6E";
const VISION_HEAD_EN = [
  { t: "One" }, { t: "studio." },
  { t: "Every", accent: "clay" }, { t: "subject,", accent: "clay" },
  { t: "every" }, { t: "grade." },
];
const VISION_HEAD_AR = [
  { t: "استوديو" }, { t: "واحد." },
  { t: "كل", accent: "clay" }, { t: "مادّة،", accent: "clay" },
  { t: "كل" }, { t: "صف." },
];
const VISION_SUB_EN =
  "Every lesson tells a story. Murchid helps you plan it, build it, and teach it."
    .split(" ");
const VISION_SUB_AR =
  "كل درس يحكي قصّة. يساعدك Murchid على تخطيطه وبنائه وتدريسه."
    .split(" ");
const C_INK2 = "#6E5C4A";

// ── Honey-drop physics (verbatim from v1.1) ────────────────────
const HONEY = [
  { x: -86, y: -2 }, { x: 28, y: 6 }, { x: 150, y: -6 },
  { x: -44, y: -52 }, { x: 96, y: -48 }, { x: 210, y: -58 },
  { x: 4, y: -88 }, { x: 150, y: -100 },
];
const HONEY_ICONS = [
  Sparkles, BookOpen, GraduationCap, ClipboardList,
  Presentation, CalendarDays, Layers, Pencil,
];

// The honeycomb runs on its OWN wall-clock (rAF) once it's revealed, so
// the fall obeys real gravity instead of the scroll speed. `active` is
// driven by scroll; flipping it false (scrolling back above the section)
// rewinds so the drop replays on the next pass. Memoised so the parent's
// per-scroll-frame re-renders don't touch it.
const HONEY_H = 150; // release height above each rest spot (px)
const HONEY_G = 1800; // gravity (px / s²)
const HONEY_E = 0.34; // restitution — low so they settle neatly
const HONEY_STAGGER = 0.04; // s — gentle release offset, bottom-row first
const HONEY_LAST = (HONEY.length - 1) * HONEY_STAGGER;

const HoneyDrop = React.memo(function HoneyDrop({ active, dx = -380, dy = 268 }) {
  const [t, setT] = useState(0); // elapsed seconds — drives the frame
  const startRef = useRef(0);
  const rafRef = useRef(0);
  const reduceRef = useRef(false);

  useEffect(() => {
    reduceRef.current = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
  }, []);

  useEffect(() => {
    if (!active) {
      cancelAnimationFrame(rafRef.current);
      setT(0); // rewind — replays next time it scrolls into view
      return undefined;
    }
    if (reduceRef.current) {
      setT(999); // no motion — show everything already settled
      return undefined;
    }
    startRef.current = performance.now();
    const settle = HONEY_LAST + 2.4; // last icon released, then at rest
    const loop = (now) => {
      const el = (now - startRef.current) / 1000;
      setT(el);
      if (el < settle) rafRef.current = requestAnimationFrame(loop);
    };
    rafRef.current = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(rafRef.current);
  }, [active]);

  return (
    <div
      className="absolute left-1/2 top-1/2"
      style={{
        width: 0,
        height: 0,
        zIndex: 25,
        // Anchored in the centre+px frame (same as the Library window)
        // so the cluster's base lines up with the window's bottom edge,
        // low in the left column and clear of the headline. dx/dy let a
        // call site nudge it (e.g. keep it within the text column).
        transform: `translate(${dx}px, ${dy}px)`,
      }}
    >
      {HONEY.map((h, i) => {
        const Ic = HONEY_ICONS[i];
        const ti = t - i * HONEY_STAGGER; // gentle bottom-first cascade
        const { disp, sq } = bounceState(ti, HONEY_H, HONEY_G, HONEY_E);
        const y = h.y - HONEY_H + disp; // released HONEY_H above its spot
        const sX = 1 + 0.16 * sq; // squash widens on impact…
        const sY = 1 - 0.18 * sq; // …and flattens, pinned to its base
        const appear = clamp01(ti / 0.06); // pops in at the release point
        const sc = lerp(0.7, 1, appear);
        const air = clamp01((HONEY_H - disp) / HONEY_H); // 1 high, 0 floor
        return (
          <span
            key={i}
            className="absolute inline-flex items-center justify-center rounded-full"
            style={{
              left: 0,
              bottom: 0,
              width: 58,
              height: 58,
              background: "var(--paper)",
              border: "0.5px solid var(--line-strong)",
              color: "var(--ink)",
              boxShadow: `0 ${lerp(8, 22, air)}px ${lerp(
                18,
                40,
                air
              )}px -16px rgba(42,31,23,${lerp(0.5, 0.32, air)})`,
              transform: `translate(${h.x}px, ${y}px) scale(${sc * sX}, ${
                sc * sY
              })`,
              transformOrigin: "50% 100%",
              opacity: appear,
              willChange: "transform, opacity",
            }}
          >
            <Ic size={20} strokeWidth={1.8} />
          </span>
        );
      })}
    </div>
  );
});

// ── The Hero Journey itself (verbatim from v1.1) ───────────────
const HeroJourney = ({ onEnter, signedIn }) => {
  const { t, lang, isRTL } = useI18n();
  const ctaLabel = signedIn ? t("lp.nav.openPlanner") : t("lp.cta.subscribe");
  const C_HEAD = lang === "ar" ? C_HEAD_AR : C_HEAD_EN;
  const trackRef = useRef(null);
  const [p, setP] = useState(0);

  useEffect(() => {
    let raf = 0;
    const onScroll = () => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = trackRef.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        const span = r.height - window.innerHeight;
        setP(span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0);
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
  }, []);

  const N = HERO_CARDS.length;
  const mid = (N - 1) / 2;

  // All pure functions of scroll `p` — one timeline, no dead seam.
  const heroOut = seg(p, 0.05, 0.15); // hero title leaves
  const heroE = easeInOut(heroOut);
  const bgT = easeInOut(seg(p, 0.02, 0.17)); // warm drench → cream page.
  // Lands cream at p≈0.17 (~85vh of scroll), exactly where the Nav flips
  // from its over-dark (cream chrome) state to ink chrome.
  const collapseT = easeInOut(seg(p, 0.07, 0.22)); // arc → deck
  const fanT = easeInOut(seg(p, 0.22, 0.4)); // deck → cascade (+slide right)
  const fileT = easeInOut(seg(p, 0.5, 0.74)); // cascade → Library folder
  const cIn = easeInOut(seg(p, 0.26, 0.38)); // phase-C frame arrives
  const pc = seg(p, 0.28, 0.46); // phase-C word-reveal scrub
  const cBody = clamp01((pc - 0.55) / 0.3); // C sub + buttons
  const cOut = seg(p, 0.46, 0.56); // phase-C column leaves
  const winT = easeInOut(seg(p, 0.66, 0.84)); // Library folder window
  const h2v = seg(p, 0.56, 0.82); // "One studio…" reveal — starts at the cascade
  const VISION_HEAD = lang === "ar" ? VISION_HEAD_AR : VISION_HEAD_EN;
  const VISION_SUB = lang === "ar" ? VISION_SUB_AR : VISION_SUB_EN;
  // Icons fall the instant "and" (3rd-from-last sub word —
  // "…and teach it.") begins to reveal. Length-based so EN & AR match.
  const subAndIdx = Math.max(0, VISION_SUB.length - 3);
  const honeyActive = p > 0.56 + 0.26 * (0.3 + subAndIdx * 0.02); // ≈0.70 EN

  const ARROW = (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M5 3l4 4-4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );

  return (
    <section ref={trackRef} className="relative min-h-screen lg:h-[600vh]">
      {/* ---------- DESKTOP — one pinned, continuous choreography ---------- */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen overflow-hidden">
        {/* Cinema drench — the Murchid hero's warm backdrop. It recedes to
            the cream page as the journey begins (bgT), so the deck-collapse,
            cascade and Library-folder acts read on paper the way they were
            designed. The opening frame is therefore the hero itself. */}
        <div className="cinema-drench" aria-hidden="true" style={{ opacity: 1 - bgT }}>
          <div className="cinema-grain" />
          <div className="cinema-orb cinema-orb-a" />
          <div className="cinema-orb cinema-orb-b" />
        </div>
        <div className="relative z-[1] max-w-[1280px] mx-auto px-8 h-screen">
          {/* Scene A — the Murchid hero. The big bilingual wordmark is the
              opening frame; it rises out (heroOut) as the cards leave their
              arc and the journey takes over. Cream-on-drench, mirroring the
              old standalone CinemaHero so nothing is lost in the merge. */}
          <div
            className="absolute left-1/2 top-[9vh] w-full max-w-[1180px] text-center will-change-transform"
            style={{
              transform: `translateX(-50%) translateY(${heroE * -80}px)`,
              opacity: 1 - heroOut,
              pointerEvents: heroOut > 0.9 ? "none" : "auto",
              zIndex: 6,
            }}
          >
            <div>
              <span className="cinema-eyebrow">{t("landing.hero.eyebrow")}</span>
            </div>
            <div className="cinema-word-wrap">
              {isRTL ? (
                <h1 className="cinema-word cinema-word--ar" style={{ color: "var(--cm-cream)" }}>
                  مرشد
                </h1>
              ) : (
                <h1 className="cinema-word" style={{ color: "var(--cm-cream)" }}>
                  Mu<em>r</em>chid
                </h1>
              )}
              <span className="cinema-word-alt">
                {isRTL ? "Murchid · مرشد" : "مرشد · Murchid"}
              </span>
            </div>
          </div>

          {/* Scene C — "Plan, draft, & teach…" (left column) */}
          <div
            className="absolute top-1/2 w-[45%] will-change-transform"
            style={{
              insetInlineStart: "2rem",
              transform: `translateY(calc(-50% + ${lerp(36, 0, cIn)}px))`,
              opacity: 1 - cOut,
              pointerEvents: cIn > 0.1 && cOut < 0.9 ? "auto" : "none",
              zIndex: 6,
            }}
          >
            <div className="flex items-center gap-3 mb-6" style={{ opacity: cIn }}>
              <span className="w-6 h-px" style={{ background: "var(--clay)" }} />
              <span className="eyebrow" style={{ color: "var(--clay)" }}>
                {t("lp.hero.studioEyebrow")}
              </span>
            </div>
            <h2 className="font-display text-[clamp(38px,4.8vw,74px)] leading-[1.04] tracking-tight">
              {C_HEAD.map((w, i) => {
                const wp = easeInOut(clamp01((pc - i * 0.05) / 0.34));
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      marginInlineEnd: "0.26em",
                      opacity: wp,
                      filter: `blur(${(1 - wp) * 9}px)`,
                      transform: `translateY(${(1 - wp) * 16}px)`,
                      color: mix(C_INK3, w.accent ? C_CLAY : C_INK, wp),
                      fontStyle: w.accent ? "italic" : "normal",
                      willChange: "filter, transform, opacity",
                    }}
                  >
                    {w.t}
                  </span>
                );
              })}
            </h2>
            <div
              style={{
                opacity: cBody,
                transform: `translateY(${(1 - cBody) * 16}px)`,
              }}
            >
              <p
                className="text-base md:text-lg leading-relaxed mt-7 mb-7 max-w-md"
                style={{ color: "var(--ink-2)" }}
              >
                {t("lp.hero.studioBody")}
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onEnter}
                  className="btn-primary px-6 py-3.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                >
                  {ctaLabel}
                  {ARROW}
                </button>
                <a
                  href="#how"
                  className="btn-secondary px-6 py-3.5 rounded-lg text-sm font-medium"
                >
                  {t("lp.hero.seeHow")}
                </a>
              </div>
            </div>
          </div>

          {/* Section heading — "The library / One studio…" above the icons */}
          <div
            className="absolute start-[4%] top-[23%] w-[42%]"
            style={{ zIndex: 30 }}
          >
            <div
              className="flex items-center gap-3 mb-6"
              style={{ opacity: clamp01((p - 0.56) / 0.05) }}
            >
              <span className="w-6 h-px" style={{ background: "var(--clay)" }} />
              <span className="eyebrow" style={{ color: "var(--clay)" }}>
                {t("lp.show.libraryEyebrow")}
              </span>
            </div>
            <h2 className="font-display text-[clamp(38px,4.8vw,76px)] leading-[1.04] tracking-tight">
              {VISION_HEAD.map((w, i) => {
                const wp = easeInOut(clamp01((h2v - i * 0.05) / 0.3));
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      marginInlineEnd: "0.26em",
                      opacity: wp,
                      filter: `blur(${(1 - wp) * 9}px)`,
                      transform: `translateY(${(1 - wp) * 15}px)`,
                      color: mix(
                        C_INK3,
                        w.accent === "clay" ? C_CLAY : C_INK,
                        wp
                      ),
                      fontStyle: w.accent ? "italic" : "normal",
                      willChange: "filter, transform, opacity",
                    }}
                  >
                    {w.t}
                  </span>
                );
              })}
            </h2>
            <p className="text-base md:text-lg leading-relaxed mt-7 max-w-md">
              {VISION_SUB.map((w, i) => {
                const wp = easeInOut(clamp01((h2v - 0.3 - i * 0.02) / 0.26));
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      marginInlineEnd: "0.24em",
                      opacity: wp,
                      filter: `blur(${(1 - wp) * 6}px)`,
                      color: mix(C_INK3, C_INK2, wp),
                      willChange: "filter, opacity",
                    }}
                  >
                    {w}
                  </span>
                );
              })}
            </p>
          </div>

          {/* Honeycomb of feature chips — drops in at the folder. Shifted
              toward the text column (left in LTR, right in RTL) so the
              cluster stays under the text and doesn't cross it. */}
          <HoneyDrop active={honeyActive} dx={lang === "ar" ? 455 : -455} />

          {/* The Murchid folder window (behind the cards) — chrome only */}
          <div className="absolute left-1/2 top-1/2" style={{ zIndex: 8 }}>
            <div
              className="overflow-hidden"
              style={{
                width: 470,
                height: 520,
                borderRadius: 26,
                background: "var(--paper)",
                border: "0.5px solid var(--line-strong)",
                boxShadow: "0 50px 110px -40px rgba(42,31,23,0.4)",
                transform: `translate(-50%,-50%) translate(${(lang === "ar" ? -250 : 250)}px, 22px) scale(${lerp(
                  0.96,
                  1,
                  winT
                )})`,
                opacity: winT,
              }}
            >
              {/* Closed folder ("School") tab strip + the New action */}
              <div
                className="flex items-center justify-between"
                style={{ height: 44, paddingInline: 26 }}
              >
                <span
                  className="font-display"
                  style={{ fontSize: 18, color: "var(--ink-3)" }}
                >
                  {t("lp.show.folderBehind")}
                </span>
                <span
                  className="inline-flex items-center gap-1.5 font-mono"
                  style={{
                    fontSize: 11,
                    padding: "7px 13px",
                    borderRadius: 999,
                    background: "var(--paper)",
                    color: "var(--ink)",
                    border: "0.5px solid var(--line-strong)",
                    boxShadow: "0 2px 6px -2px rgba(42,31,23,0.18)",
                  }}
                >
                  <Plus size={13} strokeWidth={2.5} />
                  {t("lp.show.folderNew")}
                </span>
              </div>
              {/* Active folder — the black "Personal" panel cards file into.
                  Manila-folder silhouette: the tab top runs flat across the
                  left (carrying the label) and ends in a rounded lobe under
                  "+ New", where a concave sweep drops to the body's straight
                  top edge. */}
              <div className="relative" style={{ height: 476 }}>
                {/* Body — full-bleed solid dark behind the cream sheet.
                    Square so the cream card's rounded top corners reveal
                    the dark folder (framing the card) with no page-bg gap
                    on the sides. The arc ends exactly at the cream line
                    (y=74), so there's no straight stub. */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 74,
                    bottom: 0,
                    background: "var(--ink)",
                    boxShadow:
                      "0 -1px 0 0 rgba(42,31,23,0.05), 0 26px 44px -28px rgba(42,31,23,0.6)",
                  }}
                />
                {/* Raised tab — flat top across the start side, under the
                    label. Uses logical properties so the whole silhouette
                    mirrors automatically in Arabic/RTL. */}
                <div
                  style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    insetInlineEnd: 168,
                    top: 0,
                    height: 76,
                    background: "var(--ink)",
                    borderStartStartRadius: 26,
                  }}
                />
                {/* Ogee sweep — traced curve dropping the tab into the
                    body under "+ New". In RTL the SVG flips horizontally
                    so the shoulder lands under the now-left-side "+ New". */}
                <svg
                  width={170}
                  height={76}
                  viewBox="0 0 170 76"
                  style={{
                    position: "absolute",
                    insetInlineEnd: 0,
                    top: 0,
                    display: "block",
                    transform: lang === "ar" ? "scaleX(-1)" : undefined,
                  }}
                  aria-hidden="true"
                >
                  <path
                    d="M0 0 C 36 0 56 34 104 34 L 130 34 A 40 40 0 0 1 170 74 L 0 74 Z"
                    fill="var(--ink)"
                  />
                </svg>
                <span
                  className="absolute inline-flex items-center gap-2 font-display"
                  style={{
                    insetInlineStart: 26,
                    top: 17,
                    color: "var(--paper)",
                    fontSize: 18,
                  }}
                >
                  <BookOpen size={15} strokeWidth={2} />
                  {t("lp.show.folderActive")}
                </span>
                {/* Big cream sheet the filed cards rest on — fills the
                    folder edge-to-edge (left/right/bottom); only the dark
                    "Personal" header band shows above it. Bottom corners
                    round via the folder window's overflow clip. Fades in
                    as the cards land in the grid. */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 74,
                    bottom: 0,
                    background: "var(--paper)",
                    borderTopLeftRadius: 24,
                    borderTopRightRadius: 24,
                    boxShadow: "inset 0 14px 26px -22px rgba(42,31,23,0.5)",
                    opacity: fileT,
                  }}
                />
              </div>
            </div>
          </div>

          {/* The ONE card layer — arc → deck → cascade → folder */}
          <div
            className="absolute left-1/2 top-1/2 will-change-transform"
            style={{ zIndex: 20 }}
          >
            {HERO_CARDS.map((kind, i) => {
              const o = i - mid;
              // A — wide smile arc, sat below the hero title (the base
              // offset clears the headline at top-[18vh]). Same offset
              // in both languages — the Arabic headline fits the same
              // 2 lines as the English one and the deeper inner cards
              // would otherwise clip past the bottom of the viewport.
              const xa = o * 150;
              const ya = (mid * mid - o * o) * 12 + 150; // sits in the lower
              // half, clearing the big Murchid wordmark in Scene A.
              const ra = o * 9;
              const sa = 0.74; // scaled down so the whole arc fits in view
              // B — tight centred deck
              const xb = o * 6;
              const yb = o * 2;
              const rb = o * 0.8;
              const sb = 0.62;
              // C — diagonal cascade (slide baked in: + right shift,
              // mirrored to the left in RTL so the cascade and the
              // Arabic headline sit on opposite sides like in LTR)
              const xc = (o * 60 + 230) * (lang === "ar" ? -1 : 1);
              const yc = o * 50 + 10;
              const rc = -8 + i * 2;
              const sc = 0.82;
              // G — cell inside the folder, on the cream sheet (3×2).
              // Bigger cards, even gutter, top row tucked under the tab.
              const row = Math.floor(i / 3);
              const ci = i - row * 3;
              // Folder grid centered under the folder window (which sits
              // at +250 in LTR / -250 in RTL).
              const gx = (250 + (ci - 1) * 146) * (lang === "ar" ? -1 : 1);
              const gy = -16 + row * 182;
              const x = lerp(lerp(lerp(xa, xb, collapseT), xc, fanT), gx, fileT);
              const y = lerp(lerp(lerp(ya, yb, collapseT), yc, fanT), gy, fileT);
              const r = lerp(lerp(lerp(ra, rb, collapseT), rc, fanT), 0, fileT);
              const s = lerp(lerp(lerp(sa, sb, collapseT), sc, fanT), 0.52, fileT);
              return (
                <div
                  key={kind}
                  className="absolute left-0 top-0 will-change-transform"
                  style={{
                    transform: `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`,
                    zIndex: 10 + i,
                  }}
                >
                  <HeroCardFace kind={kind} />
                </div>
              );
            })}
          </div>

          {/* Floating @handle bubbles removed by request — the hero reads
              cleaner without them. The Bubble component is kept in the file
              in case any are wanted back during the cascade / folder acts. */}
        </div>
      </div>

      {/* ---------- MOBILE — static (no scrub) ---------- */}
      <div className="lg:hidden">
        {/* Murchid wordmark hero on the warm drench — the opening frame,
            mirroring desktop. The card lineup + vision sit on the cream
            page below it. */}
        <div className="cinema-drench-static text-center px-6 pt-28 pb-16">
          <div>
            <span className="cinema-eyebrow">{t("landing.hero.eyebrow")}</span>
          </div>
          <div className="cinema-word-wrap">
            {isRTL ? (
              <h1
                className="cinema-word cinema-word--ar"
                style={{ fontSize: "clamp(72px, 24vw, 160px)" }}
              >
                مرشد
              </h1>
            ) : (
              <h1
                className="cinema-word"
                style={{ fontSize: "clamp(56px, 18vw, 120px)", lineHeight: 0.9 }}
              >
                Mu<em>r</em>chid
              </h1>
            )}
            <span className="cinema-word-alt">
              {isRTL ? "Murchid · مرشد" : "مرشد · Murchid"}
            </span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3 mt-9">
            <button type="button" onClick={onEnter} className="cinema-pill">
              {ctaLabel}
            </button>
            <a href="#how" className="cinema-ghost">
              {t("lp.hero.seeHow")}
            </a>
          </div>
        </div>
        <div className="px-6 pt-14 pb-12">
        <div className="relative h-[320px] mb-16">
          {HERO_CARDS.slice(0, 5).map((kind, i) => {
            const o = i - 2;
            return (
              <div
                key={kind}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%,-50%) translate(${o * 26}px,${
                    Math.abs(o) * 10
                  }px) rotate(${o * 5}deg) scale(0.6)`,
                  zIndex: 10 + i,
                }}
              >
                <HeroCardFace kind={kind} />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px" style={{ background: "var(--clay)" }} />
          <span className="eyebrow" style={{ color: "var(--clay)" }}>
            {t("lp.show.libraryEyebrow")}
          </span>
        </div>
        <h2 className="font-display text-[clamp(32px,8vw,48px)] leading-[1.08] tracking-tight mb-5">
          {t("lp.show.visionA")}{" "}
          <em style={{ color: "var(--clay)", fontStyle: "italic" }}>
            {t("lp.show.visionEm")}
          </em>{" "}
          {t("lp.show.visionB")}
        </h2>
        <p
          className="text-base leading-relaxed mb-10"
          style={{ color: "var(--ink-2)" }}
        >
          {t("lp.show.visionSub")}
        </p>
        <div className="grid grid-cols-2 gap-3">
          {HERO_CARDS.slice(0, 4).map((kind) => (
            <div
              key={kind}
              style={{ transform: "scale(0.62)", transformOrigin: "top left" }}
            >
              <HeroCardFace kind={kind} />
            </div>
          ))}
        </div>
        </div>
      </div>
    </section>
  );
};


export default HeroJourney;
