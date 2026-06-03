import React, { useState, useEffect, useRef } from "react";
import {
  Sparkles, ArrowRight, ChevronRight, ChevronLeft, Plus, BookOpen,
  CalendarDays, GraduationCap, ClipboardList, Presentation, Layout,
  Users, MessageCircle, CheckCircle2, Clock, TrendingUp, FileText,
  Pencil, Trash2, ArrowUpDown, Calendar, LayoutGrid, List,
  Paperclip, Send, Layers, Play, LogOut, Eye, EyeOff,
} from "lucide-react";
import "../landing.css";
import { useT, useI18n, LangToggle } from "../lib/i18n";
import { setRole as setLocalRole } from "../lib/role";
import {
  useAccount, setAccount, clearAccount,
  getPendingProfile, clearPendingProfile,
  getPendingSchools, clearPendingSchools,
} from "../lib/account";
import { api as apiFetch } from "./_shared";
import { PLANS } from "../lib/plans";
import { PRIVACY, TERMS, SECURITY, LEGAL_VERSION, LEGAL_EFFECTIVE_DATE } from "../lib/legal";
import ProfileForm from "./onboarding/ProfileForm";
import LandingHome from "./LandingHome";
import MurchidLogo from "../components/MurchidLogo";
import Avatar from "../components/Avatar";
import BrandLoader from "../components/BrandLoader";

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

// Reveal driver for un-pinned sections: returns [ref, q]. Attach ref to
// the section; q tweens 0→1 over `duration` ms each time the section
// scrolls into view, and resets to 0 when it leaves — so the slide-up
// reveal replays on every entry (scrolling down OR back up), instead of
// the old scroll-pinned scrub (which needed a tall void). Honours
// prefers-reduced-motion by snapping to the finished state.
function useRevealQ({ duration = 1200, margin = "-15% 0px -15% 0px" } = {}) {
  const ref = useRef(null);
  const [q, setQ] = useState(0);
  const qRef = useRef(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      qRef.current = 1;
      setQ(1);
      return undefined;
    }
    let raf = 0;
    const start = () => {
      cancelAnimationFrame(raf);
      const t0 = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - t0) / duration);
        qRef.current = p;
        setQ(p);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    };
    // Two observers, so the late-trigger margin doesn't double as a
    // reset boundary (which would hide the section while it's still
    // visible on screen).
    //   • triggerObs: uses the caller's `margin` — fires the reveal
    //     start only when the section reaches the desired position.
    //   • lifecycleObs: uses the real viewport — only resets q to 0
    //     once the section is FULLY below the viewport (user scrolled
    //     all the way up past it), so the reveal can replay on the
    //     next downward entry. Exiting via the top (scroll down past)
    //     intentionally does NOT reset, to keep the assembled state
    //     and avoid initial-state bleed into the next section.
    const triggerObs = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && qRef.current === 0) start();
      },
      { rootMargin: margin }
    );
    const lifecycleObs = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e.isIntersecting && e.boundingClientRect.top > 0) {
          cancelAnimationFrame(raf);
          qRef.current = 0;
          setQ(0);
        }
      },
      { rootMargin: "0px" }
    );
    triggerObs.observe(el);
    lifecycleObs.observe(el);
    return () => {
      triggerObs.disconnect();
      lifecycleObs.disconnect();
      cancelAnimationFrame(raf);
    };
  }, [duration, margin]);
  return [ref, q];
}

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
// The Nav sits fixed above every page. On the cinematic home it has
// to live both over the dark drench hero (cream text, transparent bg)
// and over the cream sections below (dark text, cream blur). The
// `darkHero` prop tells the nav the page begins with a dark surface;
// while `scrollY` is still inside that surface, the nav inverts.
// Signed-in account control in the nav: an avatar (user initial) that opens a
// small dropdown — name header + "Open the planner" + "Sign out". Replaces the
// bare "SIGN OUT" text link. Closes on outside-click / Escape.
function NavProfile({ onEnter, onSignOut }) {
  const t = useT();
  const account = useAccount();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);
  const prof = account?.profile || {};
  const name = [prof.firstName, prof.lastName].filter(Boolean).join(" ") || account?.email || "Account";
  const initial = (prof.firstName?.[0] || account?.email?.[0] || "U").toUpperCase();
  return (
    <div className="nav-profile" ref={ref}>
      <button
        type="button"
        className="nav-avatar"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={name}
        title={name}
      >
        <Avatar avatarId={prof.avatar} initial={initial} size={38} />
      </button>
      {open && (
        <div className="nav-profile-menu" role="menu">
          <div className="nav-profile-name">{name}</div>
          <button
            type="button"
            role="menuitem"
            className="nav-profile-item"
            onClick={() => { setOpen(false); onEnter(); }}
          >
            <ArrowRight size={15} strokeWidth={2} />
            {t("lp.nav.openPlanner")}
          </button>
          <button
            type="button"
            role="menuitem"
            className="nav-profile-item nav-profile-danger"
            onClick={() => { setOpen(false); onSignOut(); }}
          >
            <LogOut size={15} strokeWidth={2} />
            {t("lp.nav.signout")}
          </button>
        </div>
      )}
    </div>
  );
}

