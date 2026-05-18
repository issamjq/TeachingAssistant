import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles, ArrowRight, ChevronRight, ChevronLeft, Plus, BookOpen,
  CalendarDays, GraduationCap, ClipboardList, Presentation, Layout,
  Users, MessageCircle, CheckCircle2, Clock, TrendingUp, FileText,
  Pencil, Trash2, ArrowUpDown, Calendar, LayoutGrid, List,
  Paperclip, Send, Layers, Play,
} from "lucide-react";
import "../landing.css";

// Animations removed by request. These are no-op stand-ins for the
// framer-motion API so the page renders fully static — no fades, no
// scroll reveals, no entrance motion. Everything is visible at once.
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

// =====================================================================
// SHARED MOTION PRIMITIVES
// =====================================================================
const EASE = [0.22, 1, 0.36, 1];

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  visible: (i = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.9, ease: EASE, delay: i * 0.08 },
  }),
};

const Reveal = ({ children, delay = 0, className = "" }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-80px" });
  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={inView ? "visible" : "hidden"}
      variants={fadeUp}
      custom={delay}
      className={className}
    >
      {children}
    </motion.div>
  );
};

// =====================================================================
// SECTION DIVIDER — hand-drawn ink lines that flow between sections
// =====================================================================
const DIVIDER_PATHS = {
  calm: "M 0 60 C 120 20, 220 70, 340 40 S 540 90, 680 30 S 880 80, 1040 50 S 1240 70, 1440 35",
  cascade:
    "M 0 40 C 100 30, 180 10, 260 25 S 380 80, 500 50 C 580 30, 660 65, 760 95 S 920 80, 1080 60 C 1180 50, 1280 90, 1440 70",
  wave: "M 0 50 C 240 80, 480 20, 720 50 S 1200 80, 1440 50",
  rise: "M 0 80 C 180 60, 320 20, 480 30 S 760 80, 960 60 C 1120 45, 1280 25, 1440 40",
};

const SectionDivider = ({ variant = "calm", flip = false, height = 120 }) => {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: "-100px" });
  const path = DIVIDER_PATHS[variant];

  return (
    <div
      ref={ref}
      className="w-full overflow-hidden pointer-events-none select-none"
      style={{ height: `${height}px`, transform: flip ? "scaleY(-1)" : "none" }}
      aria-hidden="true"
    >
      <svg
        viewBox="0 0 1440 120"
        preserveAspectRatio="none"
        className="w-full h-full"
        fill="none"
      >
        <motion.path
          d={path}
          stroke="var(--ink)"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeDasharray="2400"
          initial={{ strokeDashoffset: 2400, opacity: 0 }}
          animate={inView ? { strokeDashoffset: 0, opacity: 0.85 } : {}}
          transition={{
            strokeDashoffset: { duration: 2.4, ease: EASE },
            opacity: { duration: 0.6, ease: EASE },
          }}
        />
      </svg>
    </div>
  );
};

