"use client";

import React, { useState, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import {
  Sparkles, ArrowRight, ChevronRight, ChevronLeft, Plus, BookOpen,
  CalendarDays, GraduationCap, ClipboardList, Presentation, Layout,
  Users, MessageCircle, CheckCircle2, Clock, TrendingUp, FileText,
  Pencil, Trash2, ArrowUpDown, Calendar, LayoutGrid, List,
  Paperclip, Send, Layers, Play, LogOut, Eye, EyeOff,
} from "lucide-react";
import "../landing.css";
import { useT, useI18n, LangToggle } from "../lib/i18n";
// The Wall Chart world, so the funnel the marketing CTA points at is the
// same material as the page that sent the visitor there. Styling only.
import wc from "../features/marketing/Landing.module.css";
import { setRole as setLocalRole } from "../lib/role";
import {
  useAccount, setAccount, clearAccount,
  getPendingProfile, clearPendingProfile,
  getPendingSchools, clearPendingSchools,
  getPendingStudents, clearPendingStudents,
} from "../lib/account";
import { api as apiFetch } from "./_shared";
import { setSessionId, clearSessionId } from "../lib/session";
import { PLANS } from "../lib/plans";
import { passwordChecks, passwordScore, validatePassword } from "@/shared/lib/password";
import { useBillingMode } from "@/features/marketing/useBillingMode";
import { PRIVACY, TERMS, SECURITY, LEGAL_VERSION, LEGAL_EFFECTIVE_DATE } from "../lib/legal";
import ProfileForm from "./onboarding/ProfileForm";
import LandingHome from "./LandingHome";
import MurchidLogo from "../components/MurchidLogo";
import Avatar from "../components/Avatar";
import BrandLoader from "../components/BrandLoader";
import SetupOverlay from "../features/onboarding/components/SetupOverlay";

// Where the sign-up funnel parks its state across an OAuth redirect.
//
// Firebase's popup kept the whole flow inside one page load, so the click
// handler could sign in and continue straight into the funnel. Supabase
// redirects the top-level page to the provider, which tears down all
// component state — so the intent has to survive in storage and be picked
// up again when the browser returns. See handleProvider (parks it) and the
// resume effect in Landing (reads it).
const PENDING_SIGNUP_KEY = "murchid.signup.pending";

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
  // Mobile menu: `menuOpen` mounts it, `menuVisible` drives the open/close
  // CSS transitions. Closing flips menuVisible off (plays the exit), then
  // unmounts after the animation. Body scroll is locked while mounted.
  const [menuOpen, setMenuOpen] = useState(false);
  const [menuVisible, setMenuVisible] = useState(false);
  const openMenu = () => setMenuOpen(true);
  const closeMenu = () => {
    setMenuVisible(false);
    window.setTimeout(() => setMenuOpen(false), 520);
  };
  useEffect(() => {
    if (!menuOpen) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    // Hide the floating accessibility widget while the full-screen menu is
    // up (it has a max z-index and would otherwise sit over the CTA).
    document.body.classList.add("lp-menu-open");
    const id = requestAnimationFrame(() => setMenuVisible(true));
    const onKey = (e) => { if (e.key === "Escape") closeMenu(); };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      document.body.classList.remove("lp-menu-open");
      cancelAnimationFrame(id);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [menuOpen]);
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
      // Cream/light sections the nav must go ink over (everything else is
      // the warm drench): the Showreel, the membership/Plans block, and
      // the FAQ. The FAQ carries a plain global class ALONGSIDE its CSS
      // module class purely so it can be named here — a module class is
      // hashed at build time and cannot be written into a selector string.
      const lightSections = document.querySelectorAll(".film-stage, .plans-stage, .faq-stage");
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
  const accent = onDark ? "var(--cm-on-drench)" : "var(--clay)";
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
    { key: "lp.nav.faq", to: "sec-faq" },
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
            style={{ "--murchid-logo-accent": onDark ? "var(--cm-on-drench)" : "var(--color-accent)", transform: "translateY(5px)" }}
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
          {/* Lang toggle is desktop-only here — on phones it lives inside
              the mobile menu so the bar stays uncluttered. */}
          <div className="hidden md:block">
            <LangToggle />
          </div>
          {!signedIn && (
            <button
              type="button"
              onClick={() => onPage("signin")}
              className="hidden md:inline-flex nav-signin"
              style={{ color: fg }}
            >
              <span>{t("lp.nav.signin")}</span>
              <svg width="13" height="13" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                <path d={ctaArrow} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          )}
          {signedIn && (
            <NavProfile onEnter={onEnter} onSignOut={onSignOut} />
          )}
          {/* Mobile menu trigger — sits at the trailing edge of the bar.
              The editorial index is hidden below md, so phones reach the
              section links + sign-in through the full-screen menu it opens. */}
          <button
            type="button"
            onClick={() => (menuOpen ? closeMenu() : openMenu())}
            className="lp-burger md:hidden"
            style={{ color: fg }}
            aria-label="Open menu"
            aria-expanded={menuOpen}
          >
            <span /><span /><span />
          </button>
        </div>
      </div>

      {menuOpen && createPortal(
        <div className={`lp-menu${menuVisible ? " is-open" : ""}`} role="dialog" aria-modal="true">
          <div className="lp-menu-scrim" onClick={closeMenu} aria-hidden="true" />
          <div className="lp-menu-panel" dir={isRTL ? "rtl" : "ltr"}>
            {/* Top bar — mirrors the nav: wordmark, lang, close. */}
            <div className="lp-menu-top">
              <MurchidLogo
                className="h-[44px] w-auto"
                style={{ "--murchid-logo-accent": "var(--color-accent)", transform: "translateY(3px)" }}
              />
              <div className="lp-menu-top-actions">
                <LangToggle />
                <button
                  type="button"
                  onClick={closeMenu}
                  className="lp-menu-close"
                  aria-label="Close menu"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                    <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Editorial index — large serif links, numbered, staggered. */}
            <nav className="lp-menu-nav" aria-label="Primary">
              {navItems.map((it, i) => (
                <button
                  key={it.key + i}
                  type="button"
                  onClick={() => { onJump(it.to); closeMenu(); }}
                  className="lp-menu-link"
                  style={{ "--i": i }}
                >
                  <span className="lp-menu-num">{String(i + 1).padStart(2, "0")}</span>
                  <span className="lp-menu-label">{t(it.key)}</span>
                  <span className="lp-menu-chev" aria-hidden="true">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                      <path d="M9 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </span>
                </button>
              ))}
            </nav>

            {/* Footer — Sign in only (Subscribe removed). Signed-in users
                get Open-the-planner instead. */}
            <div className="lp-menu-foot" style={{ "--i": navItems.length }}>
              <button
                type="button"
                onClick={() => { signedIn ? onEnter() : onPage("signin"); closeMenu(); }}
                className="lp-menu-cta"
              >
                <span>{signedIn ? t("lp.nav.openPlanner") : t("lp.nav.signin")}</span>
                <svg width="15" height="15" viewBox="0 0 14 14" fill="none" aria-hidden="true">
                  <path d={ctaArrow} stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              </button>
              <p className="lp-menu-tag">SIX TOOLS · ONE STUDIO</p>
            </div>
          </div>
        </div>,
        document.body
      )}
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
const C_INK3 = "#9B8B76";
const C_INK2 = "#6E5C4A";

// Scattered drop — hand-tuned "random" rest spots (not a grid). Kept
// shallow (y range ≈ 90px) so the whole cluster sits in the clear band
// between the sub-paragraph and the Library window's bottom edge.
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

// Wide free-trial CTA — the same banner the plan-picker (OnboardingPage)
// shows, lifted onto the landing's Membership section so visitors can
// start the 7-day trial without first scrolling into a plan card. Clicking
// drops them into the sign-up funnel (onEnter), where the trial is the
// no-payment "trial" pseudo-plan.
function LandingTrialBanner({ onEnter, t, className = "" }) {
  return (
    <div
      className={`group relative w-full rounded-[24px] overflow-hidden flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-7 py-4 ${className}`}
      style={{
        background:
          "radial-gradient(ellipse 92% 64% at 50% 14%, oklch(0.64 0.13 42), transparent 72%), var(--cm-clay)",
        color: "var(--paper)",
        boxShadow:
          "0 14px 30px -12px rgba(26,24,20,0.55), inset 0 1px 0 rgba(255,255,255,0.08)",
      }}
    >
      <span
        aria-hidden="true"
        className="murchid-trial-glow absolute inset-0 pointer-events-none transition-opacity duration-500 group-hover:!opacity-100"
        style={{
          background:
            "radial-gradient(60% 100% at 50% 100%, rgba(181,117,78,0.55), rgba(26,24,20,0) 70%)",
          animation: "murchid-trial-glow 4.5s ease-in-out infinite",
        }}
      />
      <span
        aria-hidden="true"
        className="murchid-trial-shimmer absolute inset-y-0 -left-1/2 w-1/2 pointer-events-none"
        style={{
          background:
            "linear-gradient(105deg, transparent 35%, rgba(255,255,255,0.12) 50%, transparent 65%)",
          animation: "murchid-trial-shimmer 6s linear infinite",
        }}
      />
      <span aria-hidden="true" className="murchid-trial-twinkle absolute top-3 start-[10%] w-0.5 h-0.5 rounded-full" style={{ background: "var(--paper)", animation: "murchid-trial-twinkle 3.6s ease-in-out infinite", animationDelay: "0s" }} />
      <span aria-hidden="true" className="murchid-trial-twinkle absolute bottom-3 end-[16%] w-px h-px rounded-full" style={{ background: "var(--paper)", animation: "murchid-trial-twinkle 4.2s ease-in-out infinite", animationDelay: "-0.8s" }} />
      <span aria-hidden="true" className="murchid-trial-twinkle absolute top-4 end-[8%] w-0.5 h-0.5 rounded-full" style={{ background: "var(--paper)", animation: "murchid-trial-twinkle 3.2s ease-in-out infinite", animationDelay: "-1.6s" }} />

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

      <button
        type="button"
        onClick={onEnter}
        className="cinema-pill flex-shrink-0"
      >
        {t("lp.plan.trialCta")}
      </button>
    </div>
  );
}

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
            <LandingTrialBanner onEnter={onEnter} t={t} className="mt-8 max-w-md" />
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
        <CardReveal>
          <LandingTrialBanner onEnter={onEnter} t={t} className="mt-8" />
        </CardReveal>
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
              <li><FLink onClick={() => onJump("sec-faq")}>{t("lp.nav.faq")}</FLink></li>
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

// Microsoft's four squares. Drawn rather than imported so the mark is
// the official colours at any size and costs no request.
function OutlookMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 23 23" aria-hidden="true">
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="12" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="12" width="10" height="10" fill="#00A4EF" />
      <rect x="12" y="12" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}