const Nav = ({ onEnter, signedIn, onJump, onPage, onSignOut, darkHero = false }) => {
  const t = useT();
  const [scrolled, setScrolled] = useState(false);
  const [overDark, setOverDark] = useState(darkHero);
  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 20);
      // The home page is warm drench (dark) throughout EXCEPT the cream
      // Showreel. Keep the nav light over the drench, and flip to ink chrome
      // only while the Showreel crosses the nav line.
      if (!darkHero) {
        setOverDark(false);
        return;
      }
      // Cream/light sections the nav must go ink over (everything else is the
      // warm drench): the Showreel and the membership/Plans block.
      const lightSections = document.querySelectorAll(".film-stage, .plans-stage");
      let overLight = false;
      lightSections.forEach((el) => {
        const r = el.getBoundingClientRect();
        if (r.top <= 70 && r.bottom >= 70) overLight = true;
      });
      setOverDark(!overLight);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [darkHero]);

  // Two colour scenarios. On the dark drench: cream chrome, no blur
  // tint (a faint smoke shadow keeps the bar legible). On any cream
  // surface: ink chrome with a cream backdrop blur once scrolled.
  const onDark = overDark;
  const fg = onDark ? "oklch(0.96 0.025 80 / 0.92)" : "var(--ink-2)";
  const fgDot = onDark ? "var(--paper)" : "var(--paper)";
  const dotBg = onDark ? "oklch(0.95 0.03 80 / 0.18)" : "var(--ink)";
  const headerCls = scrolled
    ? onDark
      ? "nav-shade"
      : "nav-blur border-b"
    : "";

  // Editorial chrome. The index links + underline take a warm accent
  // (amber on the drench, clay on the cream page); the CTA pill inverts
  // its fill with the surface. `isRTL` flips the CTA arrow + hover nudge.
  const { isRTL } = useI18n();
  const accent = onDark ? "oklch(0.86 0.13 60)" : "var(--clay)";
  const ctaStyle = onDark
    ? { background: "var(--paper)", color: "var(--cm-clay-dd)" }
    : { background: "var(--ink)", color: "var(--paper)" };
  // Anchors point at the sections the redesigned home actually renders
  // (HeroAtelier index → Showreel → Voices → Plans). See sec-* ids in
  // LandingHome.jsx + HeroAtelier.jsx.
  const navItems = [
    { key: "lp.nav.features", to: "sec-features" },
    { key: "lp.nav.how", to: "sec-how" },
    { key: "lp.nav.voices", to: "sec-voices" },
    { key: "lp.nav.pricing", to: "sec-pricing" },
  ];
  const ctaArrow = isRTL
    ? "M11.5 7 H3 M6.5 3.5 L3 7 L6.5 10.5"
    : "M2.5 7 H11 M7.5 3.5 L11 7 L7.5 10.5";

  return (
    <motion.header
      initial={{ y: -40, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.8, ease: EASE }}
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${headerCls}`}
      style={{
        borderColor: scrolled && !onDark ? "var(--line)" : "transparent",
        ["--nav-accent"]: accent,
      }}
    >
      <div className="max-w-[1280px] mx-auto px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <button type="button" onClick={() => onPage("home")} className="nav-brand" style={{ color: fg }} aria-label="Murchid — home">
          <MurchidLogo
            className="h-[50px] w-auto"
            style={{ "--murchid-logo-accent": onDark ? "#fcb979" : "#8e5435", transform: "translateY(5px)" }}
          />
        </button>

        {/* Editorial index */}
        <nav className="hidden md:flex items-center gap-9" style={{ color: fg, transform: "translateY(8px)" }}>
          {navItems.map((it, i) => (
            <button key={it.key + i} type="button" onClick={() => onJump(it.to)} className="nav-link">
              <span className="nav-link-num">{String(i + 1).padStart(2, "0")}</span>
              <span className="nav-link-label">{t(it.key)}</span>
            </button>
          ))}
        </nav>

        {/* Controls */}
        <div className="flex items-center gap-3 md:gap-4" style={{ transform: "translateY(8px)" }}>
          <LangToggle />
          {!signedIn && (
            <button
              type="button"
              onClick={() => onPage("signin")}
              className="hidden sm:block nav-quiet"
              style={{ color: fg }}
            >
              {t("lp.nav.signin")}
            </button>
          )}
          {signedIn && (
            <NavProfile onEnter={onEnter} onSignOut={onSignOut} />
          )}
          {/* Signed-in users reach the planner from the profile dropdown, so
              the nav CTA only shows the Subscribe action when signed out. */}
          {!signedIn && (
            <button
              type="button"
              onClick={onEnter}
              className="nav-cta"
              style={{ ...ctaStyle, ["--cta-nudge"]: isRTL ? "-3px" : "3px" }}
            >
              <span>{t("lp.cta.subscribe")}</span>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d={ctaArrow} stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
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

// Real Murchid cards that fan out, then collapse + shrink as you scroll.
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
        Drafted by Murchid
      </span>
    </div>
  );
}

const HERO_CARDS = ["lesson", "quiz", "deck", "presentation", "activity", "homework"];

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

const Hero = ({ onEnter, signedIn }) => {
  const { t, lang } = useI18n();
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

  // Three phases, all pure functions of scroll position `p`:
  //   A  wide smile arc + hero title      (read)
  //   B  everything converges to one deck (collapse)
  //   C  deck re-fans into a diagonal cascade while a second
  //      headline reveals word-by-word    (reveal)
  // Continuous timeline — no dead zone: the fan begins the instant the
  // deck finishes collapsing, so the stack never just sits there.
  const collapseT = easeInOut(seg(p, 0.1, 0.4)); // arc → deck
  const fanT = easeInOut(seg(p, 0.4, 0.86)); // deck → cascade (starts as collapse ends)
  const heroOut = seg(p, 0.08, 0.3); // hero title leaves
  const heroE = easeInOut(heroOut);
  const bubbleA = 1 - seg(p, 0.06, 0.22); // phase-A pills fade
  const cIn = easeInOut(seg(p, 0.42, 0.62)); // phase-C frame arrives
  const pc = seg(p, 0.44, 0.92); // word-reveal scrub
  const cardsX = lerp(0, 210, easeInOut(seg(p, 0.44, 0.86))); // deck slides right
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
    <section ref={trackRef} className="relative min-h-screen lg:h-[200vh]">
      {/* ---------- DESKTOP — pinned 3-phase scroll choreography ---------- */}
      <div className="hidden lg:block lg:sticky lg:top-0 lg:h-screen overflow-hidden">
        <div className="relative max-w-[1280px] mx-auto px-8 h-screen">
          {/* Scene A — hero title (top) */}
          <div
            className="absolute left-1/2 top-[18vh] w-full max-w-3xl text-center will-change-transform"
            style={{
              transform: `translateX(-50%) translateY(${heroE * -80}px)`,
              opacity: 1 - heroOut,
              pointerEvents: heroOut > 0.9 ? "none" : "auto",
            }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="w-6 h-px" style={{ background: "var(--ink-3)" }} />
              <span className="eyebrow">
                {t("lp.hero.eyebrow")}
              </span>
            </div>
            <h1 className="font-display text-[clamp(44px,5.6vw,92px)] leading-[0.98] tracking-tight">
              {t("lp.hero.h1a")}{" "}
              <em style={{ color: "var(--clay)", fontStyle: "italic" }}>
                {t("lp.hero.brand")}
              </em>{" "}
              <span style={{ color: "var(--ink-2)" }}>{t("lp.hero.h1b")}</span>
            </h1>
          </div>

          {/* Scene C — headline reveals word-by-word (left column) */}
          <div
            className="absolute top-1/2 w-[45%] will-change-transform"
            style={{
              insetInlineStart: "2rem",
              transform: `translateY(calc(-50% + ${lerp(36, 0, cIn)}px))`,
              pointerEvents: cIn > 0.1 ? "auto" : "none",
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

          {/* Shared card layer — arc → deck → cascade */}
          <div
            className="absolute left-1/2 top-1/2 will-change-transform"
            style={{ transform: `translateX(${cardsX}px)` }}
          >
            {HERO_CARDS.map((kind, i) => {
              const o = i - mid;
              // A — wide smile arc (centered, contained, vertically balanced)
              const xa = o * 150;
              const ya = (mid * mid - o * o) * 12 + 26;
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
            {t("lp.hero.eyebrow")}
          </span>
        </div>
        <h1 className="font-display text-[clamp(40px,11vw,64px)] leading-[1.0] tracking-tight mb-6">
          {t("lp.hero.h1a")}{" "}
          <em style={{ color: "var(--clay)", fontStyle: "italic" }}>{t("lp.hero.brand")}</em>{" "}
          <span style={{ color: "var(--ink-2)" }}>{t("lp.hero.h1b")}</span>
        </h1>
        <p
          className="text-base leading-relaxed mb-7"
          style={{ color: "var(--ink-2)" }}
        >
          {t("lp.hero.mobileSub")}
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-14">
          <button
            type="button"
            onClick={onEnter}
            className="btn-primary px-6 py-3.5 rounded-lg text-sm font-medium"
          >
            {ctaLabel}
          </button>
          <a
            href="#how"
            className="btn-secondary px-6 py-3.5 rounded-lg text-sm font-medium"
          >
            {t("lp.hero.seeHow")}
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
// HERO JOURNEY — ONE pinned section, ONE card layer, no gap.
// The seven Murchid cards travel a single continuous path:
//   A  wide arc + "The teacher directs. Murchid drafts."
//   B  collapse into a deck
//   C  diagonal cascade + "Plan, draft, & teach… start to finish."
//   D  the SAME cards keep sliding while "Whether you're planning…"
//   E  they file into the Library folder · "The library / One studio."
// (Replaces the old Hero + ShowcaseScroll seam — the cards never
// unmount, so there is no empty scroll between the acts.)
// =====================================================================
const HeroJourney = ({ onEnter, signedIn }) => {
  const { t, lang } = useI18n();
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
  const collapseT = easeInOut(seg(p, 0.07, 0.22)); // arc → deck
  const fanT = easeInOut(seg(p, 0.22, 0.4)); // deck → cascade (+slide right)
  const fileT = easeInOut(seg(p, 0.5, 0.74)); // cascade → Library folder
  const bubbleA = 1 - seg(p, 0.03, 0.12); // phase-A pills fade
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
  const bWin = clamp01((p - 0.82) / 0.05); // @head.of.year
  const bob = Math.sin(p * Math.PI * 2) * 6; // gentle pill float

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
        <div className="relative max-w-[1280px] mx-auto px-8 h-screen">
          {/* Scene A — hero title */}
          <div
            className="absolute left-1/2 top-[18vh] w-full max-w-3xl text-center will-change-transform"
            style={{
              transform: `translateX(-50%) translateY(${heroE * -80}px)`,
              opacity: 1 - heroOut,
              pointerEvents: heroOut > 0.9 ? "none" : "auto",
              zIndex: 6,
            }}
          >
            <div className="flex items-center justify-center gap-3 mb-6">
              <span className="w-6 h-px" style={{ background: "var(--ink-3)" }} />
              <span className="eyebrow">{t("lp.hero.eyebrow")}</span>
            </div>
            <h1 className="font-display text-[clamp(44px,5.6vw,92px)] leading-[0.98] tracking-tight">
              {t("lp.hero.h1a")}{" "}
              <em style={{ color: "var(--clay)", fontStyle: "italic" }}>
                {t("lp.hero.brand")}
              </em>{" "}
              <span style={{ color: "var(--ink-2)" }}>{t("lp.hero.h1b")}</span>
            </h1>
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
              const ya = (mid * mid - o * o) * 12 + 150;
              const ra = o * 9;
              const sa = 1;
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

          {/* Floating handle bubbles */}
          {/* Bubble positions use logical inset properties so the whole
              cluster mirrors automatically in Arabic/RTL. The head.of.year
              bubble's translateX is flipped explicitly since CSS has no
              logical translate. */}
          <Bubble
            label="@ms.layla"
            bg="var(--sage)"
            style={{
              insetInlineStart: "21%",
              top: "29%",
              opacity: bubbleA,
              transform: `translateY(${bob}px)`,
              transition: "opacity 0.15s linear",
              zIndex: 30,
            }}
          />
          <Bubble
            label="@mr.idris"
            bg="var(--clay)"
            style={{
              insetInlineEnd: "21%",
              top: "25%",
              opacity: bubbleA,
              transform: `translateY(${-bob}px)`,
              transition: "opacity 0.15s linear",
              zIndex: 30,
            }}
          />
          <Bubble
            label="@head.of.science"
            bg="var(--brick)"
            style={{
              insetInlineEnd: "15%",
              top: "30%",
              opacity: clamp01((pc - 0.4) / 0.28) * (1 - cOut),
              transform: `translateY(${bob}px)`,
              zIndex: 30,
            }}
          />
          <Bubble
            label="@head.of.year"
            bg="var(--sage)"
            style={{
              insetInlineStart: "50%",
              top: "24%",
              opacity: bWin,
              transform: `translateX(${lang === "ar" ? -120 : 120}px) translateY(${bob}px)`,
              zIndex: 30,
            }}
          />
        </div>
      </div>

      {/* ---------- MOBILE — static (no scrub) ---------- */}
      <div className="lg:hidden px-6 pt-28 pb-12">
        <div className="flex items-center gap-3 mb-6">
          <span className="w-6 h-px" style={{ background: "var(--ink-3)" }} />
          <span className="eyebrow">{t("lp.hero.eyebrow")}</span>
        </div>
        <h1 className="font-display text-[clamp(40px,11vw,64px)] leading-[1.0] tracking-tight mb-6">
          {t("lp.hero.h1a")}{" "}
          <em style={{ color: "var(--clay)", fontStyle: "italic" }}>
            {t("lp.hero.brand")}
          </em>{" "}
          <span style={{ color: "var(--ink-2)" }}>{t("lp.hero.h1b")}</span>
        </h1>
        <p
          className="text-base leading-relaxed mb-7"
          style={{ color: "var(--ink-2)" }}
        >
          {t("lp.hero.mobileSub")}
        </p>
        <div className="flex flex-wrap items-center gap-3 mb-12">
          <button
            type="button"
            onClick={onEnter}
            className="btn-primary px-6 py-3.5 rounded-lg text-sm font-medium"
          >
            {ctaLabel}
          </button>
          <a
            href="#how"
            className="btn-secondary px-6 py-3.5 rounded-lg text-sm font-medium"
          >
            {t("lp.hero.seeHow")}
          </a>
        </div>
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
    </section>
  );
};

// =====================================================================
// SHOWCASE — second scroll act. Murchid "content cover" cards converge
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
          Murchid
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
// Per-language word lists so the reveal works in EN and AR (RTL).
const SHOW_HEAD_EN = [
  { t: "Whether" }, { t: "you're" }, { t: "planning" },
  { t: "tomorrow's" }, { t: "lesson" }, { t: "or" }, { t: "building" },
  { t: "a" }, { t: "full" }, { t: "unit" }, { t: "—" },
  { t: "Murchid", accent: "clay", italic: true }, { t: "turns" },
  { t: "intent" }, { t: "into" },
  { t: "classroom-ready", accent: "sage" }, { t: "material." },
];
const SHOW_HEAD_AR = [
  { t: "سواء" }, { t: "تُحضّر" }, { t: "درس" }, { t: "الغد" },
  { t: "أو" }, { t: "تبني" }, { t: "وحدةً" }, { t: "كاملة" }, { t: "—" },
  { t: "Murchid", accent: "clay", italic: true }, { t: "يحوّل" },
  { t: "النيّة" }, { t: "إلى" },
  { t: "مادّة", accent: "sage" }, { t: "جاهزة" }, { t: "للصَّف." },
];
const C_SAGE = "#7A8F6E";

// Headline #2 (left column, library phase) + the honeycomb chips.
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

// Scattered drop — hand-tuned "random" rest spots (not a grid). Kept
// shallow (y range ≈ 90px) so the whole cluster sits in the clear band
// between the sub-paragraph and the Library window's bottom edge.
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

// One continuous act, ONE set of cards, four phases driven by a single
// scroll progress `q`:
//   P1 converge  scattered → centred portrait stack  (headline #1 reveals)
//   P2 cascade   stack → diagonal cascade
//   P3 to-grid   the SAME cards travel right + shrink into the Library grid
//   P4 reveal    left headline #2 + sub + honeycomb chips assemble
const ShowcaseScroll = () => {
  const { t, lang } = useI18n();
  const SHOW_HEAD = lang === "ar" ? SHOW_HEAD_AR : SHOW_HEAD_EN;
  const VISION_HEAD = lang === "ar" ? VISION_HEAD_AR : VISION_HEAD_EN;
  const VISION_SUB = lang === "ar" ? VISION_SUB_AR : VISION_SUB_EN;
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

  // SAME cards as the hero — they carry continuously from the hero's
  // cascade into the Library folder (no separate subject deck).
  const CARDS = HERO_CARDS.slice(0, 6);
  const N = CARDS.length;
  const mid = (N - 1) / 2;

  // ONE continuous motion. The section opens on the SAME diagonal
  // cascade the hero left its cards in (so the seam reads as one move),
  // then the cards file themselves into the Library folder. A short
  // hold up front is the hero hand-off beat, not a dead zone — the
  // bubbles + bob keep it alive.
  const gFile = easeInOut(seg(q, 0.06, 0.6)); // entry cascade → folder grid

  // Headline #1 — centred. Holds under the cascade, then reveals as the
  // cards file away to the right and clear the centre.
  const h1 = seg(q, 0.22, 0.44);
  const head1Out = seg(q, 0.5, 0.64);
  const head1Up = easeInOut(seg(q, 0.5, 0.68)) * -70;

  // Library folder window + headline #2 + honeycomb (folder phase)
  const winT = easeInOut(seg(q, 0.42, 0.66));
  const h2 = seg(q, 0.64, 0.97);
  const honeyActive = q > 0.78; // start the drop once "grade" is revealed

  const bob = Math.sin(q * Math.PI * 2) * 6;
  // Teacher bubbles flank the entry cascade (the hero hand-off moment),
  // then fade as the cards file into the folder.
  const bStack =
    clamp01((q - 0.04) / 0.05) * (1 - clamp01((q - 0.22) / 0.07));
  const bWin = clamp01((q - 0.68) / 0.06);

  const colOff = [-140, 0, 140];
  // Top row pushed down so it clears the header + folder tabs (the
  // floating cards otherwise cover the "Personal / School" labels).
  const rowOff = [-6, 184];

  return (
    <section ref={trackRef} className="relative min-h-screen lg:h-[480vh]">
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
                    marginInlineEnd: "0.28em",
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
            className="absolute start-[4%] top-[23%] w-[42%]"
            style={{ zIndex: 30 }}
          >
            <div
              className="flex items-center gap-3 mb-6"
              style={{ opacity: clamp01((q - 0.6) / 0.05) }}
            >
              <span className="w-6 h-px" style={{ background: "var(--clay)" }} />
              <span className="eyebrow" style={{ color: "var(--clay)" }}>
                {t("lp.show.libraryEyebrow")}
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
                const wp = easeInOut(clamp01((h2 - 0.3 - i * 0.02) / 0.26));
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

          {/* Honeycomb of feature chips — real-gravity drop, flipped to
              the right in RTL so it stays under the (now right-side) text. */}
          <HoneyDrop active={honeyActive} dx={lang === "ar" ? 380 : -380} />

          {/* The Murchid "Library" product window (behind the cards) */}
          <div className="absolute left-1/2 top-1/2" style={{ zIndex: 8 }}>
            <div
              className="overflow-hidden"
              style={{
                width: 470,
                height: 520,
                borderRadius: 22,
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
              <div
                className="flex items-center justify-between px-6"
                style={{ height: 64 }}
              >
                <span className="font-display text-xl">{t("lp.show.libraryWin")}</span>
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
              {/* Active folder — manila-folder silhouette: the tab top
                  runs flat across the left (carrying the label) and ends
                  in a rounded lobe under "+ New", where a concave sweep
                  drops to the body's straight top edge. */}
              <div className="relative" style={{ height: 62 }}>
                {/* Body — top edge sits a lip below the raised tab */}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: 24,
                    bottom: 0,
                    background: "var(--ink)",
                    boxShadow: "0 18px 30px -20px rgba(42,31,23,0.55)",
                  }}
                />
                {/* Raised tab — flat top across the start side, mirrors
                    automatically in Arabic/RTL via logical properties. */}
                <div
                  style={{
                    position: "absolute",
                    insetInlineStart: 0,
                    insetInlineEnd: 138,
                    top: 0,
                    height: 46,
                    background: "var(--ink)",
                    borderStartStartRadius: 20,
                  }}
                />
                {/* Ogee sweep — flipped horizontally in RTL so the
                    shoulder still lands under the (now-start-side) "+ New". */}
                <svg
                  width={140}
                  height={46}
                  viewBox="0 0 140 46"
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
                    d="M0 0 C 24 0 40 16 76 16 L 110 16 A 30 30 0 0 1 140 46 L 0 46 Z"
                    fill="var(--ink)"
                  />
                </svg>
                <span
                  className="absolute inline-flex items-center gap-2"
                  style={{
                    insetInlineStart: 26,
                    top: 23,
                    transform: "translateY(-50%)",
                    color: "var(--paper)",
                    fontFamily: "'Fraunces', serif",
                    fontSize: 17,
                  }}
                >
                  <BookOpen size={15} strokeWidth={2} />
                  Personal
                </span>
              </div>
            </div>
          </div>

          {/* The ONE card layer — converge → stack → cascade → grid */}
          <div className="absolute left-1/2 top-1/2" style={{ zIndex: 20 }}>
            {CARDS.map((c, i) => {
              const o = i - mid;
              // C — entry cascade: the SAME diagonal arrangement the
              // hero left its cards in, sitting over the folder zone so
              // the section reads as one continuous motion.
              // Mirror the cascade x in RTL so the cards and the Arabic
              // headline sit on opposite sides like in LTR.
              const cx = (o * 64 + 300) * (lang === "ar" ? -1 : 1);
              const cy = o * 52 + 8;
              const cr = -8 + i * 2.4;
              const cs = 0.82;
              // G — grid cell inside the Library folder
              const gx = (250 + colOff[i % 3]) * (lang === "ar" ? -1 : 1);
              const gy = -10 + rowOff[Math.floor(i / 3)];
              const base = (a, d) => lerp(a, d, gFile);
              const x = base(cx, gx);
              const y = base(cy, gy);
              const r = base(cr, 0);
              const s = base(cs, 0.5);
              return (
                <div
                  key={c}
                  className="absolute left-0 top-0 will-change-transform"
                  style={{
                    transform: `translate(-50%,-50%) translate(${x}px,${y}px) rotate(${r}deg) scale(${s})`,
                    zIndex: 10 + i,
                  }}
                >
                  <HeroCardFace kind={c} />
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
              opacity: bStack,
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
              opacity: bStack,
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
          {t("lp.show.mHeadA")}{" "}
          <em style={{ color: "var(--clay)", fontStyle: "italic" }}>{t("lp.brand")}</em>{" "}
          {t("lp.show.mHeadB")}{" "}
          <span style={{ color: "var(--sage)" }}>{t("lp.show.mHeadAccent")}</span> {t("lp.show.mHeadC")}
        </h2>
        <div className="relative h-[340px] mb-14">
          {CARDS.slice(0, 5).map((c, i) => {
            const o = i - 2;
            return (
              <div
                key={c}
                className="absolute left-1/2 top-1/2"
                style={{
                  transform: `translate(-50%,-50%) translate(${o * 30}px,${
                    o * 22
                  }px) rotate(${-6 + i * 3}deg) scale(0.6)`,
                  zIndex: 10 + i,
                }}
              >
                <HeroCardFace kind={c} />
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
          {CARDS.slice(0, 4).map((c) => (
            <div
              key={c}
              style={{ transform: "scale(0.62)", transformOrigin: "top left" }}
            >
              <HeroCardFace kind={c} />
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
  { code: "MA", label: "Mathematics", ar: "الرياضيات", bg: "#2A1F17", tx: "#F4EFE4" },
  { code: "SC", label: "Science", ar: "العلوم", bg: "#5E7156", tx: "#F2F5EE" },
  { code: "AR", label: "Arabic", ar: "العربية", bg: "#EDE5D6", tx: "#2A1F17" },
  { code: "EN", label: "English", ar: "الإنجليزية", bg: "#B5754E", tx: "#FBF5EC" },
  { code: "PH", label: "Physics", ar: "الفيزياء", bg: "#33291F", tx: "#F4EFE4" },
  { code: "CH", label: "Chemistry", ar: "الكيمياء", bg: "#7A8F6E", tx: "#F7F3EC" },
  { code: "BI", label: "Biology", ar: "الأحياء", bg: "#5E7156", tx: "#F2F5EE" },
  { code: "HI", label: "History", ar: "التاريخ", bg: "#A0392A", tx: "#FBEFE9" },
  { code: "GE", label: "Geography", ar: "الجغرافيا", bg: "#8E5435", tx: "#FBF1E8" },
  { code: "IS", label: "Islamic St.", ar: "التربية الإسلامية", bg: "#7A2A1E", tx: "#FBEFE9" },
  { code: "AT", label: "Art & Design", ar: "الفنون والتصميم", bg: "#B5754E", tx: "#FBF5EC" },
  { code: "MU", label: "Music", ar: "الموسيقى", bg: "#E3D9C5", tx: "#2A1F17" },
  { code: "CS", label: "Coding", ar: "البرمجة", bg: "#2A1F17", tx: "#F4EFE4" },
  { code: "PE", label: "P.E.", ar: "التربية البدنية", bg: "#7A8F6E", tx: "#F7F3EC" },
  { code: "EC", label: "Economics", ar: "الاقتصاد", bg: "#8E5435", tx: "#FBF1E8" },
  { code: "ME", label: "Moral Ed.", ar: "التربية الأخلاقية", bg: "#EDE5D6", tx: "#2A1F17" },
];

function MqTile({ t: tile }) {
  const { lang } = useI18n();
  return (
    <div
      className="flex flex-col justify-between p-3.5 rounded-[20px] select-none"
      style={{
        width: 112,
        height: 112,
        background: tile.bg,
        color: tile.tx,
        boxShadow: "0 18px 36px -22px rgba(42,31,23,0.45)",
      }}
    >
      <span
        className="font-mono"
        style={{ fontSize: 9, letterSpacing: "0.16em", opacity: 0.65 }}
      >
        {tile.code}
      </span>
      <span className="font-display" style={{ fontSize: 15, lineHeight: 1.05 }}>
        {lang === "ar" ? tile.ar : tile.label}
      </span>
    </div>
  );
}

const MQ_HEAD_EN = [
  { t: "You'll" }, { t: "find" },
  { t: "every", accent: true }, { t: "subject", accent: true },
  { t: "here." },
];
const MQ_HEAD_AR = [
  { t: "ستجد" }, { t: "كل", accent: true }, { t: "مادّة", accent: true },
  { t: "هنا." },
];
const MQ_SUB_EN =
  "Built with teachers across the UAE — from KG to Grade 12, every classroom."
    .split(" ");
const MQ_SUB_AR =
  "بُني مع معلّمين من كل أنحاء الإمارات — من الروضة إلى الصف 12، كل صفّ."
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
      // Force LTR flow inside the marquee — the JS translateX animation
      // is hard-coded for LTR, so an inherited dir="rtl" (Arabic page)
      // would otherwise reverse the flex layout and bunch the tiles at
      // one edge. Tile content is still bilingual via the MqTile data.
      dir="ltr"
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
  const { t, lang } = useI18n();
  const MQ_HEAD = lang === "ar" ? MQ_HEAD_AR : MQ_HEAD_EN;
  const MQ_SUB = lang === "ar" ? MQ_SUB_AR : MQ_SUB_EN;
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
                    marginInlineEnd: "0.26em",
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

        <MarqueeRow reverse />
      </div>

      {/* ---------- MOBILE — marquees + static text ---------- */}
      <div className="lg:hidden py-16 flex flex-col gap-10">
        <MarqueeRow />
        <div className="text-center px-6">
          <h2 className="font-display text-[clamp(34px,9vw,52px)] leading-[1.06] tracking-tight">
            {t("lp.comm.headA")}{" "}
            <em style={{ color: "var(--clay)", fontStyle: "italic" }}>
              {t("lp.comm.headEm")}
            </em>{" "}
            {t("lp.comm.headB")}
          </h2>
          <p
            className="text-base leading-relaxed mt-5"
            style={{ color: "var(--ink-2)" }}
          >
            {t("lp.comm.sub")}
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
        className="murchid-studio-frame rounded-2xl overflow-hidden border border-line bg-paper text-ink font-sans flex"
        style={{
          width: 1340,
          height: 830,
          zoom: 0.77,
          boxShadow: "0 40px 100px -25px rgba(26,24,20,0.30)",
        }}
      >
        {/* ── SIDEBAR ─────────────────────────────────────────────── */}
        <aside className="murchid-sidebar w-64 flex flex-col flex-shrink-0 h-full">
          <div className="murchid-sidebar-brand flex items-center px-5 pt-6 pb-4 text-left">
            <MurchidLogo
              className="h-[50px] w-auto text-ink"
              style={{ "--murchid-logo-accent": "#8e5435" }}
            />
          </div>

          <button
            type="button"
            onClick={onOpenStudio}
            className="murchid-studio-launcher"
            aria-label="Open AI studio"
          >
            <span className="murchid-studio-launcher-head">
              <span className="murchid-studio-launcher-brand">
                <span className="murchid-studio-launcher-icon" aria-hidden>
                  <Sparkles size={15} strokeWidth={2.25} />
                </span>
                <span className="murchid-studio-launcher-title">Studio</span>
              </span>
              <span className="murchid-studio-launcher-pill">AI</span>
            </span>
            <span className="murchid-studio-launcher-body">
              <span className="murchid-studio-launcher-subtitle">
                Your AI co-pilot for teaching
              </span>
              <span className="murchid-studio-launcher-tagline">
                Create · Plan · Inspire
              </span>
            </span>
            <span className="murchid-studio-launcher-cta">
              <span>Open Studio</span>
              <ArrowRight
                size={14}
                strokeWidth={2.25}
                className="murchid-studio-launcher-cta-arrow"
              />
            </span>
          </button>

          <nav className="px-2 flex-1 overflow-hidden pb-3" aria-label="Primary">
            <section className="murchid-sidebar-section">
              <p className="murchid-sidebar-section-label">Planning</p>
              <div className="space-y-0.5 px-1">
                <div className="murchid-sidebar-item murchid-sidebar-item-active">
                  <span className="murchid-sidebar-badge text-base leading-none">▦</span>
                  <span className="truncate flex-1">Planner</span>
                </div>
              </div>
            </section>
            <section className="murchid-sidebar-section">
              <p className="murchid-sidebar-section-label">Teaching</p>
              <div className="space-y-0.5 px-1">
                {[
                  ["L", "Lesson Plans"],
                  ["Q", "Quizzes"],
                  ["H", "Homework"],
                  ["P", "Presentations"],
                  ["A", "Activities"],
                ].map(([badge, label]) => (
                  <div key={badge} className="murchid-sidebar-item">
                    <span className="murchid-sidebar-badge">{badge}</span>
                    <span className="truncate flex-1">{label}</span>
                  </div>
                ))}
              </div>
            </section>
            <section className="murchid-sidebar-section">
              <p className="murchid-sidebar-section-label">Data</p>
              <div className="space-y-0.5 px-1">
                <div className="murchid-sidebar-item">
                  <span className="murchid-sidebar-badge">C</span>
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

          <div className="murchid-sidebar-account">
            <span className="murchid-sidebar-account-avatar">SA</span>
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
// swaps to match the selected feature (Apploye-style, Murchid palette).
// =====================================================================
const EB = "font-mono text-[10px] uppercase tracking-[0.18em] text-muted";

function Win({ title, children }) {
  return (
    <div className="murchid-studio-frame rounded-2xl overflow-hidden border border-line bg-paper-cool shadow-[0_40px_90px_-30px_rgba(26,24,20,0.32)]">
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

// A single Murchid "slide" — a real deck slide: tinted cover + SlideArt.
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

// A single Murchid Studio document card — real /lessons · /quizzes etc.
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

// Decorative sample cards. Each carries an `ar` overlay used when the
// page is in Arabic (GalleryTileFace merges it over the base fields).
const GALLERY_TILES = [
  { t: "slide", bg: "#1e3a44", art: "#7fc6c0", tx: "#eaf3f4", eyebrow: "G4 · Science", title: "The Water Cycle", ar: { eyebrow: "الصف 4 · العلوم", title: "دورة الماء" } },
  { t: "doc", k: "Lesson plan", title: "Photosynthesis — how leaves work", meta: "Science · G7 · 7A", tag: "50 min · 4 stages", tone: "sage", ar: { k: "خطة درس", title: "البناء الضوئي — كيف تعمل الأوراق", meta: "العلوم · الصف 7 · 7A", tag: "50 دقيقة · 4 مراحل" } },
  { t: "slide", bg: "#5f7256", art: "#f0d9a8", tx: "#f8f5ec", eyebrow: "G7 · Science", title: "Photosynthesis", ar: { eyebrow: "الصف 7 · العلوم", title: "البناء الضوئي" } },
  { t: "doc", k: "Quiz", title: "Cell respiration check", meta: "Science · G7 · 7B", tag: "20 marks · auto-graded", tone: "accent", ar: { k: "اختبار", title: "اختبار التنفّس الخلوي", meta: "العلوم · الصف 7 · 7B", tag: "20 درجة · تصحيح آلي" } },
  { t: "slide", bg: "#b3442b", art: "#ffe6d2", tx: "#fbefe9", eyebrow: "G10 · English", title: "Romeo & Juliet — Act 1", ar: { eyebrow: "الصف 10 · الإنجليزية", title: "روميو وجولييت — الفصل 1" } },
  { t: "doc", k: "Homework", title: "Worksheet 4 — leaf structure", meta: "Science · 7A", tag: "Due May 21", tone: "gold", ar: { k: "واجب", title: "ورقة عمل 4 — بنية الورقة", meta: "العلوم · 7A", tag: "يُسلَّم 21 مايو" } },
  { t: "slide", bg: "#3a2740", art: "#d39bd0", tx: "#f4e9f3", eyebrow: "G9 · Maths", title: "Intro to Statistics", ar: { eyebrow: "الصف 9 · الرياضيات", title: "مقدمة في الإحصاء" } },
  // index 7 — featured centre
  { t: "slide", bg: "#1e3a44", art: "#7fc6c0", tx: "#eaf3f4", eyebrow: "Grade 4 · Science", title: "The Water Cycle", ar: { eyebrow: "الصف 4 · العلوم", title: "دورة الماء" } },
  { t: "doc", k: "Activity", title: "Group debate: is fusion worth it?", meta: "Science · G10 · 10D", tag: "25 min · groups", tone: "soft", ar: { k: "نشاط", title: "نقاش جماعي: هل يستحقّ الاندماج؟", meta: "العلوم · الصف 10 · 10D", tag: "25 دقيقة · مجموعات" } },
  { t: "slide", bg: "#dce8ee", art: "#2f7d95", tx: "#1e3a44", eyebrow: "G8 · Science", title: "States of Matter", ar: { eyebrow: "الصف 8 · العلوم", title: "حالات المادة" } },
  { t: "doc", k: "Template", title: "Inquiry-led science lesson", meta: "Science · KG–G6", tag: "Used 23×", tone: "sage", ar: { k: "قالب", title: "درس علوم قائم على الاستقصاء", meta: "العلوم · الروضة–الصف 6", tag: "استُخدم 23×" } },
  { t: "slide", bg: "#243027", art: "#9bc48a", tx: "#eaf3e6", eyebrow: "G6 · Science", title: "Plant Life Cycles", ar: { eyebrow: "الصف 6 · العلوم", title: "دورات حياة النبات" } },
  { t: "doc", k: "Worksheet", title: "Photosynthesis · differentiated", meta: "3 levels", tag: "8 / 10 / 12 Qs", tone: "gold", ar: { k: "ورقة عمل", title: "البناء الضوئي · متمايزة", meta: "3 مستويات", tag: "8 / 10 / 12 سؤالًا" } },
  { t: "slide", bg: "#2A1F17", art: "#E3B23C", tx: "#f4efe4", eyebrow: "G5 · Maths", title: "Fractions in Action", ar: { eyebrow: "الصف 5 · الرياضيات", title: "الكسور في التطبيق" } },
  { t: "doc", k: "Presentation", title: "Cell respiration overview", meta: "Science · G7 · 7B", tag: "9 slides", tone: "accent", ar: { k: "عرض تقديمي", title: "نظرة على التنفّس الخلوي", meta: "العلوم · الصف 7 · 7B", tag: "9 شرائح" } },
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

const GalleryTileFace = ({ tile }) => {
  const { lang } = useI18n();
  const v = lang === "ar" && tile.ar ? { ...tile, ...tile.ar } : tile;
  return v.t === "slide" ? <GallerySlide {...v} /> : <GalleryDoc {...v} />;
};

// Pinned, scroll-scrubbed reveal: an app-dock whose centre icon grows
// into the big featured card while the small tiles fan out from behind
// it into the scattered grid, then the overlays fade in.
const TeacherShowcase = () => {
  const { t } = useI18n();
  const stageWrapRef = useRef(null);
  const [scale, setScale] = useState(1);
  const [ref, q] = useRevealQ(); // un-pinned; slide-up replays on entry

  useEffect(() => {
    const onResize = () => {
      const w = stageWrapRef.current?.clientWidth || G_DESIGN_W;
      setScale(Math.min(1, Math.max(0.42, w / G_DESIGN_W)));
    };
    onResize();
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const featured = GALLERY_TILES[7];
  const smalls = GALLERY_TILES.filter((_, i) => i !== 7);

  // Timeline — the big card starts fully below the section and slides
  // straight up into the centre as you scroll (no fade — it travels in),
  // shrinking a touch while the small tiles fan out from behind it.
  // Reveal sequence: big card slides in first (0 → 0.40), THEN the
  // small tiles expand from behind it (see delay/ti below, starts ~0.5),
  // and the chips settle last (0.85 → 1.0).
  const enter = easeInOut(seg(q, 0.0, 0.40)); // rises ↑ from below
  const appear = easeInOut(seg(q, 0.85, 1.0)); // overlays settle (last)
  const featSc = lerp(2.2, 1, enter); // very big → final
  const featY = lerp(470, 0, enter); // already in view low → centred

  return (
    <section id="features" ref={ref} className="relative overflow-hidden">
      {/* Desktop — un-pinned; slide-up reveal replays on view.
          Generous top padding gives the subjects marquee above clear
          breathing room before the gallery enters, so the reveal plays
          naturally as the user reaches the section. */}
      <div
        ref={stageWrapRef}
        className="hidden lg:flex overflow-hidden items-center justify-center pt-48 pb-24"
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
            // Tiles start AFTER the big card has settled (q≈0.4),
            // then cascade out ring by ring from behind it.
            const delay =
              0.5 + (c.ring - 1) * 0.09 + (i % 5) * 0.012;
            const ti = easeInOut(clamp01((q - delay) / 0.26));
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
                label="@murchid"
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
                <Sparkles size={12} className="text-accent" /> {t("lp.ts.openStudio")}
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
                    {t("lp.ts.featTitle")}
                  </span>
                  <span className="block text-[10.5px] text-muted">
                    {t("lp.ts.draftedBy")}
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

// Mariam — describe a deck, Murchid builds the slides.
function MiniDeck() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [ref, p] = useLoop(7200);
  const PROMPT = ar
    ? "عرض من 8 شرائح · دورة الماء · الصف 4"
    : "8-slide deck · the water cycle · G4";
  const typed = PROMPT.slice(0, Math.round(seg(p, 0.02, 0.16) * PROMPT.length));
  const built = seg(p, 0.22, 0.64);
  return (
    <MiniWin
      refProp={ref}
      label={ar ? "الاستوديو · عرض تقديمي" : "studio · presentation"}
      chip={ar ? "عرض تقديمي" : "Presentation"}
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
        {ar ? "العرض جاهز · 8 شرائح" : "Deck ready · 8 slides"}
      </MiniStatus>
    </MiniWin>
  );
}

// Salma — a formative quiz drafts itself, Bloom-tagged & auto-graded.
function MiniQuiz() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [ref, p] = useLoop(7200);
  const Q = ar
    ? [
        { n: "س1", t: "أيُّ عُضيّة تُطلق الطاقة؟", tag: "اختياري" },
        { n: "س2", t: "التنفّس الهوائي يحتاج أكسجين.", tag: "صح / خطأ" },
        { n: "س3", t: "المعادلة اللفظية للتنفّس؟", tag: "قصير" },
      ]
    : [
        { n: "Q1", t: "Which organelle releases energy?", tag: "MCQ" },
        { n: "Q2", t: "Aerobic respiration needs oxygen.", tag: "True / False" },
        { n: "Q3", t: "Word equation for respiration?", tag: "Short" },
      ];
  const built = seg(p, 0.1, 0.62);
  return (
    <MiniWin
      refProp={ref}
      label={ar ? "الاستوديو · اختبار" : "studio · quiz"}
      chip={ar ? "اختبار · الصف 7" : "Quiz · Grade 7"}
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
        {ar ? "مصنّف بتصنيف بلوم · تصحيح آلي" : "Bloom-tagged · auto-graded"}
      </MiniStatus>
    </MiniWin>
  );
}

// Noura — homework set, collected and graded itself (real /homework
// content: a Studio worksheet task + auto-marked submissions).
function MiniHomework() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [ref, p] = useLoop(7200);
  const subs = ar
    ? [
        { who: "أحمد ك.", score: "18 / 20" },
        { who: "لينا م.", score: "20 / 20" },
        { who: "عمر س.", score: "16 / 20" },
        { who: "سارة ح.", score: "19 / 20" },
      ]
    : [
        { who: "Ahmed K.", score: "18 / 20" },
        { who: "Lina M.", score: "20 / 20" },
        { who: "Omar S.", score: "16 / 20" },
        { who: "Sara H.", score: "19 / 20" },
      ];
  const built = seg(p, 0.12, 0.66);
  return (
    <MiniWin
      refProp={ref}
      label={ar ? "الاستوديو · واجب" : "studio · homework"}
      chip={ar ? "واجب · 7A" : "Homework · 7A"}
      ChipIcon={ClipboardList}
    >
      <div className="rounded-lg border border-line/70 bg-paper-cool px-3 py-2 mb-2 flex items-center justify-between gap-2 flex-shrink-0">
        <span className="text-[11px] text-ink truncate">
          {ar ? "ورقة عمل 4 — بنية الورقة" : "Worksheet 4 — leaf structure"}
        </span>
        <span className="font-mono text-[8px] uppercase tracking-wider px-1.5 py-0.5 rounded bg-paper border border-line text-muted flex-shrink-0">
          {ar ? "يُسلَّم 21 مايو" : "Due May 21"}
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
        {ar ? "تصحيح آلي · أُضيفت ملاحظات" : "Auto-graded · feedback added"}
      </MiniStatus>
    </MiniWin>
  );
}

// Ibrahim — a timed lesson plan, drafted and MoE-aligned (the real
// Studio lesson-plan stage breakdown).
function MiniLessonPlan() {
  const { lang } = useI18n();
  const ar = lang === "ar";
  const [ref, p] = useLoop(7200);
  const stages = ar
    ? [
        { t: "00–05", s: "تمهيد — استرجاع سابق" },
        { t: "05–15", s: "تشويق — عرض الورقة" },
        { t: "15–35", s: "ورقة عمل موجَّهة" },
        { t: "35–45", s: "نقاش" },
        { t: "45–50", s: "بطاقة خروج" },
      ]
    : [
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
      label={ar ? "الاستوديو · خطة درس" : "studio · lesson plan"}
      chip={ar ? "البناء الضوئي · الصف 7" : "Photosynthesis · G7"}
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
        {ar ? "موقوت · متوافق مع الوزارة" : "Timed · MoE-aligned"}
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
  const { t, lang } = useI18n();
  const ar = lang === "ar";
  const steps = [
    {
      n: "01",
      label: ar ? "مريم" : "Mariam",
      title: ar ? "عرض شرائح كامل في عشرين ثانية." : "A full slide deck, in twenty seconds.",
      demo: "deck",
      tag: ar ? "20 دقيقة ← 20 ثانية" : "20 min → 20 sec",
    },
    {
      n: "02",
      label: ar ? "سلمى" : "Salma",
      title: ar ? "اختبار تكويني جاهز قبل الجرس." : "A formative quiz, ready before the bell.",
      demo: "quiz",
      tag: ar ? "اختبار في أقل من دقيقة" : "Quiz in under a minute",
    },
    {
      n: "03",
      label: ar ? "نورة" : "Noura",
      title: ar ? "واجب مُصحَّح قبل موعد الانصراف." : "Homework, marked before home time.",
      demo: "homework",
      tag: ar ? "يُصحَّح لحظة تسليمه" : "Graded the moment it's in",
    },
    {
      n: "04",
      label: ar ? "إبراهيم" : "Ibrahim",
      title: ar ? "دروس الأسبوع القادم، مخطَّطة سلفًا." : "Next week's lessons, already planned.",
      demo: "lesson",
      tag: ar ? "أسبوع من الخطط في دقائق" : "A week of plans in minutes",
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
            <div className="eyebrow mb-6">{t("lp.wf.eyebrow")}</div>
            <h2 className="font-display text-5xl md:text-6xl leading-[1.02] tracking-tight mb-6">
              {t("lp.wf.h2a")}
              <br />
              {t("lp.wf.h2b")}
            </h2>
            <p
              className="text-xl leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              {t("lp.wf.sub")}
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
// MEMBERSHIP — pricing. Scroll-scrubbed like the other acts: the left
// column reveals (icon + headline + word-by-word sub) while three plan
// cards rise from below and settle into an overlapping fan, the middle
// "Popular" card raised. Murchid palette (clay accent — no orange).
// =====================================================================
function PlanCardFace({ plan, featured, t, cur }) {
  const [intp, decp] = String(plan.perMonth).split(".");
  const note =
    plan.id === "monthly"
      ? t("lp.plan.billed.mo")
      : plan.id === "annual"
        ? t("lp.plan.yearOff", { n: plan.savePct })
        : t("lp.plan.save", { n: plan.savePct });
  return (
    <div
      className="h-full w-full rounded-[24px] p-5 flex flex-col text-start"
      style={{
        background: featured ? "var(--clay)" : "#fffdf6",
        color: featured ? "var(--paper)" : "var(--ink)",
        border: "0.5px solid " + (featured ? "var(--clay)" : "var(--line-strong)"),
        boxShadow: "0 26px 54px -26px rgba(26,24,20,0.42)",
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-display text-base leading-none">
          {t(`lp.plan.name.${plan.id}`)}
        </span>
        {featured && (
          <span
            className="px-2.5 py-1 rounded-full text-[9.5px] font-semibold flex-shrink-0"
            style={{ background: "var(--paper)", color: "var(--ink)" }}
          >
            {t("lp.plan.popular")}
          </span>
        )}
      </div>
      <div className="mt-auto">
        <div className="flex items-start gap-1">
          <span className="text-[12px] mt-1.5" style={{ opacity: 0.7 }}>{cur}</span>
          <span className="font-display text-[44px] leading-none">{intp}</span>
          <span className="text-base mt-1">.{decp}</span>
        </div>
        <div
          className="text-[11.5px] mt-2"
          style={{ color: featured ? "rgba(247,243,236,0.72)" : "var(--ink-3)" }}
        >
          {note}
        </div>
      </div>
    </div>
  );
}

// Rest layout per card (px from centre): side cards rotate out and sit
// lower/behind; the middle "Popular" card is raised and on top.
const MB_REST = [
  { x: -218, y: 34, rot: -8, z: 10, sc: 0.97 },
  { x: 0, y: -30, rot: 0, z: 30, sc: 1.05 },
  { x: 218, y: 34, rot: 8, z: 10, sc: 0.97 },
];

const Membership = ({ onEnter }) => {
  const { t, isRTL } = useI18n();
  // Late trigger: only fire the reveal once Membership's top has
  // scrolled up into the top quarter of the viewport — i.e. the
  // gallery's last cards have just exited above, so Membership isn't
  // showing while the previous section is still half-visible.
  const [ref, q] = useRevealQ({ margin: "0px 0px -75% 0px" });

  const cur = t("lp.plan.aed");
  const headIn = easeInOut(seg(q, 0.0, 0.28));
  const subWords = t("lp.mb.sub").split(" ");
  const dir = isRTL ? -1 : 1;

  return (
    <section id="membership" ref={ref} className="relative">
      {/* Desktop / iPad-landscape — un-pinned; slide-up reveal on view.
          Generous top padding gives the gallery above clear breathing
          room before Membership enters. No overflow-hidden so the
          fanned pricing cards aren't clipped at the right edge. */}
      <div className="hidden lg:flex items-center pt-48 pb-24">
        <div className="max-w-[1280px] mx-auto px-8 w-full grid grid-cols-2 gap-12 items-center">
          <div
            style={{
              opacity: headIn,
              transform: `translateY(${(1 - headIn) * 34}px)`,
            }}
          >
            <span
              className="inline-flex h-10 w-10 rounded-full items-center justify-center mb-7"
              style={{
                background: "var(--paper)",
                border: "0.5px solid var(--line-strong)",
                color: "var(--clay)",
              }}
            >
              <Sparkles size={16} strokeWidth={2} />
            </span>
            <h2 className="font-display text-[clamp(44px,5vw,84px)] leading-[1.0] tracking-tight mb-6">
              {t("lp.mb.title")}
            </h2>
            <p className="text-lg leading-relaxed max-w-md">
              {subWords.map((w, i) => {
                const wp = easeInOut(clamp01((q - 0.16 - i * 0.018) / 0.3));
                return (
                  <span
                    key={i}
                    style={{
                      display: "inline-block",
                      marginInlineEnd: "0.24em",
                      opacity: wp,
                      filter: `blur(${(1 - wp) * 5}px)`,
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

          <div className="relative h-[440px]">
            {PLANS.map((p, i) => {
              const r = MB_REST[i];
              const cp = easeInOut(seg(q, 0.2 + i * 0.07, 0.82));
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={onEnter}
                  aria-label={t(`lp.plan.name.${p.id}`)}
                  className="absolute left-1/2 top-1/2 w-[224px] h-[210px] bg-transparent p-0 border-0 cursor-pointer focus-visible:outline-none"
                  style={{
                    zIndex: r.z,
                    opacity: clamp01(cp / 0.5),
                    transform:
                      `translate(-50%,-50%) ` +
                      `translate(${r.x * dir * cp}px, ${r.y + (1 - cp) * 280}px) ` +
                      `rotate(${r.rot * dir * cp}deg) scale(${lerp(0.82, r.sc, cp)})`,
                    willChange: "transform, opacity",
                  }}
                >
                  <PlanCardFace plan={p} featured={i === 1} t={t} cur={cur} />
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Mobile / iPad-portrait — static, stacked */}
      <div className="lg:hidden px-6 py-20">
        <Reveal>
          <span
            className="inline-flex h-10 w-10 rounded-full items-center justify-center mb-6"
            style={{
              background: "var(--paper)",
              border: "0.5px solid var(--line-strong)",
              color: "var(--clay)",
            }}
          >
            <Sparkles size={16} strokeWidth={2} />
          </span>
          <h2 className="font-display text-[clamp(36px,9vw,52px)] leading-[1.04] tracking-tight mb-4">
            {t("lp.mb.title")}
          </h2>
          <p className="text-base leading-relaxed mb-10" style={{ color: "var(--ink-2)" }}>
            {t("lp.mb.sub")}
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          {PLANS.map((p, i) => (
            <CardReveal key={p.id} className={i === 1 ? "sm:-translate-y-3" : ""}>
              <button
                type="button"
                onClick={onEnter}
                aria-label={t(`lp.plan.name.${p.id}`)}
                className="block w-full h-[190px] bg-transparent p-0 border-0 cursor-pointer text-start"
              >
                <PlanCardFace plan={p} featured={i === 1} t={t} cur={cur} />
              </button>
            </CardReveal>
          ))}
        </div>
      </div>
    </section>
  );
};

// =====================================================================
// STUDIO FLOW — auto-playing walkthrough of the real presentation
// pipeline: open Studio AI from the Planner → describe the deck →
// Murchid builds it → the finished slides. Content is the real Studio
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
          Tell Murchid what to cover.
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
              Murchid will fill the rest
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

// Step 3 — Murchid building the deck (the real "thinking" state +
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
      <p className="font-serif text-2xl text-ink mb-1">Murchid is thinking…</p>
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
  planner: { title: "murchid.app · planner", Render: FlowPlanner },
  compose: { title: "murchid.app · studio · presentation", Render: FlowCompose },
  building: { title: "studio · generating", Render: FlowBuilding },
  result: { title: "studio · presentation · ready", Render: FlowResult },
};

// Scripted shot list — plays as one continuous take (cursor moves,
// clicks, the prompt types itself, Murchid builds it, the deck appears),
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
  building: "Murchid builds it",
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
            deck in a sentence, and Murchid builds the slides for you.
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
      body: "Murchid drafts. You direct. Every output is a starting point, never the final word — your name goes on the lesson, so your judgment has the last say.",
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
          Murchid is built on four convictions. They shape every screen, every
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
            — The Murchid team
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
const CTA = ({ onEnter, signedIn }) => {
  const t = useT();
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
            {t("lp.cta.eyebrow")}
          </div>
          <h2
            className="font-display text-6xl md:text-8xl leading-[0.98] tracking-tight mb-8"
            style={{ color: "var(--paper)" }}
          >
            {t("lp.cta.h1a")}
            <br />
            {t("lp.cta.h1b")}
          </h2>
          <p
            className="text-xl mb-12 max-w-xl mx-auto leading-relaxed"
            style={{ color: "rgba(247,243,236,0.65)" }}
          >
            {t("lp.cta.sub")}
          </p>

          <button
            type="button"
            onClick={onEnter}
            className="btn-invert inline-flex items-center gap-2 px-7 py-3.5 rounded-lg text-sm font-medium"
          >
            {signedIn ? t("lp.nav.openPlanner") : t("lp.cta.subscribe")}
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
const Footer = ({ onEnter, signedIn, onJump, onPage }) => {
  const t = useT();
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
            <div className="flex items-center mb-5">
              <MurchidLogo
                className="h-[50px] w-auto text-ink"
                style={{ "--murchid-logo-accent": "#8e5435" }}
              />
            </div>
            <p className="font-display text-2xl leading-tight max-w-sm mb-6">
              {t("lp.foot.tagline")}
            </p>
            <p className="text-xs" style={{ color: "var(--ink-3)" }}>
              {t("lp.foot.builtIn")}
            </p>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="eyebrow mb-4">{t("lp.foot.product")}</div>
            <ul className="space-y-2.5 text-sm" style={{ color: "var(--ink-2)" }}>
              <li><FLink onClick={() => onJump("sec-features")}>{t("lp.nav.features")}</FLink></li>
              <li><FLink onClick={() => onJump("sec-how")}>{t("lp.nav.how")}</FLink></li>
              <li><FLink onClick={() => onJump("sec-voices")}>{t("lp.nav.voices")}</FLink></li>
              <li><FLink onClick={() => onPage("pricing")}>{t("lp.foot.pricing")}</FLink></li>
            </ul>
          </div>

          <div className="col-span-6 md:col-span-2">
            <div className="eyebrow mb-4">{t("lp.foot.schools")}</div>
            <ul className="space-y-2.5 text-sm" style={{ color: "var(--ink-2)" }}>
              <li><FLink onClick={() => onPage("schools")}>{t("lp.foot.forSchools")}</FLink></li>
              <li><FLink onClick={() => onPage("moe")}>{t("lp.foot.moe")}</FLink></li>
              <li><FLink onClick={() => onPage("privacy")}>{t("lp.foot.privacy")}</FLink></li>
              <li><FLink onClick={() => onPage("contact")}>{t("lp.foot.contact")}</FLink></li>
            </ul>
          </div>

          <div className="col-span-12 md:col-span-3">
            <div className="eyebrow mb-4">{t("lp.foot.fromTeam")}</div>
            <p
              className="text-sm leading-relaxed mb-4"
              style={{ color: "var(--ink-2)" }}
            >
              {t("lp.foot.teamBody")}
            </p>
            <button
              type="button"
              onClick={onEnter}
              className="text-sm link-quiet font-medium"
            >
              {signedIn ? t("lp.foot.openPlanner") : t("lp.cta.subscribe")}
            </button>
          </div>
        </div>

        <div
          className="pt-8 border-t flex flex-wrap items-center justify-between gap-4 text-xs"
          style={{ borderColor: "var(--line)", color: "var(--ink-3)" }}
        >
          <div>{t("lp.foot.copyright")}</div>
          <div className="flex items-center gap-6">
            <FLink onClick={() => onPage("terms")}>{t("lp.foot.terms")}</FLink>
            <FLink onClick={() => onPage("security")}>{t("lp.foot.security")}</FLink>
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

function PageShell({ eyebrow, title, em, lead, onPage, children, narrow, centered, wide, compact }) {
  const t = useT();
  // `centered` switches the shell to a vertically-centered flex layout
  // — used by short pages like AuthPage that otherwise float at the
  // top of a near-empty viewport. Long content pages keep the default.
  return (
    <main
      className={
        centered
          // pt-28 / md:pt-32 = same nav clearance the non-centered shell
          // uses, so the flex-centering happens in the space BELOW the
          // fixed nav instead of behind it. pb-12 keeps a comfortable
          // bottom margin without throwing off the visual center.
          ? "min-h-[100dvh] flex items-center justify-center px-8 pt-28 md:pt-32 pb-12"
          : compact
            // `compact` packs the page into ~one viewport (used by the plan
            // picker): less nav gap + tight bottom padding.
            ? "pt-20 md:pt-24 pb-8 min-h-screen"
            : "pt-28 md:pt-32 pb-28 min-h-screen"
      }
    >
      <div className={`${narrow ? "max-w-xl" : wide ? "max-w-5xl" : "max-w-3xl"} mx-auto px-8 w-full ${centered ? "text-center" : ""}`}>
        {/* Back to home stays on the leading edge even when the rest
            of the panel is text-centered — wrap in a text-start div so
            the parent's text-center doesn't pull the link to the middle. */}
        <div className={centered ? "text-start" : ""}>
          <button
            type="button"
            onClick={() => onPage("home")}
            className={`link-quiet text-sm inline-flex items-center gap-1.5 ${compact ? "mb-5" : "mb-10"}`}
            style={{ color: "var(--ink-2)" }}
          >
            {t("lp.pg.back")}
          </button>
        </div>
        <div className={`eyebrow ${compact ? "mb-3" : "mb-6"}`}>{eyebrow}</div>
        <h1 className={`font-display ${compact ? "text-3xl md:text-4xl mb-3" : "text-4xl md:text-5xl mb-6"} leading-[1.05] tracking-tight`}>
          {title}
          {em && <em style={{ color: "var(--clay)" }}> {em}</em>}
        </h1>
        {lead && (
          <p
            className={`leading-relaxed ${compact ? "text-lg mb-6" : "text-xl mb-12"}`}
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
  const t = useT();
  const [sent, setSent] = useState(false);
  if (sent) {
    return (
      <div
        className="rounded-2xl p-8 text-center"
        style={{ border: "0.5px solid var(--line)", background: "var(--paper)" }}
      >
        <p className="font-display text-2xl mb-1">{t("lp.pg.contact.sentTitle")}</p>
        <p style={{ color: "var(--ink-2)" }}>
          {t("lp.pg.contact.sentBody")}
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
        placeholder={t("lp.pg.contact.namePh")}
        className="w-full px-4 py-3 rounded-lg text-sm outline-none"
        style={fieldStyle}
      />
      <input
        required
        type="email"
        placeholder={t("lp.pg.emailPh")}
        className="w-full px-4 py-3 rounded-lg text-sm outline-none"
        style={fieldStyle}
      />
      <textarea
        required
        rows={4}
        placeholder={t("lp.pg.contact.msgPh")}
        className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none"
        style={fieldStyle}
      />
      <button
        type="submit"
        className="btn-primary px-6 py-3 rounded-lg text-sm font-medium"
      >
        {t("lp.pg.contact.send")}
      </button>
    </form>
  );
}

// Brand marks — small, recognisable, no external assets.
function GoogleMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
      <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
      <path fill="#FBBC05" d="M3.97 10.72a5.41 5.41 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
      <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
    </svg>
  );
}
function OutlookMark() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <rect x="1" y="1" width="7.4" height="7.4" fill="#F25022" />
      <rect x="9.6" y="1" width="7.4" height="7.4" fill="#7FBA00" />
      <rect x="1" y="9.6" width="7.4" height="7.4" fill="#00A4EF" />
      <rect x="9.6" y="9.6" width="7.4" height="7.4" fill="#FFB900" />
    </svg>
  );
}
function EmailMark() {
  // Editorial envelope glyph — same weight as the provider marks.
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden focusable="false">
      <rect x="2" y="3.5" width="14" height="11" rx="1.5"
        fill="none" stroke="currentColor" strokeWidth="1.4" />
      <path d="M2.5 5.5 L9 10 L15.5 5.5"
        fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  );
}

function ProviderButton({ icon, label, onClick, disabled }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      title={disabled ? "Tick the box below to enable" : undefined}
      className={`w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium transition ${
        disabled ? "cursor-not-allowed opacity-50" : "lift"
      }`}
      style={{ background: "var(--paper)", border: "0.5px solid var(--line-strong)", color: "var(--ink)" }}
    >
      <span className="flex-shrink-0 inline-flex">{icon}</span>
      <span>{label}</span>
    </button>
  );
}

// Sign up — Google / Outlook only. No real auth yet (mock): tapping a
// provider records it and moves to plan onboarding. Swap onSignUp for a
// Firebase popup later; the rest of the funnel is unchanged.
// Returns a human error string, or null when the email is valid.
function validateEmail(email) {
  if (!email) return "Email is required.";
  if (email.length > 254) return "Email is too long.";
  if (email.includes("..")) return "Email can't contain two dots in a row.";
  if (!email.includes("@")) return "Email is missing the @ sign.";
  const m = email.match(/^([^@]+)@([^@]+)$/);
  if (!m) return "Email must have exactly one @ sign.";
  const [, local, domain] = m;
  if (!local) return "Email is missing the part before @.";
  if (local.startsWith(".") || local.endsWith(".")) return "Email can't start or end with a dot before @.";
  if (!/^[a-zA-Z0-9._%+-]+$/.test(local)) return "Email has invalid characters before @.";
  if (!domain) return "Email is missing the domain.";
  if (domain.startsWith(".") || domain.endsWith(".")) return "Email domain can't start or end with a dot.";
  if (domain.startsWith("-") || domain.endsWith("-")) return "Email domain can't start or end with a hyphen.";
  const parts = domain.split(".");
  if (parts.length < 2) return "Email domain is missing a top-level part (e.g. .com).";
  for (const p of parts) {
    if (!p) return "Email domain has an empty section.";
    if (!/^[a-zA-Z0-9-]+$/.test(p)) return "Email domain has invalid characters.";
    if (p.startsWith("-") || p.endsWith("-")) return "Email domain section can't start or end with a hyphen.";
  }
  const tld = parts[parts.length - 1];
  if (tld.length < 2) return "Email's top-level domain is too short.";
  if (!/^[a-zA-Z]+$/.test(tld)) return "Email's top-level domain must be letters only.";
  return null;
}

// Live rule checks — used to drive the per-rule checklist + strength
// bar under the password input. Keep in sync with validatePassword().
function passwordChecks(password) {
  const p = password || "";
  return {
    length:  p.length >= 8,
    upper:   /[A-Z]/.test(p),
    lower:   /[a-z]/.test(p),
    number:  /[0-9]/.test(p),
    special: /[^A-Za-z0-9\s]/.test(p),
  };
}

// 0..5 — count of passed rules. Drives the colored strength bar.
function passwordScore(password) {
  const c = passwordChecks(password);
  return [c.length, c.upper, c.lower, c.number, c.special].filter(Boolean).length;
}

// Returns a human error string, or null when the password is valid.
// Sign-in mode skips strength rules — existing accounts may have been
// created before tightening, and forcing them to reset client-side
// would lock people out when the server-side password is already fine.
function validatePassword(password, { isSignin = false } = {}) {
  if (!password) return "Password is required.";
  if (isSignin) return null;
  if (/\s/.test(password)) return "Password can't contain spaces.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (!/[A-Z]/.test(password)) return "Add at least one uppercase letter (A–Z).";
  if (!/[a-z]/.test(password)) return "Add at least one lowercase letter (a–z).";
  if (!/[0-9]/.test(password)) return "Add at least one number (0–9).";
  if (!/[^A-Za-z0-9]/.test(password)) return "Add at least one symbol (e.g. ! @ # ?).";
  return null;
}

function AuthPage({ onSignUp, onPage, mode = "signup", onEnterStudio }) {
  const t = useT();
  const isSignin = mode === "signin";

  // Silent session restore on AuthPage mount. If Firebase still has a
  // valid token (auto-persisted ~1 year), the user is already authed
  // — no need to ask for an email link or click any provider button.
  // Restore the account locally and bounce straight to the studio.
  //
  // This is the SAME logic the Landing home page runs on mount, but
  // duplicated here because users who click the Sign In nav button
  // arrive directly at AuthPage and skip the home check.
  const [restoring, setRestoring] = useState(true);
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { getIdToken } = await import("../lib/firebaseAuth");
        const token = await getIdToken();
        if (!token || cancelled) { if (!cancelled) setRestoring(false); return; }
        const me = await apiFetch("/api/auth/me");
        if (cancelled || !me?.id) { if (!cancelled) setRestoring(false); return; }
        setAccount({
          provider: "google",
          plan: me.subscription_plan || "annual",
          profile: {
            firstName: me.first_name || "",
            lastName:  me.last_name  || "",
            email:     me.email      || "",
            avatarUrl: me.avatar_url || "",
          },
          role:     me.role,
          sub_role: me.sub_role || null,
          subscriptionStatus: me.subscription_status,
          subscriptionEndsAt: me.subscription_ends_at,
        });
        if (me.role) setLocalRole(me.role);
        if (onEnterStudio) onEnterStudio();
      } catch {
        // No session / no teacher row / network error — fall through
        // and render the normal AuthPage so the user can sign in.
        if (!cancelled) setRestoring(false);
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Sign-up requires explicit, opt-in acceptance of the Terms and the
  // Privacy Policy. Until both are checked, the provider buttons stay
  // disabled — a recorded act of consent (PDPL Article 6) is the
  // lawful basis we rely on for new accounts.
  //
  // Sign-in mode skips the checkbox entirely: the user already accepted
  // when they subscribed, and the consent record lives on the account
  // row server-side. Re-asking adds friction with no legal value.
  const [accepted, setAccepted] = useState(isSignin);
  const [tried, setTried] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  const [authError, setAuthError] = useState(null);
  // Email auth flow states:
  //   "idle"           = provider buttons (Google + Continue with Email) visible
  //   "entering"       = email + password form showing (primary path)
  //   "verify-pending" = signup done, waiting for the user to click the
  //                       verification link in their inbox before we
  //                       advance the funnel to the plan picker
  //   "sent"           = magic sign-in link emailed (new device / forgot-pwd fallback)
  //   "reset-sent"     = password reset link emailed
  const [emailMode, setEmailMode] = useState("idle");
  const [emailValue, setEmailValue] = useState("");
  const [passwordValue, setPasswordValue] = useState("");
  const [confirmValue, setConfirmValue] = useState("");
  const [emailSending, setEmailSending] = useState(false);
  // Track whether the user has interacted with each field so we don't
  // flash "invalid" errors before they've had a chance to type. Set
  // true on first blur OR first failed submit attempt.
  const [emailTouched, setEmailTouched] = useState(false);
  const [passwordTouched, setPasswordTouched] = useState(false);
  const [confirmTouched, setConfirmTouched] = useState(false);
  // One toggle controls both fields — once you can read your own
  // password, you should be able to verify it matches the confirm
  // field without re-toggling.
  const [showPassword, setShowPassword] = useState(false);
  // Verification state. After a fresh signup we hold the Firebase user
  // + the pending onSignUp payload here, then advance once the user has
  // clicked the link in their inbox (polled every 3s via reload).
  const [pendingVerification, setPendingVerification] = useState(null); // { user, payload }
  const [verifyResendCooldown, setVerifyResendCooldown] = useState(0);
  const [verifyChecking, setVerifyChecking] = useState(false);

  // Email validation. Stricter than a one-line regex — catches the
  // common mistakes that pass a permissive pattern:
  //   - issa@hotmail....com   → consecutive dots
  //   - .issa@hotmail.com     → leading dot in local
  //   - issa.@hotmail.com     → trailing dot in local
  //   - issa@hotmail          → missing TLD
  //   - issa@hotmail.c        → TLD too short
  //   - issa@hotmail.123      → TLD not letters
  //   - issa@-hotmail.com     → leading hyphen in domain label
  const emailTrim = emailValue.trim();
  const emailError = validateEmail(emailTrim);

  // Sign-up: 8+ chars + upper + lower + number + symbol. Sign-in skips
  // the strength rules — legacy accounts may pre-date them.
  const passwordError = validatePassword(passwordValue, { isSignin });
  // Live rule satisfaction + score for the strength meter / checklist
  // under the password input. Only rendered in sign-up mode.
  const pwChecks = passwordChecks(passwordValue);
  const pwScore  = passwordValue ? passwordScore(passwordValue) : 0;
  const pwStrength = (() => {
    if (pwScore <= 1) return { label: "Weak",   tone: "var(--clay, #b3442b)" };
    if (pwScore === 2) return { label: "Weak",  tone: "var(--clay, #b3442b)" };
    if (pwScore === 3) return { label: "Fair",  tone: "#b8862a" };
    if (pwScore === 4) return { label: "Good",  tone: "#5a7a4a" };
    return { label: "Strong", tone: "#3f5c34" };
  })();
  // Confirm-password check. Sign-in mode skips it entirely (there's no
  // second field rendered). Empty confirm is treated as "required" once
  // the field has been touched, otherwise as not-yet-an-error.
  const confirmError = (() => {
    if (isSignin) return null;
    if (!confirmValue) return "Please re-enter the password.";
    if (confirmValue !== passwordValue) return "Passwords don't match.";
    return null;
  })();
  // True only once the user has typed both fields AND they match — drives
  // the green "Passwords match" hint under the confirm input.
  const confirmMatches =
    !isSignin && passwordValue.length > 0 && confirmValue === passwordValue && !passwordError;

  // (Earlier versions ran a live "is this email already registered?"
  // check via fetchSignInMethodsForEmail. Firebase's email-enumeration
  // protection — ON by default for new projects — makes that lookup
  // always return empty regardless of existence, so the hint never
  // fired usefully. Removed; the submit-time auth/email-already-in-use
  // error already catches duplicates correctly.)
  const handleProvider = async (provider) => {
    if (!accepted) {
      setTried(true);
      return;
    }
    setAuthError(null);
    setSigningIn(true);
    try {
      // Both providers resolve to the same Firebase User shape, so the
      // downstream funnel (profile prefill, plan picker, bootstrap)
      // doesn't care which one was tapped.
      const lib = await import("../lib/firebaseAuth");
      const user = provider === "google"
        ? await lib.signInWithGoogle()
        : await lib.signInWithMicrosoft();
      onSignUp(provider, {
        acceptedAt: new Date().toISOString(),
        legalVersion: LEGAL_VERSION,
        firebaseUser: {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
        },
      });
    } catch (e) {
      // Always log so the browser console has the full error object —
      // makes diagnosing provider-config issues possible without re-
      // running the flow in dev tools.
      console.error(`[auth/${provider}]`, e);

      // Normalise the provider name. The AuthPage button labelled
      // "Continue with Outlook" passes "outlook"; downstream copy and
      // branching is easier when we treat outlook + microsoft as the
      // same Microsoft path.
      const isMicrosoft = provider === "outlook" || provider === "microsoft";
      const providerLabel = provider === "google" ? "Google" : "Microsoft";

      const code = e?.code || "";
      if (code === "auth/cancelled-popup-request") {
        // Two clicks too fast — Firebase noise, keep silent.
      } else if (code === "auth/popup-blocked") {
        setAuthError("Your browser blocked the sign-in popup. Allow popups for this site and try again.");
      } else if (code === "auth/popup-closed-by-user") {
        // For Microsoft this usually means the Azure-side flow rejected
        // the sign-in: most often "Supported account types" is set to
        // a tenant that doesn't include this user's account, OR the
        // user denied consent. For Google it's almost always a real
        // user cancel.
        if (isMicrosoft) {
          setAuthError(
            "The Microsoft sign-in popup closed before completing. " +
            "If you didn't cancel, this usually means your Microsoft account " +
            "isn't allowed by the app's tenant settings. Try Google for now, " +
            "or contact support."
          );
        }
      } else {
        const friendly = {
          "auth/operation-not-allowed":
            `${providerLabel} sign-in isn't enabled on this project yet.`,
          "auth/unauthorized-domain":
            "This domain isn't authorised for sign-in. Add it under Authentication → Settings → Authorised domains.",
          "auth/account-exists-with-different-credential":
            `An account with this email already exists, signed up with the other provider. Try the other button.`,
          "auth/network-request-failed":
            "Network error during sign-in. Check your connection and try again.",
          "auth/invalid-credential":
            `${providerLabel} rejected the credential. Try again, and if it persists check the provider settings on the server.`,
        }[code];
        setAuthError(friendly || (e?.message || String(e)));
      }
      setSigningIn(false);
    }
  };

  // Email + password — the primary email path. Set once at sign-up,
  // used instantly forever after with no inbox round-trip. Firebase
  // session persists ~1 year so the password rarely gets retyped after
  // the first sign-in on a device.
  const handleEmailPassword = async () => {
    if (!accepted) { setTried(true); return; }
    // Surface every inline error by marking every field touched, then
    // gate the actual call on validity. Without this, a user who never
    // tabs out of the input doesn't see the inline hint.
    setEmailTouched(true);
    setPasswordTouched(true);
    if (!isSignin) setConfirmTouched(true);
    if (emailError || passwordError) return;
    if (!isSignin && confirmError) return;
    const email = emailTrim;
    const password = passwordValue;
    setAuthError(null);
    setEmailSending(true);
    try {
      const lib = await import("../lib/firebaseAuth");
      const user = isSignin
        ? await lib.signInWithEmail(email, password)
        : await lib.signUpWithEmail(email, password);
      const payload = {
        acceptedAt: new Date().toISOString(),
        legalVersion: LEGAL_VERSION,
        firebaseUser: {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          photoURL: user.photoURL || "",
        },
      };
      // Sign-in: continue straight to the studio bootstrap. The account
      // either pre-dates verification or already verified previously.
      // Sign-up: pause the funnel and ask the user to click the link in
      // their inbox first. Polling below flips us back into onSignUp.
      if (isSignin) {
        onSignUp("email", payload);
      } else {
        await lib.sendVerificationEmail(user);
        setPendingVerification({ user, payload });
        setEmailMode("verify-pending");
        setVerifyResendCooldown(45);
      }
    } catch (e) {
      console.error(`[auth/email-${isSignin ? "signin" : "signup"}]`, e);
      const code = e?.code || "";
      const friendly = {
        "auth/invalid-email":            "That email address doesn't look valid.",
        "auth/weak-password":            "Pick a stronger password (8+ characters).",
        "auth/email-already-in-use":     "An account with this email already exists. Try signing in instead.",
        "auth/invalid-credential":       "Wrong email or password.",
        "auth/user-not-found":           "No account with this email. Try subscribing instead.",
        "auth/wrong-password":           "Wrong password. Use 'Forgot password' if you don't remember it.",
        "auth/too-many-requests":        "Too many attempts. Wait a minute and try again, or reset your password.",
        "auth/operation-not-allowed":
          "Email/password sign-in isn't enabled yet. Enable it in Firebase Console → Authentication → Sign-in method → Email/Password.",
        "auth/network-request-failed":   "Network error. Check your connection and try again.",
      }[code];
      setAuthError(friendly || (e?.message || String(e)));
    } finally {
      setEmailSending(false);
    }
  };

  // Send a password reset email (used by the "Forgot password" link in
  // sign-in mode). Firebase emails a link to reset the password; the
  // user comes back and signs in normally afterwards.
  const handleForgotPassword = async () => {
    const email = emailValue.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError("Enter your email above first, then click 'Forgot password'.");
      return;
    }
    setAuthError(null);
    setEmailSending(true);
    try {
      const lib = await import("../lib/firebaseAuth");
      await lib.sendPasswordReset(email);
      setEmailMode("reset-sent");
    } catch (e) {
      console.error("[auth/password-reset]", e);
      setAuthError(e?.message || String(e));
    } finally {
      setEmailSending(false);
    }
  };

  // ── Email verification (signup gate) ───────────────────────────────
  //
  // After signUpWithEmail we sit in emailMode === "verify-pending" until
  // the user clicks the link in their inbox. Two paths can flip us out:
  //
  //   1. Manual: user clicks "I've verified — continue", which calls
  //      reload() once and advances if emailVerified is true.
  //   2. Automatic: a 3s poll calls reload() in the background so the
  //      user doesn't have to come back and tap anything — the funnel
  //      advances as soon as Firebase sees the verification.
  //
  // Polling stops when the component unmounts OR we leave verify-pending
  // mode OR the verification succeeds.
  useEffect(() => {
    if (emailMode !== "verify-pending" || !pendingVerification) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const lib = await import("../lib/firebaseAuth");
        const fresh = await lib.reloadCurrentUser();
        if (cancelled) return;
        if (fresh && fresh.emailVerified) {
          // Hand the original signup payload to the parent funnel —
          // unchanged from the synchronous handleEmailPassword path.
          onSignUp("email", pendingVerification.payload);
          setPendingVerification(null);
        }
      } catch {
        // Network blip — swallow and try again next tick.
      }
    };
    const id = setInterval(tick, 3000);
    return () => { cancelled = true; clearInterval(id); };
  }, [emailMode, pendingVerification, onSignUp]);

  // Resend-button cooldown countdown — once a second until it hits zero.
  useEffect(() => {
    if (verifyResendCooldown <= 0) return;
    const id = setTimeout(() => setVerifyResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [verifyResendCooldown]);

  const handleVerifyCheck = async () => {
    if (!pendingVerification) return;
    setVerifyChecking(true);
    setAuthError(null);
    try {
      const lib = await import("../lib/firebaseAuth");
      const fresh = await lib.reloadCurrentUser();
      if (fresh && fresh.emailVerified) {
        onSignUp("email", pendingVerification.payload);
        setPendingVerification(null);
      } else {
        setAuthError("We still don't see a verified email — click the link in your inbox, then tap this again.");
      }
    } catch (e) {
      setAuthError(e?.message || String(e));
    } finally {
      setVerifyChecking(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerification || verifyResendCooldown > 0) return;
    setAuthError(null);
    try {
      const lib = await import("../lib/firebaseAuth");
      await lib.sendVerificationEmail(pendingVerification.user);
      setVerifyResendCooldown(45);
    } catch (e) {
      console.error("[auth/verify/resend]", e);
      setAuthError(e?.message || String(e));
    }
  };

  // Magic-link fallback. Stays available for users without a password
  // (legacy magic-link signups) and as a no-password-needed alternative
  // on new devices.
  const handleSendEmailLink = async () => {
    if (!accepted) { setTried(true); return; }
    const email = emailValue.trim();
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setAuthError("Please enter a valid email address.");
      return;
    }
    setAuthError(null);
    setEmailSending(true);
    try {
      const lib = await import("../lib/firebaseAuth");
      await lib.sendEmailLink(email);
      setEmailMode("sent");
    } catch (e) {
      console.error("[auth/email-link/send]", e);
      const code = e?.code || "";
      const friendly = {
        "auth/invalid-email": "That email address doesn't look valid.",
        "auth/operation-not-allowed":
          "Email link sign-in isn't enabled yet.",
        "auth/unauthorized-domain":
          "This domain isn't authorised for sign-in.",
        "auth/network-request-failed":
          "Network error. Check your connection and try again.",
      }[code];
      setAuthError(friendly || (e?.message || String(e)));
    } finally {
      setEmailSending(false);
    }
  };

  // Restoring? Show a minimal loader so the user doesn't see the
  // sign-in form flash before getting auto-redirected to the studio.
  // Capped at ~1.5s by the session-restore effect's typical roundtrip.
  if (restoring) {
    return (
      <PageShell
        eyebrow={isSignin ? t("lp.auth.signin.eyebrow") : t("lp.auth.eyebrow")}
        title={isSignin ? t("lp.auth.signin.title") : t("lp.auth.title")}
        em={isSignin ? t("lp.auth.signin.titleEm") : t("lp.auth.titleEm")}
        lead={isSignin ? t("lp.auth.signin.lead") : t("lp.auth.lead")}
        onPage={onPage}
        narrow
        centered
      >
        <div className="max-w-sm mx-auto flex justify-center py-8">
          <div className="relative w-32 h-px bg-line/60 overflow-hidden">
            <span className="absolute top-0 left-0 h-px w-12 bg-accent brand-loader-sweep" />
          </div>
        </div>
      </PageShell>
    );
  }

  return (
    <PageShell
      eyebrow={isSignin ? t("lp.auth.signin.eyebrow") : t("lp.auth.eyebrow")}
      title={isSignin ? t("lp.auth.signin.title") : t("lp.auth.title")}
      em={isSignin ? t("lp.auth.signin.titleEm") : t("lp.auth.titleEm")}
      lead={isSignin ? t("lp.auth.signin.lead") : t("lp.auth.lead")}
      onPage={onPage}
      narrow
      centered
    >
      <div className={`space-y-3 max-w-sm mx-auto transition-opacity ${accepted ? "opacity-100" : "opacity-90"}`}>
        {emailMode === "idle" && (
          <>
            <ProviderButton
              icon={<GoogleMark />}
              label={signingIn ? "Opening sign-in…" : t("lp.auth.google")}
              onClick={() => handleProvider("google")}
              disabled={!accepted || signingIn}
            />
            <ProviderButton
              icon={<EmailMark />}
              label={t("lp.auth.email") || "Continue with Email"}
              onClick={() => { if (!accepted) { setTried(true); return; } setAuthError(null); setEmailMode("entering"); }}
              disabled={!accepted || signingIn}
            />
          </>
        )}

        {emailMode === "entering" && (
          <div className="space-y-3">
            <p className="text-xs text-center text-muted">
              {isSignin
                ? "Sign in with the email + password you set when you subscribed."
                : "Pick a strong password — 8+ chars with upper, lower, number, and a symbol."}
            </p>
            <div>
              <input
                type="email"
                autoFocus
                autoComplete="email"
                value={emailValue}
                onChange={(e) => setEmailValue(e.target.value)}
                onBlur={() => setEmailTouched(true)}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEmailPassword(); } }}
                placeholder="you@school.ae"
                className="w-full px-5 py-3.5 rounded-xl text-sm text-ink"
                style={{
                  background: "var(--paper)",
                  border: `0.5px solid ${emailTouched && emailError ? "var(--clay, #b3442b)" : "var(--line-strong)"}`,
                }}
                disabled={emailSending}
                aria-invalid={emailTouched && emailError ? "true" : "false"}
                aria-describedby={emailTouched && emailError ? "auth-email-error" : undefined}
                dir="ltr"
              />
              {emailTouched && emailError && (
                <p
                  id="auth-email-error"
                  role="alert"
                  className="text-xs mt-1.5 ps-1"
                  style={{ color: "var(--clay, #b3442b)" }}
                >
                  {emailError}
                </p>
              )}
            </div>
            <div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete={isSignin ? "current-password" : "new-password"}
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEmailPassword(); } }}
                  placeholder={isSignin ? "Your password" : "Create a password"}
                  className="w-full ps-5 pe-12 py-3.5 rounded-xl text-sm text-ink"
                  style={{
                    background: "var(--paper)",
                    border: `0.5px solid ${passwordTouched && passwordError ? "var(--clay, #b3442b)" : "var(--line-strong)"}`,
                  }}
                  disabled={emailSending}
                  aria-invalid={passwordTouched && passwordError ? "true" : "false"}
                  aria-describedby={passwordTouched && passwordError ? "auth-password-error" : "auth-password-meter"}
                  dir="ltr"
                  minLength={8}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                  className="absolute end-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-paper-warm/70"
                  style={{ color: "var(--ink-soft, #8a7e63)" }}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
              {passwordTouched && passwordError && (
                <p
                  id="auth-password-error"
                  role="alert"
                  className="text-xs mt-1.5 ps-1"
                  style={{ color: "var(--clay, #b3442b)" }}
                >
                  {passwordError}
                </p>
              )}
              {/* Strength meter + per-rule checklist — sign-up only.
                  Renders once the user starts typing so an empty field
                  doesn't shout requirements before they've engaged. */}
              {!isSignin && passwordValue && (
                <div id="auth-password-meter" className="mt-2.5 space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 grid grid-cols-5 gap-1" aria-hidden="true">
                      {[1, 2, 3, 4, 5].map((i) => (
                        <span
                          key={i}
                          className="h-1 rounded-full transition-colors"
                          style={{
                            background: i <= pwScore ? pwStrength.tone : "var(--line, #e6dcc6)",
                          }}
                        />
                      ))}
                    </div>
                    <span
                      className="text-[10px] font-mono uppercase tracking-[0.15em]"
                      style={{ color: pwStrength.tone }}
                      aria-live="polite"
                    >
                      {pwStrength.label}
                    </span>
                  </div>
                  <ul className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px] ps-1">
                    {[
                      { ok: pwChecks.length,  label: "8+ characters" },
                      { ok: pwChecks.upper,   label: "Uppercase (A–Z)" },
                      { ok: pwChecks.lower,   label: "Lowercase (a–z)" },
                      { ok: pwChecks.number,  label: "Number (0–9)" },
                      { ok: pwChecks.special, label: "Symbol (! @ # ?)" },
                    ].map((r) => (
                      <li
                        key={r.label}
                        className="inline-flex items-center gap-1.5"
                        style={{ color: r.ok ? "#3f5c34" : "var(--ink-soft, #8a7e63)" }}
                      >
                        <span
                          aria-hidden="true"
                          className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px]"
                          style={{
                            background: r.ok ? "#dfe8d6" : "transparent",
                            border: r.ok ? "none" : "1px solid var(--line, #e6dcc6)",
                            color: r.ok ? "#3f5c34" : "transparent",
                          }}
                        >
                          ✓
                        </span>
                        {r.label}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            {/* Confirm password — sign-up only. Catches typos before the
                user is locked into a password they can't remember. */}
            {!isSignin && (
              <div>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    autoComplete="new-password"
                    value={confirmValue}
                    onChange={(e) => setConfirmValue(e.target.value)}
                    onBlur={() => setConfirmTouched(true)}
                    onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEmailPassword(); } }}
                    placeholder="Confirm password"
                    className="w-full ps-5 pe-12 py-3.5 rounded-xl text-sm text-ink"
                    style={{
                      background: "var(--paper)",
                      border: `0.5px solid ${
                        confirmMatches
                          ? "#5a7a4a"
                          : confirmTouched && confirmError
                            ? "var(--clay, #b3442b)"
                            : "var(--line-strong)"
                      }`,
                    }}
                    disabled={emailSending}
                    aria-invalid={confirmTouched && confirmError ? "true" : "false"}
                    aria-describedby={confirmTouched && confirmError ? "auth-confirm-error" : undefined}
                    dir="ltr"
                    minLength={8}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    aria-pressed={showPassword}
                    className="absolute end-3 top-1/2 -translate-y-1/2 inline-flex items-center justify-center w-8 h-8 rounded-md transition-colors hover:bg-paper-warm/70"
                    style={{ color: "var(--ink-soft, #8a7e63)" }}
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {confirmTouched && confirmError && (
                  <p
                    id="auth-confirm-error"
                    role="alert"
                    className="text-xs mt-1.5 ps-1"
                    style={{ color: "var(--clay, #b3442b)" }}
                  >
                    {confirmError}
                  </p>
                )}
                {confirmMatches && (
                  <p
                    className="text-xs mt-1.5 ps-1 inline-flex items-center gap-1.5"
                    style={{ color: "#3f5c34" }}
                  >
                    <span
                      aria-hidden="true"
                      className="inline-flex items-center justify-center w-3.5 h-3.5 rounded-full text-[9px]"
                      style={{ background: "#dfe8d6", color: "#3f5c34" }}
                    >
                      ✓
                    </span>
                    Passwords match
                  </p>
                )}
              </div>
            )}
            <ProviderButton
              icon={<EmailMark />}
              label={emailSending
                ? (isSignin ? "Signing in…" : "Creating account…")
                : (isSignin ? "Sign in" : "Create account")}
              onClick={handleEmailPassword}
              disabled={!accepted || emailSending || !!emailError || !!passwordError || (!isSignin && !!confirmError)}
            />
            {isSignin && (
              <div className="flex flex-col items-center gap-2 pt-1">
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-muted hover:text-ink transition"
                  disabled={emailSending}
                >
                  Forgot password?
                </button>
                <button
                  type="button"
                  onClick={handleSendEmailLink}
                  className="text-xs text-muted hover:text-ink transition"
                  disabled={emailSending}
                >
                  Or sign in with a one-time link instead
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => { setEmailMode("idle"); setAuthError(null); }}
              className="w-full text-xs text-muted hover:text-ink transition pt-1"
            >
              ← back to all options
            </button>
          </div>
        )}

        {emailMode === "verify-pending" && (
          <div className="text-center space-y-4 py-2">
            <div
              className="inline-flex items-center justify-center w-12 h-12 rounded-full"
              style={{ background: "var(--paper-warm, #ede4d3)" }}
            >
              <EmailMark />
            </div>
            <div className="space-y-1.5">
              <p className="text-sm text-ink font-medium">Verify your email to continue.</p>
              <p className="text-xs text-muted leading-relaxed">
                We sent a verification link to{" "}
                <span className="text-ink">{emailValue}</span>.
                Click it, then this page will continue automatically.
              </p>
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <ProviderButton
                icon={<EmailMark />}
                label={verifyChecking ? "Checking…" : "I've verified — continue"}
                onClick={handleVerifyCheck}
                disabled={verifyChecking}
              />
              <button
                type="button"
                onClick={handleResendVerification}
                className="text-xs text-muted hover:text-ink transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={verifyResendCooldown > 0}
              >
                {verifyResendCooldown > 0
                  ? `Resend link in ${verifyResendCooldown}s`
                  : "Didn't get it? Resend link"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingVerification(null);
                  setEmailMode("entering");
                  setAuthError(null);
                }}
                className="text-xs text-muted hover:text-ink transition"
              >
                ← Change email
              </button>
            </div>
            <p className="text-[10.5px] text-muted/80 leading-relaxed">
              Check your spam folder if you don't see it within a minute.
            </p>
          </div>
        )}

        {emailMode === "sent" && (
          <div className="text-center space-y-3 py-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full" style={{ background: "var(--paper-warm, #ede4d3)" }}>
              <EmailMark />
            </div>
            <p className="text-sm text-ink">Check your inbox.</p>
            <p className="text-xs text-muted leading-relaxed">
              We sent a one-time sign-in link to <span className="text-ink">{emailValue}</span>.
              Click it to finish signing in.
              <br />
              Don't see it? Check spam, or
              <button
                type="button"
                onClick={() => { setEmailMode("entering"); }}
                className="ml-1 underline hover:text-ink"
              >
                try a different email
              </button>.
            </p>
          </div>
        )}

        {emailMode === "reset-sent" && (
          <div className="text-center space-y-3 py-2">
            <div className="inline-flex items-center justify-center w-12 h-12 rounded-full" style={{ background: "var(--paper-warm, #ede4d3)" }}>
              <EmailMark />
            </div>
            <p className="text-sm text-ink">Password reset sent.</p>
            <p className="text-xs text-muted leading-relaxed">
              We emailed a reset link to <span className="text-ink">{emailValue}</span>.
              Click it, pick a new password, then come back here to sign in.
              <br />
              <button
                type="button"
                onClick={() => { setEmailMode("entering"); }}
                className="mt-2 underline hover:text-ink"
              >
                ← back to sign in
              </button>
            </p>
          </div>
        )}

        {authError && emailMode !== "sent" && emailMode !== "reset-sent" && (
          <p role="alert" className="text-xs text-center" style={{ color: "var(--clay, #b3442b)" }}>
            {authError}
          </p>
        )}
      </div>

      {/* Legal acceptance block — sign-up only. Returning users already
          accepted when they subscribed; that consent record lives on
          the account row server-side. Re-asking adds friction with no
          legal value. */}
      {!isSignin && (
        <div className="max-w-sm mx-auto mt-6">
          <label className="flex items-start gap-3 text-start cursor-pointer select-none">
            <input
              type="checkbox"
              checked={accepted}
              onChange={(e) => { setAccepted(e.target.checked); if (e.target.checked) setTried(false); }}
              // Native checkbox, scaled up so it's easy to tap. We avoid
              // custom-painted boxes here because the legal acceptance
              // checkbox should remain unmistakable as a real form
              // control on every browser and assistive tech.
              className="mt-0.5 h-4 w-4 flex-shrink-0 accent-[color:var(--clay,#b3442b)] cursor-pointer"
              aria-describedby="auth-terms-text auth-terms-error"
              required
            />
            <span
              id="auth-terms-text"
              className="text-sm leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              I have read and agree to the{" "}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); onPage("terms"); }}
                className="underline decoration-from-font font-medium hover:text-[color:var(--clay,#b3442b)]"
              >Terms &amp; Conditions</button>{" "}
              and the{" "}
              <button
                type="button"
                onClick={(e) => { e.preventDefault(); onPage("privacy"); }}
                className="underline decoration-from-font font-medium hover:text-[color:var(--clay,#b3442b)]"
              >Privacy Policy</button>, including the processing of my data
              under UAE Federal Decree-Law No. 45 of 2021 (PDPL).
            </span>
          </label>
          {tried && !accepted && (
            <p
              id="auth-terms-error"
              role="alert"
              className="text-xs mt-2 ps-7"
              style={{ color: "var(--clay, #b3442b)" }}
            >
              Please confirm you agree to the Terms and Privacy Policy before continuing.
            </p>
          )}
        </div>
      )}

      <p className="text-xs mt-6 text-center" style={{ color: "var(--ink-3)" }}>
        {t("lp.auth.only")}
      </p>
    </PageShell>
  );
}