// =====================================================================
// NAV
// =====================================================================
const Nav = ({ onOpenStudio, onJump, onPage }) => {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled ? "nav-blur border-b" : ""
      }`}
      style={{ borderColor: scrolled ? "var(--line)" : "transparent" }}
    >
      <div className="max-w-[1280px] mx-auto px-8 py-3 flex items-center justify-between">
        <button
          type="button"
          onClick={() => onPage("home")}
          className="flex items-center gap-2.5"
        >
          <div
            className="w-7 h-7 rounded-md flex items-center justify-center"
            style={{ background: "var(--ink)" }}
          >
            <span className="font-display text-base" style={{ color: "var(--paper)" }}>
              م
            </span>
          </div>
          <span className="font-display text-xl tracking-tight">Mudir</span>
        </button>

        <nav
          className="hidden md:flex items-center gap-10 text-sm"
          style={{ color: "var(--ink-2)" }}
        >
          <button type="button" onClick={() => onJump("how")} className="link-quiet">
            How it works
          </button>
          <button type="button" onClick={() => onJump("features")} className="link-quiet">
            Features
          </button>
          <button type="button" onClick={() => onJump("how")} className="link-quiet">
            AI studio
          </button>
          <button type="button" onClick={() => onJump("philosophy")} className="link-quiet">
            How we build
          </button>
        </nav>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onPage("signin")}
            className="hidden sm:block text-sm link-quiet"
            style={{ color: "var(--ink-2)" }}
          >
            Sign in
          </button>
          <button
            type="button"
            onClick={onOpenStudio}
            className="btn-primary px-4 py-2 rounded-lg text-sm font-medium"
          >
            Open the planner
          </button>
        </div>
      </div>
    </motion.header>
  );
};

// =====================================================================
// HERO
// =====================================================================
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

// Real Mudir cards that fan out, then collapse + shrink as you scroll.
function HeroCardFace({ kind }) {
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
      <span
        className="mt-auto self-start text-[10px] font-mono px-2 py-1 rounded"
        style={{ background: "var(--paper-2)", color: "var(--ink-3)" }}
      >
        Drafted by Mudir
      </span>
    </div>
  );
}

const HERO_CARDS = ["lesson", "quiz", "deck", "presentation", "activity", "homework", "worksheet"];

// Phase-C headline — each token fades + un-blurs + colour-shifts in turn.
const C_HEAD = [
  { t: "Plan," }, { t: "draft," },
  { t: "&", accent: true }, { t: "teach", accent: true },
  { t: "every" }, { t: "lesson" }, { t: "—" },
  { t: "start" }, { t: "to" }, { t: "finish." },
];

// Floating handle pill with a little speech tail.
function Bubble({ label, bg, style }) {
  return (
    <div style={{ position: "absolute", ...style }}>
      <div
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

const Hero = ({ onOpenStudio }) => {
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

  // Three phases, all pure functions of scroll position `p`:
  //   A  wide smile arc + hero title      (read)
  //   B  everything converges to one deck (collapse)
  //   C  deck re-fans into a diagonal cascade while a second
  //      headline reveals word-by-word    (reveal)
  const collapseT = easeInOut(seg(p, 0.14, 0.42)); // arc → deck
  const fanT = easeInOut(seg(p, 0.52, 0.9)); // deck → cascade
  const heroOut = seg(p, 0.12, 0.34); // hero title leaves
  const heroE = easeInOut(heroOut);
  const bubbleA = 1 - seg(p, 0.1, 0.28); // phase-A pills fade
  const cIn = easeInOut(seg(p, 0.54, 0.72)); // phase-C frame arrives
  const pc = seg(p, 0.56, 0.96); // word-reveal scrub
  const cardsX = lerp(0, 210, easeInOut(seg(p, 0.56, 0.9))); // deck slides right
  const bob = Math.sin(p * Math.PI * 2) * 6; // gentle pill float
  const cBody = clamp01((pc - 0.55) / 0.3); // C sub + buttons

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
    <section ref={trackRef} className="relative min-h-screen lg:h-[460vh]">
      {/* ---------- DESKTOP — pinned 3-phase scroll choreography ---------- */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen overflow-hidden">
        <div className="relative max-w-[1280px] mx-auto px-8 h-screen">
          {/* Scene A — hero title (top) */}
          <div
            className="absolute left-1/2 top-[11vh] w-full max-w-3xl text-center will-change-transform"
            style={{
              transform: `translateX(-50%) translateY(${heroE * -80}px)`,
              opacity: 1 - heroOut,
              pointerEvents: heroOut > 0.9 ? "none" : "auto",
            }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="w-6 h-px" style={{ background: "var(--ink-3)" }} />
              <span className="eyebrow">
                An AI lesson director · Built for UAE schools
              </span>
            </div>
            <h1 className="font-display text-[clamp(44px,5.6vw,92px)] leading-[0.98] tracking-tight">
              The teacher directs.{" "}
              <em style={{ color: "var(--clay)", fontStyle: "italic" }}>
                Mudir
              </em>{" "}
              <span style={{ color: "var(--ink-2)" }}>drafts.</span>
            </h1>
          </div>

          {/* Scene C — headline reveals word-by-word (left column) */}
          <div
            className="absolute left-8 top-1/2 w-[45%] will-change-transform"
            style={{
              transform: `translateY(calc(-50% + ${lerp(36, 0, cIn)}px))`,
              pointerEvents: cIn > 0.1 ? "auto" : "none",
            }}
          >
            <div className="flex items-center gap-3 mb-6" style={{ opacity: cIn }}>
              <span className="w-6 h-px" style={{ background: "var(--clay)" }} />
              <span className="eyebrow" style={{ color: "var(--clay)" }}>
                The studio
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
                      marginRight: "0.26em",
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
                One studio for every artifact. You direct the lesson — Mudir
                builds the rest, classroom-ready.
              </p>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={onOpenStudio}
                  className="btn-primary px-6 py-3.5 rounded-lg text-sm font-medium inline-flex items-center gap-2"
                >
                  Open the planner
                  {ARROW}
                </button>
                <a
                  href="#how"
                  className="btn-secondary px-6 py-3.5 rounded-lg text-sm font-medium"
                >
                  See how it works
                </a>
              </div>
            </div>
          </div>

          {/* Shared card layer — arc → deck → cascade */}
          <div
            className="absolute left-1/2 top-1/2 will-change-transform"
            style={{ transform: `translateX(${cardsX}px)` }}
          >
            {HERO_CARDS.map((kind, i) => {
              const o = i - mid;
              // A — wide smile arc
              const xa = o * 168;
              const ya = (mid * mid - o * o) * 12 - 30;
              const ra = o * 9;
              const sa = 1;
              // B — tight centered deck
              const xb = o * 6;
              const yb = o * 2;
              const rb = o * 0.8;
              const sb = 0.62;
              // C — diagonal cascade (upper-left → lower-right)
              const xc = o * 60 + 20;
              const yc = o * 50 + 10;
              const rc = -8 + i * 2;
              const sc = 0.82;
              const x = lerp(lerp(xa, xb, collapseT), xc, fanT);
              const y = lerp(lerp(ya, yb, collapseT), yc, fanT);
              const r = lerp(lerp(ra, rb, collapseT), rc, fanT);
              const s = lerp(lerp(sa, sb, collapseT), sc, fanT);
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

          {/* Floating handle bubbles */}
          <Bubble
            label="@ms.layla"
            bg="var(--sage)"
            style={{
              left: "21%",
              top: "29%",
              opacity: bubbleA,
              transform: `translateY(${bob}px)`,
              transition: "opacity 0.15s linear",
            }}
          />
          <Bubble
            label="@mr.idris"
            bg="var(--clay)"
            style={{
              right: "21%",
              top: "25%",
              opacity: bubbleA,
              transform: `translateY(${-bob}px)`,
              transition: "opacity 0.15s linear",
            }}
          />
          <Bubble
            label="@head.of.science"
            bg="var(--brick)"
            style={{
              right: "15%",
              top: "30%",
              opacity: clamp01((pc - 0.4) / 0.28),
              transform: `translateY(${bob}px)`,
            }}
          />
        </div>
      </div>

      {/* ---------- MOBILE — static (no scrub) ---------- */}
      <div className="lg:hidden px-6 pt-28 pb-16">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px" style={{ background: "var(--ink-3)" }} />
          <span className="eyebrow">
            An AI lesson director · Built for UAE schools
          </span>
        </div>
        <h1 className="font-display text-[clamp(40px,11vw,64px)] leading-[1.0] tracking-tight mb-6">
          The teacher directs.{" "}
          <em style={{ color: "var(--clay)", fontStyle: "italic" }}>Mudir</em>{" "}
          <span style={{ color: "var(--ink-2)" }}>drafts.</span>
        </h1>
        <p
          className="text-base leading-relaxed mb-7"
          style={{ color: "var(--ink-2)" }}
        >
          Lessons, quizzes, slides, homework — every teaching artifact, drafted
          for you and ready to teach.
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-14">
          <button
            type="button"
            onClick={onOpenStudio}
            className="btn-primary px-6 py-3.5 rounded-lg text-sm font-medium"
          >
            Open the planner
          </button>
          <a
            href="#how"
            className="btn-secondary px-6 py-3.5 rounded-lg text-sm font-medium"
          >
            See how it works
          </a>
        </div>
        <div className="relative h-[320px]">
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
      </div>
    </section>
  );
};

// =====================================================================
// SHOWCASE — second scroll act. Mudir "content cover" cards converge
// into a centred portrait stack while a headline reveals word-by-word
// behind them, then the stack fans into a diagonal cascade.
// =====================================================================
const SHOW_CARDS = [
  {
    k: "science",
    bg: "#5E7156",
    tx: "#F2F5EE",
    tag: "Lesson plan · G5",
    title: "The Water\nCycle",
    note: "Evaporation → condensation",
  },
  {
    k: "math",
    bg: "#2A1F17",
    tx: "#F7F3EC",
    tag: "Quiz · G10",
    title: "Trigonometry",
    note: "20 questions · auto-marked",
  },
  {
    k: "reading",
    bg: "#F7F3EC",
    tx: "#2A1F17",
    accent: "#B5754E",
    tag: "Reading unit · G8",
    title: "الشِّعر\nالعربي",
    arabic: true,
    note: "Arabic poetry · 6 lessons",
  },
  {
    k: "history",
    bg: "#A0392A",
    tx: "#F7F3EC",
    tag: "Unit overview · G7",
    title: "Islamic\nHistory",
    note: "Scheme of work · 6 weeks",
  },
  {
    k: "art",
    bg: "#B5754E",
    tx: "#FBF5EC",
    tag: "Project brief · G6",
    title: "Colour\n& Form",
    note: "Studio project · rubric",
  },
  {
    k: "slides",
    bg: "#7A8F6E",
    tx: "#F7F3EC",
    tag: "Slide deck · G9",
    title: "Photo-\nsynthesis",
    note: "18 slides · speaker notes",
  },
  {
    k: "work",
    bg: "#EDE5D6",
    tx: "#2A1F17",
    accent: "#A0392A",
    tag: "Worksheet · G6",
    title: "Fractions,\nThree Ways",
    note: "Foundation · core · stretch",
  },
];

function ShowCardFace({ c }) {
  return (
    <div
      className="w-[238px] h-[322px] rounded-2xl border overflow-hidden flex flex-col p-6 relative"
      style={{
        background: c.bg,
        color: c.tx,
        borderColor: "rgba(42,31,23,0.10)",
        boxShadow: "0 38px 72px -30px rgba(42,31,23,0.5)",
      }}
    >
      <span
        className="font-mono uppercase"
        style={{ fontSize: 10, letterSpacing: "0.16em", color: c.tx, opacity: 0.7 }}
      >
        {c.tag}
      </span>
      <h3
        className={`font-display mt-3 ${c.arabic ? "arabic" : ""}`}
        style={{
          fontSize: c.arabic ? 38 : 31,
          lineHeight: 1.04,
          whiteSpace: "pre-line",
          color: c.tx,
        }}
      >
        {c.title}
      </h3>
      <span
        className="mt-4 h-[3px] w-12 rounded-full"
        style={{ background: c.accent || c.tx, opacity: 0.85 }}
      />
      <p
        className="mt-auto"
        style={{ fontSize: 12, lineHeight: 1.4, color: c.tx, opacity: 0.78 }}
      >
        {c.note}
      </p>
      <div className="mt-3 flex items-center justify-between">
        <span
          className="font-mono uppercase"
          style={{ fontSize: 9, letterSpacing: "0.14em", color: c.tx, opacity: 0.55 }}
        >
          {c.k}
        </span>
        <span
          className="font-mono"
          style={{
            fontSize: 9,
            padding: "3px 7px",
            borderRadius: 5,
            color: c.tx,
            border: `0.5px solid ${c.tx}`,
            opacity: 0.5,
          }}
        >
          Mudir
        </span>
      </div>
      <span
        aria-hidden
        style={{
          position: "absolute",
          right: -46,
          bottom: -46,
          width: 150,
          height: 150,
          borderRadius: "50%",
          border: `1px solid ${c.tx}`,
          opacity: 0.16,
          pointerEvents: "none",
        }}
      />
    </div>
  );
}

// Centred headline — reveals word-by-word, behind the card stack.
const SHOW_HEAD = [
  { t: "Whether" }, { t: "you're" }, { t: "planning" },
  { t: "tomorrow's" }, { t: "lesson" }, { t: "or" }, { t: "building" },
  { t: "a" }, { t: "full" }, { t: "unit" }, { t: "—" },
  { t: "Mudir", accent: "clay", italic: true }, { t: "turns" },
  { t: "intent" }, { t: "into" },
  { t: "classroom-ready", accent: "sage" }, { t: "material." },
];
const C_SAGE = "#7A8F6E";

// Headline #2 (left column, library phase) + the honeycomb chips.
const VISION_HEAD = [
  { t: "One" }, { t: "studio." },
  { t: "Every", accent: "clay" }, { t: "subject,", accent: "clay" },
  { t: "every" }, { t: "grade." },
];
const VISION_SUB =
  "Every lesson tells a story. Mudir helps you plan it, build it, and teach it."
    .split(" ");
const C_INK2 = "#6E5C4A";

// Honeycomb — a tight hexagonal close-pack of the 58px circles: a 3-2-3
// pile where every neighbour is tangent (touching) and the bottom row
// sits on the ground (y: 0). Row pitch = 58·√3/2 ≈ 50, columns 58 apart,
// odd rows offset by half a circle into the valleys.
const HONEY = [
  { x: -58, y: 0 }, { x: 0, y: 0 }, { x: 58, y: 0 },
  { x: -29, y: -50 }, { x: 29, y: -50 },
  { x: -58, y: -100 }, { x: 0, y: -100 }, { x: 58, y: -100 },
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

const HoneyDrop = React.memo(function HoneyDrop({ active }) {
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
      className="absolute left-[10%] bottom-[4%]"
      style={{ width: 0, height: 0, zIndex: 25 }}
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

// One continuous act, ONE set of cards, four phases driven by a single
// scroll progress `q`:
//   P1 converge  scattered → centred portrait stack  (headline #1 reveals)
//   P2 cascade   stack → diagonal cascade
//   P3 to-grid   the SAME cards travel right + shrink into the Library grid
//   P4 reveal    left headline #2 + sub + honeycomb chips assemble
const ShowcaseScroll = () => {
  const trackRef = useRef(null);
  const [q, setQ] = useState(0);

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
        setQ(span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0);
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

  const CARDS = SHOW_CARDS.slice(0, 6);
  const N = CARDS.length;
  const mid = (N - 1) / 2;

  // Card phase sub-progress
  const g1 = easeInOut(seg(q, 0.02, 0.18)); // S → M  (converge)
  const g2 = easeInOut(seg(q, 0.18, 0.4)); //  M → E  (cascade)
  const g3 = easeInOut(seg(q, 0.46, 0.78)); // E → G  (travel to grid)

  // Headline #1 — centred, behind the cards (cascade phase)
  const h1 = seg(q, 0.03, 0.3);
  const head1Out = seg(q, 0.46, 0.6);
  const head1Up = easeInOut(seg(q, 0.46, 0.7)) * -70;

  // Library window + headline #2 + honeycomb (grid phase)
  const winT = easeInOut(seg(q, 0.5, 0.74));
  const h2 = seg(q, 0.62, 0.96);
  const honeyActive = q > 0.62;

  const bob = Math.sin(q * Math.PI * 2) * 6;
  const bCasc =
    clamp01((q - 0.08) / 0.06) * (1 - clamp01((q - 0.4) / 0.08));
  const bWin = clamp01((q - 0.66) / 0.08);

  const colOff = [-140, 0, 140];
  // Top row pushed down so it clears the header + folder tabs (the
  // floating cards otherwise cover the "Personal / School" labels).
  const rowOff = [-6, 184];

  return (
    <section ref={trackRef} className="relative min-h-screen lg:h-[680vh]">
      {/* ---------- DESKTOP — one pinned, continuous choreography ---------- */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen overflow-hidden">
        <div className="relative max-w-[1280px] mx-auto px-8 h-screen">
          {/* Headline #1 — centred, behind the cards */}
          <h2
            className="absolute left-1/2 top-1/2 w-full max-w-5xl text-center font-display text-[clamp(32px,4.4vw,66px)] leading-[1.14] tracking-tight"
            style={{
              transform: `translate(-50%,-50%) translateY(${head1Up}px)`,
              opacity: 1 - head1Out,
              zIndex: 5,
            }}
          >
            {SHOW_HEAD.map((w, i) => {
              const wp = easeInOut(clamp01((h1 - i * 0.044) / 0.3));
              const col =
                w.accent === "clay"
                  ? C_CLAY
                  : w.accent === "sage"
                  ? C_SAGE
                  : C_INK;
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: "0.28em",
                    opacity: wp,
                    filter: `blur(${(1 - wp) * 10}px)`,
                    transform: `translateY(${(1 - wp) * 14}px)`,
                    color: mix(C_INK3, col, wp),
                    fontStyle: w.italic ? "italic" : "normal",
                    willChange: "filter, transform, opacity",
                  }}
                >
                  {w.t}
                </span>
              );
            })}
          </h2>

          {/* Headline #2 — left column, arrives as the grid forms */}
          <div
            className="absolute left-[4%] top-[23%] w-[42%]"
            style={{ zIndex: 30 }}
          >
            <div
              className="flex items-center gap-3 mb-6"
              style={{ opacity: clamp01((q - 0.6) / 0.05) }}
            >
              <span className="w-6 h-px" style={{ background: "var(--clay)" }} />
              <span className="eyebrow" style={{ color: "var(--clay)" }}>
                The library
              </span>
            </div>
            <h2 className="font-display text-[clamp(38px,4.8vw,76px)] leading-[1.04] tracking-tight">
              {VISION_HEAD.map((w, i) => {
                const wp = easeInOut(clamp01((h2 - i * 0.05) / 0.3));
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      marginRight: "0.26em",
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
                const wp = easeInOut(clamp01((h2 - 0.3 - i * 0.02) / 0.26));
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      marginRight: "0.24em",
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

          {/* Honeycomb of feature chips — real-gravity drop (bottom-left) */}
          <HoneyDrop active={honeyActive} />

          {/* The Mudir "Library" product window (behind the cards) */}
          <div className="absolute left-1/2 top-1/2" style={{ zIndex: 8 }}>
            <div
              className="overflow-hidden"
              style={{
                width: 470,
                height: 470,
                borderRadius: 22,
                background: "var(--paper)",
                border: "0.5px solid var(--line-strong)",
                boxShadow: "0 50px 110px -40px rgba(42,31,23,0.4)",
                transform: `translate(-50%,-50%) translate(250px, 22px) scale(${lerp(
                  0.96,
                  1,
                  winT
                )})`,
                opacity: winT,
              }}
            >
              <div
                className="flex items-center justify-between px-6"
                style={{
                  height: 64,
                  borderBottom: "0.5px solid var(--line)",
                }}
              >
                <span className="font-display text-xl">Library</span>
                <span
                  className="inline-flex items-center gap-1.5 font-mono"
                  style={{
                    fontSize: 11,
                    padding: "7px 12px",
                    borderRadius: 8,
                    background: "var(--ink)",
                    color: "var(--paper)",
                  }}
                >
                  <Plus size={13} strokeWidth={2.5} /> New
                </span>
              </div>
              {/* Folder tabs — stacked like the reference: a lighter
                  folder behind, the active one dark in front. */}
              <div
                className="relative px-6"
                style={{ paddingTop: 16, height: 58 }}
              >
                {/* Back folder — "School" (peeks behind, to the right) */}
                <div
                  className="font-mono absolute"
                  style={{
                    top: 12,
                    left: 150,
                    fontSize: 10.5,
                    letterSpacing: "0.13em",
                    textTransform: "uppercase",
                    padding: "9px 26px 18px",
                    background: "var(--paper-2)",
                    color: "var(--ink-3)",
                    border: "0.5px solid var(--line-strong)",
                    borderBottom: "none",
                    borderRadius: "13px 13px 0 0",
                    zIndex: 1,
                  }}
                >
                  School
                </div>
                {/* Active folder — "Personal" (dark, in front) */}
                <div
                  className="relative inline-flex items-center gap-2"
                  style={{
                    zIndex: 2,
                    padding: "11px 26px 16px",
                    background: "var(--ink)",
                    color: "var(--paper)",
                    borderRadius: "15px 15px 0 0",
                    boxShadow: "0 14px 26px -16px rgba(42,31,23,0.5)",
                    fontFamily: "'Fraunces', serif",
                    fontSize: 15,
                  }}
                >
                  <BookOpen size={14} strokeWidth={2} />
                  Personal
                </div>
                {/* Seam — the active folder opens onto the content */}
                <div
                  className="absolute left-0 right-0"
                  style={{
                    bottom: 0,
                    height: "0.5px",
                    background: "var(--line)",
                    zIndex: 0,
                  }}
                />
              </div>
            </div>
          </div>

          {/* The ONE card layer — converge → stack → cascade → grid */}
          <div className="absolute left-1/2 top-1/2" style={{ zIndex: 20 }}>
            {CARDS.map((c, i) => {
              const o = i - mid;
              // S — small, low, lightly scattered
              const xs = o * 6;
              const ys = 80;
              const rs = o * 3;
              const ss = 0.3;
              // M — centred portrait stack
              const xm = o * 6;
              const ym = o * 1.5;
              const rm = o * 1.4;
              const sm = 0.92;
              // E — centred diagonal cascade
              const xe = o * 92;
              const ye = o * 70;
              const re = -10 + i * 2.6;
              const se = 0.84;
              // G — grid cell inside the Library window
              const gx = 250 + colOff[i % 3];
              const gy = -10 + rowOff[Math.floor(i / 3)];
              const base = (a, b, cc, d) =>
                lerp(lerp(lerp(a, b, g1), cc, g2), d, g3);
              const x = base(xs, xm, xe, gx);
              const y = base(ys, ym, ye, gy);
              const r = base(rs, rm, re, 0);
              const s = base(ss, sm, se, 0.46);
              return (
                <div
                  key={c.k}
                  className="absolute left-0 top-0 will-change-transform"
                  style={{
                    transform: `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`,
                    zIndex: 10 + i,
                  }}
                >
                  <ShowCardFace c={c} />
                </div>
              );
            })}
          </div>

          {/* Floating handle bubbles */}
          <Bubble
            label="@ms.layla"
            bg="var(--ink)"
            style={{
              left: "21%",
              top: "31%",
              opacity: bCasc,
              transform: `translateY(${bob}px)`,
              zIndex: 30,
            }}
          />
          <Bubble
            label="@mr.idris"
            bg="var(--clay)"
            style={{
              right: "21%",
              top: "27%",
              opacity: bCasc,
              transform: `translateY(${-bob}px)`,
              zIndex: 30,
            }}
          />
          <Bubble
            label="@head.of.year"
            bg="var(--sage)"
            style={{
              left: "50%",
              top: "24%",
              opacity: bWin,
              transform: `translateX(120px) translateY(${bob}px)`,
              zIndex: 30,
            }}
          />
        </div>
      </div>

      {/* ---------- MOBILE — static (no scrub) ---------- */}
      <div className="lg:hidden px-6 py-20">
        <h2 className="font-display text-[clamp(30px,8vw,46px)] leading-[1.16] tracking-tight mb-10">
          Whether you're planning tomorrow's lesson or building a full unit —{" "}
          <em style={{ color: "var(--clay)", fontStyle: "italic" }}>Mudir</em>{" "}
          turns intent into{" "}
          <span style={{ color: "var(--sage)" }}>classroom-ready</span> material.
        </h2>
        <div className="relative h-[340px] mb-14">
          {CARDS.slice(0, 5).map((c, i) => {
            const o = i - 2;
            return (
              <div
                key={c.k}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%,-50%) translate(${o * 30}px,${
                    o * 22
                  }px) rotate(${-6 + i * 3}deg) scale(0.6)`,
                  zIndex: 10 + i,
                }}
              >
                <ShowCardFace c={c} />
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px" style={{ background: "var(--clay)" }} />
          <span className="eyebrow" style={{ color: "var(--clay)" }}>
            The library
          </span>
        </div>
        <h2 className="font-display text-[clamp(32px,8vw,48px)] leading-[1.08] tracking-tight mb-5">
          One studio.{" "}
          <em style={{ color: "var(--clay)", fontStyle: "italic" }}>
            Every subject,
          </em>{" "}
          every grade.
        </h2>
        <p
          className="text-base leading-relaxed mb-10"
          style={{ color: "var(--ink-2)" }}
        >
          Every lesson tells a story. Mudir helps you plan it, build it, and
          teach it.
        </p>
        <div className="grid grid-cols-2 gap-3">
          {CARDS.slice(0, 4).map((c) => (
            <div
              key={c.k}
              style={{ transform: "scale(0.62)", transformOrigin: "top left" }}
            >
              <ShowCardFace c={c} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// COMMUNITY — two opposing tile marquees (top R→L, bottom L→R) with a
// gentle vertical wave, and a centred headline that reveals word-by-word.
// =====================================================================
const MQ_TILES = [
  { code: "MA", label: "Mathematics", bg: "#2A1F17", tx: "#F4EFE4" },
  { code: "SC", label: "Science", bg: "#5E7156", tx: "#F2F5EE" },
  { code: "AR", label: "Arabic", bg: "#EDE5D6", tx: "#2A1F17" },
  { code: "EN", label: "English", bg: "#B5754E", tx: "#FBF5EC" },
  { code: "PH", label: "Physics", bg: "#33291F", tx: "#F4EFE4" },
  { code: "CH", label: "Chemistry", bg: "#7A8F6E", tx: "#F7F3EC" },
  { code: "BI", label: "Biology", bg: "#5E7156", tx: "#F2F5EE" },
  { code: "HI", label: "History", bg: "#A0392A", tx: "#FBEFE9" },
  { code: "GE", label: "Geography", bg: "#8E5435", tx: "#FBF1E8" },
  { code: "IS", label: "Islamic St.", bg: "#7A2A1E", tx: "#FBEFE9" },
  { code: "AT", label: "Art & Design", bg: "#B5754E", tx: "#FBF5EC" },
  { code: "MU", label: "Music", bg: "#E3D9C5", tx: "#2A1F17" },
  { code: "CS", label: "Coding", bg: "#2A1F17", tx: "#F4EFE4" },
  { code: "PE", label: "P.E.", bg: "#7A8F6E", tx: "#F7F3EC" },
  { code: "EC", label: "Economics", bg: "#8E5435", tx: "#FBF1E8" },
  { code: "ME", label: "Moral Ed.", bg: "#EDE5D6", tx: "#2A1F17" },
];

function MqTile({ t }) {
  return (
    <div
      className="flex flex-col justify-between p-3.5 rounded-[20px] select-none"
      style={{
        width: 112,
        height: 112,
        background: t.bg,
        color: t.tx,
        boxShadow: "0 18px 36px -22px rgba(42,31,23,0.45)",
      }}
    >
      <span
        className="font-mono"
        style={{ fontSize: 9, letterSpacing: "0.16em", opacity: 0.65 }}
      >
        {t.code}
      </span>
      <span className="font-display" style={{ fontSize: 15, lineHeight: 1.05 }}>
        {t.label}
      </span>
    </div>
  );
}

const MQ_HEAD = [
  { t: "You'll" }, { t: "find" },
  { t: "every", accent: true }, { t: "subject", accent: true },
  { t: "here." },
];
const MQ_SUB =
  "Built with teachers across the UAE — from KG to Grade 12, every classroom."
    .split(" ");

// JS-driven so each tile's vertical offset is a function of its LIVE
// position — the wave actually travels with the tiles instead of being a
// fixed stagger that just slides sideways.
const MQ_PITCH = 134; // 112 tile + 22 gap
const MQ_AMP = 19; // vertical wave amplitude (px)
const MQ_SPEED = 40; // horizontal px / second

const MarqueeRow = ({ reverse }) => {
  const trackRef = useRef(null);
  const tilesRef = useRef([]);
  const L = MQ_TILES.length;
  const list = MQ_TILES.concat(MQ_TILES);
  const SETW = L * MQ_PITCH;
  // 3 full waves per set so the sine is continuous across the loop seam.
  const F = (Math.PI * 2 * 3) / SETW;

  useEffect(() => {
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)"
    ).matches;
    if (reduce) return;
    let raf = 0;
    let last = performance.now();
    let pos = 0;
    const dir = reverse ? -1 : 1;
    const tick = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      pos += MQ_SPEED * dt;
      const wrapped = pos % SETW;
      const track = trackRef.current;
      if (track) {
        track.style.transform = `translateX(${
          reverse ? wrapped - SETW : -wrapped
        }px)`;
      }
      const tiles = tilesRef.current;
      for (let i = 0; i < tiles.length; i++) {
        const el = tiles[i];
        if (!el) continue;
        const y = MQ_AMP * Math.sin((i * MQ_PITCH - dir * pos) * F);
        el.style.transform = `translateY(${y}px)`;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [reverse, SETW, F]);

  return (
    <div
      className="w-full"
      style={{ overflowX: "hidden", overflowY: "visible", paddingBlock: MQ_AMP + 34 }}
    >
      <div
        ref={trackRef}
        style={{ display: "flex", width: "max-content", willChange: "transform" }}
      >
        {list.map((t, i) => (
          <div
            key={i}
            ref={(el) => (tilesRef.current[i] = el)}
            style={{ marginRight: 22, willChange: "transform" }}
          >
            <MqTile t={t} />
          </div>
        ))}
      </div>
    </div>
  );
};

const CommunityScroll = () => {
  const trackRef = useRef(null);
  const [q, setQ] = useState(0);

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
        setQ(span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0);
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

  const hr = seg(q, 0.12, 0.66); // headline scrub
  const sb = seg(q, 0.46, 0.92); // sub scrub

  return (
    <section ref={trackRef} className="relative min-h-screen lg:h-[260vh]">
      {/* ---------- DESKTOP — pinned; marquees loop, text reveals ---------- */}
      <div className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen overflow-hidden flex-col py-[6vh]">
        <MarqueeRow />

        <div className="flex-1 min-h-0 flex flex-col items-center justify-center text-center px-8 overflow-hidden">
          <span
            className="inline-flex h-9 w-9 rounded-full items-center justify-center mb-7"
            style={{
              background: "var(--paper)",
              border: "0.5px solid var(--line-strong)",
              color: "var(--clay)",
            }}
          >
            <Sparkles size={15} strokeWidth={2} />
          </span>
          <h2 className="font-display text-[clamp(38px,5vw,80px)] leading-[1.02] tracking-tight max-w-4xl mx-auto">
            {MQ_HEAD.map((w, i) => {
              const wp = easeInOut(clamp01((hr - i * 0.07) / 0.34));
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: "0.26em",
                    opacity: wp,
                    filter: `blur(${(1 - wp) * 10}px)`,
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
          <p className="text-base md:text-lg leading-relaxed mt-6 max-w-md mx-auto">
            {MQ_SUB.map((w, i) => {
              const wp = easeInOut(clamp01((sb - i * 0.03) / 0.3));
              return (
                <span
                  key={i}
                  style={{
                    display: "inline-block",
                    marginRight: "0.24em",
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

        <MarqueeRow reverse />
      </div>

      {/* ---------- MOBILE — marquees + static text ---------- */}
      <div className="lg:hidden py-16 flex flex-col gap-10">
        <MarqueeRow />
        <div className="text-center px-6">
          <h2 className="font-display text-[clamp(34px,9vw,52px)] leading-[1.06] tracking-tight">
            You'll find{" "}
            <em style={{ color: "var(--clay)", fontStyle: "italic" }}>
              every subject
            </em>{" "}
            here.
          </h2>
          <p
            className="text-base leading-relaxed mt-5"
            style={{ color: "var(--ink-2)" }}
          >
            Built with teachers across the UAE — from KG to Grade 12, every
            classroom.
          </p>
        </div>
        <MarqueeRow reverse />
      </div>
    </section>
  );
};

// =====================================================================
// PRODUCT MOCK — the layered hero UI preview
// =====================================================================
const ProductMock = ({ onOpenStudio }) => {
  // Static May 2026 month grid (Mon-start) — mirrors the real Planner.
  const anchor = new Date(2026, 4, 1);
  const today = new Date(2026, 4, 17);
  const todayStart = new Date(2026, 4, 17);
  const sameYMD = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();
  const iso = (d) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate()
    ).padStart(2, "0")}`;
  const offset = (anchor.getDay() - 1 + 7) % 7;
  const start = new Date(2026, 4, 1 - offset);
  let grid = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
  if (grid[35].getMonth() !== anchor.getMonth()) grid = grid.slice(0, 35);

  const COLOR_STYLES = {
    ink: { dot: "bg-ink", chipBg: "bg-ink/[0.06]", chipText: "text-ink" },
    sage: { dot: "bg-sage", chipBg: "bg-sage/[0.10]", chipText: "text-sage" },
    accent: { dot: "bg-accent", chipBg: "bg-accent/[0.08]", chipText: "text-accent" },
    gold: { dot: "bg-gold", chipBg: "bg-gold/[0.10]", chipText: "text-gold" },
    "accent-soft": { dot: "bg-accent-soft", chipBg: "bg-accent-soft/[0.10]", chipText: "text-accent-soft" },
    muted: { dot: "bg-muted", chipBg: "bg-muted/[0.10]", chipText: "text-muted" },
  };
  const CATEGORIES = [
    { key: "lesson-plans", label: "Lesson Plans", icon: BookOpen, color: "ink" },
    { key: "schedule", label: "Schedule", icon: CalendarDays, color: "sage" },
    { key: "quizzes", label: "Quizzes", icon: GraduationCap, color: "accent" },
    { key: "homework", label: "Homework", icon: ClipboardList, color: "gold" },
    { key: "presentations", label: "Presentations", icon: Presentation, color: "accent-soft" },
    { key: "activities", label: "Activities", icon: Sparkles, color: "muted" },
  ];
  const EVENTS = {
    "2026-05-13": [{ kind: "lesson-plans", title: "The Water Cycle" }],
    "2026-05-16": [{ kind: "schedule", title: "The Water Cycle" }],
    "2026-05-17": [
      { kind: "quizzes", title: "Photosynthesis" },
      { kind: "activities", title: "Lab prep" },
    ],
    "2026-05-19": [
      { kind: "schedule", title: "Statistics intro" },
      { kind: "presentations", title: "Presentation" },
    ],
  };
  const weekdayLabels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  const heroChips = [
    { verb: "Generate", noun: "Lesson Plan", icon: BookOpen, color: "accent" },
    { verb: "Create", noun: "Quiz", icon: GraduationCap, color: "sage" },
    { verb: "Build", noun: "Presentation", icon: Layout, color: "accent-soft" },
    { verb: "Plan", noun: "Weekly Schedule", icon: CalendarDays, color: "indigo" },
    { verb: "Analyze", noun: "Students", icon: Users, color: "moss" },
    { verb: "Ask", noun: "Anything", icon: MessageCircle, color: "violet" },
  ];
  const stats = [
    { n: 6, k: "Planned", icon: CalendarDays, iconBg: "bg-ink/[0.08]", iconText: "text-ink" },
    { n: 2, k: "Completed", icon: CheckCircle2, iconBg: "bg-sage/[0.14]", iconText: "text-sage" },
    { n: 4, k: "To do", icon: Clock, iconBg: "bg-accent/[0.12]", iconText: "text-accent" },
  ];
  const upcoming = [
    { m: "MAY", d: "17", t: "Photosynthesis lab" },
    { m: "MAY", d: "17", t: "Quiz · cell respiration" },
    { m: "MAY", d: "19", t: "Statistics introduction" },
    { m: "MAY", d: "19", t: "Term presentation" },
  ];
  const quickActions = [
    { label: "New Lesson Plan", icon: BookOpen, tone: "accent" },
    { label: "New Quiz", icon: ClipboardList, tone: "accent-soft" },
    { label: "New Homework", icon: GraduationCap, tone: "sage" },
    { label: "New Presentation", icon: Presentation, tone: "gold" },
  ];
  const toneToBg = {
    accent: "bg-[rgba(200,71,43,0.12)] text-accent",
    "accent-soft": "bg-[rgba(232,122,85,0.14)] text-accent",
    sage: "bg-[rgba(107,127,90,0.14)] text-sage",
    gold: "bg-[rgba(184,137,61,0.15)] text-gold",
  };

  return (
    <div className="relative">
      {/* Rendered at full desktop scale then uniformly zoomed down so
          the whole faithful layout shrinks together (nothing reflows /
          clips) — like a scaled screenshot. */}
      <div
        className="mudir-studio-frame rounded-2xl overflow-hidden border border-line bg-paper text-ink font-sans flex"
        style={{
          width: 1340,
          height: 830,
          zoom: 0.77,
          boxShadow: "0 40px 100px -25px rgba(26,24,20,0.30)",
        }}
      >
        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="mudir-sidebar w-64 flex flex-col flex-shrink-0 h-full">
          <div className="mudir-sidebar-brand flex items-center gap-3 px-5 pt-6 pb-4 text-left">
            <span className="mudir-sidebar-brand-mark" aria-hidden>
              M
            </span>
            <span className="font-serif text-[1.4rem] font-medium text-ink leading-none">
              Mudir
            </span>
          </div>

          <button
            type="button"
            onClick={onOpenStudio}
            className="mudir-studio-launcher"
            aria-label="Open AI studio"
          >
            <span className="mudir-studio-launcher-head">
              <span className="mudir-studio-launcher-brand">
                <span className="mudir-studio-launcher-icon" aria-hidden>
                  <Sparkles size={15} strokeWidth={2.25} />
                </span>
                <span className="mudir-studio-launcher-title">Studio</span>
              </span>
              <span className="mudir-studio-launcher-pill">AI</span>
            </span>
            <span className="mudir-studio-launcher-body">
              <span className="mudir-studio-launcher-subtitle">
                Your AI co-pilot for teaching
              </span>
              <span className="mudir-studio-launcher-tagline">
                Create · Plan · Inspire
              </span>
            </span>
            <span className="mudir-studio-launcher-cta">
              <span>Open Studio</span>
              <ArrowRight
                size={14}
                strokeWidth={2.25}
                className="mudir-studio-launcher-cta-arrow"
              />
            </span>
          </button>

          <nav className="px-2 flex-1 overflow-hidden pb-3" aria-label="Primary">
            <section className="mudir-sidebar-section">
              <p className="mudir-sidebar-section-label">Planning</p>
              <div className="space-y-0.5 px-1">
                <div className="mudir-sidebar-item mudir-sidebar-item-active">
                  <span className="mudir-sidebar-badge text-base leading-none">▦</span>
                  <span className="truncate flex-1">Planner</span>
                </div>
              </div>
            </section>
            <section className="mudir-sidebar-section">
              <p className="mudir-sidebar-section-label">Teaching</p>
              <div className="space-y-0.5 px-1">
                {[
                  ["L", "Lesson Plans"],
                  ["Q", "Quizzes"],
                  ["H", "Homework"],
                  ["P", "Presentations"],
                  ["A", "Activities"],
                ].map(([badge, label]) => (
                  <div key={badge} className="mudir-sidebar-item">
                    <span className="mudir-sidebar-badge">{badge}</span>
                    <span className="truncate flex-1">{label}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="mudir-sidebar-section">
              <p className="mudir-sidebar-section-label">Data</p>
              <div className="space-y-0.5 px-1">
                <div className="mudir-sidebar-item">
                  <span className="mudir-sidebar-badge">C</span>
                  <span className="truncate flex-1">My students</span>
                </div>
              </div>
            </section>
          </nav>

          <div className="px-4 pb-2 pt-1 flex items-center justify-between">
            <span className="font-mono text-[9.5px] uppercase tracking-[0.16em] text-muted">
              Language
            </span>
            <div
              className="inline-flex items-center rounded-full border border-line bg-paper-cool p-0.5"
              dir="ltr"
            >
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium leading-none bg-ink text-paper-cool">
                EN
              </span>
              <span className="px-2.5 py-1 rounded-full text-[11px] font-medium leading-none text-ink-soft">
                ع
              </span>
            </div>
          </div>

          <div className="mudir-sidebar-account">
            <span className="mudir-sidebar-account-avatar">SA</span>
            <div className="flex-1 min-w-0 text-start">
              <p className="text-sm font-medium leading-tight truncate text-ink">
                Sara
              </p>
              <p className="font-serif italic text-[11px] text-muted mt-0.5">
                Teacher
              </p>
            </div>
            <ChevronRight size={14} className="text-muted flex-shrink-0" />
          </div>
        </aside>

        {/* ── MAIN: PLANNER ───────────────────────────────────────── */}
        <div className="flex-1 min-w-0 h-full flex flex-col">
          <div className="relative flex-1 px-6 py-4 overflow-hidden bg-[#fbf2e6]">
            <div className="planner-view relative max-w-[1400px] mx-auto pb-0 h-full flex flex-col">
              <div className="mb-3">
                <h1 className="font-serif text-3xl md:text-4xl font-semibold text-ink leading-none tracking-tight">
                  May <em className="italic font-medium text-accent">2026</em>
                </h1>
                <p className="font-serif italic text-[13px] text-muted leading-snug mt-1.5">
                  Lesson plans, schedule, quizzes, homework, presentations, and activities — all on one grid.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mb-2 shrink-0">
                <span className="planner-nav-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] font-medium bg-ink text-paper-cool border-ink shadow-sm">
                  <span className="inline-flex h-3.5 w-3.5 rounded items-center justify-center text-[8px] bg-paper-cool/20">
                    ▦
                  </span>
                  All
                </span>
                {CATEGORIES.map((c) => {
                  const Icon = c.icon;
                  const s = COLOR_STYLES[c.color];
                  return (
                    <span
                      key={c.key}
                      className={`planner-nav-btn inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11.5px] ${s.chipBg} ${s.chipText} border-transparent`}
                    >
                      <Icon size={12} strokeWidth={1.75} />
                      {c.label}
                    </span>
                  );
                })}
                <span className="flex-1" />
                <span className="planner-nav-btn inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-accent/30 bg-accent/[0.10] text-accent text-[11.5px] font-semibold shadow-sm">
                  <Plus size={13} strokeWidth={2.5} />
                  Schedule
                </span>
                <span className="planner-nav-btn px-2.5 py-1 rounded-lg border border-line bg-paper-cool font-serif italic text-xs text-ink">
                  Today
                </span>
                <span className="planner-nav-btn h-7 w-7 rounded-lg border border-line bg-paper-cool flex items-center justify-center">
                  <ChevronLeft size={15} />
                </span>
                <span className="planner-nav-btn h-7 w-7 rounded-lg border border-line bg-paper-cool flex items-center justify-center">
                  <ChevronRight size={15} />
                </span>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-[1fr_300px] grid-rows-[auto_1fr] gap-x-6 gap-y-3 items-stretch flex-1 min-h-0">
                <div className="min-w-0">
                  <div className="planner-hero rounded-2xl p-4 md:p-5 relative overflow-hidden h-full flex flex-col justify-center">
                    <div className="relative z-10">
                      <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/[0.10] px-2.5 py-1 text-[11px] font-semibold text-accent mb-2.5">
                        <Sparkles size={11} strokeWidth={2.25} /> Studio AI
                      </p>
                      <h2 className="font-serif text-2xl md:text-[1.55rem] text-ink leading-[1.1] font-semibold tracking-tight">
                        What would you like to{" "}
                        <span className="italic font-medium text-accent">create</span>{" "}
                        today?
                      </h2>
                      <p className="text-[12.5px] text-muted mt-1.5 max-w-xl leading-snug">
                        Your AI co-pilot that helps you plan, save time, and make every class amazing.
                      </p>
                    </div>
                    <div className="relative z-10 mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5">
                      {heroChips.map((c) => {
                        const Icon = c.icon;
                        return (
                          <button
                            key={c.noun}
                            type="button"
                            onClick={onOpenStudio}
                            className="planner-hero-chip group"
                          >
                            <span
                              className={`planner-hero-chip-icon planner-hero-chip-icon-${c.color}`}
                            >
                              <Icon size={13} strokeWidth={2} />
                            </span>
                            <span className="flex flex-col min-w-0 text-start leading-[1.1]">
                              <span className="text-[10.5px] font-semibold text-ink whitespace-nowrap">
                                {c.verb}
                              </span>
                              <span className="text-[9px] text-muted whitespace-nowrap">
                                {c.noun}
                              </span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="min-w-0">
                  <div className="h-full flex flex-col rounded-2xl border border-[#e6dccb] bg-[#fffdf6] p-4 shadow-[0_18px_44px_-22px_rgba(15,20,16,0.14)]">
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <h3 className="font-serif text-[15px] font-medium text-ink leading-tight">
                        This Month Overview
                      </h3>
                      <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted mt-1 whitespace-nowrap">
                        MAY 2026
                      </span>
                    </div>
                    <div className="h-px bg-line/40 mb-3" />
                    <div className="grid grid-cols-3 gap-3">
                      {stats.map((s) => {
                        const Icon = s.icon;
                        return (
                          <div key={s.k}>
                            <span
                              className={`inline-flex h-6 w-6 rounded-md items-center justify-center ${s.iconBg} ${s.iconText} mb-2`}
                            >
                              <Icon size={12} strokeWidth={2.25} />
                            </span>
                            <p className="font-serif text-2xl font-medium text-ink leading-none">
                              {s.n}
                            </p>
                            <p className="text-[11px] text-muted mt-1.5">{s.k}</p>
                          </div>
                        );
                      })}
                    </div>
                    <div className="mt-auto pt-4">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted">
                          Progress
                        </span>
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-sage">
                          <TrendingUp size={11} strokeWidth={2.25} />
                          33%
                        </span>
                      </div>
                      <div className="h-1.5 rounded-full bg-line/40 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-gradient-to-r from-sage to-sage/70"
                          style={{ width: "33%" }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                <div className="min-w-0 min-h-0 flex flex-col">
                  <div className="planner-grid planner-card-frame rounded-2xl bg-paper-cool overflow-hidden flex-1 flex flex-col min-h-0">
                    <div className="grid grid-cols-7 border-b border-line bg-[#fffdf6] flex-shrink-0">
                      {weekdayLabels.map((d) => (
                        <div
                          key={d}
                          className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-muted px-2 py-1.5 text-center"
                        >
                          {d}
                        </div>
                      ))}
                    </div>
                    <div
                      className="grid grid-cols-7 flex-1 auto-rows-fr"
                      style={{ gridTemplateRows: `repeat(${grid.length / 7}, 1fr)` }}
                    >
                      {grid.map((d, i) => {
                        const inMonth = d.getMonth() === anchor.getMonth();
                        const isToday = sameYMD(d, today);
                        const isPast = !isToday && d < todayStart;
                        const dayEvents = (inMonth && EVENTS[iso(d)]) || [];
                        const shown = dayEvents.slice(0, 2);
                        const overflow = dayEvents.length - shown.length;
                        const lastRowStart = grid.length - 7;
                        return (
                          <div
                            key={i}
                            className={`planner-cell border-b border-r border-line/70 px-1.5 pt-1 pb-1 min-h-[60px] flex flex-col gap-0.5 ${
                              inMonth
                                ? isPast
                                  ? "bg-paper-cool/50"
                                  : "bg-paper-cool"
                                : "bg-paper-warm/40 text-muted/60"
                            } ${isToday ? "planner-cell-today" : ""} ${
                              (i + 1) % 7 === 0 ? "border-r-0" : ""
                            } ${i >= lastRowStart ? "border-b-0" : ""}`}
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span
                                className={`font-mono text-[11px] leading-none ${
                                  isToday
                                    ? "h-6 w-6 rounded-full bg-accent text-paper-cool flex items-center justify-center font-medium text-[11.5px]"
                                    : inMonth
                                      ? isPast
                                        ? "text-muted/70"
                                        : "text-ink-soft"
                                      : "text-muted/60"
                                }`}
                              >
                                {d.getDate()}
                              </span>
                              {dayEvents.length > 0 && (
                                <span className="font-mono text-[10px] text-muted">
                                  {dayEvents.length}
                                </span>
                              )}
                            </div>
                            <div
                              className={`flex-1 flex flex-col gap-1 min-h-0 ${
                                isPast ? "opacity-60" : ""
                              }`}
                            >
                              {shown.map((e, ei) => {
                                const cat = CATEGORIES.find((c) => c.key === e.kind);
                                const s = COLOR_STYLES[cat?.color || "ink"];
                                return (
                                  <span
                                    key={ei}
                                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md ${s.chipBg} ${s.chipText} text-[10.5px] leading-tight`}
                                  >
                                    <span
                                      className={`h-1 w-1 flex-shrink-0 rounded-full ${s.dot}`}
                                    />
                                    <span className="truncate">{e.title}</span>
                                  </span>
                                );
                              })}
                              {overflow > 0 && (
                                <span className="font-serif italic text-[10.5px] text-muted px-1.5">
                                  +{overflow} more
                                </span>
                              )}
                            </div>
                            {isToday && (
                              <span className="planner-cell-today-spark" aria-hidden>
                                <Sparkles size={11} strokeWidth={2} />
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                <div className="min-w-0 min-h-0 flex flex-col gap-3">
                  <div className="flex flex-col overflow-hidden flex-1 min-h-0">
                    <div className="flex items-center justify-between mb-2.5">
                      <h3 className="font-serif text-[15px] font-medium text-ink">
                        Upcoming
                      </h3>
                      <span className="text-xs text-accent">View all</span>
                    </div>
                    <div className="flex flex-col gap-2.5">
                      {upcoming.map((e, i) => (
                        <div key={i} className="flex items-center gap-2.5">
                          <div className="flex-shrink-0 rounded-lg bg-paper-warm/60 px-2 py-1 text-center min-w-[44px]">
                            <div className="text-[9px] text-muted tracking-wider uppercase">
                              {e.m}
                            </div>
                            <div className="text-sm font-medium font-serif text-ink leading-none mt-0.5">
                              {e.d}
                            </div>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-[12.5px] font-medium text-ink leading-tight truncate">
                              {e.t}
                            </p>
                            <p className="text-[10.5px] text-muted mt-0.5">All day</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                  <div>
                    <h3 className="font-serif text-[15px] font-medium text-ink mb-2.5">
                      Quick Actions
                    </h3>
                    <div className="flex flex-col gap-2">
                      {quickActions.map((a) => {
                        const Icon = a.icon;
                        return (
                          <button
                            key={a.label}
                            type="button"
                            onClick={onOpenStudio}
                            className="planner-nav-btn w-full flex items-center gap-2.5 px-3 py-2 rounded-xl border border-line/70 bg-paper-cool"
                          >
                            <span
                              className={`flex-shrink-0 inline-flex h-7 w-7 rounded-lg items-center justify-center ${toneToBg[a.tone]}`}
                            >
                              <Icon size={13} strokeWidth={2} />
                            </span>
                            <span className="flex-1 text-left text-[12.5px] font-medium text-ink">
                              {a.label}
                            </span>
                            <Plus size={13} strokeWidth={2} className="text-muted flex-shrink-0" />
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Floating callout — kept per request, restyled to the Studio palette */}
      <div
        className="absolute -bottom-8 -right-4 md:-right-12 rounded-2xl border border-line bg-paper-cool p-4 max-w-[240px] hidden md:block"
        style={{ boxShadow: "0 20px 50px -10px rgba(26,24,20,0.18)" }}
      >
        <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted mb-2">
          Saved this week
        </div>
        <div className="font-serif text-3xl font-semibold text-accent mb-1">
          11h 40m
        </div>
        <div className="font-serif italic text-xs text-muted">
          Average across UAE pilot teachers
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// TEACHER SHOWCASE — interactive desktop feature explorer
// Two flanking columns of feature pills + a centre app preview that
// swaps to match the selected feature (Apploye-style, Mudir palette).
// =====================================================================
const EB = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted";

function Win({ title, children }) {
  return (
    <div className="mudir-studio-frame rounded-2xl overflow-hidden border border-line bg-paper-cool shadow-[0_40px_90px_-30px_rgba(26,24,20,0.32)]">
      <div className="flex items-center gap-2 px-4 py-2.5 border-b border-line bg-[#fffdf6]">
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <span className="h-2.5 w-2.5 rounded-full bg-line" />
        <div className="flex-1 text-center text-[11px] text-muted font-medium">
          {title}
        </div>
      </div>
      <div className="h-[620px] overflow-hidden bg-[#fbf2e6] text-ink px-6 py-5">
        {children}
      </div>
    </div>
  );
}

// Faithful replica of the Studio's shared DataPageHeader (eyebrow +
// serif title with red italic accent + caption + toolbar chips).
function Head({ eyebrow, plain, em, sub, neu }) {
  return (
    <div className="mb-5">
      <div className="mb-3.5">
        <p className={`${EB} mb-2 inline-flex items-center gap-2.5`}>
          <span className="w-6 h-px bg-accent" /> {eyebrow}
        </p>
        <h2 className="font-serif text-[28px] font-medium text-ink leading-tight">
          {plain}
          <em className="italic font-light text-accent">{em}</em>
        </h2>
        <p className="text-muted text-[12.5px] mt-1.5 max-w-2xl">{sub}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[11.5px] border border-line bg-paper-cool text-ink">
          <ArrowUpDown size={11} className="text-muted" /> Newest
        </span>
        <span className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[11.5px] border border-line bg-paper-cool text-ink">
          <Calendar size={11} className="text-muted" /> All time
        </span>
        <span className="h-8 inline-flex items-center gap-1 px-1 rounded-lg border border-line bg-paper-cool">
          <span className="h-6 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11.5px] bg-ink text-paper-cool">
            <LayoutGrid size={11} /> Cards
          </span>
          <span className="h-6 inline-flex items-center gap-1.5 px-2.5 rounded-md text-[11.5px] text-ink">
            <List size={11} /> List
          </span>
        </span>
        <span className="h-8 inline-flex items-center gap-1.5 px-3 rounded-lg text-[11.5px] border border-line bg-paper-cool text-ink">
          <Trash2 size={11} /> Recently deleted
        </span>
        <span className="h-8 ml-auto inline-flex items-center gap-1.5 px-3 rounded-lg text-[11.5px] bg-ink text-paper-cool font-medium border border-ink">
          <Plus size={12} strokeWidth={2.25} /> {neu}
        </span>
      </div>
    </div>
  );
}

function Cnt({ children }) {
  return (
    <p className="font-mono text-[10px] uppercase tracking-[0.15em] text-muted mb-3.5">
      {children}
    </p>
  );
}

function DGrid({ children }) {
  return <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">{children}</div>;
}

// Replica of the Studio's DataCard (status chip, serif title, mono
// meta, dashed-top stat row, pencil + trash in the corner).
function DCard({ status, title, meta, stats }) {
  return (
    <div className="relative rounded-2xl border border-[#e6dccb] bg-paper-cool shadow-[0_18px_44px_-22px_rgba(15,20,16,0.14)] p-4 flex flex-col">
      <div className="absolute top-3 right-3 flex items-center gap-1">
        <span className="h-6 w-6 rounded-md border border-line bg-paper-cool flex items-center justify-center">
          <Pencil size={11} className="text-ink-soft" />
        </span>
        <span className="h-6 w-6 rounded-md border border-line bg-paper-cool flex items-center justify-center text-ink-soft">
          <Trash2 size={11} />
        </span>
      </div>
      <span className="font-mono text-[9px] uppercase tracking-wider px-2 py-0.5 bg-paper border border-line text-ink-soft rounded self-start">
        {status}
      </span>
      <h3 className="font-serif text-[15px] font-medium text-ink leading-snug mt-2 pr-14">
        {title}
      </h3>
      <p className="font-mono text-[9px] uppercase tracking-wider text-muted mt-1">
        {meta}
      </p>
      <div
        className="grid gap-2 mt-2.5 pt-2.5 border-t border-dashed border-line"
        style={{ gridTemplateColumns: `repeat(${stats.length}, minmax(0,1fr))` }}
      >
        {stats.map(([l, v]) => (
          <div key={l} className="min-w-0">
            <p className="font-mono text-[8.5px] uppercase tracking-wider text-muted">
              {l}
            </p>
            <p className="text-[11.5px] text-ink mt-0.5 leading-tight truncate">
              {v}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Lesson Plans — tab bar (Templates library / Drafts) + template
//    cards, mirroring the real /lesson-plans screen.
function PvLesson() {
  const tpl = [
    { status: "Template", title: "Inquiry-led science lesson", meta: "Science · KG–G6", stats: [["Stages", "4"], ["Duration", "50 min"], ["Used", "23×"]] },
    { status: "Template", title: "Exam revision carousel", meta: "Any · G7–G12", stats: [["Stages", "5"], ["Duration", "45 min"], ["Used", "61×"]] },
    { status: "Template", title: "Lab practical write-up", meta: "Science · G7–G12", stats: [["Stages", "3"], ["Duration", "60 min"], ["Used", "12×"]] },
    { status: "Template", title: "Reading circle", meta: "English · G3–G9", stats: [["Stages", "4"], ["Duration", "40 min"], ["Used", "38×"]] },
  ];
  return (
    <div>
      <div className="flex items-center gap-2 border-b border-line mb-5">
        <span className="px-4 py-2 font-mono text-[11px] uppercase tracking-[0.15em] border-b-2 border-accent text-ink">
          Templates library
        </span>
      </div>
      <Head
        eyebrow="Templates"
        plain="Templates "
        em="library"
        sub="Pick a starting point. Edit it once, reuse it forever."
        neu="New template"
      />
      <Cnt>4 templates</Cnt>
      <DGrid>
        {tpl.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvQuiz() {
  const items = [
    { status: "Scheduled", title: "Cell respiration · check", meta: "Science · G7 · 7B", stats: [["Marks", "20"], ["Duration", "15 min"], ["Scheduled", "May 19"]] },
    { status: "Draft", title: "Photosynthesis end-of-unit", meta: "Science · G7 · 7A", stats: [["Marks", "40"], ["Duration", "45 min"], ["Scheduled", "—"]] },
    { status: "Graded", title: "Genetics mid-term", meta: "Science · G10 · 10D", stats: [["Marks", "60"], ["Duration", "60 min"], ["Scheduled", "May 8"]] },
    { status: "Scheduled", title: "States of matter quiz", meta: "Science · G8 · 8B", stats: [["Marks", "15"], ["Duration", "12 min"], ["Scheduled", "May 22"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Quizzes & exams"
        plain="Quizzes & "
        em="exams"
        sub="Build, schedule, and grade. MCQ, true/false, short, and essay."
        neu="New quiz"
      />
      <Cnt>4 quizzes &amp; exams</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvHomework() {
  const items = [
    { status: "Open", title: "Worksheet 4 — leaf structure", meta: "Science · G7 · 7A", stats: [["Due", "May 21"], ["Section", "7A"]] },
    { status: "Graded", title: "Balancing equations set", meta: "Science · G9 · 9C", stats: [["Due", "May 12"], ["Section", "9C"]] },
    { status: "Open", title: "Reading log — chapters 4–6", meta: "English · G5 · 5B", stats: [["Due", "May 24"], ["Section", "5B"]] },
    { status: "Open", title: "Practice problems · fractions", meta: "Maths · G5 · 5B", stats: [["Due", "May 20"], ["Section", "5B"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Homework"
        plain=""
        em="Homework"
        sub="Assign work to a class, track who's done it, grade and give feedback."
        neu="New homework"
      />
      <Cnt>4 homework tasks</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvPresentation() {
  const items = [
    { status: "Ready", title: "Photosynthesis — how leaves work", meta: "Science · G7 · 7A", stats: [["Slides", "12"], ["Linked", "Lesson 4"]] },
    { status: "Draft", title: "Cell respiration overview", meta: "Science · G7 · 7B", stats: [["Slides", "9"], ["Linked", "—"]] },
    { status: "Ready", title: "Romeo & Juliet — Act 1", meta: "English · G10 · 10D", stats: [["Slides", "16"], ["Linked", "Lesson 2"]] },
    { status: "Ready", title: "Intro to statistics", meta: "Maths · G9 · 9C", stats: [["Slides", "11"], ["Linked", "Lesson 7"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Presentations"
        plain="Slide "
        em="decks"
        sub="Build slide-based presentations linked to your lessons."
        neu="New presentation"
      />
      <Cnt>4 presentations</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvActivities() {
  const items = [
    { status: "Pair work", title: "Sort the light-reaction cards", meta: "Science · G7 · 7A", stats: [["Time", "10 min"], ["Materials", "Card set"]] },
    { status: "Group task", title: "Build a leaf cross-section poster", meta: "Science · G7 · 7A", stats: [["Time", "20 min"], ["Materials", "A3 + pens"]] },
    { status: "Individual", title: "Label-the-diagram worksheet", meta: "Science · G7 · 7B", stats: [["Time", "10 min"], ["Materials", "Printable"]] },
    { status: "Group task", title: "Debate: is fusion worth it?", meta: "Science · G10 · 10D", stats: [["Time", "25 min"], ["Materials", "Prompt"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Activities"
        plain="Classroom "
        em="activities"
        sub="Pair-work, group tasks, individual exercises — with materials and timing."
        neu="New activity"
      />
      <Cnt>4 activities</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

function PvTemplates() {
  const items = [
    { status: "Template", title: "Inquiry-led science lesson", meta: "Science · KG–G6", stats: [["Stages", "4"], ["Duration", "50 min"], ["Used", "23×"]] },
    { status: "Template", title: "Exam revision carousel", meta: "Any · G7–G12", stats: [["Stages", "5"], ["Duration", "45 min"], ["Used", "61×"]] },
    { status: "Template", title: "Reading circle", meta: "English · G3–G9", stats: [["Stages", "4"], ["Duration", "40 min"], ["Used", "38×"]] },
    { status: "Template", title: "Problem-set practice", meta: "Maths · G6–G12", stats: [["Stages", "3"], ["Duration", "35 min"], ["Used", "47×"]] },
  ];
  return (
    <div>
      <Head
        eyebrow="Templates"
        plain="Templates "
        em="library"
        sub="Pick a starting point. Edit it once, reuse it forever."
        neu="New template"
      />
      <Cnt>4 templates</Cnt>
      <DGrid>
        {items.map((c) => (
          <DCard key={c.title} {...c} />
        ))}
      </DGrid>
    </div>
  );
}

// ── Weekly Schedule — mirrors the Planner/Schedule grid chrome.
function PvSchedule() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri"];
  const grid = {
    Mon: ["7A · Biology", "", "9C · Chemistry"],
    Tue: ["", "8B · Biology", ""],
    Wed: ["7A · Biology", "10D · English", ""],
    Thu: ["", "9C · Chemistry", "Lab prep"],
    Fri: ["8B · Biology", "", "7A · Quiz"],
  };
  return (
    <div>
      <h2 className="font-serif text-[28px] font-medium text-ink leading-none tracking-tight mb-1">
        Week of <em className="italic font-medium text-accent">17 May</em>
      </h2>
      <p className="font-serif italic text-[12.5px] text-muted mb-4">
        Your teaching week — periods, classes, and prep at a glance.
      </p>
      <div className="grid grid-cols-5 gap-2">
        {days.map((d) => (
          <div key={d} className="text-center">
            <div className={`${EB} mb-2`}>{d}</div>
            <div className="flex flex-col gap-2">
              {grid[d].map((c, i) => (
                <div
                  key={i}
                  className={`h-[92px] rounded-lg border text-[11px] p-2 flex items-start ${
                    c
                      ? "border-accent/30 bg-accent/[0.07] text-accent font-medium"
                      : "border-line/70 bg-paper-cool text-transparent"
                  }`}
                >
                  {c || "·"}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Worksheets — the differentiated set the Studio produces.
function PvWorksheets() {
  const levels = [
    ["Level 1", "Foundation", "8 questions", "from-sage/15"],
    ["Level 2", "Core", "10 questions", "from-accent/15"],
    ["Level 3", "Extension", "12 questions", "from-gold/15"],
  ];
  return (
    <div>
      <p className={`${EB} mb-2 inline-flex items-center gap-2.5`}>
        <span className="w-6 h-px bg-accent" /> Worksheets
      </p>
      <h2 className="font-serif text-[28px] font-medium text-ink leading-tight">
        One topic, <em className="italic font-light text-accent">three levels</em>
      </h2>
      <p className="text-muted text-[12.5px] mt-1.5 mb-5">
        Photosynthesis · differentiated · printable PDF + answer key.
      </p>
      <div className="grid grid-cols-3 gap-4">
        {levels.map(([l, d, n, g]) => (
          <div
            key={l}
            className={`rounded-2xl border border-line bg-gradient-to-b ${g} to-transparent p-5 h-[250px] flex flex-col`}
          >
            <p className={`${EB} mb-2`}>{l}</p>
            <p className="font-serif text-xl font-medium mb-1">{d}</p>
            <p className="text-[12px] text-muted">{n}</p>
            <div className="mt-auto flex flex-col gap-1.5">
              <span className="h-2 rounded bg-line/50" />
              <span className="h-2 rounded bg-line/50 w-4/5" />
              <span className="h-2 rounded bg-line/50 w-3/5" />
            </div>
            <span className="mt-3 text-[11px] font-mono px-2 py-1 rounded bg-paper-cool border border-line text-muted self-start">
              PDF + key
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// A single Mudir "slide" — a real deck slide: tinted cover + SlideArt.
function GallerySlide({ bg, art, tx, eyebrow, title }) {
  return (
    <div
      className="relative h-full w-full rounded-2xl overflow-hidden flex flex-col p-4"
      style={{ background: bg, color: tx }}
    >
      <span
        className="font-mono text-[9px] uppercase tracking-[0.18em]"
        style={{ color: art }}
      >
        {eyebrow}
      </span>
      <h4 className="font-display text-[17px] leading-tight mt-1.5 pr-6">
        {title}
      </h4>
      <span
        className="mt-2 h-[3px] w-8 rounded-full"
        style={{ background: art }}
      />
      <div className="absolute right-0 bottom-0 w-[64%] h-[56%] opacity-90">
        <SlideArt stroke={art} fill={art} full />
      </div>
    </div>
  );
}

// A single Mudir Studio document card — real /lessons · /quizzes etc.
function GalleryDoc({ k, title, meta, tag, tone }) {
  const dot =
    { sage: "var(--sage)", accent: "var(--clay)", gold: "#C99A4B", soft: "#B5754E" }[
      tone
    ] || "var(--clay)";
  return (
    <div
      className="relative h-full w-full rounded-2xl overflow-hidden flex flex-col p-4 border"
      style={{ background: "#fffdf6", borderColor: "var(--line)", color: "var(--ink)" }}
    >
      <span
        className="font-mono text-[9px] uppercase tracking-[0.16em] px-1.5 py-0.5 rounded self-start"
        style={{ background: "var(--paper-2)", color: "var(--ink-3)" }}
      >
        {k}
      </span>
      <h4 className="font-display text-[16px] leading-snug mt-2.5 line-clamp-2">
        {title}
      </h4>
      <span
        className="font-mono text-[9px] uppercase tracking-wider mt-1.5"
        style={{ color: "var(--ink-3)" }}
      >
        {meta}
      </span>
      <div
        className="mt-auto pt-3 border-t border-dashed flex items-center gap-1.5"
        style={{ borderColor: "var(--line)" }}
      >
        <span
          className="h-1 w-1 rounded-full"
          style={{ background: dot }}
        />
        <span className="text-[11px]" style={{ color: "var(--ink-2)" }}>
          {tag}
        </span>
      </div>
    </div>
  );
}

const GALLERY_TILES = [
  { t: "slide", bg: "#1e3a44", art: "#7fc6c0", tx: "#eaf3f4", eyebrow: "G4 · Science", title: "The Water Cycle" },
  { t: "doc", k: "Lesson plan", title: "Photosynthesis — how leaves work", meta: "Science · G7 · 7A", tag: "50 min · 4 stages", tone: "sage" },
  { t: "slide", bg: "#5f7256", art: "#f0d9a8", tx: "#f8f5ec", eyebrow: "G7 · Science", title: "Photosynthesis" },
  { t: "doc", k: "Quiz", title: "Cell respiration check", meta: "Science · G7 · 7B", tag: "20 marks · auto-graded", tone: "accent" },
  { t: "slide", bg: "#b3442b", art: "#ffe6d2", tx: "#fbefe9", eyebrow: "G10 · English", title: "Romeo & Juliet — Act 1" },
  { t: "doc", k: "Homework", title: "Worksheet 4 — leaf structure", meta: "Science · 7A", tag: "Due May 21", tone: "gold" },
  { t: "slide", bg: "#3a2740", art: "#d39bd0", tx: "#f4e9f3", eyebrow: "G9 · Maths", title: "Intro to Statistics" },
  // index 7 — featured centre
  { t: "slide", bg: "#1e3a44", art: "#7fc6c0", tx: "#eaf3f4", eyebrow: "Grade 4 · Science", title: "The Water Cycle" },
  { t: "doc", k: "Activity", title: "Group debate: is fusion worth it?", meta: "Science · G10 · 10D", tag: "25 min · groups", tone: "soft" },
  { t: "slide", bg: "#dce8ee", art: "#2f7d95", tx: "#1e3a44", eyebrow: "G8 · Science", title: "States of Matter" },
  { t: "doc", k: "Template", title: "Inquiry-led science lesson", meta: "Science · KG–G6", tag: "Used 23×", tone: "sage" },
  { t: "slide", bg: "#243027", art: "#9bc48a", tx: "#eaf3e6", eyebrow: "G6 · Science", title: "Plant Life Cycles" },
  { t: "doc", k: "Worksheet", title: "Photosynthesis · differentiated", meta: "3 levels", tag: "8 / 10 / 12 Qs", tone: "gold" },
  { t: "slide", bg: "#2A1F17", art: "#E3B23C", tx: "#f4efe4", eyebrow: "G5 · Maths", title: "Fractions in Action" },
  { t: "doc", k: "Presentation", title: "Cell respiration overview", meta: "Science · G7 · 7B", tag: "9 slides", tone: "accent" },
];

// ---- Gallery stage geometry (logical px, scaled to fit) -------------
const G_TILE_W = 152;
const G_TILE_H = 190;
const G_COL_DX = 178; // column pitch
const G_ROW_DY = 216; // row pitch
const G_V_OFF = [-36, 28, 0, 28, -36]; // per-column V scatter (by col+2)
const G_FEAT_W = 320;
const G_FEAT_H = 400;
const G_DESIGN_W = 1000;
const G_DESIGN_H = 780;

// 5×3 cells minus the centre (which the featured card occupies). Order
// rings inner→outer so the inner tiles emerge from behind the card
// first as it grows, then the corners fan out.
const G_CELLS = (() => {
  const list = [];
  for (let row = -1; row <= 1; row++) {
    for (let col = -2; col <= 2; col++) {
      if (row === 0 && col === 0) continue;
      list.push({
        col,
        row,
        fx: col * G_COL_DX,
        fy: row * G_ROW_DY + G_V_OFF[col + 2],
        ring: Math.max(Math.abs(col), Math.abs(row)),
      });
    }
  }
  return list.sort((a, b) => a.ring - b.ring);
})();

const GalleryTileFace = ({ tile }) =>
  tile.t === "slide" ? <GallerySlide {...tile} /> : <GalleryDoc {...tile} />;

// Pinned, scroll-scrubbed reveal: an app-dock whose centre icon grows
// into the big featured card while the small tiles fan out from behind
// it into the scattered grid, then the overlays fade in.
const TeacherShowcase = () => {
  const trackRef = useRef(null);
  const stageWrapRef = useRef(null);
  const [q, setQ] = useState(0);
  const [scale, setScale] = useState(1);

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
        setQ(span > 0 ? Math.min(1, Math.max(0, -r.top / span)) : 0);
      });
    };
    const onResize = () => {
      const w = stageWrapRef.current?.clientWidth || G_DESIGN_W;
      setScale(Math.min(1, Math.max(0.42, w / G_DESIGN_W)));
      onScroll();
    };
    onResize();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onResize);
      if (raf) cancelAnimationFrame(raf);
    };
  }, []);

  const featured = GALLERY_TILES[7];
  const smalls = GALLERY_TILES.filter((_, i) => i !== 7);

  // Timeline — the big card starts fully below the section and slides
  // straight up into the centre as you scroll (no fade — it travels in),
  // shrinking a touch while the small tiles fan out from behind it.
  const enter = easeInOut(seg(q, 0.0, 0.46)); // rises ↑ from below
  const appear = easeInOut(seg(q, 0.74, 0.96)); // overlays settle
  const featSc = lerp(2.2, 1, enter); // very big → final
  const featY = lerp(470, 0, enter); // already in view low → centred

  return (
    <section
      id="features"
      ref={trackRef}
      className="relative min-h-screen lg:h-[210vh]"
    >
      {/* Desktop — pinned choreography */}
      <div
        ref={stageWrapRef}
        className="hidden lg:flex lg:sticky lg:top-0 lg:h-screen overflow-hidden items-center justify-center"
      >
        <div
          className="relative"
          style={{
            width: G_DESIGN_W,
            height: G_DESIGN_H,
            transform: `scale(${scale})`,
          }}
        >
          {/* Small tiles — fan out from behind the card */}
          {G_CELLS.map((c, i) => {
            const tile = smalls[i % smalls.length];
            const delay =
              0.3 + (c.ring - 1) * 0.12 + (i % 5) * 0.015;
            const ti = easeInOut(clamp01((q - delay) / 0.34));
            const s = lerp(0.28, 1, ti);
            return (
              <div
                key={i}
                className="absolute left-1/2 top-1/2 rounded-2xl overflow-hidden shadow-[0_26px_56px_-30px_rgba(26,24,20,0.45)]"
                style={{
                  width: G_TILE_W,
                  height: G_TILE_H,
                  marginLeft: -G_TILE_W / 2,
                  marginTop: -G_TILE_H / 2,
                  transform: `translate(${c.fx * ti}px, ${c.fy * ti}px) scale(${s})`,
                  opacity: clamp01(ti / 0.45),
                  zIndex: 10 + c.ring,
                  willChange: "transform, opacity",
                }}
              >
                <GalleryTileFace tile={tile} />
              </div>
            );
          })}

          {/* Featured card — rises very large from below, shrinks to
              its final size as the small tiles spread from behind it */}
          <div
            className="absolute left-1/2 top-1/2"
            style={{
              width: G_FEAT_W,
              height: G_FEAT_H,
              marginLeft: -G_FEAT_W / 2,
              marginTop: -G_FEAT_H / 2,
              transform: `translateY(${featY}px) scale(${featSc})`,
              opacity: 1,
              zIndex: 30,
              willChange: "transform, opacity",
            }}
          >
            <div className="relative h-full w-full rounded-[26px] overflow-hidden shadow-[0_60px_110px_-30px_rgba(26,24,20,0.6)] ring-1 ring-black/5">
              <GalleryTileFace tile={featured} />
            </div>
            {/* Overlays settle once the card is full size */}
            <div
              style={{
                opacity: appear,
                transform: `translateY(${(1 - appear) * 10}px)`,
              }}
            >
              <Bubble
                label="@mudir"
                bg="var(--clay)"
                style={{ top: 54, left: -14, zIndex: 40 }}
              />
              <span
                className="absolute flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-paper-cool text-ink text-[12px] font-semibold"
                style={{
                  top: 16,
                  right: 16,
                  zIndex: 40,
                  boxShadow: "0 12px 24px -12px rgba(26,24,20,0.4)",
                }}
              >
                <Sparkles size={12} className="text-accent" /> Open in Studio
              </span>
              <div
                className="absolute flex items-center gap-2.5 px-3 py-2 rounded-2xl bg-paper-cool"
                style={{
                  left: 16,
                  bottom: 16,
                  zIndex: 40,
                  boxShadow: "0 14px 28px -14px rgba(26,24,20,0.45)",
                }}
              >
                <span className="h-8 w-8 rounded-xl bg-accent/15 text-accent flex items-center justify-center">
                  <BookOpen size={15} />
                </span>
                <span className="leading-tight">
                  <span className="block text-[12.5px] font-semibold text-ink">
                    The Water Cycle
                  </span>
                  <span className="block text-[10.5px] text-muted">
                    Drafted by Mudir
                  </span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Mobile / tablet — static scattered grid */}
      <div className="lg:hidden py-20 px-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-w-[680px] mx-auto">
          {GALLERY_TILES.map((tile, i) => (
            <div
              key={i}
              className={`aspect-[4/5] rounded-2xl overflow-hidden shadow-[0_22px_50px_-30px_rgba(26,24,20,0.4)] ${
                i === 7 ? "ring-1 ring-accent/30" : ""
              } ${i % 2 === 1 ? "translate-y-5" : ""}`}
            >
              <GalleryTileFace tile={tile} />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// WORKFLOW MINI-DEMOS — small looping "screens" that replace the prose
// in each teacher card: a deck building, a quiz generating, a week of
// plans filling in. Each runs its own rAF loop, only while on screen,
// and freezes on its final frame for reduced-motion.
// =====================================================================
function useLoop(period) {
  const [p, setP] = useState(0);
  const ref = useRef(null);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setP(1);
      return undefined;
    }
    const el = ref.current;
    let raf = 0;
    let last = 0;
    let acc = 0;
    // Stays paused on its first frame until the card is actually
    // scrolled into view — the demo "plays when you reach it".
    let vis = false;
    let io;
    if (el && "IntersectionObserver" in window) {
      io = new IntersectionObserver(
        ([e]) => {
          vis = e.isIntersecting;
          if (!vis) {
            // Left the section — rewind so it replays from the
            // beginning the next time it's scrolled back into view.
            acc = 0;
            setP(0);
          }
        },
        { threshold: 0.25 }
      );
      io.observe(el);
    } else {
      vis = true;
    }
    const tick = (now) => {
      if (last && vis) {
        acc = (acc + (now - last)) % period;
        setP(acc / period);
      }
      last = now;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      if (io) io.disconnect();
    };
  }, [period]);
  return [ref, p];
}

// Just the media block now — the WorkflowCard around it owns the
// rounded border / shadow so the demo sits *inside* one card.
function MiniWin({ label, chip, ChipIcon, refProp, children }) {
  return (
    <div ref={refProp} className="border-b border-line">
      <div className="flex items-center gap-1.5 px-3 py-2 border-b border-line bg-[#fffdf6]">
        <span className="h-1.5 w-1.5 rounded-full bg-line" />
        <span className="h-1.5 w-1.5 rounded-full bg-line" />
        <span className="h-1.5 w-1.5 rounded-full bg-line" />
        <span className="ml-1 font-mono text-[9px] uppercase tracking-[0.16em] text-muted">
          {label}
        </span>
      </div>
      <div className="h-[212px] bg-[#fbf2e6] px-4 py-3.5 overflow-hidden">
        <div className="flex h-full flex-col">
          <div className="flex items-center gap-2 mb-3 flex-shrink-0">
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md border border-line bg-paper-cool text-[10px] text-ink">
              <ChipIcon size={10} className="text-accent" /> {chip}
            </span>
          </div>
          {children}
        </div>
      </div>
    </div>
  );
}

function MiniStatus({ show, children }) {
  return (
    <div
      className="mt-3 flex items-center gap-1.5 text-[10px] flex-shrink-0"
      style={{ opacity: show }}
    >
      <CheckCircle2 size={11} className="text-sage" />
      <span className="text-ink-soft">{children}</span>
    </div>
  );
}

// Page-wide entrance motion is intentionally stubbed out (see top of
// file). This is a small, self-contained slide-up reveal *only* for the
// workflow cards: each starts lower and transparent, then slides up and
// fades in once as it's scrolled into view, and stays — so they appear
// one by one as you scroll down.
function CardReveal({ children, className = "" }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setShown(true);
      return undefined;
    }
    const el = ref.current;
    if (!el || !("IntersectionObserver" in window)) {
      setShown(true);
      return undefined;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setShown(true);
          io.disconnect(); // one-shot — it stays once revealed
        }
      },
      { threshold: 0.15, rootMargin: "0px 0px -10% 0px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <div
      ref={ref}
      className={className}
      style={{
        opacity: shown ? 1 : 0,
        transform: shown ? "translateY(0)" : "translateY(44px)",
        transition:
          "opacity 0.7s cubic-bezier(0.22,1,0.36,1), transform 0.7s cubic-bezier(0.22,1,0.36,1)",
        willChange: "opacity, transform",
      }}
    >
      {children}
    </div>
  );
}

const DECK_THUMBS = [
  { bg: "#1e3a44", art: "#7fc6c0" },
  { bg: "#dce8ee", art: "#2f7d95" },
  { bg: "#5f7256", art: "#f0d9a8" },
  { bg: "#fffdf6", art: "#c8472b" },
  { bg: "#f0d79a", art: "#b3442b" },
  { bg: "#b3442b", art: "#ffe6d2" },
  { bg: "#3a2740", art: "#d39bd0" },
  { bg: "#243027", art: "#9bc48a" },
];

// Mariam — describe a deck, Mudir builds the slides.
function MiniDeck() {
  const [ref, p] = useLoop(7200);
  const PROMPT = "8-slide deck · the water cycle · G4";
  const typed = PROMPT.slice(0, Math.round(seg(p, 0.02, 0.16) * PROMPT.length));
  const built = seg(p, 0.22, 0.64);
  return (
    <MiniWin
      refProp={ref}
      label="studio · presentation"
      chip="Presentation"
      ChipIcon={Layers}
    >
      <div className="font-mono text-[10px] text-ink-soft mb-3 h-[14px] truncate flex-shrink-0">
        {typed}
        {p < 0.16 && (
          <span className="inline-block w-px h-[1em] align-[-1px] bg-accent ml-px animate-pulse" />
        )}
      </div>
      <div className="grid grid-cols-4 grid-rows-2 gap-1.5 flex-1 min-h-0">
        {DECK_THUMBS.map((s, i) => {
          const a = clamp01((built - i * 0.08) / 0.2);
          return (
            <div
              key={i}
              className="relative rounded-md overflow-hidden border border-line"
              style={{
                background: s.bg,
                opacity: a,
                transform: `scale(${lerp(0.84, 1, a)})`,
              }}
            >
              <SlideArt stroke={s.art} fill={s.art} full />
            </div>
          );
        })}
      </div>
      <MiniStatus show={clamp01((p - 0.66) / 0.06)}>
        Deck ready · 8 slides
      </MiniStatus>
    </MiniWin>
  );
}

// Salma — a formative quiz drafts itself, Bloom-tagged & auto-graded.
function MiniQuiz() {
  const [ref, p] = useLoop(7200);
  const Q = [
    { n: "Q1", t: "Which organelle releases energy?", tag: "MCQ" },
    { n: "Q2", t: "Aerobic respiration needs oxygen.", tag: "True / False" },
    { n: "Q3", t: "Word equation for respiration?", tag: "Short" },
  ];
  const built = seg(p, 0.1, 0.62);
  return (
    <MiniWin
      refProp={ref}
      label="studio · quiz"
      chip="Quiz · Grade 7"
      ChipIcon={GraduationCap}
    >
      <div className="flex flex-col gap-1.5 flex-1 min-h-0">
        {Q.map((q, i) => {
          const a = clamp01((built - i * 0.2) / 0.22);
          const graded = clamp01((built - i * 0.2 - 0.14) / 0.12);
          return (
            <div
              key={q.n}
              className="flex items-center gap-2 px-2.5 py-2 rounded-lg border border-line/70 bg-paper-cool"
              style={{ opacity: a, transform: `translateY(${(1 - a) * 6}px)` }}
            >
              <span className="font-mono text-[9px] text-accent flex-shrink-0">
                {q.n}
              </span>
              <span className="text-[11px] text-ink-soft truncate flex-1">
                {q.t}
              </span>
              <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-paper border border-line text-muted flex-shrink-0">
                {q.tag}
              </span>
              <CheckCircle2
                size={12}
                className="text-sage flex-shrink-0"
                style={{ opacity: graded }}
              />
            </div>
          );
        })}
      </div>
      <MiniStatus show={clamp01((p - 0.64) / 0.06)}>
        Bloom-tagged · auto-graded
      </MiniStatus>
    </MiniWin>
  );
}

// Noura — homework set, collected and graded itself (real /homework
// content: a Studio worksheet task + auto-marked submissions).
function MiniHomework() {
  const [ref, p] = useLoop(7200);
  const subs = [
    { who: "Ahmed K.", score: "18 / 20" },
    { who: "Lina M.", score: "20 / 20" },
    { who: "Omar S.", score: "16 / 20" },
    { who: "Sara H.", score: "19 / 20" },
  ];
  const built = seg(p, 0.12, 0.66);
  return (
    <MiniWin
      refProp={ref}
      label="studio · homework"
      chip="Homework · 7A"
      ChipIcon={ClipboardList}
    >
      <div className="rounded-lg border border-line/70 bg-paper-cool px-3 py-2 mb-2 flex items-center justify-between gap-2 flex-shrink-0">
        <span className="text-[11px] text-ink truncate">
          Worksheet 4 — leaf structure
        </span>
        <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-paper border border-line text-muted flex-shrink-0">
          Due May 21
        </span>
      </div>
      <div className="flex flex-col gap-1.5 flex-1 min-h-0">
        {subs.map((s, i) => {
          const a = clamp01((built - i * 0.16) / 0.2);
          const graded = clamp01((built - i * 0.16 - 0.12) / 0.12);
          return (
            <div
              key={s.who}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-line/70 bg-paper-cool flex-1"
              style={{ opacity: a, transform: `translateY(${(1 - a) * 6}px)` }}
            >
              <span className="text-[11px] text-ink-soft flex-1 truncate">
                {s.who}
              </span>
              <span
                className="font-mono text-[9px] text-ink"
                style={{ opacity: graded }}
              >
                {s.score}
              </span>
              <CheckCircle2
                size={12}
                className="text-sage flex-shrink-0"
                style={{ opacity: graded }}
              />
            </div>
          );
        })}
      </div>
      <MiniStatus show={clamp01((p - 0.66) / 0.06)}>
        Auto-graded · feedback added
      </MiniStatus>
    </MiniWin>
  );
}

// Ibrahim — a timed lesson plan, drafted and MoE-aligned (the real
// Studio lesson-plan stage breakdown).
function MiniLessonPlan() {
  const [ref, p] = useLoop(7200);
  const stages = [
    { t: "00–05", s: "Starter — recall prior" },
    { t: "05–15", s: "Hook — leaf demo" },
    { t: "15–35", s: "Guided worksheet" },
    { t: "35–45", s: "Discussion" },
    { t: "45–50", s: "Exit ticket" },
  ];
  const built = seg(p, 0.1, 0.66);
  return (
    <MiniWin
      refProp={ref}
      label="studio · lesson plan"
      chip="Photosynthesis · G7"
      ChipIcon={BookOpen}
    >
      <div className="flex flex-col gap-1.5 flex-1 min-h-0">
        {stages.map((st, i) => {
          const a = clamp01((built - i * 0.13) / 0.18);
          const done = clamp01((built - i * 0.13 - 0.1) / 0.1);
          return (
            <div
              key={st.t}
              className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg border border-line/70 bg-paper-cool flex-1"
              style={{ opacity: a, transform: `translateY(${(1 - a) * 6}px)` }}
            >
              <span className="font-mono text-[8.5px] text-accent flex-shrink-0 w-9">
                {st.t}
              </span>
              <span className="text-[11px] text-ink-soft flex-1 truncate">
                {st.s}
              </span>
              <CheckCircle2
                size={12}
                className="text-sage flex-shrink-0"
                style={{ opacity: done }}
              />
            </div>
          );
        })}
      </div>
      <MiniStatus show={clamp01((p - 0.66) / 0.06)}>
        Timed · MoE-aligned
      </MiniStatus>
    </MiniWin>
  );
}

const WORKFLOW_DEMOS = {
  deck: MiniDeck,
  quiz: MiniQuiz,
  homework: MiniHomework,
  lesson: MiniLessonPlan,
};

// =====================================================================
// WORKFLOW — How it works
// =====================================================================
const Workflow = () => {
  const steps = [
    {
      n: "01",
      label: "Mariam",
      title: "A full slide deck, in twenty seconds.",
      demo: "deck",
      tag: "20 min → 20 sec",
    },
    {
      n: "02",
      label: "Salma",
      title: "A formative quiz, ready before the bell.",
      demo: "quiz",
      tag: "Quiz in under a minute",
    },
    {
      n: "03",
      label: "Noura",
      title: "Homework, marked before home time.",
      demo: "homework",
      tag: "Graded the moment it's in",
    },
    {
      n: "04",
      label: "Ibrahim",
      title: "Next week's lessons, already planned.",
      demo: "lesson",
      tag: "A week of plans in minutes",
    },
  ];

  return (
    <section
      id="workflow"
      className="snap-stop py-24 md:py-36"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="max-w-2xl mb-24">
          <Reveal>
            <div className="eyebrow mb-6">From real classrooms</div>
            <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight mb-6">
              Real teachers.
              <br />
              Real time back.
            </h2>
            <p
              className="text-xl leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              Four teachers, four tasks that used to eat their evenings —
              now drafted by Mudir in the time it takes to read this.
            </p>
          </Reveal>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-10 lg:gap-x-14 gap-y-14">
          {steps.map((s, i) => {
            const Demo = WORKFLOW_DEMOS[s.demo];
            return (
              <div
                key={i}
                className={i % 2 === 1 ? "md:translate-y-24" : ""}
              >
                <CardReveal className="h-full">
                  <div className="rounded-2xl overflow-hidden border border-line bg-paper-cool shadow-[0_28px_64px_-36px_rgba(26,24,20,0.36)] flex flex-col h-full">
                    <Demo />
                    <div className="px-5 py-5 flex flex-col flex-1">
                      <div className="flex items-baseline gap-3 mb-3">
                        <span
                          className="font-mono text-xs"
                          style={{ color: "var(--clay)" }}
                        >
                          {s.n}
                        </span>
                        <span className="eyebrow">{s.label}</span>
                      </div>
                      <h3 className="font-display text-2xl md:text-[26px] leading-tight text-balance mb-4 min-h-[3.25rem] md:min-h-[3.75rem]">
                        {s.title}
                      </h3>
                      <div
                        className="mt-auto inline-flex self-start items-center gap-2 text-xs font-mono px-2.5 py-1 rounded"
                        style={{
                          background: "var(--paper-2)",
                          color: "var(--ink-2)",
                        }}
                      >
                        <div
                          className="w-1 h-1 rounded-full"
                          style={{ background: "var(--sage)" }}
                        />
                        {s.tag}
                      </div>
                    </div>
                  </div>
                </CardReveal>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// STUDIO FLOW — auto-playing walkthrough of the real presentation
// pipeline: open Studio AI from the Planner → describe the deck →
// Mudir builds it → the finished slides. Content is the real Studio
// (presentation sample, "Slide-by-slide outline", "Make it", the
// SlideBuilder ocean theme).
// =====================================================================

// Step 1 — the Planner's Studio AI hero card, "Build / Presentation"
// chip spotlighted with a cursor cue.
function FlowPlanner() {
  const chips = [
    { label: "Lesson Plans", icon: BookOpen, color: "accent" },
    { label: "Quizzes", icon: GraduationCap, color: "sage" },
    { label: "Homework", icon: ClipboardList, color: "indigo" },
    { label: "Presentations", icon: Presentation, color: "accent-soft", hot: true },
    { label: "Activities", icon: Sparkles, color: "violet" },
  ];
  return (
    <div className="planner-hero rounded-2xl p-5 md:p-6 relative overflow-hidden h-full flex flex-col justify-center">
      <div className="relative z-10">
        <p className="inline-flex items-center gap-1.5 rounded-full bg-accent/[0.10] px-2.5 py-1 text-[12px] font-semibold text-accent mb-3">
          <Sparkles size={12} strokeWidth={2.25} /> Studio AI
        </p>
        <h2 className="font-serif text-3xl text-ink leading-[1.1] font-semibold tracking-tight">
          What would you like to{" "}
          <span className="italic font-medium text-accent">create</span> today?
        </h2>
        <p className="text-[13px] text-muted mt-2 max-w-xl leading-snug">
          Your AI co-pilot that helps you plan, save time, and make every class amazing.
        </p>
      </div>
      <div className="relative z-10 mt-6 grid grid-cols-2 md:grid-cols-3 gap-3">
        {chips.map((c) => {
          const Icon = c.icon;
          return (
            <div
              key={c.label}
              className="relative"
              data-flow={c.hot ? "build" : undefined}
            >
              <div
                className={`planner-hero-chip ${
                  c.hot ? "ring-2 ring-accent ring-offset-2 ring-offset-[#fbf2e6]" : ""
                }`}
              >
                <span className={`planner-hero-chip-icon planner-hero-chip-icon-${c.color}`}>
                  <Icon size={14} strokeWidth={2} />
                </span>
                <span className="text-[13px] font-semibold text-ink whitespace-nowrap">
                  {c.label}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// Step 2 — the real Studio composer for the Presentation kind.
function FlowCompose() {
  const FULL = "8-slide intro deck on the water cycle for Grade 4.";
  const [typed, setTyped] = useState("");
  useEffect(() => {
    let i = 0;
    setTyped("");
    // Type like a person — slightly uneven cadence, a beat after commas.
    let id;
    const tick = () => {
      i += 1;
      setTyped(FULL.slice(0, i));
      if (i < FULL.length) {
        const ch = FULL[i - 1];
        const delay =
          ch === "." ? 320 : ch === " " ? 70 : 38 + Math.random() * 55;
        id = setTimeout(tick, delay);
      }
    };
    id = setTimeout(tick, 450);
    return () => clearTimeout(id);
  }, []);
  return (
    <div className="h-full flex flex-col justify-center">
      <div className="flex items-center gap-2 mb-4">
        <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-paper-cool text-[13px] text-ink">
          <Layers size={14} className="text-accent" /> Presentation
          <ChevronRight size={13} className="text-muted rotate-90" />
        </span>
        <span className="text-[12.5px] text-muted font-serif italic">
          Tell Mudir what to cover.
        </span>
      </div>

      <div className="bg-paper-cool rounded-2xl border border-ink shadow-sm overflow-hidden">
        <div className="px-5 py-4 text-[15px] text-ink min-h-[92px] leading-relaxed">
          {typed || <span className="text-muted">{/* sample */}</span>}
          <span className="inline-block w-px h-[1.1em] align-[-2px] ml-0.5 bg-accent animate-pulse" />
        </div>
        <div className="border-t border-line px-3 py-2.5 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="h-8 w-8 rounded-full border border-line bg-paper-cool text-ink-soft flex items-center justify-center">
              <Paperclip size={14} />
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border border-line bg-paper text-[11.5px] text-muted">
              <Sparkles size={11} className="text-accent" /> Slide-by-slide outline
            </span>
          </div>
          <div className="flex items-center gap-3">
            <p className="hidden sm:block text-xs text-muted italic">
              Mudir will fill the rest
            </p>
            <span
              data-flow="makeit"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-paper-cool text-sm font-medium"
            >
              <Send size={14} /> Make it
            </span>
          </div>
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3 flex-wrap">
        <p className="font-serif italic text-[15px] text-muted">Or try</p>
        <div className="flex flex-wrap gap-1.5">
          {["Water cycle", "World religions", "Plot diagram"].map((s) => (
            <span
              key={s}
              className="px-2.5 py-1 rounded-full border border-line bg-paper-cool text-[12px] text-ink-soft"
            >
              {s}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}

// Step 3 — Mudir building the deck (the real "thinking" state +
// streaming outline).
function FlowBuilding() {
  const lines = [
    "Slide 1 — The Water Cycle",
    "Slide 2 — Where water lives",
    "Slide 3 — Evaporation",
    "Slide 4 — Condensation",
    "Slide 5 — Precipitation",
    "Slide 6 — Collection",
  ];
  return (
    <div className="h-full flex flex-col items-center justify-center text-center">
      <span className="relative inline-flex items-center justify-center w-16 h-16 mb-5">
        <span className="absolute inset-0 rounded-full bg-accent/15 animate-ping" />
        <span className="relative inline-flex items-center justify-center w-16 h-16 rounded-full bg-accent text-paper-cool">
          <Sparkles size={26} strokeWidth={2} />
        </span>
      </span>
      <p className="font-serif text-2xl text-ink mb-1">Mudir is thinking…</p>
      <p className="text-[13px] text-muted mb-6">
        Drafting an 8-slide deck on the water cycle, Grade 4.
      </p>
      <div className="w-full max-w-md text-left flex flex-col gap-1.5">
        {lines.map((l, i) => (
          <div
            key={l}
            className="flex items-center gap-2.5 px-3 py-2 rounded-lg bg-paper-cool border border-line/70"
            style={{
              opacity: 0,
              animation: `studioflow-line 420ms ease-out ${i * 260}ms forwards`,
            }}
          >
            <CheckCircle2 size={13} className="text-sage flex-shrink-0" />
            <span className="text-[12.5px] text-ink-soft">{l}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// Step 4 — the finished deck, styled like the real SlideBuilder
// (ocean theme cover + thumbnail strip).
// A small slide-scene illustration so the deck reads as real designed
// slides, not flat colour chips. Tinted to each slide's palette.
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
        <line
          key={x}
          x1={x}
          y1="84"
          x2={x - 5}
          y2="100"
          stroke={stroke}
          strokeWidth="3"
          strokeLinecap="round"
          opacity="0.8"
        />
      ))}
      {/* water + evaporation arrow */}
      <path
        d="M0 132 Q 25 122 50 132 T 100 132 T 150 132 T 200 132 V150 H0 Z"
        fill={stroke}
        opacity="0.5"
      />
      <path
        d="M40 124 C 28 104, 40 86, 58 80"
        fill="none"
        stroke={stroke}
        strokeWidth="2.5"
        strokeDasharray="3 4"
        strokeLinecap="round"
        opacity="0.7"
      />
    </svg>
  );
}

function FlowResult() {
  const ocean = { bg: "#1e3a44", text: "#eaf3f4", soft: "#a8c4c8", dot: "#7fc6c0" };
  // Each thumb is a real slide palette: bg + the tint used for its art.
  const thumbs = [
    { bg: "#1e3a44", art: "#7fc6c0" },
    { bg: "#dce8ee", art: "#2f7d95" },
    { bg: "#5f7256", art: "#f0d9a8" },
    { bg: "#fffdf6", art: "#c8472b" },
    { bg: "#f0d79a", art: "#b3442b" },
    { bg: "#b3442b", art: "#ffe6d2" },
    { bg: "#3a2740", art: "#d39bd0" },
    { bg: "#243027", art: "#9bc48a" },
  ];
  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-sage/[0.14] text-sage text-[11px] font-semibold">
          <CheckCircle2 size={12} /> Ready
        </span>
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-line bg-paper-cool text-[12px] text-ink">
            <Pencil size={12} /> Edit deck
          </span>
          <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-paper-cool text-[12px] font-medium">
            <Play size={12} /> Present
          </span>
        </div>
      </div>
      <div
        className="flex-1 rounded-2xl flex border border-line overflow-hidden"
        style={{ background: ocean.bg, color: ocean.text }}
      >
        <div className="flex-1 p-9 flex flex-col justify-center">
          <span
            className="font-mono text-[11px] uppercase tracking-[0.22em] mb-4"
            style={{ color: ocean.soft }}
          >
            Grade 4 · Science
          </span>
          <h3 className="font-serif text-5xl font-medium leading-[1.05] mb-4">
            The Water Cycle
          </h3>
          <p className="text-[15px] max-w-md leading-relaxed" style={{ color: ocean.soft }}>
            How water moves around our planet — evaporation, condensation,
            precipitation and collection.
          </p>
          <span
            className="mt-6 h-1 w-16 rounded-full"
            style={{ background: ocean.dot }}
          />
        </div>
        <div className="w-[44%] relative">
          <SlideArt stroke={ocean.dot} fill={ocean.soft} full />
        </div>
      </div>
      <div className="flex gap-2 mt-3">
        {thumbs.map((s, i) => (
          <div
            key={i}
            className={`relative h-16 flex-1 rounded-md overflow-hidden border ${
              i === 0 ? "border-accent ring-1 ring-accent" : "border-line"
            }`}
            style={{ background: s.bg }}
          >
            <span
              className="absolute left-2 top-2 h-1.5 w-7 rounded-full"
              style={{ background: s.art, opacity: 0.85 }}
            />
            <span
              className="absolute left-2 top-[18px] h-1 w-10 rounded-full"
              style={{ background: s.art, opacity: 0.4 }}
            />
            <div className="absolute right-1.5 bottom-1.5 top-1.5 w-9 rounded">
              <SlideArt stroke={s.art} fill={s.art} full />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

const FLOW_SCENES = {
  planner: { title: "mudir.app · planner", Render: FlowPlanner },
  compose: { title: "mudir.app · studio · presentation", Render: FlowCompose },
  building: { title: "studio · generating", Render: FlowBuilding },
  result: { title: "studio · presentation · ready", Render: FlowResult },
};

// Scripted shot list — plays as one continuous take (cursor moves,
// clicks, the prompt types itself, Mudir builds it, the deck appears),
// then loops. No tabs, no manual stepping.
const TIMELINE = [
  { scene: "planner",  target: "start",  ms: 900 },
  { scene: "planner",  target: "build",  ms: 1000 },
  { scene: "planner",  target: "build",  click: true, ms: 650 },
  { scene: "compose",  target: null,     ms: 3000 },
  { scene: "compose",  target: "makeit", ms: 850 },
  { scene: "compose",  target: "makeit", click: true, ms: 650 },
  { scene: "building", target: null,     ms: 2800 },
  { scene: "result",   target: null,     ms: 3400 },
];
const SCENE_LABEL = {
  planner: "Open Studio AI",
  compose: "Describe the deck",
  building: "Mudir builds it",
  result: "Your deck, ready",
};

const StudioFlow = () => {
  const [i, setI] = useState(0);
  const frame = TIMELINE[i];
  const scene = frame.scene;
  const steps = Object.entries(SCENE_LABEL);
  const sceneIdx = steps.findIndex(([k]) => k === scene);
  const stageRef = useRef(null);
  const [cur, setCur] = useState({ x: 0, y: 0, show: false });

  // Advance the scripted timeline, looping.
  useEffect(() => {
    const id = setTimeout(
      () => setI((n) => (n + 1) % TIMELINE.length),
      frame.ms || 950
    );
    return () => clearTimeout(id);
  }, [i, frame.ms]);

  // Anchor the simulated cursor to the *real* target element so it
  // always lands exactly on the Build·Presentation chip / Make it
  // button regardless of layout.
  useEffect(() => {
    const place = () => {
      const stage = stageRef.current;
      if (!stage) return;
      const f = TIMELINE[i];
      const sr = stage.getBoundingClientRect();
      if (f.target === "start") {
        setCur({ x: sr.width * 0.26, y: sr.height * 0.86, show: true });
        return;
      }
      if (f.target === "build" || f.target === "makeit") {
        const el = stage.querySelector(`[data-flow="${f.target}"]`);
        if (el) {
          const r = el.getBoundingClientRect();
          setCur({
            x: r.left - sr.left + r.width / 2,
            y: r.top - sr.top + r.height / 2,
            show: true,
          });
          return;
        }
      }
      setCur((p) => ({ ...p, show: false }));
    };
    const raf = requestAnimationFrame(() =>
      requestAnimationFrame(place)
    );
    window.addEventListener("resize", place);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", place);
    };
  }, [i]);

  const { Render } = FLOW_SCENES[scene];

  return (
    <section
      id="how"
      className="snap-stop py-24 md:py-36"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="max-w-2xl mb-12">
          <div className="eyebrow mb-6">From the Planner</div>
          <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight mb-6">
            A presentation,
            <br />
            <em style={{ color: "var(--clay)" }}>start to slides.</em>
          </h2>
          <p className="text-xl leading-relaxed" style={{ color: "var(--ink-2)" }}>
            One continuous take — open Studio AI from the Planner, describe the
            deck in a sentence, and Mudir builds the slides for you.
          </p>
        </div>

        <div className="max-w-[1040px] mx-auto">
          <Win title="">
            <div ref={stageRef} className="relative h-full">
              <div key={scene} className="studioflow-scene h-full">
                <Render />
              </div>
              {/* Simulated cursor — glides to the real target, clicks. */}
              <div
                className="pointer-events-none absolute z-30 transition-all duration-[800ms] ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{
                  left: cur.x,
                  top: cur.y,
                  opacity: cur.show ? 1 : 0,
                  transform: "translate(-3px, -2px)",
                }}
              >
                {frame.click && cur.show && (
                  <span className="absolute -left-2.5 -top-2.5 h-10 w-10 rounded-full bg-accent/30 animate-ping" />
                )}
                <svg
                  width="24"
                  height="24"
                  viewBox="0 0 24 24"
                  fill="none"
                  className="drop-shadow-[0_2px_4px_rgba(0,0,0,0.25)]"
                >
                  <path
                    d="M5 3l14 7-6 2-2 6z"
                    fill="#1a1814"
                    stroke="#fff"
                    strokeWidth="1.6"
                  />
                </svg>
              </div>
            </div>
          </Win>

          {/* 4-step flow indicator — shows where in the take we are. */}
          <div className="mt-6 grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-4">
            {steps.map(([key, label], idx) => {
              const done = idx < sceneIdx;
              const active = idx === sceneIdx;
              return (
                <div key={key}>
                  <div className="h-1 rounded-full bg-line/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-accent transition-all duration-700 ease-linear"
                      style={{ width: done || active ? "100%" : "0%" }}
                    />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span
                      className={`grid place-items-center h-5 w-5 rounded-full text-[10px] font-semibold flex-shrink-0 transition-colors ${
                        done || active
                          ? "bg-accent text-paper-cool"
                          : "bg-paper-cool border border-line text-muted"
                      }`}
                    >
                      {done ? "✓" : idx + 1}
                    </span>
                    <span
                      className={`text-[12.5px] font-medium leading-tight ${
                        active
                          ? "text-ink"
                          : done
                            ? "text-ink-soft"
                            : "text-muted"
                      }`}
                    >
                      {label}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// PHILOSOPHY
// =====================================================================
const Philosophy = () => {
  const beliefs = [
    {
      n: "I",
      title: "The teacher is the author.",
      body: "Mudir drafts. You direct. Every output is a starting point, never the final word — your name goes on the lesson, so your judgment has the last say.",
    },
    {
      n: "II",
      title: "Calm over clever.",
      body: "We chose restraint over novelty. No flashing prompts, no gimmicks, no surprises. Just structure you can trust on a Sunday night.",
    },
    {
      n: "III",
      title: "Aligned to the UAE classroom.",
      body: "MoE outcomes, Arabic-first content where it matters, and local context understood — not a foreign tool bent to fit.",
    },
    {
      n: "IV",
      title: "Private by default.",
      body: "Student data stays in your school's region. Nothing you create trains a public model. Quietly, that is the point.",
    },
  ];

  return (
    <section
      id="philosophy"
      className="snap-stop py-24 md:py-36"
      style={{ borderColor: "var(--line)" }}
    >
      <div className="max-w-3xl mx-auto px-8">
        <div className="eyebrow mb-8">How we build</div>

        <h2 className="font-display text-4xl md:text-6xl leading-[1.05] tracking-tight mb-10">
          AI should reduce teacher workload —{" "}
          <em style={{ color: "var(--clay)" }}>not replace</em> teacher
          judgment.
        </h2>

        <p
          className="text-xl leading-relaxed mb-16"
          style={{ color: "var(--ink-2)" }}
        >
          Mudir is built on four convictions. They shape every screen, every
          default, and every line of generated text — so the tool stays
          quietly on your side.
        </p>

        <div className="space-y-12">
          {beliefs.map((b) => (
            <div key={b.n} className="flex gap-6 md:gap-8">
              <span
                className="font-display italic text-3xl md:text-4xl leading-none flex-shrink-0 w-12 pt-1"
                style={{ color: "var(--clay)" }}
              >
                {b.n}
              </span>
              <div>
                <h3 className="font-display text-2xl md:text-3xl leading-tight mb-2.5">
                  {b.title}
                </h3>
                <p
                  className="text-lg leading-relaxed"
                  style={{ color: "var(--ink-2)" }}
                >
                  {b.body}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div
          className="mt-16 pt-8 border-t"
          style={{ borderColor: "var(--line)" }}
        >
          <p
            className="font-display italic text-xl md:text-2xl"
            style={{ color: "var(--ink)" }}
          >
            — The Mudir team
          </p>
          <p className="eyebrow mt-3">Built in Dubai, alongside teachers</p>
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// FINAL CTA
// =====================================================================
const CTA = ({ onOpenStudio }) => {
  return (
    <section
      id="cta"
      className="snap-stop py-24 md:py-36 relative overflow-hidden"
      style={{ borderColor: "var(--line)", background: "var(--ink)" }}
    >
      <div className="absolute inset-0 opacity-30 pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgba(181,117,78,0.4) 0%, transparent 60%)",
            filter: "blur(80px)",
          }}
        />
      </div>

      <div className="relative max-w-[1280px] mx-auto px-8">
        <div className="max-w-3xl mx-auto text-center">
          <div
            className="eyebrow mb-8"
            style={{ color: "rgba(247,243,236,0.5)" }}
          >
            Now in pilot — UAE schools
          </div>
          <h2
            className="font-display text-6xl md:text-8xl leading-[0.98] tracking-tight mb-8"
            style={{ color: "var(--paper)" }}
          >
            Get your
            <br />
            evenings back.
          </h2>
          <p
            className="text-xl mb-12 max-w-xl mx-auto leading-relaxed"
            style={{ color: "rgba(247,243,236,0.65)" }}
          >
            Open the planner and let Mudir draft your next lesson, quiz, or
            deck — you stay in charge of every word.
          </p>

          <button
            type="button"
            onClick={onOpenStudio}
            className="btn-invert inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-medium"
          >
            Open the planner
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M5 3l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// FOOTER
// =====================================================================
const Footer = ({ onOpenStudio, onJump, onPage }) => {
  const FLink = ({ children, onClick }) => (
    <button type="button" onClick={onClick} className="link-quiet text-left">
      {children}
    </button>
  );
  return (
    <footer
      className="py-16"
      style={{ borderColor: "var(--line)", background: "var(--paper)" }}
    >
      <div className="max-w-[1280px] mx-auto px-8">
        <div className="grid grid-cols-12 gap-8 mb-16">
          <div className="col-span-12 md:col-span-5">
            <div className="flex items-center gap-2.5 mb-5">
              <div
                className="w-7 h-7 rounded-md flex items-center justify-center"
                style={{ background: "var(--ink)" }}
              >
                <span
                  className="font-display text-base"
                  style={{ color: "var(--paper)" }}
                >
                  م
                </span>
              </div>
              <span className="font-display text-xl">Mudir</span>
            </div>
            <p className="font-display text-2xl leading-tight max-w-sm mb-6">
              A calmer way to prepare lessons.
            </p>
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              Built in Dubai, for teachers across the UAE.
            </p>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="eyebrow mb-4">Product</div>
            <ul className="space-y-2.5 text-sm" style={{ color: "var(--ink-2)" }}>
              <li><FLink onClick={() => onJump("features")}>Features</FLink></li>
              <li><FLink onClick={() => onJump("how")}>How it works</FLink></li>
              <li><FLink onClick={() => onJump("how")}>AI studio</FLink></li>
              <li><FLink onClick={() => onPage("pricing")}>Pricing</FLink></li>
            </ul>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="eyebrow mb-4">Schools</div>
            <ul className="space-y-2.5 text-sm" style={{ color: "var(--ink-2)" }}>
              <li><FLink onClick={() => onPage("schools")}>For schools</FLink></li>
              <li><FLink onClick={() => onPage("moe")}>MoE alignment</FLink></li>
              <li><FLink onClick={() => onPage("privacy")}>Data privacy</FLink></li>
              <li><FLink onClick={() => onPage("contact")}>Contact</FLink></li>
            </ul>
          </div>

          <div className="col-span-12 md:col-span-3">
            <div className="eyebrow mb-4">From the team</div>
            <p
              className="text-sm leading-relaxed mb-4"
              style={{ color: "var(--ink-2)" }}
            >
              We're a small team building Mudir alongside teachers in Dubai and
              Abu Dhabi.
            </p>
            <button
              type="button"
              onClick={onOpenStudio}
              className="text-sm link-quiet font-medium"
            >
              Open the planner →
            </button>
          </div>
        </div>

        <div
          className="pt-8 border-t flex flex-wrap items-center justify-between gap-4 text-xs"
          style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
        >
          <div>© 2026 Mudir. Made in Dubai.</div>
          <div className="flex items-center gap-6">
            <FLink onClick={() => onPage("privacy")}>Privacy</FLink>
            <FLink onClick={() => onPage("privacy")}>Terms</FLink>
            <FLink onClick={() => onPage("privacy")}>Security</FLink>
          </div>
        </div>
      </div>
    </footer>
  );
};

// =====================================================================
// MARKETING PAGES — lightweight in-app views (no router). Reached from
// the nav/footer; share the same Nav + Footer chrome.
// =====================================================================
const fieldStyle = {
  background: "var(--paper)",
  border: "0.5px solid var(--line-strong)",
  color: "var(--ink)",
};

function PageShell({ eyebrow, title, em, lead, onPage, children, narrow }) {
  return (
    <main className="pt-28 md:pt-32 pb-28 min-h-screen">
      <div className={`${narrow ? "max-w-xl" : "max-w-3xl"} mx-auto px-8`}>
        <button
          type="button"
          onClick={() => onPage("home")}
          className="link-quiet text-sm mb-10 inline-flex items-center gap-1.5"
          style={{ color: "var(--ink-2)" }}
        >
          ← Back to home
        </button>
        <div className="eyebrow mb-6">{eyebrow}</div>
        <h1 className="font-display text-4xl md:text-5xl leading-[1.05] tracking-tight mb-6">
          {title}
          {em && <em style={{ color: "var(--clay)" }}> {em}</em>}
        </h1>
        {lead && (
          <p
            className="text-xl leading-relaxed mb-12"
            style={{ color: "var(--ink-2)" }}
          >
            {lead}
          </p>
        )}
        {children}
      </div>
    </main>
  );
}

function CommitList({ items }) {
  return (
    <ul className="space-y-6">
      {items.map((it) => (
        <li key={it.t} className="flex gap-5">
          <span
            className="font-display italic text-2xl leading-none w-8 flex-shrink-0 pt-1"
            style={{ color: "var(--clay)" }}
          >
            ·
          </span>
          <div>
            <h3 className="font-display text-xl md:text-2xl leading-tight mb-1.5">
              {it.t}
            </h3>
            <p className="leading-relaxed" style={{ color: "var(--ink-2)" }}>
              {it.b}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

function ContactForm() {
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ border: "0.5px solid var(--line)", background: "var(--paper)" }}
      >
        <p className="font-display text-2xl mb-1">Thanks — we'll be in touch.</p>
        <p style={{ color: "var(--ink-2)" }}>
          We read every message. Expect a reply within a couple of days.
        </p>
      </div>
    );
  }
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        setSent(true);
      }}
      className="space-y-4"
    >
      <input
        required
        placeholder="Your name"
        className="w-full px-4 py-3 rounded-lg text-sm outline-none"
        style={fieldStyle}
      />
      <input
        required
        type="email"
        placeholder="your.email@school.ae"
        className="w-full px-4 py-3 rounded-lg text-sm outline-none"
        style={fieldStyle}
      />
      <textarea
        required
        rows={4}
        placeholder="How can we help?"
        className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none"
        style={fieldStyle}
      />
      <button
        type="submit"
        className="btn-primary px-6 py-3 rounded-lg text-sm font-medium"
      >
        Send message
      </button>
    </form>
  );
}

function SignInPage({ onOpenStudio, onPage }) {
  return (
    <PageShell
      eyebrow="Welcome back"
      title="Sign in"
      onPage={onPage}
      narrow
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          onOpenStudio();
        }}
        className="space-y-4"
      >
        <input
          required
          type="email"
          placeholder="your.email@school.ae"
          className="w-full px-4 py-3 rounded-lg text-sm outline-none"
          style={fieldStyle}
        />
        <input
          required
          type="password"
          placeholder="Password"
          className="w-full px-4 py-3 rounded-lg text-sm outline-none"
          style={fieldStyle}
        />
        <button
          type="submit"
          className="btn-primary w-full px-6 py-3 rounded-lg text-sm font-medium"
        >
          Sign in
        </button>
      </form>
      <p className="text-sm mt-6" style={{ color: "var(--ink-2)" }}>
        New to Mudir?{" "}
        <button
          type="button"
          onClick={onOpenStudio}
          className="link-quiet font-medium"
          style={{ color: "var(--ink)" }}
        >
          Open the planner
        </button>
      </p>
      <p className="text-xs mt-8" style={{ color: "var(--ink-3)" }}>
        Pilot access — signing in opens the planner directly.
      </p>
    </PageShell>
  );
}

function MarketingPage({ page, onOpenStudio, onPage }) {
  if (page === "signin")
    return <SignInPage onOpenStudio={onOpenStudio} onPage={onPage} />;

  if (page === "privacy")
    return (
      <PageShell
        eyebrow="Data privacy"
        title="Your data"
        em="stays yours."
        lead="Mudir is built for schools that take student data seriously. Privacy is a default, not a setting."
        onPage={onPage}
      >
        <CommitList
          items={[
            { t: "Region residency", b: "Student data stays in your school's region. It is never shipped elsewhere to be processed." },
            { t: "Nothing trains a public model", b: "What you and your students create is yours. It is never used to train public AI models." },
            { t: "Teacher-owned content", b: "Every lesson, quiz and deck belongs to you. Export or delete it at any time." },
            { t: "Deleted means deleted", b: "Remove an item and it's gone — soft-deleted for 30 days, then permanently purged." },
          ]}
        />
      </PageShell>
    );

  if (page === "moe")
    return (
      <PageShell
        eyebrow="Curriculum"
        title="Built for the"
        em="UAE classroom."
        lead="Mudir speaks the curriculum your inspectors do — every output can be mapped to Ministry of Education outcomes."
        onPage={onPage}
      >
        <CommitList
          items={[
            { t: "MoE outcomes by default", b: "Lessons and quizzes tag the outcomes they cover, so coverage is visible at a glance." },
            { t: "Arabic-first where it matters", b: "Generate in Arabic or English, with content that respects local context — not a translated afterthought." },
            { t: "KG through Grade 12", b: "Pacing, language and difficulty adjust to the grade and stream you teach." },
            { t: "Bloom-tagged assessment", b: "Quizzes balance recall, application and extension so they hold up to scrutiny." },
          ]}
        />
      </PageShell>
    );

  if (page === "schools")
    return (
      <PageShell
        eyebrow="For schools"
        title="Bring Mudir to"
        em="your school."
        lead="Give every teacher the same calm prep workflow — and give leadership the consistency and time back that follows."
        onPage={onPage}
      >
        <CommitList
          items={[
            { t: "Consistency across teachers", b: "Shared templates and MoE-aligned defaults mean every classroom starts from the same strong base." },
            { t: "Hours back, every week", b: "Pilot teachers report 10+ hours saved a week on prep — time that returns to teaching." },
            { t: "Onboarding we run with you", b: "We set up your grades, sections and subjects together, so day one is productive." },
          ]}
        />
        <button
          type="button"
          onClick={() => onPage("contact")}
          className="btn-primary px-6 py-3 rounded-lg text-sm font-medium mt-12"
        >
          Talk to us
        </button>
      </PageShell>
    );

  if (page === "pricing")
    return (
      <PageShell
        eyebrow="Pricing"
        title="Simple, while"
        em="we're in pilot."
        lead="Mudir is in an invite-only pilot with UAE schools. Pricing for teachers and schools comes after the pilot — shaped by what teachers actually use."
        onPage={onPage}
      >
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {[
            { k: "Pilot", v: "Free", d: "For participating UAE schools, for the duration of the pilot." },
            { k: "Teacher", v: "Later", d: "An individual plan for solo teachers — after the pilot." },
            { k: "School", v: "Later", d: "Whole-school licensing with admin tools — after the pilot." },
          ].map((p) => (
            <div
              key={p.k}
              className="rounded-2xl p-6"
              style={{ border: "0.5px solid var(--line)", background: "var(--paper)" }}
            >
              <div className="eyebrow mb-3">{p.k}</div>
              <div
                className="font-display text-3xl mb-2"
                style={{ color: "var(--clay)" }}
              >
                {p.v}
              </div>
              <p className="text-sm leading-relaxed" style={{ color: "var(--ink-2)" }}>
                {p.d}
              </p>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => onPage("contact")}
          className="btn-primary px-6 py-3 rounded-lg text-sm font-medium"
        >
          Talk to us about the pilot
        </button>
      </PageShell>
    );

  // contact (default)
  return (
    <PageShell
      eyebrow="Contact"
      title="Say"
      em="hello."
      lead="Questions, a pilot enquiry, or feedback from the classroom — we'd like to hear it."
      onPage={onPage}
    >
      <ContactForm />
      <p className="text-xs mt-8" style={{ color: "var(--ink-3)" }}>
        Built in Dubai · we read everything.
      </p>
    </PageShell>
  );
}

// =====================================================================
// LANDING (exported)
// =====================================================================
export default function Landing({ onOpenStudio }) {
  const [page, setPage] = useState("home");

  const goPage = (p) => {
    setPage(p);
    window.scrollTo(0, 0);
  };
  const jump = (id) => {
    const doScroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
    };
    if (page === "home") doScroll();
    else {
      setPage("home");
      setTimeout(doScroll, 90);
    }
  };

  return (
    <div className="mudir-landing paper-noise">
      <Nav onOpenStudio={onOpenStudio} onJump={jump} onPage={goPage} />
      {page === "home" ? (
        <>
          <Hero onOpenStudio={onOpenStudio} />
          <ShowcaseScroll />
          <CommunityScroll />
          <SectionDivider variant="wave" />
          <TeacherShowcase />
          <SectionDivider variant="cascade" />
          <Workflow />
          <SectionDivider variant="cascade" flip />
          <CTA onOpenStudio={onOpenStudio} />
        </>
      ) : (
        <MarketingPage
          page={page}
          onOpenStudio={onOpenStudio}
          onPage={goPage}
        />
      )}
      <Footer onOpenStudio={onOpenStudio} onJump={jump} onPage={goPage} />
    </div>
  );
}