// LinkedIn's mark, drawn rather than fetched so it is the official blue
// at any size and costs no request.
function LinkedInMark() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" aria-hidden="true">
      <rect width="24" height="24" rx="3" fill="#0A66C2" />
      <path
        fill="#fff"
        d="M8.2 18.5H5.4V9.7h2.8v8.8ZM6.8 8.5a1.6 1.6 0 1 1 0-3.3 1.6 1.6 0 0 1 0 3.3Zm11.8 10h-2.8v-4.3c0-1 0-2.4-1.5-2.4s-1.7 1.1-1.7 2.3v4.4H9.8V9.7h2.7v1.2h.04a3 3 0 0 1 2.7-1.5c2.9 0 3.4 1.9 3.4 4.3v4.8Z"
      />
    </svg>
  );
}

function ProviderButton({ icon, label, onClick, disabled, badge }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-disabled={disabled || undefined}
      className={`w-full flex items-center justify-center gap-3 px-5 py-3.5 rounded-xl text-sm font-medium transition ${
        // A badged button is inert but not pending, so it takes a plain
        // cursor and dims less — 0.7 alpha on a label that has something
        // to say is already close to the 4.5:1 floor.
        disabled ? (badge ? "cursor-default opacity-85" : "cursor-wait opacity-70") : "lift"
      }`}
      style={{ background: "var(--paper)", border: "0.5px solid var(--line-strong)", color: "var(--ink)" }}
    >
      <span className="flex-shrink-0 inline-flex">{icon}</span>
      <span>{label}</span>
      {badge && (
        <span
          className="ms-1 rounded-full px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]"
          style={{ border: "0.5px solid var(--line-strong)", color: "var(--ink-2)" }}
        >
          {badge}
        </span>
      )}
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
// The rules moved to shared/lib/password.ts when the reset screen was
// built — it sets a password too, and two copies of five regexes drift.

// One page for both. A visitor types an email and a password; which of
// the two this turns out to be is decided by the ANSWER, not by which
// button they pressed on the way in — see signInOrSignUp in
// lib/supabaseAuth.js. `mode` survives only so /signin and /signup both
// still resolve to something; it no longer changes what is rendered.

// ── Auth shell ────────────────────────────────────────────────────────
// The auth page is the one screen that must never scroll: a teacher is
// three fields from being inside the product, and a scrollbar there says
// "this is going to take a while". PageShell could not deliver that — it
// centres a single column and lets anything taller than the viewport
// overflow, and this page has two fields, a primary action, two
// providers, a consent line and a tail of secondary links.
//
// So the height is spent sideways instead of downwards. On a wide screen
// the brand takes a fixed panel on one side and the form takes the other,
// which halves the vertical stack. Below `lg` the panel collapses to a
// slim header and the form runs full width.
//
// h-[100dvh], not 100vh: on a phone 100vh is the viewport WITHOUT browser
// chrome, so the last provider button would sit under the address bar.
function AuthShell({ title, em, lead, onPage, children }) {
  const { billingOn } = useBillingMode();
  const t = useT();

  // Rebuilt in the Wall Chart world (direction seed 0df4eaa5). MARKUP AND
  // STYLING ONLY — `children` is still whatever AuthPage renders, and every
  // Supabase call, validation rule and provider handler is untouched.
  //
  // What changed and why:
  // - The old shell gave 43% of the viewport to an empty gradient slab
  //   carrying a decorative wordmark, while "No card required" sat at 11px
  //   in its bottom corner, nowhere near the button it was reassuring. The
  //   panel now carries the reassurance itself, at a readable size, on the
  //   page where a visitor is deciding whether to hand over an email.
  // - The form sits on a specimen plate, so the CTA's destination is the
  //   same material as the page that sent them here.
  // - h-[100dvh] with overflow-hidden is gone: it clipped the form under
  //   the accessibility toolbar's 1.5x text setting, which is a shipped
  //   product feature, not an edge case.
  // The first reassurance is the offer, and the offer changes with the
  // billing switch (db/tune.sql §89). "Seven days of the whole studio" is
  // a trial; during a free period there is no trial and no clock, and
  // promising one to someone about to hand over an email would be the
  // wrong kind of wrong. The other two are true in both modes.
  const reassurances = [
    billingOn ? t("mk.auth.point1") : t("mk.free.authPoint"),
    t("mk.auth.point2"),
    t("mk.auth.point3"),
  ];

  return (
    <div className={wc.page} style={{ minHeight: "100dvh" }}>
      <div className={`${wc.shell} ${wc.authGrid}`}>
        <aside className={wc.authAside}>
          <button
            type="button"
            onClick={() => onPage("home")}
            className={wc.authBack}
          >
            {t("lp.pg.back")}
          </button>

          <div>
            <MurchidLogo
              className="h-11 w-auto"
              style={{ color: "var(--ink, #101718)", "--murchid-logo-accent": "var(--accent, #16646c)" }}
            />

            <ul className={wc.authPoints}>
              {reassurances.map((line) => (
                <li key={line} className={wc.authPoint}>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <p className={wc.authFoot}>{t("mk.cta.note")}</p>
        </aside>

        <section className={wc.authPlate}>
          <h1 className={wc.authTitle}>
            {title} {em}
          </h1>
          <p className={wc.authLead}>{lead}</p>
          {children}
        </section>
      </div>
    </div>
  );
}

function AuthPage({ onSignUp, onPage, mode = "signup", onEnterStudio, notice }) {
  const t = useT();
  const isSignin = mode === "signin";

  // Silent session restore on AuthPage mount. If Supabase still has a
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
        const { getIdToken } = await import("../lib/supabaseAuth");
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
            staffId:   me.staff_id   || "",
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
  // When a teacher taps a provider before ticking the terms box, we draw
  // their eye to it (scroll + pulse) instead of silently doing nothing.
  const termsRef = useRef(null);
  useEffect(() => {
    if (tried && !accepted && termsRef.current) {
      termsRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [tried, accepted]);
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
  // Opens ON the form. It used to open on a menu of provider buttons,
  // so email — the path most teachers take — cost an extra click before
  // they could type anything. The providers move below the form as
  // alternatives; nobody has to press a button to reach the default.
  const [emailMode, setEmailMode] = useState("entering");
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
  // Verification state. After a fresh signup we hold the Supabase user
  // + the pending onSignUp payload here, then advance once the user has
  // clicked the link in their inbox (polled every 3s via reload).
  const [pendingVerification, setPendingVerification] = useState(null); // { user, payload }
  const [verifyResendCooldown, setVerifyResendCooldown] = useState(0);
  const [verifyChecking, setVerifyChecking] = useState(false);
  const [verifyCode, setVerifyCode] = useState("");
  const [verifyError, setVerifyError] = useState(null);

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
      // Supabase OAuth is a full-page redirect, not Firebase's popup: the
      // browser leaves for the provider and comes back to "/" afterwards.
      // So we cannot read a user here — there is no "after" in this
      // function. Instead we park the funnel state the return trip needs
      // (which provider, and the legal acceptance the user just gave)
      // and let the resume effect in Landing pick it up on the way back.
      //
      // sessionStorage, not localStorage: this intent is meaningful only
      // for the tab that started the sign-in, and should not survive a
      // browser restart as a stale half-finished signup.
      try {
        sessionStorage.setItem(
          PENDING_SIGNUP_KEY,
          JSON.stringify({
            provider,
            acceptedAt: new Date().toISOString(),
            legalVersion: LEGAL_VERSION,
          })
        );
      } catch { /* private mode — the funnel still works, just no prefill */ }

      const lib = await import("../lib/supabaseAuth");
      if (provider === "google") await lib.signInWithGoogle();
      else if (provider === "linkedin") await lib.signInWithLinkedIn();
      else await lib.signInWithMicrosoft();
      // Unreachable in practice — navigation is already in flight.
    } catch (e) {
      // Always log so the browser console has the full error object —
      // makes diagnosing provider-config issues possible without re-
      // running the flow in dev tools.
      console.error(`[auth/${provider}]`, e);
      try { sessionStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* ignore */ }

      const providerLabel =
        provider === "google" ? "Google" : provider === "linkedin" ? "LinkedIn" : "Microsoft";
      // Failures here happen BEFORE the redirect, so the Firebase popup
      // codes (popup-blocked, popup-closed-by-user, cancelled-popup-
      // request) no longer exist — there is no popup. What's left is
      // project misconfiguration, which Supabase reports by name.
      const code = e?.code || "";
      const friendly = {
        validation_failed:
          `${providerLabel} sign-in isn't enabled for this Supabase project yet. ` +
          `Enable it under Authentication → Providers.`,
        provider_disabled:
          `${providerLabel} sign-in is disabled for this Supabase project.`,
      }[code];
      setAuthError(friendly || e?.message || String(e));
      setSigningIn(false);
    }
  };

  // Email + password — the primary email path. Set once at sign-up,
  // used instantly forever after with no inbox round-trip. The Supabase
  // session persists ~1 year so the password rarely gets retyped after
  // the first sign-in on a device.
  const handleEmailPassword = async () => {
    if (!accepted) { setTried(true); return; }
    // Surface every inline error by marking every field touched, then
    // gate the actual call on validity. Without this, a user who never
    // tabs out of the input doesn't see the inline hint.
    setEmailTouched(true);
    setPasswordTouched(true);
    if (emailError || passwordError) return;
    const email = emailTrim;
    const password = passwordValue;
    setAuthError(null);
    setEmailSending(true);
    try {
      const lib = await import("../lib/supabaseAuth");
      // One page, one call. signInOrSignUp resolves the three cases the
      // form cannot tell apart on its own: returning teacher with the
      // right password, returning teacher with the wrong one, and someone
      // brand new. See the note on it in lib/supabaseAuth.js.
      const { user, isNew } = await lib.signInOrSignUp(email, password);
      const payload = {
        acceptedAt: new Date().toISOString(),
        legalVersion: LEGAL_VERSION,
        authUser: {
          uid: user.uid,
          email: user.email || "",
          displayName: user.displayName || "",
          // Carried separately so the prefill does not have to split a
          // display name — see the note where `merged` is built.
          firstName: user.firstName || "",
          lastName: user.lastName || "",
          photoURL: user.photoURL || "",
          locale: user.locale || null,
        },
      };

      if (!isNew) {
        // Existing account: straight through. onSignUp finds the teacher
        // row and routes to the dashboard — no profile questions, which
        // is the whole point of recognising them here.
        onSignUp("email", payload);
      } else {
        // Brand new — kick off our own 6-digit code flow. The endpoint
        // reads the email off the access token, so no body is needed.
        //
        // That requires a live session immediately after signUp, which
        // only happens when "Confirm email" is OFF in the Supabase
        // dashboard. It has to be off: this product deliberately replaced
        // link-based verification with the 6-digit code (teachers got lost
        // on the "verified ✓" page and never returned to the tab).
        //
        // Rather than let it fail as an opaque 401, detect it and say so.
        const { getIdToken } = await import("../lib/supabaseAuth");
        if (!(await getIdToken())) {
          setAuthError(
            "Your account was created, but this project still has email " +
            "confirmation switched on, so we can't verify you in-app. " +
            "Check your inbox for a confirmation link, then sign in."
          );
          return;
        }
        await apiFetch("/api/auth/email-verify/send", { method: "POST" });
        setPendingVerification({ user, payload });
        setVerifyCode("");
        setVerifyError(null);
        setEmailMode("verify-pending");
        setVerifyResendCooldown(30);
      }
    } catch (e) {
      console.error("[auth/email]", e);
      const code = e?.code || "";
      // Supabase error codes, not Firebase's "auth/…" ones. GoTrue reports
      // a single `invalid_credentials` for both a wrong password and an
      // unknown email — deliberately, so the form can't be used to
      // enumerate which addresses have accounts — so the copy has to cover
      // both cases in one message rather than the old separate
      // user-not-found / wrong-password pair.
      const friendly = {
        email_address_invalid:      "That email address doesn't look valid.",
        weak_password:              "Pick a stronger password (8+ characters).",
        user_already_exists:        "An account with this email already exists. Try signing in instead.",
        email_exists:               "An account with this email already exists. Try signing in instead.",
        invalid_credentials:        "Wrong email or password.",
        // Raised by signInOrSignUp when sign-up reports the address is
        // taken — which can only mean the password was wrong, since the
        // sign-in attempt with it had already failed.
        wrong_password:
          "You already have an account with this email. Check your password, or reset it below.",
        email_not_confirmed:        "Confirm your email address first — check your inbox for the link.",
        over_request_rate_limit:    "Too many attempts. Wait a minute and try again, or reset your password.",
        over_email_send_rate_limit: "Too many emails sent. Wait a minute before trying again.",
        signup_disabled:            "New sign-ups are disabled on this project right now.",
        validation_failed:
          "Email/password sign-in isn't enabled yet. Enable it in the Supabase dashboard → Authentication → Providers → Email.",
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
      const lib = await import("../lib/supabaseAuth");
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
  // 6-digit OTP delivered to the user's inbox by the backend (Resend).
  // The teacher types the code, we POST it to /api/auth/email-verify/check,
  // and on success we hand the original signup payload to the parent
  // funnel. Codes live 5 minutes and accept 5 attempts — both enforced
  // server-side.

  // Resend-button cooldown countdown — once a second until it hits zero.
  useEffect(() => {
    if (verifyResendCooldown <= 0) return;
    const id = setTimeout(() => setVerifyResendCooldown((s) => s - 1), 1000);
    return () => clearTimeout(id);
  }, [verifyResendCooldown]);

  // Submit handler — manual or auto-fired when the user finishes typing
  // the 6th digit. Keeps the input editable while checking so a wrong
  // code can be corrected without re-typing the right digits.
  const handleVerifyCheck = async (codeOverride) => {
    if (!pendingVerification) return;
    const code = String(codeOverride ?? verifyCode).trim();
    if (!/^\d{6}$/.test(code)) {
      setVerifyError("Enter the 6-digit code from your email.");
      return;
    }
    setVerifyChecking(true);
    setVerifyError(null);
    try {
      await apiFetch("/api/auth/email-verify/check", {
        method: "POST",
        body: { code },
      });
      onSignUp("email", pendingVerification.payload);
      setPendingVerification(null);
    } catch (e) {
      setVerifyError(e?.message || String(e));
    } finally {
      setVerifyChecking(false);
    }
  };

  const handleResendVerification = async () => {
    if (!pendingVerification || verifyResendCooldown > 0) return;
    setVerifyError(null);
    try {
      await apiFetch("/api/auth/email-verify/send", { method: "POST" });
      setVerifyResendCooldown(30);
      setVerifyCode("");
    } catch (e) {
      console.error("[auth/verify/resend]", e);
      setVerifyError(e?.message || String(e));
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
      const lib = await import("../lib/supabaseAuth");
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
      <AuthShell
        title={isSignin ? t("lp.auth.signin.title") : t("lp.auth.title")}
        em={isSignin ? t("lp.auth.signin.titleEm") : t("lp.auth.titleEm")}
        lead={isSignin ? t("lp.auth.signin.lead") : t("lp.auth.lead")}
        onPage={onPage}
      >
        <div className="flex justify-center py-6">
          <div className="relative w-32 h-px bg-line/60 overflow-hidden">
            <span className="absolute top-0 left-0 h-px w-12 bg-accent brand-loader-sweep" />
          </div>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      title={isSignin ? t("lp.auth.signin.title") : t("lp.auth.title")}
      em={isSignin ? t("lp.auth.signin.titleEm") : t("lp.auth.titleEm")}
      lead={isSignin ? t("lp.auth.signin.lead") : t("lp.auth.lead")}
      onPage={onPage}
    >
      {/* CONSENT SITS ABOVE THE ACTION IT GATES.
          It used to render after the Continue button, so a teacher met a
          button that looked pressable, did nothing, and explained nothing,
          with the checkbox that unlocked it further down the page. Markup
          move only: the same state, the same handlers, the same validation.
 */}
      {/* Legal acceptance block — sign-up only. Returning users already
          accepted when they subscribed; that consent record lives on
          the account row server-side. Re-asking adds friction with no
          legal value. */}
      {!isSignin && (
        <div
          ref={termsRef}
          className={`max-w-sm mx-auto mt-6 rounded-xl transition-shadow ${
            tried && !accepted
              ? "p-3 -m-3 ring-2 ring-[color:var(--clay,#b3442b)] ring-offset-2 ring-offset-[color:var(--paper)] murchid-terms-pulse"
              : ""
          }`}
        >
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
      <div className={`space-y-3 max-w-sm mx-auto transition-opacity ${accepted ? "opacity-100" : "opacity-90"}`}>
        {emailMode === "entering" && (
          <div className="space-y-3">
            {/* No hint line here. It repeated the lead directly above it,
                and the password rules already appear inline the moment a
                weak one is typed — telling somebody the rules before they
                have typed anything spends a line to say nothing. */}
            <div>
              {/* A real <label>, not a placeholder doing its job: a
                  placeholder disappears the moment you type, so anyone
                  who looks away loses what the field was for, and screen
                  readers may never announce it at all. */}
              <label htmlFor="auth-email" className="block text-start text-xs mb-1.5 ps-1 text-muted">
                {t("lp.auth.emailLabel")}
              </label>
              <input
                id="auth-email"
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
              <label htmlFor="auth-password" className="block text-start text-xs mb-1.5 ps-1 text-muted">
                {t("lp.auth.passwordLabel")}
              </label>
              <div className="relative">
                <input
                  id="auth-password"
                  type={showPassword ? "text" : "password"}
                  // "current-password": the page leads with sign-in, and a
                  // manager offering to FILL beats one offering to generate
                  // for the majority who already have an account.
                  autoComplete="current-password"
                  value={passwordValue}
                  onChange={(e) => setPasswordValue(e.target.value)}
                  onBlur={() => setPasswordTouched(true)}
                  onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleEmailPassword(); } }}
                  placeholder="Your password"
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
            {/* No confirm-password field. This page cannot know whether it
                is creating an account until the call comes back, so a
                second box would be put in front of returning teachers
                too. The show/hide toggle above catches the typo it used
                to catch, without the extra field. */}
            <ProviderButton
              icon={<EmailMark />}
              label={emailSending ? t("lp.auth.working") : t("lp.auth.continue")}
              onClick={handleEmailPassword}
              disabled={!accepted || emailSending || !!emailError || !!passwordError}
            />

            {/* Alternatives, plainly secondary. The rule is "one primary
                action per screen": email is it, and a divider says the
                rest are other ways to do the same thing rather than
                competing choices. */}
            <div className="flex items-center gap-3 pt-2" aria-hidden="true">
              <span className="h-px flex-1" style={{ background: "var(--line-strong)", opacity: 0.5 }} />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted">
                {t("lp.auth.or")}
              </span>
              <span className="h-px flex-1" style={{ background: "var(--line-strong)", opacity: 0.5 }} />
            </div>
            <ProviderButton
              icon={<GoogleMark />}
              label={signingIn ? t("portal.opening") : t("lp.auth.google")}
              onClick={() => handleProvider("google")}
              disabled={signingIn || emailSending}
            />
            <ProviderButton
              icon={<LinkedInMark />}
              label={signingIn ? t("portal.opening") : t("lp.auth.linkedin")}
              onClick={() => handleProvider("linkedin")}
              disabled={signingIn || emailSending}
            />
            <ProviderButton
              icon={<OutlookMark />}
              label={t("portal.continueMicrosoft")}
              badge={t("portal.comingSoon")}
              onClick={() => {}}
              disabled
            />
            {/* Sign-in only. A password reset link on a SIGN-UP screen offers
                to recover a password for an account that does not exist. */}
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
              </div>
            )}
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
              <p className="text-sm text-ink font-medium">Enter your 6-digit code.</p>
              {/* "5 minutes" is the server's rule (see handleVerifyCheck:
                  codes live 5 minutes, 5 attempts). This once said
                  "1 minute" — a deadline four times tighter than the real
                  one, panicking teachers for nothing. If the backend TTL
                  changes, change this line with it. */}
              <p className="text-xs text-muted leading-relaxed">
                We emailed a 6-digit verification code to{" "}
                <span className="text-ink">{emailValue}</span>. It expires
                in 5 minutes.
              </p>
            </div>
            {/* Single numeric input styled to look like 6 grouped boxes
                via wide letter-spacing. Cleaner than 6 separate inputs
                that need focus-juggling and paste-distribution code. */}
            <div>
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                pattern="\d{6}"
                maxLength={6}
                autoFocus
                value={verifyCode}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setVerifyCode(v);
                  setVerifyError(null);
                  // Auto-submit the moment the 6th digit lands so the
                  // user doesn't have to reach for a button.
                  if (v.length === 6 && !verifyChecking) {
                    handleVerifyCheck(v);
                  }
                }}
                onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleVerifyCheck(); } }}
                placeholder="• • • • • •"
                className="w-full text-center text-[26px] font-mono py-4 rounded-xl text-ink"
                style={{
                  letterSpacing: "0.45em",
                  background: "var(--paper)",
                  border: `0.5px solid ${verifyError ? "var(--clay, #b3442b)" : "var(--line-strong)"}`,
                  paddingInlineStart: "0.45em", // visual centering with letter-spacing
                }}
                disabled={verifyChecking}
                aria-invalid={verifyError ? "true" : "false"}
                aria-describedby={verifyError ? "verify-error" : undefined}
                dir="ltr"
              />
              {verifyError && (
                <p
                  id="verify-error"
                  role="alert"
                  className="text-xs mt-1.5 ps-1"
                  style={{ color: "var(--clay, #b3442b)" }}
                >
                  {verifyError}
                </p>
              )}
            </div>
            <div className="flex flex-col gap-2 pt-1">
              <ProviderButton
                icon={<EmailMark />}
                label={verifyChecking ? "Checking…" : "Verify & continue"}
                onClick={() => handleVerifyCheck()}
                disabled={verifyChecking || verifyCode.length !== 6}
              />
              <button
                type="button"
                onClick={handleResendVerification}
                className="text-xs text-muted hover:text-ink transition disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={verifyResendCooldown > 0 || verifyChecking}
              >
                {verifyResendCooldown > 0
                  ? `Resend code in ${verifyResendCooldown}s`
                  : "Didn't get it? Resend code"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setPendingVerification(null);
                  setEmailMode("entering");
                  setVerifyError(null);
                  setVerifyCode("");
                }}
                className="text-xs text-muted hover:text-ink transition"
              >
                ← Change email
              </button>
            </div>
            <p className="text-[10.5px] text-muted/80 leading-relaxed">
              Check your spam folder if you don't see the email within a minute.
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
              Click it and pick a new password — it opens Murchid straight away.
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

        {/* `notice` comes from Landing's sign-in handler, which runs after
            this component has handed control away and has no access to
            the state below. Either can be showing; both use one slot so
            two errors can never stack up and push the page into a
            scroll. */}
        {(authError || notice) && emailMode !== "sent" && emailMode !== "reset-sent" && (
          <p role="alert" className="text-xs text-center" style={{ color: "var(--clay, #b3442b)" }}>
            {authError || notice}
          </p>
        )}
      </div>


      {/* No sign-in / sign-up cross-link: there is nowhere else to go.
          One page works out which it is from the credentials given. */}

      {/* The bilingual note moved to the brand panel, where there is room
          for it, rather than costing the form a line it cannot spare. */}
    </AuthShell>
  );
}

// Onboarding — pick a membership. Choosing a plan finalises the mock
// account and drops the teacher straight into the planner.
function OnboardingPage({ onChoosePlan, onPage }) {
  const t = useT();
  const cur = t("lp.plan.aed");
  // Plan provisioning can take several seconds (token refresh + the
  // Supabase inserts + profile patch + per-school attach). Without a
  // visible loading state, users hammer the button and trigger
  // duplicate POSTs. We swallow further clicks once one is in flight,
  // and overlay a BrandLoader so the whole funnel reads as "working".
  const [pickingPlan, setPickingPlan] = useState(null);
  // Which provisioning stage is in flight. Drives SetupOverlay so the
  // teacher sees the sequence advance instead of one frozen line.
  const [setupStage, setSetupStage] = useState("account");
  const choose = async (planId) => {
    if (pickingPlan) return;
    setPickingPlan(planId);
    setSetupStage("account");
    try {
      // The stage setter rides along so the handler (which lives in
      // Landing, a different component) can advance the overlay. It used
      // to call a setSetupStage that was not in its scope — a
      // ReferenceError the moment a teacher picked a plan.
      await onChoosePlan(planId, setSetupStage);
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
        className="lp-trial-sweep group relative mt-5 w-full rounded-[24px] overflow-hidden flex flex-wrap items-center justify-between gap-x-6 gap-y-4 px-7 py-4"
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
          unresponsive page. Portaled to <body> so it escapes the
          landing's transformed scroll-animation ancestors (otherwise
          `fixed` is trapped inside a narrow centered column). Unmounts as
          soon as the studio opens. This is the ONLY loader across the
          boarding → first-launch handoff. */}
      {pickingPlan && <SetupOverlay stage={setupStage} />}
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

function MarketingPage({ page, onSignUp, onProfileDone, onChoosePlan, onPage, onEnterStudio, notice }) {
  const t = useT();
  if (page === "signin" || page === "signup")
    return <AuthPage onSignUp={onSignUp} onPage={onPage} mode={page} onEnterStudio={onEnterStudio} notice={notice} />;
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
// heroVariant selects which cut of the opening act renders. null is what
// ships at "/" — the original card fan. Any other value is a stage-one
// variant id served at /preview1../preview10 and listed at /preview. It
// is threaded rather than branched on the URL so every cut stays
// reachable side by side while the design is being decided.
// onOpenStudio takes WHERE to land, because sign-up and sign-in want
// different rooms. A teacher who has just created an account has nothing
// to look at on a dashboard — no lessons, no scores, no history — so they
// go to the AI Studio, which is the one screen that is useful when empty.
// A returning teacher goes to the dashboard, which is a summary of work
// they have actually done.
export default function Landing({ onOpenStudio, heroVariant = null, initialPage = "home" }) {
  // `initialPage` is how a real route hands this view its starting screen.
  // The funnel used to be reachable only as internal state at "/", which
  // meant the primary CTA never changed the URL and the browser's Back
  // button left the site entirely. The route segments under
  // app/(marketing)/ now own the address; the funnel's own logic is
  // untouched.
  const [page, setPage] = useState(initialPage);
  // Mock auth: an account exists only once a provider was picked AND a
  // plan chosen. Signed-in visitors skip the funnel entirely.
  const account = useAccount();
  const signedIn = !!account;
  const [pendingProvider, setPendingProvider] = useState(null);
  // A message from the sign-in handler back to the auth page. handleSignUp
  // lives HERE, but the field that shows errors lives inside AuthPage, so
  // the text has to travel down as a prop — an earlier version called
  // AuthPage's own setAuthError from this scope and threw ReferenceError
  // the first time a returning-user check failed.
  const [signInNotice, setSignInNotice] = useState(null);
  // Supabase user captured by AuthPage on provider sign-in. Used
  // to pre-fill the onboarding form AND to call /api/auth/supabase
  // once the plan is picked (so the teacher row gets created in our
  // DB before the studio loads).
  const [pendingAuthUser, setPendingAuthUser] = useState(null);

  const goPage = (p) => {
    setPage(p);
    window.scrollTo(0, 0);
  };

  // Email link sign-in completion. If the user lands on the site from a
  // magic link in their inbox, complete the auth and feed the resulting
  // user into the same funnel a Google sign-up takes. Cleans the URL so
  // refreshes don't re-trigger.
  //
  // Detection is by OUR marker only. Supabase magic links come back as
  // "/?completeEmailSignIn=1&code=…" (the marker rides along on the
  // emailRedirectTo we set in sendEmailLink). We deliberately don't key
  // off ?code= alone, because an OAuth return carries that same param and
  // must be handled by the resume effect below instead — matching on code
  // would make the two flows fight over the same page load.
  const [emailLinkCompleting, setEmailLinkCompleting] = useState(() => {
    if (typeof window === "undefined") return false;
    return window.location.href.includes("completeEmailSignIn=1");
  });
  useEffect(() => {
    if (!emailLinkCompleting) return;
    let cancelled = false;
    (async () => {
      try {
        const lib = await import("../lib/supabaseAuth");
        if (!lib.isEmailSignInLink(window.location.href)) {
          // Not actually an email link (just our query marker stale) — bail.
          window.history.replaceState(null, "", window.location.pathname);
          setEmailLinkCompleting(false);
          return;
        }
        const user = await lib.completeEmailLinkSignIn(window.location.href);
        if (cancelled) return;
        // Drop into the existing sign-up funnel exactly like a Google
        // sign-up — handleSignUp reads authUser and stages the
        // profile prefill, then routes to /profile.
        handleSignUp("email", {
          acceptedAt: new Date().toISOString(),
          legalVersion: LEGAL_VERSION,
          authUser: {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            firstName: user.firstName || "",
            lastName: user.lastName || "",
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

  // OAuth redirect return. Picks the sign-up funnel back up after the
  // browser has been to Google / Microsoft and come home.
  //
  // Runs only when handleProvider parked an intent, so a normal visit
  // costs one sessionStorage read. By the time this fires, supabase-js
  // has already exchanged the ?code= in the URL for a session (that's
  // detectSessionInUrl in supabaseClient.ts), so getCurrentUser() is
  // enough — there's no code to redeem here.
  //
  // handleSignUp then routes correctly on its own: it calls
  // /api/auth/claim-session, which 200s for a returning teacher (→
  // straight into the studio) and 404s for a first-time one (→ profile +
  // plan funnel). So both cases land here and neither needs special
  // handling.
  const [oauthResuming, setOauthResuming] = useState(() => {
    if (typeof window === "undefined") return false;
    try { return Boolean(sessionStorage.getItem(PENDING_SIGNUP_KEY)); }
    catch { return false; }
  });
  useEffect(() => {
    if (!oauthResuming) return;
    let cancelled = false;
    (async () => {
      try {
        let intent = null;
        try {
          intent = JSON.parse(sessionStorage.getItem(PENDING_SIGNUP_KEY) || "null");
        } catch { /* corrupt entry — treated as absent */ }
        if (!intent) return;

        const { getCurrentUser } = await import("../lib/supabaseAuth");
        const user = await getCurrentUser();
        if (cancelled) return;

        // No session means the user bounced off the provider without
        // completing (denied consent, hit back). Drop the intent so a
        // later visit doesn't resume a sign-in that never happened.
        if (!user) {
          try { sessionStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* ignore */ }
          return;
        }

        // Clear BEFORE running the funnel: handleSignUp can navigate, and
        // a leftover intent would re-trigger this on the next mount.
        try { sessionStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* ignore */ }

        await handleSignUp(intent.provider, {
          acceptedAt: intent.acceptedAt,
          legalVersion: intent.legalVersion,
          authUser: {
            uid: user.uid,
            email: user.email || "",
            displayName: user.displayName || "",
            firstName: user.firstName || "",
            lastName: user.lastName || "",
            photoURL: user.photoURL || "",
          },
        });
      } catch (e) {
        console.error("[auth/oauth-return]", e);
        try { sessionStorage.removeItem(PENDING_SIGNUP_KEY); } catch { /* ignore */ }
      } finally {
        if (!cancelled) setOauthResuming(false);
      }
    })();
    return () => { cancelled = true; };
  }, [oauthResuming]); // eslint-disable-line react-hooks/exhaustive-deps

  // Silent session-restore on mount. If Supabase still has a valid
  // session (persisted in localStorage and auto-refreshed) but
  // localStorage.murchid.account was cleared — incognito switch, manual
  // clear, new browser profile — call /api/auth/me to bring the account
  // back. After this, signedIn = true and the CTAs route to the studio
  // without making the user click any provider button again.
  useEffect(() => {
    // Also wait out an in-flight OAuth resume: that path provisions the
    // account itself, and both running at once would race on setAccount.
    if (signedIn || emailLinkCompleting || oauthResuming) return;
    let cancelled = false;
    (async () => {
      try {
        const { getIdToken } = await import("../lib/supabaseAuth");
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
            staffId:   me.staff_id   || "",
            email:     me.email      || "",
            avatarUrl: me.avatar_url || "",
          },
          role:     me.role,
          sub_role: me.sub_role || null,
          subscriptionStatus: me.subscription_status,
          subscriptionEndsAt: me.subscription_ends_at,
        });
        if (me.role) setLocalRole(me.role);
      } catch (e) {
        // No session / no teacher row / network error — fall through.
        // The landing CTAs default to the sign-up funnel, which is
        // the right behavior for an unauthenticated visitor.
        //
        // Except for one visitor it is not: an invited student who is
        // already signed in and comes back to "/" has no teacher row, so
        // this lands here and leaves them looking at a marketing page
        // that offers to sign them up. Claim their roster row instead and
        // let the CTAs take them to their own dashboard.
        if (e?.status === 404 && !cancelled) {
          try {
            const linked = await apiFetch("/api/auth/link-student", { method: "POST" });
            if (linked?.linked && !cancelled) {
              const me2 = await apiFetch("/api/auth/me");
              setAccount({
                provider: pendingProvider || "google",
                plan: "trial",
                role: "student",
                profile: {
                  firstName: me2?.first_name || "",
                  lastName:  me2?.last_name  || "",
                  email:     me2?.email      || "",
                  avatarUrl: "",
                },
              });
              setLocalRole("student");
            }
          } catch { /* not a student either — the funnel is right */ }
        }
      }
    })();
    return () => { cancelled = true; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // The single entry action behind every primary CTA: into the planner
  // if subscribed, otherwise into the sign-up funnel.
  const enter = () => (signedIn ? onOpenStudio() : goPage("signup"));
  const handleSignUp = async (provider, payload) => {
    // Clear last attempt's message so a stale "try again" cannot sit over
    // a run that is now succeeding.
    setSignInNotice(null);
    setPendingProvider(provider);
    if (payload?.authUser) {
      setPendingAuthUser(payload.authUser);
      // Pre-fill the onboarding profile with the Google account's
      // name/email/avatar so the teacher doesn't retype what we already
      // know. ProfileForm reads getPendingProfile() on mount.
      // Prefer the parts the provider gave us. Splitting a display name on
      // whitespace guesses wrong for two given names or a compound family
      // name; LinkedIn and Google both send given_name/family_name, so use
      // them and keep the split only as a fallback.
      const [splitFirst, ...splitRest] = (payload.authUser.displayName || "")
        .split(/\s+/)
        .filter(Boolean);
      const existing = getPendingProfile() || {};
      const merged = {
        ...existing,
        firstName: existing.firstName || payload.authUser.firstName || splitFirst || "",
        lastName:  existing.lastName  || payload.authUser.lastName  || splitRest.join(" "),
        email:     existing.email     || payload.authUser.email,
        avatarUrl: existing.avatarUrl || payload.authUser.photoURL,
      };
      try {
        localStorage.setItem("murchid.profile.pending", JSON.stringify(merged));
      } catch { /* ignore */ }

      // Returning-user fast path. If this Supabase user already has an
      // account row on the server, skip the profile + plan funnel and
      // drop them straight into the studio. /api/auth/me returns 200
      // only when a teacher row already exists for the verified token.
      try {
        // Returning user signing in (possibly on a new device): claim the
        // single active session here. This both confirms the teacher row
        // exists (404 → new user → funnel) and kicks any other device.
        const existingAccount = await apiFetch("/api/auth/claim-session", { method: "POST" });
        if (existingAccount && existingAccount.id) {
          if (existingAccount.active_session_id) setSessionId(existingAccount.active_session_id);
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
          // A row already existed, so this is a returning teacher however
          // they got here — even if they came through the sign-up page.
          onOpenStudio("dashboard");
          return;
        }
      } catch (e) {
        // ONLY a 404 means "no teacher row yet", and only a 404 may send
        // someone into onboarding.
        //
        // This used to fall through on every error, which quietly turned
        // any transient failure into "you must be new": a 429 from the
        // auth rate limiter, a 500, a dropped API — all of them dumped a
        // returning teacher back onto "Tell us who you are." and asked
        // for details they had already given. Worse, the funnel then ends
        // at the plan picker, so a rate-limited sign-in could talk
        // somebody into re-picking a plan they already pay for.
        //
        // Anything that is not a 404 is a problem to report, not a
        // reason to doubt the account exists.
        if (e?.status && e.status !== 404) {
          console.warn("[auth] returning-user check failed:", e);
          setSignInNotice(
            e.status === 429
              ? "Too many attempts just now. Wait a minute and try again — your account is fine."
              : "We couldn't reach your account just now. Check your connection and try again."
          );
          return;
        }
      }

      // ── Invited student ───────────────────────────────────────────
      //
      // A 404 means no TEACHER row — it does not mean nobody knows this
      // person. A student whose teacher invited them but whose email
      // never arrived (or who never opened it) signs in here, at the
      // front door, with the same address that is on the roster. Falling
      // through would hand them the teacher funnel and make them one.
      //
      // link_student_account() claims every invited row for the address,
      // so this also works for a student several teachers invited. It is
      // the same call /student makes; the invite email is a convenience,
      // not the mechanism.
      try {
        const linked = await apiFetch("/api/auth/link-student", { method: "POST" });
        if (linked?.linked) {
          const me = await apiFetch("/api/auth/me");
          setAccount({
            provider,
            // A student has no plan and nothing on their surface reads one.
            plan: "trial",
            role: "student",
            profile: {
              firstName: me?.first_name || merged.firstName || "",
              lastName:  me?.last_name  || merged.lastName  || "",
              email:     me?.email      || merged.email     || "",
              avatarUrl: merged.avatarUrl || "",
            },
          });
          setLocalRole("student");
          onOpenStudio("student-dashboard");
          return;
        }
      } catch (e) {
        // Not a student either — carry on into the funnel, which is the
        // right answer for an actual new teacher.
        console.warn("[auth] student link check failed:", e);
      }
    }
    // ── New user ────────────────────────────────────────────────────
    // A social sign-in already told us who they are, so there is nothing
    // to ask before letting them in: create the account on the trial,
    // save what we know in the BACKGROUND, and open the studio. The
    // wizard's remaining questions — subjects, grades, schools — are
    // things the studio prompts for when they first matter, and Settings
    // holds the rest.
    //
    // Email sign-ups still go through the wizard. There we know an
    // address and nothing else, so there is genuinely something to ask.
    const known = getPendingProfile() || {};
    const fastTrack =
      provider !== "email" && !!known.email && !!(known.firstName || known.lastName);

    if (fastTrack) {
      try {
        const row = await apiFetch("/api/auth/supabase", {
          method: "POST",
          body: { plan: "trial" },
        });
        if (row?.active_session_id) setSessionId(row.active_session_id);
        setAccount({
          provider,
          plan: "trial",
          profile: {
            firstName: known.firstName || "",
            lastName: known.lastName || "",
            email: known.email || "",
            avatarUrl: known.avatarUrl || "",
          },
          role: row?.role || "teacher",
          sub_role: row?.sub_role || null,
          subscriptionStatus: row?.subscription_status,
          subscriptionEndsAt: row?.subscription_ends_at,
        });
        if (row?.role) setLocalRole(row.role);

        // Deliberately NOT awaited. Writing the name is not worth making
        // somebody watch a spinner for, and if it fails they are already
        // inside the product with an account — the fields are editable in
        // Settings, and the next save overwrites whatever missed.
        // Everything the provider actually gave us, not just the name.
        // LinkedIn OIDC returns name, email, picture and locale — that is
        // the whole of it, so this is the complete import rather than a
        // first instalment.
        //
        // locale → a teaching language is a guess, but a safe one: it is
        // the language their LinkedIn account is in, it is editable in
        // Settings, and an empty list makes the studio ask on the first
        // lesson instead.
        const langFromLocale = (loc) => {
          const code = String(loc || "").slice(0, 2).toLowerCase();
          return { en: "English", ar: "Arabic", fr: "French", es: "Spanish",
                   tr: "Turkish", ur: "Urdu", hi: "Hindi", ru: "Russian",
                   pt: "Portuguese", de: "German", it: "Italian" }[code] || null;
        };
        const lang = langFromLocale(payload?.authUser?.locale);
        apiFetch("/api/me", {
          method: "PATCH",
          body: {
            first_name: known.firstName || undefined,
            last_name: known.lastName || undefined,
            avatar_url: known.avatarUrl || undefined,
            languages: lang ? [lang] : undefined,
          },
        }).catch((err) => console.warn("[auth] background profile save failed:", err));

        clearPendingProfile();
        onOpenStudio("studio");
        return;
      } catch (err) {
        // Falling through to the wizard is the right failure: it collects
        // the same details by hand and ends at the same bootstrap call.
        console.warn("[auth] fast track failed, falling back to onboarding:", err);
      }
    }

    // Otherwise: collect profile, then plan picker.
    goPage("profile");
  };
  const handleProfileDone = () => {
    goPage("onboarding");
  };
  const handleChoosePlan = async (plan, setSetupStage = () => {}) => {
    const profile = getPendingProfile() || undefined;
    const pendingSchools = getPendingSchools() || [];

    // Bootstrap the teacher row in Postgres FIRST. /api/auth/supabase
    // upserts by auth_uid, logs IP/UA, sets subscription_ends_at
    // based on the picked plan (trial=7d, monthly=30d, quarterly=90d,
    // annual=365d), and returns the canonical row. We only persist the
    // mock account locally AFTER this succeeds — that way a failed
    // bootstrap doesn't leave the UI showing "signed in" with no
    // backing data.
    let teacherRow;
    try {
      teacherRow = await apiFetch("/api/auth/supabase", { method: "POST", body: { plan } });
      // Single-device sign-in: the server just claimed a session for this
      // device — persist it so subsequent requests carry X-Session-Id.
      if (teacherRow?.active_session_id) setSessionId(teacherRow.active_session_id);
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
      setSetupStage("profile");
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
    if (pendingSchools.length > 0) setSetupStage("schools");
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

    // Persist the roster imported during onboarding's CSV step. The rows
    // sat in localStorage because the CSV upload runs before the account
    // exists — this is the only place they reach the database. Straight
    // browser→Supabase inserts (RLS scopes them to this teacher); the
    // API service is not involved. Non-fatal — but not silent: a partial
    // import must not look identical to a complete one, so failed rows
    // are named to the teacher, who can add them from My students.
    const pendingStudents = getPendingStudents() || [];
    if (pendingStudents.length > 0) {
      setSetupStage("students");
      const failed = [];
      for (const st of pendingStudents) {
        try {
          await apiFetch("/api/students", {
            method: "POST",
            body: {
              first_name: st.firstName,
              last_name: st.lastName,
              grade: st.grade || undefined,
              section: st.section || undefined,
              student_id: st.studentId || undefined,
              primary_guardian_email: st.parentEmail || undefined,
            },
          });
        } catch (e) {
          // The name goes to HER, in `failed` below — not to the console.
          // A devtools log is readable by anyone at the machine and gets
          // scraped into error reporters, and these are children.
          console.warn("[import] a student row failed:", e?.message || e);
          failed.push(`${st.firstName || ""} ${st.lastName || ""}`.trim() || "(unnamed row)");
        }
      }
      if (failed.length > 0) {
        // alert() is the app's convention for action failures. Blocking
        // here is deliberate — the next screen is the studio, where an
        // incomplete roster would just look mysteriously short.
        const shown = failed.slice(0, 8).join(", ");
        alert(
          `${failed.length} of ${pendingStudents.length} students couldn't be imported: ` +
          `${shown}${failed.length > 8 ? ", …" : ""}. ` +
          `The rest were added. You can add the missing ones from My students.`,
        );
      }
    }
    clearPendingStudents();
    setPendingAuthUser(null);

    // Final stage. The overlay stays mounted through the handoff — it is
    // unmounted by the route change, not by a timer, so it never clears
    // before the studio is actually on screen.
    setSetupStage("studio");
    // First run: straight into the AI Studio. The dashboard would be empty.
    onOpenStudio("studio");
  };
  // Signs the teacher out of Supabase, drops the local account record,
  // and returns them to the landing home. Both halves matter — leaving
  // the Supabase session intact would let the next /api/* call slip
  // through with a valid token but no UI state to back it up.
  const handleSignOut = async () => {
    try {
      const { signOut } = await import("../lib/supabaseAuth");
      await signOut();
    } catch (e) {
      console.warn("Supabase signOut failed:", e);
    }
    clearSessionId();
    clearAccount();
    // Drop the stored role too, or the next account to sign in on this
    // browser inherits this one's rail — see lib/role.syncRoleFromServer.
    const { clearRole } = await import("../lib/role");
    clearRole();
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

  // Funnel pages = anything the teacher is mid-task on (sign-in,
  // sign-up, profile wizard, plan picker). The editorial marketing
  // nav (01 FEATURES, 02 HOW IT WORKS, …) looks too much like the
  // wizard's own step indicator — teachers read the 01/02/03/04 as
  // "step 1 of 4" and get confused. Swap in a quiet, single-row
  // chrome (logo + back-to-home + LangToggle) for those screens, and
  // drop the long marketing Footer below the funnel content too.
  const FUNNEL_PAGES = new Set(["signin", "signup", "profile", "onboarding"]);
  const isFunnel = FUNNEL_PAGES.has(page);

  return (
    <div className="murchid-landing paper-noise">
      {page === "signup" || page === "signin" ? (
        // The auth screens carry their own lockup and back link inside
        // AuthShell, so a header above them is a SECOND header — it
        // overlapped the back link and shipped two wordmarks in two
        // different type systems. The other funnel stages (profile,
        // onboarding) keep FunnelHeader; only these two own their frame.
        null
      ) : isFunnel ? (
        <FunnelHeader onHome={() => goPage("home")} />
      ) : (
        <Nav onEnter={enter} signedIn={signedIn} onJump={jump} onPage={goPage} onSignOut={handleSignOut} darkHero={page === "home"} />
      )}
      {page === "home" ? (
        <LandingHome onEnter={enter} signedIn={signedIn} heroVariant={heroVariant} />
      ) : (
        <MarketingPage
          page={page}
          onSignUp={handleSignUp}
          onProfileDone={handleProfileDone}
          onChoosePlan={handleChoosePlan}
          onPage={goPage}
          onEnterStudio={onOpenStudio}
          notice={signInNotice}
        />
      )}
      {!isFunnel && (
        <Footer onEnter={enter} signedIn={signedIn} onJump={jump} onPage={goPage} />
      )}
    </div>
  );
}

// Minimal chrome shown while the teacher is mid-funnel. Just the
// wordmark (tappable back to the landing home) and a LangToggle —
// no section indices, no Subscribe CTA, no anchor links that would
// scroll-jump away from the wizard.
function FunnelHeader({ onHome }) {
  return (
    <header className="fixed top-0 left-0 right-0 z-50" style={{ background: "var(--paper)" }}>
      <div className="max-w-[1280px] mx-auto px-6 sm:px-8 h-16 flex items-center justify-between border-b border-line/60">
        <button
          type="button"
          onClick={onHome}
          className="nav-brand inline-flex items-center"
          style={{ color: "var(--ink-2)" }}
          aria-label="Murchid — back to home"
        >
          <MurchidLogo
            className="h-[44px] w-auto"
            style={{ "--murchid-logo-accent": "var(--color-accent)", transform: "translateY(3px)" }}
          />
        </button>
        <LangToggle />
      </div>
    </header>
  );
}