// Onboarding — pick a membership. Choosing a plan finalises the mock
// account and drops the teacher straight into the planner.
function OnboardingPage({ onChoosePlan, onPage }) {
  const t = useT();
  const cur = t("lp.plan.aed");
  // Plan provisioning can take several seconds (Firebase token refresh
  // + Neon insert + profile patch + per-school attach). Without a
  // visible loading state, users hammer the button and trigger
  // duplicate POSTs. We swallow further clicks once one is in flight,
  // and overlay a BrandLoader so the whole funnel reads as "working".
  const [pickingPlan, setPickingPlan] = useState(null);
  const choose = async (planId) => {
    if (pickingPlan) return;
    setPickingPlan(planId);
    try {
      await onChoosePlan(planId);
      // On success the studio opens and this component unmounts — the
      // setPickingPlan(null) below never runs. On failure (alert in the
      // handler), we drop back here and clear so the user can retry.
    } finally {
      setPickingPlan(null);
    }
  };
  return (
    <PageShell
      eyebrow={t("lp.ob.eyebrow")}
      title={t("lp.ob.title")}
      em={t("lp.ob.titleEm")}
      lead={t("lp.ob.lead")}
      onPage={onPage}
      wide
      compact
    >
      {/* Plan cards — same visual treatment as the Membership section
          (clay/orange "Popular" middle card, cream side cards) but laid
          out in a clean selectable grid with a "Choose plan" CTA and a
          7-day free-trial line on each card. */}
      <div className="plans-grid plan-picker-grid">
        {PLANS.map((p) => {
          const featured = !!p.best;
          const billed =
            p.cycle === "yr"
              ? t("lp.plan.billed.yr", { total: p.total, cur })
              : p.cycle === "q"
                ? t("lp.plan.billed.q", { total: p.total, cur })
                : t("lp.plan.billed.mo");
          return (
            <article key={p.id} className={`plans-card${featured ? " featured" : ""}`}>
              {featured && <div className="plans-badge">{t("lp.plan.popular")}</div>}
              <div className="plans-name">{t(`lp.plan.name.${p.id}`)}</div>
              <div className="plans-price">
                <span className="plans-price-n">{p.perMonth}</span>
                <span className="plans-price-c">{cur} {t("lp.plan.perMo")}</span>
              </div>
              <div className="plans-bill">{billed}</div>
              {p.savePct > 0 && (
                <div className="plans-bill" style={{ opacity: 0.85 }}>
                  {t("lp.plan.save", { n: p.savePct })}
                </div>
              )}
              <button
                type="button"
                className="plans-cta"
                onClick={() => choose(p.id)}
                disabled={!!pickingPlan}
                style={pickingPlan ? { opacity: 0.6, cursor: "not-allowed" } : undefined}
              >
                {pickingPlan === p.id
                  ? (t("lp.plan.choosing") || "Setting up…")
                  : t("lp.plan.choose")}
              </button>
            </article>
          );
        })}
      </div>

      {/* Trial CTA — wide banner matching the 3 cards' width above
          (max-w-4xl, rounded-[24px]), kept low in height so it doesn't
          overwhelm the cards. Premium feel from the warm clay radial
          glow inside + a sprinkle of subtle sparkle particles, all
          quietly animating on their own (shimmer + breathe + twinkle)
          so the button feels alive without needing hover. */}
      <div
        className="group relative mt-5 w-full rounded-[24px] overflow-hidden flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-7 py-4"
        style={{
          background:
            "radial-gradient(ellipse 92% 64% at 50% 14%, oklch(0.64 0.13 42), transparent 72%), var(--cm-clay)",
          color: "var(--paper)",
          boxShadow:
            "0 14px 30px -12px rgba(26,24,20,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
        }}
      >
        {/* Warm-clay inner glow — breathes continuously, intensifies on hover */}
        <span
          aria-hidden="true"
          className="murchid-trial-glow absolute inset-0 pointer-events-none transition-opacity duration-500 group-hover:!opacity-100"
          style={{
            background:
              "radial-gradient(60% 100% at 50% 100%, rgba(181,117,78,0.55), rgba(26,24,20,0) 70%)",
            animation: "murchid-trial-glow 4.5s ease-in-out infinite",
          }}
        />
        {/* Slow diagonal shimmer sweeping across the bar */}
        <span
          aria-hidden="true"
          className="murchid-trial-shimmer absolute inset-y-0 -left-1/2 w-1/2 pointer-events-none"
          style={{
            background:
              "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)",
            animation: "murchid-trial-shimmer 6s linear infinite",
          }}
        />
        {/* Subtle sparkle particles, each twinkling on a staggered delay */}
        <span aria-hidden="true" className="murchid-trial-twinkle absolute top-3 start-[10%] w-0.5 h-0.5 rounded-full" style={{ background: "var(--paper)", animation: "murchid-trial-twinkle 3.6s ease-in-out infinite", animationDelay: "0s" }} />
        <span aria-hidden="true" className="murchid-trial-twinkle absolute bottom-3 end-[16%] w-px h-px rounded-full" style={{ background: "var(--paper)", animation: "murchid-trial-twinkle 4.2s ease-in-out infinite", animationDelay: "-0.8s" }} />
        <span aria-hidden="true" className="murchid-trial-twinkle absolute top-4 end-[8%] w-0.5 h-0.5 rounded-full" style={{ background: "var(--paper)", animation: "murchid-trial-twinkle 3.2s ease-in-out infinite", animationDelay: "-1.6s" }} />
        <span aria-hidden="true" className="murchid-trial-twinkle absolute top-2 start-[38%] w-px h-px rounded-full" style={{ background: "var(--paper)", animation: "murchid-trial-twinkle 4s ease-in-out infinite", animationDelay: "-2.2s" }} />
        <span aria-hidden="true" className="murchid-trial-twinkle absolute bottom-4 start-[8%] w-0.5 h-0.5 rounded-full" style={{ background: "var(--paper)", animation: "murchid-trial-twinkle 3.8s ease-in-out infinite", animationDelay: "-1.1s" }} />
        <span aria-hidden="true" className="murchid-trial-twinkle absolute bottom-2 start-[60%] w-px h-px rounded-full" style={{ background: "var(--paper)", animation: "murchid-trial-twinkle 4.4s ease-in-out infinite", animationDelay: "-0.4s" }} />

        {/* Left — title + subtitle, left-aligned */}
        <div className="relative min-w-0 text-start">
          <div className="inline-flex items-center gap-2.5">
            <Sparkles size={18} strokeWidth={2} style={{ color: "var(--paper)" }} />
            <span className="font-display text-lg md:text-xl leading-tight">
              {t("lp.plan.trialTitle")}
            </span>
          </div>
          <p className="text-[12.5px] mt-1.5" style={{ color: "rgba(247,243,236,0.66)" }}>
            {t("lp.plan.trialNote")}
          </p>
        </div>

        {/* Right — the CTA button (cream pill, same family as the hero).
            "trial" is its own pseudo-plan: no payment, 7-day window
            (TRIAL_DAYS in lib/plans.js). The picker cards above all go
            to the paid path. */}
        <button
          type="button"
          onClick={() => choose("trial")}
          className="cinema-pill flex-shrink-0"
          disabled={!!pickingPlan}
          style={pickingPlan ? { opacity: 0.7, cursor: "not-allowed" } : undefined}
        >
          {pickingPlan === "trial"
            ? (t("lp.plan.trialStarting") || "Starting your trial…")
            : t("lp.plan.trialCta")}
        </button>
      </div>
      <p className="text-xs mt-5" style={{ color: "var(--ink-3)" }}>
        {t("lp.ob.note")}
      </p>
      {/* Full-screen overlay during provisioning — blocks every
          interactive element under it so the user can't double-submit,
          and gives them a clear "we're working" signal instead of an
          unresponsive page. Unmounts as soon as the studio opens. */}
      {pickingPlan && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center"
          style={{ background: "rgba(247,243,236,0.92)", backdropFilter: "blur(6px)" }}
          role="status"
          aria-live="polite"
        >
          <BrandLoader
            label={
              pickingPlan === "trial"
                ? (t("lp.plan.trialStarting") || "Starting your free trial…")
                : (t("lp.plan.settingUp") || "Setting up your account…")
            }
          />
        </div>
      )}
    </PageShell>
  );
}

// Long-form legal document renderer — Privacy Policy / Terms &
// Conditions. Content trees live in lib/legal.js so the binding text
// is versioned and reviewed separately from the marketing UI. The
// renderer handles paragraphs, ordered/unordered lists, and one
// level of sub-section nesting.
function LegalBody({ items }) {
  if (!Array.isArray(items)) return null;
  return (
    <>
      {items.map((item, i) => {
        if (item.p) {
          return (
            <p
              key={i}
              className="mb-4 leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              {item.p}
            </p>
          );
        }
        if (item.strong) {
          return (
            <p key={i} className="mb-4 font-semibold leading-relaxed">
              {item.strong}
            </p>
          );
        }
        if (Array.isArray(item.list)) {
          return (
            <ul
              key={i}
              className="mb-4 ms-5 list-disc space-y-1.5 leading-relaxed"
              style={{ color: "var(--ink-2)" }}
            >
              {item.list.map((li, li_i) => (
                <li key={li_i} className="ps-1">{li}</li>
              ))}
            </ul>
          );
        }
        if (item.sub) {
          return (
            <div key={i} className="mb-4">
              <h3 className="font-display text-lg mt-3 mb-2 leading-tight">
                {item.sub}
              </h3>
              <LegalBody items={item.body} />
            </div>
          );
        }
        return null;
      })}
    </>
  );
}

function LegalPage({ doc, onPage }) {
  const t = useT();
  return (
    <PageShell
      eyebrow={t("lp.pg.privacy.eyebrow") /* shared "Legal" eyebrow */}
      title={doc.title}
      em=""
      lead={`Effective ${LEGAL_EFFECTIVE_DATE} · Version ${LEGAL_VERSION}`}
      onPage={onPage}
    >
      <div className="mb-8 rounded-lg border px-4 py-3 text-sm leading-relaxed"
        style={{
          color: "var(--ink-2)",
          borderColor: "var(--ink-1, rgba(15,20,16,0.12))",
          background: "var(--paper-warm, rgba(255,253,246,0.6))",
        }}
      >
        This document is governed by the laws of the United Arab Emirates,
        including UAE Federal Decree-Law No. 45 of 2021 on the Protection
        of Personal Data, and is published in English. An Arabic version
        is available on request.
      </div>

      <LegalBody items={doc.intro} />

      {doc.sections.map((s, i) => (
        <section key={i} className="mt-10">
          <h2 className="font-display text-2xl md:text-3xl mb-4 leading-tight">
            {s.heading}
          </h2>
          <LegalBody items={s.body} />
        </section>
      ))}

      <p className="mt-12 text-sm" style={{ color: "var(--ink-3)" }}>
        Last updated {LEGAL_EFFECTIVE_DATE} · {doc.title} v{LEGAL_VERSION}
      </p>
    </PageShell>
  );
}

function MarketingPage({ page, onSignUp, onProfileDone, onChoosePlan, onPage, onEnterStudio }) {
  const t = useT();
  if (page === "signin" || page === "signup")
    return <AuthPage onSignUp={onSignUp} onPage={onPage} mode={page} onEnterStudio={onEnterStudio} />;
  if (page === "profile")
    return (
      <ProfileForm
        onDone={onProfileDone}
        onBack={() => onPage("signup")}
      />
    );
  if (page === "onboarding")
    return <OnboardingPage onChoosePlan={onChoosePlan} onPage={onPage} />;

  if (page === "privacy")
    return <LegalPage doc={PRIVACY} onPage={onPage} />;

  if (page === "terms")
    return <LegalPage doc={TERMS} onPage={onPage} />;

  if (page === "security")
    return <LegalPage doc={SECURITY} onPage={onPage} />;

  if (page === "moe")
    return (
      <PageShell
        eyebrow={t("lp.pg.moe.eyebrow")}
        title={t("lp.pg.moe.title")}
        em={t("lp.pg.moe.em")}
        lead={t("lp.pg.moe.lead")}
        onPage={onPage}
      >
        <CommitList
          items={[
            { t: t("lp.pg.moe.i1t"), b: t("lp.pg.moe.i1b") },
            { t: t("lp.pg.moe.i2t"), b: t("lp.pg.moe.i2b") },
            { t: t("lp.pg.moe.i3t"), b: t("lp.pg.moe.i3b") },
            { t: t("lp.pg.moe.i4t"), b: t("lp.pg.moe.i4b") },
          ]}
        />
      </PageShell>
    );

  if (page === "schools")
    return (
      <PageShell
        eyebrow={t("lp.pg.schools.eyebrow")}
        title={t("lp.pg.schools.title")}
        em={t("lp.pg.schools.em")}
        lead={t("lp.pg.schools.lead")}
        onPage={onPage}
      >
        <CommitList
          items={[
            { t: t("lp.pg.schools.i1t"), b: t("lp.pg.schools.i1b") },
            { t: t("lp.pg.schools.i2t"), b: t("lp.pg.schools.i2b") },
            { t: t("lp.pg.schools.i3t"), b: t("lp.pg.schools.i3b") },
          ]}
        />
        <button
          type="button"
          onClick={() => onPage("contact")}
          className="btn-primary px-6 py-3 rounded-lg text-sm font-medium mt-12"
        >
          {t("lp.pg.schools.cta")}
        </button>
      </PageShell>
    );

  if (page === "pricing")
    return (
      <PageShell
        eyebrow={t("lp.pg.pricing.eyebrow")}
        title={t("lp.pg.pricing.title")}
        em={t("lp.pg.pricing.em")}
        lead={t("lp.pg.pricing.lead")}
        onPage={onPage}
      >
        <div className="grid sm:grid-cols-3 gap-4 mb-12">
          {[
            { k: t("lp.pg.pricing.c1k"), v: t("lp.pg.pricing.c1v"), d: t("lp.pg.pricing.c1d") },
            { k: t("lp.pg.pricing.c2k"), v: t("lp.pg.pricing.c2v"), d: t("lp.pg.pricing.c2d") },
            { k: t("lp.pg.pricing.c3k"), v: t("lp.pg.pricing.c3v"), d: t("lp.pg.pricing.c3d") },
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
          {t("lp.pg.pricing.cta")}
        </button>
      </PageShell>
    );

  // contact (default)
  return (
    <PageShell
      eyebrow={t("lp.pg.contact.eyebrow")}
      title={t("lp.pg.contact.title")}
      em={t("lp.pg.contact.em")}
      lead={t("lp.pg.contact.lead")}
      onPage={onPage}
    >
      <ContactForm />
      <p className="text-xs mt-8" style={{ color: "var(--ink-3)" }}>
        {t("lp.pg.contact.note")}
      </p>
    </PageShell>
  );
}

// =====================================================================
// LANDING (exported)
// =====================================================================
export default function Landing({ onOpenStudio }) {
  const [page, setPage] = useState("home");
  // Mock auth: an account exists only once a provider was picked AND a
  // plan chosen. Signed-in visitors skip the funnel entirely.
  const account = useAccount();
  const signedIn = !!account;
  const [pendingProvider, setPendingProvider] = useState(null);
  // Firebase user object captured by AuthPage on Google sign-in. Used
  // to pre-fill the onboarding form AND to call /api/auth/firebase
  // once the plan is picked (so the teacher row gets created in our
  // DB before the studio loads).
  const [pendingFirebaseUser, setPendingFirebaseUser] = useState(null);

  const goPage = (p) => {
    setPage(p);
    window.scrollTo(0, 0);
  };

  // Email link sign-in completion. If the user lands on the site from
  // a magic link in their inbox (URL has Firebase's ?apiKey=…&oobCode=…
  // &mode=signIn params or our marker), complete the auth and feed the
  // resulting Firebase user into the same funnel a Google sign-up takes.
  // Cleans the URL so refreshes don't re-trigger.
  const [emailLinkCompleting, setEmailLinkCompleting] = useState(() => {
    if (typeof window === "undefined") return false;
    const url = window.location.href;
    return url.includes("mode=signIn") || url.includes("completeEmailSignIn=1");
  });
  useEffect(() => {
    if (!emailLinkCompleting) return;
    let cancelled = false;
    (async () => {
      try {
        const lib = await import("../lib/firebaseAuth");
        if (!lib.isEmailSignInLink(window.location.href)) {
          // Not actually an email link (just our query marker stale) — bail.
          window.history.replaceState(null, "", window.location.pathname);
          setEmailLinkCompleting(false);
          return;
        }
        const user = await lib.completeEmailLinkSignIn(window.location.href);
        if (cancelled) return;
        // Drop into the existing sign-up funnel exactly like a Google
        // sign-up — handleSignUp reads firebaseUser and stages the
        // profile prefill, then routes to /profile.
        handleSignUp("email", {
          acceptedAt: new Date().toISOString(),
          legalVersion: LEGAL_VERSION,
          firebaseUser: {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            photoURL: user.photoURL || "",
          },
        });
        // Clean URL so refreshes don't re-trigger.
        window.history.replaceState(null, "", window.location.pathname);
      } catch (e) {
        console.error("[auth/email-link/complete]", e);
        // If completion fails (link expired, used twice, wrong email),
        // park the user on the sign-up page with an error.
        alert(
          e?.code === "auth/email-required-for-completion"
            ? "Please re-enter your email to finish signing in (you may be on a different device than where you requested the link)."
            : `Sign-in link couldn't be verified: ${e?.message || e}`
        );
        window.history.replaceState(null, "", window.location.pathname);
        setPage("signup");
      } finally {
        if (!cancelled) setEmailLinkCompleting(false);
      }
    })();
    return () => { cancelled = true; };
  }, [emailLinkCompleting]); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent session-restore on mount. If Firebase still has a valid
  // session (its tokens persist in IndexedDB for a year by default) but
  // localStorage.murchid.account was cleared — incognito switch, manual
  // clear, new browser profile — call /api/auth/me to bring the account
  // back. After this, signedIn = true and the CTAs route to the studio
  // without making the user click any provider button again.
  useEffect(() => {
    if (signedIn || emailLinkCompleting) return;
    let cancelled = false;
    (async () => {
      try {
        const { getIdToken } = await import("../lib/firebaseAuth");
        const token = await getIdToken();
        if (!token || cancelled) return;
        const me = await apiFetch("/api/auth/me");
        if (cancelled || !me?.id) return;
        setAccount({
          provider: pendingProvider || "google",
          plan: me.subscription_plan || "annual",
          profile: {
            firstName: me.first_name || "",
            lastName:  me.last_name  || "",
            email:     me.email      || "",
            avatarUrl: me.avatar_url || "",
          },
          role:     me.role,
          sub_role: me.sub_role || null,
          subscriptionStatus: me.subscription_status,
          subscriptionEndsAt: me.subscription_ends_at,
        });
        if (me.role) setLocalRole(me.role);
      } catch {
        // No session / no teacher row / network error — fall through.
        // The landing CTAs default to the sign-up funnel, which is
        // the right behavior for an unauthenticated visitor.
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The single entry action behind every primary CTA: into the planner
  // if subscribed, otherwise into the sign-up funnel.
  const enter = () => (signedIn ? onOpenStudio() : goPage("signup"));
  const handleSignUp = async (provider, payload) => {
    setPendingProvider(provider);
    if (payload?.firebaseUser) {
      setPendingFirebaseUser(payload.firebaseUser);
      // Pre-fill the onboarding profile with the Google account's
      // name/email/avatar so the teacher doesn't retype what we already
      // know. ProfileForm reads getPendingProfile() on mount.
      const [firstName, ...rest] = (payload.firebaseUser.displayName || "").split(/\s+/).filter(Boolean);
      const existing = getPendingProfile() || {};
      const merged = {
        ...existing,
        firstName: existing.firstName || firstName || "",
        lastName:  existing.lastName  || rest.join(" "),
        email:     existing.email     || payload.firebaseUser.email,
        avatarUrl: existing.avatarUrl || payload.firebaseUser.photoURL,
      };
      try {
        localStorage.setItem("murchid.profile.pending", JSON.stringify(merged));
      } catch { /* ignore */ }

      // Returning-user fast path. If this Firebase user already has an
      // account row on the server, skip the profile + plan funnel and
      // drop them straight into the studio. /api/auth/me returns 200
      // only when a teacher row already exists for the verified token.
      try {
        const existingAccount = await apiFetch("/api/auth/me");
        if (existingAccount && existingAccount.id) {
          setAccount({
            provider,
            plan: existingAccount.subscription_plan || "annual",
            profile: {
              firstName: existingAccount.first_name || merged.firstName || "",
              lastName:  existingAccount.last_name  || merged.lastName  || "",
              email:     existingAccount.email      || merged.email     || "",
              avatarUrl: existingAccount.avatar_url || merged.avatarUrl || "",
            },
            role:     existingAccount.role,
            sub_role: existingAccount.sub_role || null,
            subscriptionStatus: existingAccount.subscription_status,
            subscriptionEndsAt: existingAccount.subscription_ends_at,
          });
          if (existingAccount.role) setLocalRole(existingAccount.role);
          onOpenStudio();
          return;
        }
      } catch (e) {
        // 404 (no teacher row) is expected for first-time sign-up —
        // fall through to the profile funnel below. Other errors
        // also fall through; the funnel's bootstrap step will surface
        // them properly.
        if (e?.status && e.status !== 404) {
          console.warn("[auth/me] returning-user check failed:", e);
        }
      }
    }
    // New user (or check failed): collect profile then plan picker.
    goPage("profile");
  };
  const handleProfileDone = () => {
    goPage("onboarding");
  };
  const handleChoosePlan = async (plan) => {
    const profile = getPendingProfile() || undefined;
    const pendingSchools = getPendingSchools() || [];

    // Bootstrap the teacher row in Neon FIRST. /api/auth/firebase
    // upserts by firebase_uid, logs IP/UA, sets subscription_ends_at
    // based on the picked plan (trial=7d, monthly=30d, quarterly=90d,
    // annual=365d), and returns the canonical row. We only persist the
    // mock account locally AFTER this succeeds — that way a failed
    // bootstrap doesn't leave the UI showing "signed in" with no
    // backing data.
    let teacherRow;
    try {
      teacherRow = await apiFetch("/api/auth/firebase", { method: "POST", body: { plan } });
    } catch (e) {
      console.error("Failed to provision teacher on first login:", e);
      const msg = e.code === "plan_required"
        ? "Please pick a plan or start the free trial to continue."
        : `Could not finish setting up your account: ${e.message}`;
      alert(msg);
      return;
    }

    // Mock account in localStorage drives the sidebar / nav. The real
    // source of truth lives on req.account server-side.
    setAccount({
      provider: pendingProvider || "google",
      plan,
      profile,
      role:     teacherRow.role,
      sub_role: teacherRow.sub_role || null,
      subscriptionStatus: teacherRow.subscription_status,
      subscriptionEndsAt: teacherRow.subscription_ends_at,
    });

    // Sync the localStorage role with the canonical role the server
    // assigned. Without this, a previous portal sign-in's stale role
    // (e.g. /owner test left "owner" in localStorage) sticks and the
    // studio routes the new teacher account to the wrong console —
    // every API call then 403s. App.jsx reads getRole() for routing
    // and BrandLoader/portals already do this; the teacher funnel
    // wasn't.
    if (teacherRow.role) {
      setLocalRole(teacherRow.role);
    }

    // Compute profile-wide grades/sections as the union of every
    // school's per-school map. The onboarding form no longer has a
    // separate scope step — each school carries its own grade_sections
    // directly, so the teacher-level fields are derived here at save
    // time. Legacy Studio dropdowns (quiz / homework / rosters) still
    // read the flat arrays, so we keep them populated.
    const unionGradeSections = {};
    for (const s of pendingSchools) {
      for (const [g, secs] of Object.entries(s.gradeSections || {})) {
        if (!unionGradeSections[g]) unionGradeSections[g] = [];
        for (const sec of secs || []) {
          if (!unionGradeSections[g].includes(sec)) unionGradeSections[g].push(sec);
        }
      }
    }
    const unionGrades   = Object.keys(unionGradeSections);
    const unionSections = [...new Set(Object.values(unionGradeSections).flat())];

    // If the user filled in the onboarding profile, sync majors /
    // grades / sections / languages to the live teacher row so the
    // studio dropdowns match what they entered.
    if (profile) {
      try {
        await apiFetch("/api/me", {
          method: "PATCH",
          body: {
            first_name: profile.firstName || undefined,
            last_name:  profile.lastName  || undefined,
            staff_id:   profile.staffId   || undefined,
            bio:        profile.bio       || undefined,
            majors:        Array.isArray(profile.majors)    ? profile.majors    : undefined,
            languages:     Array.isArray(profile.languages) ? profile.languages : undefined,
            grade_levels:  unionGrades.length   > 0 ? unionGrades   : undefined,
            sections:      unionSections.length > 0 ? unionSections : undefined,
            grade_sections: unionGrades.length  > 0 ? unionGradeSections : undefined,
          },
        });
      } catch (e) {
        console.warn("Profile patch failed (non-fatal):", e);
      }
    }
    clearPendingProfile();

    // Persist the onboarding school picks. Custom rows (negative
    // pseudo-ids) get materialised in the catalog first. Non-fatal —
    // the studio still opens and the teacher can retry from My schools.
    try {
      for (const s of pendingSchools) {
        let schoolId = s.school_id;
        if (schoolId < 0 || s._custom) {
          const created = await apiFetch("/api/schools", {
            method: "POST",
            body: { name: s.name, name_ar: s.name_ar, emirate: s.emirate, city: s.city },
          });
          schoolId = created.id;
        }
        // Each school carries its own grade_sections — the schools
        // step IS the scope step now, no inheritance, no override
        // fallback.
        const schoolGradeSections =
          s.gradeSections && Object.keys(s.gradeSections).length > 0
            ? s.gradeSections
            : undefined;
        await apiFetch("/api/schools/mine", {
          method: "POST",
          body: {
            school_id: schoolId,
            is_primary: !!s.is_primary,
            grade_sections: schoolGradeSections,
          },
        });
      }
    } catch (e) {
      console.warn("Failed to attach schools during sign-up:", e);
    }
    clearPendingSchools();
    setPendingFirebaseUser(null);

    onOpenStudio();
  };
  // Signs the teacher out of Firebase, drops the local account record,
  // and returns them to the landing home. Both halves matter — leaving
  // the Firebase session intact would let the next /api/* call slip
  // through with a valid token but no UI state to back it up.
  const handleSignOut = async () => {
    try {
      const { signOut } = await import("../lib/firebaseAuth");
      await signOut();
    } catch (e) {
      console.warn("Firebase signOut failed:", e);
    }
    clearAccount();
    goPage("home");
  };
  const jump = (id) => {
    const doScroll = () => {
      const el = document.getElementById(id);
      if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    if (page === "home") doScroll();
    else {
      setPage("home");
      // Wait for the home sections to mount before scrolling to the anchor.
      setTimeout(doScroll, 120);
    }
  };

  return (
    <div className="murchid-landing paper-noise">
      <Nav onEnter={enter} signedIn={signedIn} onJump={jump} onPage={goPage} onSignOut={handleSignOut} darkHero={page === "home"} />
      {page === "home" ? (
        <LandingHome onEnter={enter} signedIn={signedIn} />
      ) : (
        <MarketingPage
          page={page}
          onSignUp={handleSignUp}
          onProfileDone={handleProfileDone}
          onChoosePlan={handleChoosePlan}
          onPage={goPage}
          onEnterStudio={onOpenStudio}
        />
      )}
      <Footer onEnter={enter} signedIn={signedIn} onJump={jump} onPage={goPage} />
    </div>
  );
}
